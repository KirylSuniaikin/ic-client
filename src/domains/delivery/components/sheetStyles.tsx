import React from 'react';
import { useTranslation } from 'react-i18next';
import { Box, IconButton, Typography } from '@mui/material';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import type { SxProps, Theme } from '@mui/material';
import { useSheetPresentation } from '../../../shared/components/CustomerSheet';
import type { CustomerSheetDesktop } from '../../../shared/components/CustomerSheet';

/**
 * Shared chrome for the delivery bottom sheets (checkout, address entry, one-last-check).
 *
 * They are three steps of one flow shown back to back, so the tokens live in one place rather
 * than being re-typed per file — that is how they drifted apart in the first place. The language
 * is the storefront's own: warm off-white surfaces, pill buttons, soft cards instead of hairline
 * rules, matching CustomerLoginPopup and the popup convention in ic-client/.claude/CLAUDE.md.
 */

export const BRAND_RED = '#E44B4C';

/** Warm off-white, a shade lighter than the hero's #fbfaf6 so the white cards still read. */
const SHEET_BG = '#fffcf8';

export const SHEET_PAPER_SX: SxProps<Theme> = {
    borderTopLeftRadius: { xs: 20, sm: 28 },
    borderTopRightRadius: { xs: 20, sm: 28 },
    maxWidth: { sm: 500 },
    mx: { sm: 'auto' },
    maxHeight: '90vh',
    backgroundColor: SHEET_BG,
    backgroundImage: 'none', // MUI paints an elevation overlay over bgcolor without this
};

/** The PC form of the three delivery steps: a centred 520px dialog on the same warm paper. */
export const SHEET_DESKTOP = {
    placement: 'center',
    width: 520,
    paperSx: { backgroundColor: SHEET_BG },
} satisfies CustomerSheetDesktop;

/** Groups a step's fields on their own surface, replacing 1px divider rules. */
export const SECTION_CARD_SX: SxProps<Theme> = {
    backgroundColor: '#fff',
    border: '1px solid #f1eae4',
    borderRadius: 4,
    p: 2,
};

export const PRIMARY_BUTTON_SX: SxProps<Theme> = {
    backgroundColor: BRAND_RED,
    color: '#fff',
    textTransform: 'none',
    fontWeight: 700,
    fontSize: '1rem',
    borderRadius: 999,
    py: 1.5,
    width: '100%',
    boxShadow: 'none',
    '&:hover': { backgroundColor: BRAND_RED, boxShadow: 'none', filter: 'brightness(0.94)' },
    '&.Mui-disabled': { backgroundColor: '#e9dedb', color: '#fff' },
};

/** The quiet way out of a sheet — never a second red button competing with the primary one. */
export const SUBTLE_BUTTON_SX: SxProps<Theme> = {
    textTransform: 'none',
    fontWeight: 600,
    borderRadius: 999,
    color: '#8a807a',
    width: '100%',
};

export const OUTLINED_BUTTON_SX: SxProps<Theme> = {
    textTransform: 'none',
    fontWeight: 600,
    borderRadius: 999,
    borderColor: '#f0d7d7',
    color: BRAND_RED,
    backgroundColor: '#fff',
    '&:hover': { borderColor: BRAND_RED, backgroundColor: '#fff7f7' },
};

/** Rounded, white-filled inputs — MUI's default outlined field is the main "dated" tell. */
export const FIELD_SX: SxProps<Theme> = {
    '& .MuiOutlinedInput-root': {
        borderRadius: 3,
        backgroundColor: '#fff',
        '& fieldset': { borderColor: '#ece3dd' },
        '&:hover fieldset': { borderColor: '#e0d3ca' },
        '&.Mui-focused fieldset': { borderColor: BRAND_RED, borderWidth: 1 },
    },
    '& .MuiInputLabel-root.Mui-focused': { color: BRAND_RED },
};

/**
 * Segmented control, matching the one the cart already shows two steps earlier
 * (CartComponent's toggleGroupSx/toggleBtnSx). The grouped-class overrides are not optional:
 * MUI squares off the inner corners of every button in a group, so a plain `borderRadius` on the
 * button leaves the selected pill rounded on one side only.
 */
export const SEGMENTED_GROUP_SX: SxProps<Theme> = {
    backgroundColor: '#f4ede8',
    borderRadius: 3,
    p: '4px',
    width: '100%',
    '& .MuiToggleButtonGroup-grouped': {
        border: 0,
        flex: 1,
        borderRadius: 3,
        mr: '4px',
        '&:not(:last-of-type)': { borderRight: 'none' },
        '&:last-of-type': { mr: 0 },
    },
};

export const SEGMENTED_BUTTON_SX: SxProps<Theme> = {
    textTransform: 'none',
    fontSize: '14px',
    fontWeight: 600,
    color: '#8a807a',
    borderRadius: 3,
    py: 1,
    '&:hover': { backgroundColor: 'transparent' },
    '&.Mui-selected': {
        backgroundColor: '#fff',
        color: BRAND_RED,
        boxShadow: '0 2px 4px rgba(0,0,0,0.12)',
        '&:hover': { backgroundColor: '#fff' },
    },
};

export const SECTION_LABEL_SX: SxProps<Theme> = {
    fontWeight: 700,
    color: '#3b352c',
    mb: 1,
};

/** The grab affordance every sheet in the app carries. */
export function SheetHandle(): JSX.Element | null {
    // A grab handle on a PC dialog or panel promises a drag that does not exist.
    if (useSheetPresentation() !== 'sheet') return null;
    return <Box sx={{ width: 40, height: 4, bgcolor: 'grey.300', borderRadius: 2, mx: 'auto', mb: 2 }} />;
}

/**
 * The PC dialog's visible way out. On a phone the sheet is dismissed by swiping or tapping the
 * page behind it, so it renders nothing there; a centred PC dialog otherwise closes only through
 * Esc or a click outside, which nothing on screen tells the customer about.
 */
export function SheetCloseButton({ onClose }: { onClose: () => void }): JSX.Element | null {
    // The label comes from `branch`, not `checkout`: the mobile app checks `checkout` byte for
    // byte against these files, so a new key there would break its locale-parity test.
    const { t } = useTranslation('branch');
    if (useSheetPresentation() === 'sheet') return null;
    return (
        <IconButton
            aria-label={t('picker.close')}
            onClick={onClose}
            size="small"
            sx={{ position: 'absolute', top: 12, right: 12, color: '#8a807a' }}
        >
            <CloseRoundedIcon />
        </IconButton>
    );
}

/**
 * A message shown in place, not a MUI `Alert` — its icon-plus-slab styling is the loudest thing
 * on these sheets and does not appear anywhere else in the storefront.
 */
export function SheetNotice({ tone, children }: {
    tone: 'error' | 'warning';
    children: React.ReactNode;
}): JSX.Element {
    const palette = tone === 'error'
        ? { bg: '#fdecec', fg: '#b3261e' }
        : { bg: '#fff6e6', fg: '#8a5a00' };
    return (
        <Box role="status" sx={{ backgroundColor: palette.bg, borderRadius: 3, px: 2, py: 1.25 }}>
            <Typography variant="body2" sx={{ color: palette.fg, fontWeight: 600 }}>
                {children}
            </Typography>
        </Box>
    );
}
