import React from "react";
import { Avatar, Box, Typography } from "@mui/material";
import type { StaffRoles } from "../../../auth/types";
import { ZONE_STYLE } from "../zone";
import type { DisciplineZone } from "../types";

export type ProfileHeaderProps = {
    name: string;
    role: StaffRoles | null;
    zone: DisciplineZone | null;
    photoUrl?: string | null;
};

function initialsOf(name: string): string {
    const parts = name.trim().split(/[\s._-]+/).filter(Boolean);
    if (parts.length === 0) return "?";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
}

const AVATAR_PX = 112;

const ProfileHeader: React.FC<ProfileHeaderProps> = ({ name, role, zone, photoUrl = null }) => (
    <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", mb: 2 }}>
        <Box sx={{ position: "relative", mb: 3 }}>
            <Avatar
                src={photoUrl ?? undefined}
                alt={name}
                data-testid="profile-avatar"
                sx={{ width: AVATAR_PX, height: AVATAR_PX, fontSize: 36, fontWeight: 700, bgcolor: "grey.200", color: "grey.700" }}
            >
                {initialsOf(name)}
            </Avatar>
            {zone !== null && (
                <Box
                    data-testid="profile-zone-pill"
                    data-zone={zone}
                    sx={{
                        position: "absolute",
                        left: "50%",
                        bottom: -14,
                        transform: "translateX(-50%)",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 0.75,
                        px: 1.5,
                        py: 0.5,
                        borderRadius: 4,
                        bgcolor: "background.paper",
                        boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
                        whiteSpace: "nowrap",
                        fontSize: 13,
                        fontWeight: 600,
                    }}
                >
                    <Box component="span" sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: ZONE_STYLE[zone].bg }} />
                    {ZONE_STYLE[zone].label}
                </Box>
            )}
        </Box>
        <Typography component="h2" sx={{ fontWeight: 800, fontSize: 28, lineHeight: 1.15 }}>{name}</Typography>
        {role !== null && (
            <Typography color="text.secondary" sx={{ textTransform: "capitalize" }}>
                {`${role.replace(/_/g, " ").toLowerCase()} at IC Pizza`}
            </Typography>
        )}
    </Box>
);

export default ProfileHeader;
