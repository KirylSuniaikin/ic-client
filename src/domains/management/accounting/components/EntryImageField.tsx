import React from "react";
import { EntityPhotoField, PhotoPatch } from "../../../../shared/components/EntityPhotoField";
import { fetchAccountingEntryImage } from "../../../../shared/api/management";

type Props = {
    /** Client-side row key — stable across a save, unlike the server id a new row does not have. */
    rowKey: string;
    serverId: number | null;
    hasImage: boolean;
    pendingImage: Blob | null;
    removeImage: boolean;
    onChange: (patch: PhotoPatch) => void;
};

/**
 * Binds the shared photo field to one accounting entry: the accounting image endpoints and this
 * table's row key. Same component the purchase table uses — see EntityPhotoField for behaviour.
 */
export function EntryImageField({ rowKey, serverId, hasImage, pendingImage, removeImage, onChange }: Props) {
    return (
        <EntityPhotoField
            rowKey={rowKey}
            serverId={serverId}
            hasImage={hasImage}
            pendingImage={pendingImage}
            removeImage={removeImage}
            onChange={onChange}
            fetchImage={fetchAccountingEntryImage}
            testIdPrefix="entry-image"
            label="entry photo"
            viewerTitle="Entry photo"
        />
    );
}
