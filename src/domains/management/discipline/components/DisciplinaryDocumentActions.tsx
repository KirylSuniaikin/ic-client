import React, { useState } from "react";
import { Box, Button, Typography } from "@mui/material";
import { Capacitor } from "@capacitor/core";
import {
    downloadDisciplinaryDocument,
    downloadRefusalAct,
    markActionSigned,
    recordRefusal,
} from "../../../../shared/api/management";
import type { PdfDownload } from "../../../../shared/api/management";
import type { StaffAdminTO } from "../../staff/types";
import { formatDate } from "../format";
import type { DisciplinaryActionTO, RefusalActRequest } from "../types";
import { downloadBlob } from "../utils/downloadBlob";
import RefusalActDrawer from "./RefusalActDrawer";

export type DisciplinaryDocumentActionsProps = {
    action: DisciplinaryActionTO;
    employeeId: number;
    roster: ReadonlyArray<StaffAdminTO>;
    onChanged: () => void;
};

const DisciplinaryDocumentActions: React.FC<DisciplinaryDocumentActionsProps> = ({
    action, employeeId, roster, onChanged,
}) => {
    const [busy, setBusy] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [refusalOpen, setRefusalOpen] = useState<boolean>(false);

    if (!action.documentAvailable) return null;

    const signed = action.signedAt !== null;
    const refused = action.refusalRecordedAt !== null;
    // A blob download is a silent no-op in the APK WebView, so the buttons are hidden there.
    const canDownload = !Capacitor.isNativePlatform();

    const run = async (work: () => Promise<void>): Promise<void> => {
        setBusy(true);
        setError(null);
        try {
            await work();
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : "Something went wrong");
        } finally {
            setBusy(false);
        }
    };

    const download = (fetchPdf: (id: number) => Promise<PdfDownload>): Promise<void> =>
        run(async () => {
            const { blob, filename } = await fetchPdf(action.id);
            downloadBlob(blob, filename);
        });

    const sign = (): Promise<void> =>
        run(async () => {
            await markActionSigned(action.id);
            onChanged();
        });

    const refuse = async (request: RefusalActRequest): Promise<void> => {
        await recordRefusal(action.id, request);
        onChanged();
    };

    return (
        <Box sx={{ mt: 1 }} data-testid={`document-actions-${action.id}`}>
            {action.signedAt !== null && (
                <Typography variant="body2">
                    {`Signed on ${formatDate(action.signedAt)} (recorded by ${action.signedRecordedByName ?? ""})`}
                </Typography>
            )}
            {action.refusalRecordedAt !== null && (
                <Typography variant="body2">
                    {`Refusal recorded on ${formatDate(action.refusalRecordedAt)}`}
                </Typography>
            )}
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mt: 0.5 }}>
                {canDownload && (
                    <Button size="small" disabled={busy} onClick={() => void download(downloadDisciplinaryDocument)}>
                        Download document
                    </Button>
                )}
                {!signed && !refused && (
                    <>
                        <Button size="small" disabled={busy} onClick={() => void sign()}>Mark signed</Button>
                        <Button size="small" disabled={busy} onClick={() => setRefusalOpen(true)}>
                            Record refusal
                        </Button>
                    </>
                )}
                {refused && canDownload && (
                    <Button size="small" disabled={busy} onClick={() => void download(downloadRefusalAct)}>
                        Download refusal act
                    </Button>
                )}
            </Box>
            {error !== null && (
                <Typography role="alert" variant="body2" color="error" sx={{ mt: 0.5 }}>
                    {error}
                </Typography>
            )}
            <RefusalActDrawer
                open={refusalOpen}
                employeeId={employeeId}
                roster={roster}
                onSubmit={refuse}
                onClose={() => setRefusalOpen(false)}
            />
        </Box>
    );
};

export default DisciplinaryDocumentActions;
