import React from "react";
import dayjs from "dayjs";
import { Alert, Box, Button, CircularProgress, TextField } from "@mui/material";
import { EntityPhotoField } from "../../../../shared/components/EntityPhotoField";
import { fetchViolationPhoto } from "../../../../shared/api/management";
import { todayIsoBahrain } from "../../../../shared/utils/timeUtils";
import { BRAND_BUTTON_SX, ROUNDED_FIELD_SX } from "../../_shared/components/roundedSelect";
import { useDisciplineCatalog } from "../hooks/useDisciplineCatalog";
import { useIssueViolation } from "../hooks/useIssueViolation";
import type { IssueResult } from "../hooks/useIssueViolation";
import CatalogPicker from "./CatalogPicker";
import IssuePreview from "./IssuePreview";

export type IssueViolationFormProps = {
    staffId: number;
    canIssueClassD: boolean;
    onIssued: (result: IssueResult) => void;
};

const MAX_COMMENT = 2000;
const DISCOVERY_WINDOW_DAYS = 30;

const IssueViolationForm: React.FC<IssueViolationFormProps> = ({ staffId, canIssueClassD, onIssued }) => {
    const { categories, loading: catalogLoading, error: catalogError } = useDisciplineCatalog();
    const form = useIssueViolation(staffId, onIssued);
    const today = todayIsoBahrain();
    const earliestDiscovery = dayjs(today).subtract(DISCOVERY_WINDOW_DAYS, "day").format("YYYY-MM-DD");

    return (
        <Box data-testid="issue-violation-form">
            {catalogLoading && <CircularProgress size={24} />}
            {catalogError !== null && (
                <Alert severity="error" sx={{ mb: 2 }}>
                    {catalogError}
                </Alert>
            )}
            {categories !== null && (
                <Box sx={{ mb: 2 }}>
                    <CatalogPicker
                        categories={categories}
                        value={form.typeId}
                        onChange={form.setTypeId}
                        canIssueClassD={canIssueClassD}
                    />
                </Box>
            )}

            <TextField
                label="Comment"
                multiline
                minRows={3}
                fullWidth
                value={form.comment}
                onChange={(e) => form.setComment(e.target.value)}
                inputProps={{ maxLength: MAX_COMMENT, "data-testid": "violation-comment" }}
                sx={{ mb: 2, ...ROUNDED_FIELD_SX }}
            />
            <TextField
                label="Discovered on"
                type="date"
                fullWidth
                value={form.discoveredOn}
                onChange={(e) => form.setDiscoveredOn(e.target.value)}
                InputLabelProps={{ shrink: true }}
                inputProps={{ min: earliestDiscovery, max: today, "data-testid": "violation-discovered-on" }}
                sx={{ mb: 2, ...ROUNDED_FIELD_SX }}
            />
            <TextField
                label="Occurred on"
                type="date"
                fullWidth
                value={form.occurredOn}
                onChange={(e) => form.setOccurredOn(e.target.value)}
                InputLabelProps={{ shrink: true }}
                inputProps={{ max: today, "data-testid": "violation-occurred-on" }}
                sx={{ mb: 2, ...ROUNDED_FIELD_SX }}
            />

            <Box sx={{ mb: 2 }}>
                <EntityPhotoField
                    rowKey="new"
                    serverId={null}
                    hasImage={false}
                    pendingImage={form.photo}
                    removeImage={false}
                    onChange={(patch) => form.setPhoto(patch.pendingImage)}
                    fetchImage={fetchViolationPhoto}
                    testIdPrefix="violation-photo"
                    label="violation photo"
                    viewerTitle="Evidence photo"
                />
            </Box>

            {form.previewLoading && <CircularProgress size={20} data-testid="issue-preview-loading" />}
            {form.previewError !== null && (
                <Alert severity="error" sx={{ mb: 2 }} data-testid="issue-preview-error">
                    {form.previewError}
                </Alert>
            )}
            {form.preview !== null && <IssuePreview preview={form.preview} />}
            {form.submitError !== null && (
                <Alert severity="error" sx={{ mb: 2 }} data-testid="issue-submit-error">
                    {form.submitError}
                </Alert>
            )}

            <Button
                fullWidth
                variant="contained"
                disabled={!form.canSubmit}
                onClick={(): void => {
                    void form.submit();
                }}
                sx={BRAND_BUTTON_SX}
                data-testid="issue-violation-submit"
            >
                {form.submitting ? "Recording…" : "Give punishment"}
            </Button>
        </Box>
    );
};

export default IssueViolationForm;
