import {Button} from "@mui/material";

type Props = {
    onClick: () => void;
    stage: string;
    getStage: (stage: string) => string;
}

const colorRed = '#E44B4C';

export function ShiftButton({onClick, stage, getStage}: Props) {
    return (
        <Button
            onClick={onClick}
            variant="outlined"
            size="small"
            sx={{
                textTransform: "none",
                borderRadius: "999px",
                fontWeight: 500,
                fontSize: "0.8rem",
                px: 2,
                height: "40px",
                py: 0.5,
                color: colorRed,
                borderColor: colorRed,
                '&:hover': {
                    backgroundColor: "#fff5f5",
                    borderColor: colorRed,
                },
            }}
        >
            {getStage(stage)}
        </Button>
    )
}