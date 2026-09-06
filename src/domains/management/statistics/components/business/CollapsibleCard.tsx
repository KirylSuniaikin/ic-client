import React, {useState} from "react";
import {Box, Card, CardContent, Chip, Collapse, IconButton, Typography} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";

type Props = {
    title: string;
    /** Rendered next to the title while collapsed, so the card is worth scanning shut. */
    summary?: React.ReactNode;
    /** Draws attention when something inside needs doing — an unclassified chip, a missing fee. */
    badge?: React.ReactNode;
    defaultExpanded?: boolean;
    children: React.ReactNode;
};

/**
 * One card of the Business tab, collapsed by default.
 *
 * <p>Six full tables on one screen is more than anyone reads at once, so each opens on demand. The
 * summary line matters as much as the collapse: a card that shows nothing while shut forces you to
 * open all six to find the one you wanted, which is the problem restated rather than solved.
 */
export default function CollapsibleCard(
    {title, summary, badge, defaultExpanded = false, children}: Props
): React.JSX.Element {
    const [open, setOpen] = useState<boolean>(defaultExpanded);

    return (
        <Card sx={{borderRadius: 3, boxShadow: 3, mb: 2}}>
            <Box
                onClick={() => setOpen(o => !o)}
                sx={{
                    display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap',
                    px: 2, py: 1.5, cursor: 'pointer',
                    '&:hover': {backgroundColor: '#fbfaf6'},
                }}
            >
                <Typography variant="h6" fontWeight="bold">{title}</Typography>
                {badge}
                {!open && summary && (
                    <Typography variant="body2" sx={{color: '#8a807a', ml: 1}}>
                        {summary}
                    </Typography>
                )}
                <IconButton
                    size="small"
                    aria-label={open ? `Collapse ${title}` : `Expand ${title}`}
                    sx={{
                        ml: 'auto',
                        transform: open ? 'rotate(180deg)' : 'none',
                        transition: 'transform 150ms',
                    }}
                >
                    <ExpandMoreIcon/>
                </IconButton>
            </Box>

            {/* unmountOnExit: five collapsed DataGrids and Tables would otherwise all stay mounted
                and re-render on every refresh of a card nobody is looking at. */}
            <Collapse in={open} unmountOnExit>
                <CardContent sx={{pt: 0}}>{children}</CardContent>
            </Collapse>
        </Card>
    );
}
