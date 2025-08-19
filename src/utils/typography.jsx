import {Typography} from "@mui/material";

export function TextTitle({ children, sx = {}, ...props }) {
    return (
        <Typography
            variant="h6"
            sx={{
                // fontWeight: 400,
                fontFamily: "'Baloo Bhaijaan 2', sans-serif",
                fontSize: { xs: "1.5rem", sm: "1.5rem" },
                color: "#0D0D0D",
                ...sx
            }}
            {...props}
        >
            {children}
        </Typography>
    );
}

export function TextGroup({ children, sx = {}, ...props }) {
    return (
        <Typography
            variant="h6"
            sx={{
                fontWeight: 700,
                fontFamily: "'Baloo Bhaijaan 2', sans-serif",
                fontSize: { xs: "1.5rem", sm: "1.5rem" },
                color: "#0D0D0D",
                ...sx
            }}
            {...props}
        >
            {children}
        </Typography>
    );
}

export function TextSecondary({ children, sx = {}, ...props }) {
    return (
        <Typography
            variant="caption"
            sx={{
                fontSize: "1.0rem",
                fontFamily: "'Baloo Bhaijaan 2', sans-serif",
                color: "#6A6A6A",
                lineHeight: "40px",
                display: "-webkit-box",
                WebkitLineClamp: 1,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                ...sx,
            }}
            {...props}
        >
            {children}
        </Typography>
    );
}


export function TextButton({ children, sx = {}, ...props }) {
    return (
        <Typography
            variant="button"
            sx={{
                fontWeight: 600,
                fontFamily: "'Baloo Bhaijaan 2', sans-serif",
                fontSize: "0.85rem",
                textTransform: "uppercase",
                ...sx
            }}
            {...props}
        >
            {children}
        </Typography>
    );
}