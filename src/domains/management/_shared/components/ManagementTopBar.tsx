import * as React from "react";
import { AppBar, Box, IconButton, Toolbar, Typography } from "@mui/material";
import ArrowBackIosNewRoundedIcon from "@mui/icons-material/ArrowBackIosNewRounded";
import { BranchSelectorComponent } from "./BranchSelectorComponent";
import { useBranchSelection } from "../hooks/useBranchSelection";

interface ManagementTopBarProps {
    title: string;
    onBack?: () => void;
    actions?: React.ReactNode;
    branchSelector?: boolean;
}

function BranchSelectorConnected(): React.JSX.Element | null {
    const { branches, selectedBranch, onBranchChange } = useBranchSelection();
    if (!selectedBranch) return null;
    return (
        <BranchSelectorComponent
            branches={branches}
            selectedBranch={selectedBranch}
            onBranchChange={onBranchChange}
        />
    );
}

export function ManagementTopBar({ title, onBack, actions, branchSelector }: ManagementTopBarProps): React.JSX.Element {
    return (
        <AppBar
            elevation={0}
            color="inherit"
            position="sticky"
            sx={{ borderBottom: 1, borderColor: "divider", backgroundColor: "#fbfaf6" }}
        >
            <Toolbar sx={{ gap: 1 }}>
                {onBack && (
                    <IconButton edge="start" onClick={onBack} aria-label="back" size="small">
                        <ArrowBackIosNewRoundedIcon />
                    </IconButton>
                )}

                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                    {title}
                </Typography>

                <Box flex={1} />

                {branchSelector && <BranchSelectorConnected />}
                {actions}
            </Toolbar>
        </AppBar>
    );
}
