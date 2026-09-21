import {Box, Typography} from '@mui/material';
import type {FaqItem} from '../utils/faq';

// Off until a real design pass: this project's DESIGN.md (colours/shape/elevation/scale) is
// git-ignored and not in every checkout, and per that project's own rule the right move is to
// ask for it rather than guess -- see HomePage.tsx's SeoHead comment for the same reasoning
// on the hidden <h1>. Flip to true once this section has been restyled against DESIGN.md.
// Deliberately unstyled beyond MUI theme defaults (no bespoke colours/spacing) in the
// meantime, so turning it on doesn't look broken even before that pass happens.
export const FAQ_SECTION_VISIBLE = false;

interface FaqSectionProps {
    items: FaqItem[];
}

export function FaqSection({items}: FaqSectionProps): JSX.Element {
    return (
        <Box component="section" sx={{px: 3, py: 4}}>
            <Typography variant="h2" sx={{mb: 2}}>Frequently Asked Questions</Typography>
            {items.map(item => (
                <Box key={item.question} sx={{mb: 2}}>
                    <Typography variant="h3" sx={{mb: 0.5}}>{item.question}</Typography>
                    <Typography variant="body1">{item.answer}</Typography>
                </Box>
            ))}
        </Box>
    );
}
