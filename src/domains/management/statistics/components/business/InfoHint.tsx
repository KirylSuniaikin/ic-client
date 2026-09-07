import React from "react";
import {Tooltip} from "@mui/material";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";

type Props = {
    /** The explanation. Kept out of the page body so the report stays an extract, not an essay. */
    text: React.ReactNode;
    /**
     * What this ⓘ is about, e.g. "Profit & loss". Becomes the accessible name: a bare icon with no
     * label is unreachable to a screen reader and indistinguishable from the five others on the
     * page to a test.
     */
    label: string;
};

/**
 * The ⓘ that carries a card's explanation.
 *
 * <p>These notes are worth having — they are the difference between reading a number and trusting
 * it — but as paragraphs above every table they pushed the actual figures off a tablet screen. The
 * point of this tab is a business at a glance; the prose is there for the one time somebody asks
 * "why does this not match".
 *
 * <p>{@code enterTouchDelay}/{@code leaveTouchDelay} are the house idiom (see purchases'
 * {@code HeaderWithInfo}): this is read on tablets, where hover never fires, so without them the
 * tooltip is unreachable and the explanation is simply gone.
 */
export default function InfoHint({text, label}: Props): React.JSX.Element {
    return (
        <Tooltip
            title={text}
            // Without this the tooltip puts its whole paragraph on the icon as an aria-label, which
            // overrides titleAccess and makes the icon's accessible name the essay it is hiding.
            // describeChild makes the text a DESCRIPTION, so the name stays "About <card>".
            describeChild
            arrow
            enterTouchDelay={0}
            leaveTouchDelay={10000}
            slotProps={{tooltip: {sx: {maxWidth: 320, fontSize: 12, lineHeight: 1.5, p: 1.25}}}}
        >
            <InfoOutlinedIcon
                // titleAccess, not aria-label: MUI's SvgIcon sets aria-hidden by default, so a bare
                // aria-label leaves the icon out of the accessibility tree entirely. titleAccess is
                // the prop that clears it and gives the icon a name.
                titleAccess={`About ${label}`}
                tabIndex={0}
                fontSize="small"
                // Stops the click from toggling the card it sits in.
                onClick={e => e.stopPropagation()}
                sx={{color: 'text.disabled', cursor: 'pointer'}}
            />
        </Tooltip>
    );
}
