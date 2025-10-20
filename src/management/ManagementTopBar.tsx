import {Box, Stack, Typography} from "@mui/material";


type TopBarProps = {
    title: React.ReactNode;
    right?: React.ReactNode;
    sx?: object;
};

export default function ManagementTopBar({ title, right, sx }: TopBarProps) {
    return (
        <Stack
            direction="row"
            alignItems="center"
            gap={2}
            sx={{ mb: 2, ...sx }}
        >
            <Typography variant="h5" sx={{ fontWeight: 700 }}>
                {title}
            </Typography>
            <Box sx={{ flex: 1 }} />
            {right}
        </Stack>
    );
}