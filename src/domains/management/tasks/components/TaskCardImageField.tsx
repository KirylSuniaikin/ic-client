import React from "react";
import { EntityPhotoField, PhotoPatch } from "../../../../shared/components/EntityPhotoField";
import { fetchTaskCardImage } from "../../../../shared/api/management";

type Props = {
    /** Client-side row key — stable across a save, unlike the server id a new card does not have. */
    rowKey: string;
    serverId: number | null;
    hasImage: boolean;
    pendingImage: Blob | null;
    removeImage: boolean;
    onChange: (patch: PhotoPatch) => void;
};

/**
 * Binds the shared photo field to one task card: the task-image endpoints and this drawer's row
 * key. Same component the purchase and accounting tables use — see EntityPhotoField for behaviour.
 */
export function TaskCardImageField({ rowKey, serverId, hasImage, pendingImage, removeImage, onChange }: Props) {
    return (
        <EntityPhotoField
            rowKey={rowKey}
            serverId={serverId}
            hasImage={hasImage}
            pendingImage={pendingImage}
            removeImage={removeImage}
            onChange={onChange}
            fetchImage={fetchTaskCardImage}
            testIdPrefix="task-image"
            label="task photo"
            viewerTitle="Task photo"
        />
    );
}
