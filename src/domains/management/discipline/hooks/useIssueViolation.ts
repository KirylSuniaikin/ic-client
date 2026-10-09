import { useCallback, useEffect, useRef, useState } from "react";
import { issueViolation, previewViolation, uploadViolationPhoto } from "../../../../shared/api/management";
import { todayIsoBahrain } from "../../../../shared/utils/timeUtils";
import type { IssuePreviewTO, IssueViolationRequest, ViolationTO } from "../types";

export type IssueResult = { violation: ViolationTO; photoError: string | null };

export type UseIssueViolationResult = {
    typeId: number | null;
    comment: string;
    discoveredOn: string;
    occurredOn: string;
    photo: Blob | null;
    setTypeId: (id: number) => void;
    setComment: (text: string) => void;
    setDiscoveredOn: (iso: string) => void;
    setOccurredOn: (iso: string) => void;
    setPhoto: (blob: Blob | null) => void;
    preview: IssuePreviewTO | null;
    previewLoading: boolean;
    previewError: string | null;
    submitting: boolean;
    submitError: string | null;
    canSubmit: boolean;
    submit: () => Promise<void>;
};

function messageOf(err: unknown, fallback: string): string {
    return err instanceof Error ? err.message : fallback;
}

export function useIssueViolation(
    staffId: number | null,
    onIssued: (result: IssueResult) => void,
): UseIssueViolationResult {
    const [typeId, setTypeId] = useState<number | null>(null);
    const [comment, setComment] = useState("");
    const [discoveredOn, setDiscoveredOn] = useState(todayIsoBahrain);
    const [occurredOn, setOccurredOn] = useState(todayIsoBahrain);
    const [photo, setPhoto] = useState<Blob | null>(null);
    const [preview, setPreview] = useState<IssuePreviewTO | null>(null);
    const [previewLoading, setPreviewLoading] = useState(false);
    const [previewError, setPreviewError] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);

    const trimmed = comment.trim();
    const commentReady = trimmed !== "";

    // The preview must not refetch per keystroke but must still send the latest text.
    const commentRef = useRef(trimmed);
    commentRef.current = trimmed;

    useEffect(() => {
        setPreview(null);
        setPreviewError(null);
        if (staffId === null || typeId === null || !commentReady || occurredOn === "" || discoveredOn === "") {
            setPreviewLoading(false);
            return undefined;
        }
        // Latest wins: a superseded request's result is dropped on cleanup.
        let cancelled = false;
        setPreviewLoading(true);
        previewViolation(staffId, {
            violationTypeId: typeId,
            issuerComment: commentRef.current,
            occurredOn,
            discoveredOn,
        })
            .then((p) => {
                if (!cancelled) setPreview(p);
            })
            .catch((err: unknown) => {
                if (!cancelled) setPreviewError(messageOf(err, "Failed to load preview"));
            })
            .finally(() => {
                if (!cancelled) setPreviewLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [staffId, typeId, commentReady, occurredOn, discoveredOn]);

    const reset = useCallback((): void => {
        setTypeId(null);
        setComment("");
        setDiscoveredOn(todayIsoBahrain());
        setOccurredOn(todayIsoBahrain());
        setPhoto(null);
    }, []);

    const canSubmit =
        staffId !== null &&
        typeId !== null &&
        commentReady &&
        preview !== null &&
        !previewLoading &&
        previewError === null &&
        !submitting;

    const submit = async (): Promise<void> => {
        if (!canSubmit || staffId === null || typeId === null) return;
        const request: IssueViolationRequest = {
            violationTypeId: typeId,
            issuerComment: trimmed,
            occurredOn,
            discoveredOn,
        };
        setSubmitting(true);
        setSubmitError(null);
        let violation: ViolationTO;
        try {
            violation = await issueViolation(staffId, request);
        } catch (err) {
            setSubmitError(messageOf(err, "Failed to record violation"));
            setSubmitting(false);
            return;
        }
        // The record exists now: a failed photo must never present as a failed save.
        let photoError: string | null = null;
        if (photo !== null) {
            const [outcome] = await Promise.allSettled([uploadViolationPhoto(violation.id, photo)]);
            if (outcome.status === "rejected") photoError = messageOf(outcome.reason, "Upload failed");
        }
        reset();
        setSubmitting(false);
        onIssued({ violation, photoError });
    };

    return {
        typeId,
        comment,
        discoveredOn,
        occurredOn,
        photo,
        setTypeId,
        setComment,
        setDiscoveredOn,
        setOccurredOn,
        setPhoto,
        preview,
        previewLoading,
        previewError,
        submitting,
        submitError,
        canSubmit,
        submit,
    };
}
