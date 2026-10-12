import React, { useState } from "react";
import { Box, Button, TextField, Typography } from "@mui/material";
import { useMyViolationActions } from "../hooks/useMyViolationActions";

export type ExplanationFormProps = {
    violationId: number;
    onDone: () => void;
};

const ExplanationForm: React.FC<ExplanationFormProps> = ({ violationId, onDone }) => {
    const [text, setText] = useState<string>("");
    const { explain, busyIds, error } = useMyViolationActions(onDone);
    const busy = busyIds.has(violationId);
    const trimmed = text.trim();

    return (
        <Box sx={{ mt: 1 }}>
            <TextField
                label="Your explanation"
                value={text}
                onChange={(e) => setText(e.target.value)}
                multiline
                minRows={3}
                fullWidth
                size="small"
                inputProps={{ maxLength: 2000 }}
                helperText="You can submit one explanation within 48 hours. It cannot be changed afterwards."
            />
            {error !== null && (
                <Typography role="alert" variant="body2" color="error" sx={{ mt: 0.5 }}>
                    {error}
                </Typography>
            )}
            <Button
                variant="contained"
                size="small"
                disabled={trimmed === "" || busy}
                onClick={() => void explain(violationId, trimmed)}
                sx={{ mt: 1 }}
            >
                Submit explanation
            </Button>
        </Box>
    );
};

export default ExplanationForm;
