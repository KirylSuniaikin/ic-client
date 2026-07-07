import { useRef } from "react";
import { Box, Fab } from "@mui/material";
import { useTranslation } from "react-i18next";
import { TextTitle } from "../shared/components/typography";
import { LanguageToggle } from "../shared/components/LanguageToggle";
import { CustomerIconButton } from "../domains/customer-auth/components/CustomerIconButton";
import BranchScheduleHeader from "../domains/schedule/components/BranchScheduleHeader";
import { useScrolledAboveViewport } from "../shared/hooks/useScrolledAboveViewport";
import type { IBranch } from "../domains/management/inventory/types";
import type { WorkingHoursSchedule } from "../shared/api/management";

interface HeroSectionProps {
    isKiosk: boolean;
    branches: IBranch[];
    workingHours: WorkingHoursSchedule | null | undefined;
    // When the customer has an active order the top cluster (branch schedule header +
    // language/account controls) is hidden so the Live-Activity card stands alone.
    hideTopBar?: boolean;
}

export default function HeroSection({ isKiosk, branches, workingHours, hideTopBar = false }: HeroSectionProps): JSX.Element {
    const { t } = useTranslation("home");
    const heroRef = useRef<HTMLDivElement>(null);
    // Hide the branch schedule header once the hero video has scrolled fully above the viewport,
    // so the menu gets the whole screen.
    const heroScrolledAway = useScrolledAboveViewport(heroRef);

    return (
        <Box ref={heroRef} sx={{ position: "relative", width: "100%", height: { xs: "70vh", sm: "70vh", md: "70vh" }, overflow: "hidden", backgroundColor: "#fbfaf6", mb: 0 }}>
            <Box
                component="video"
                src={isKiosk ? "/videos/header_vid_2.mp4" : "/videos/header-vid.mp4"}
                autoPlay muted loop playsInline preload="auto"
                poster="/images/header_poster.jpg"
                aria-hidden="true"
                disablePictureInPicture
                sx={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", objectFit: "cover", zIndex: 0, pointerEvents: "none" }}
            />
            <Box sx={{ position: "absolute", bottom: 0, width: "100%", height: "40%", background: "#fbfaf6", maskImage: "linear-gradient(to top, rgba(0,0,0,1), rgba(0,0,0,0))", WebkitMaskImage: "linear-gradient(to top, rgba(0,0,0,1), rgba(0,0,0,0))", pointerEvents: "none", zIndex: 1 }} />
            {!hideTopBar && !heroScrolledAway && <BranchScheduleHeader branches={branches} workingHours={workingHours} />}
            {!hideTopBar && (
                <Box sx={{ position: "absolute", top: 16, right: 16, zIndex: 2, display: "flex", gap: 1 }}>
                    {/*<Fab size="medium" onClick={() => window.open("https://url-eu.mykeeta.com/4creMhXz", "_blank")} sx={{ p: 0, minHeight: "unset", minWidth: "unset", width: 40, height: 40, borderRadius: "50%", boxShadow: "none" }}>*/}
                    {/*    <Box component="img" src="/keeta-logo.png" alt="Jahez" sx={{ width: "100%", height: "100%", objectFit: "contain", borderRadius: "50%", display: "block", padding: "3px" }} />*/}
                    {/*</Fab>*/}
                    <LanguageToggle />
                    {/* Kiosk is a shared guest tablet in the restaurant — no personal account entry
                        point (and the post-order account proposal is likewise skipped in useCheckout). */}
                    {!isKiosk && <CustomerIconButton />}
                </Box>
            )}
            <Box sx={{ position: "absolute", bottom: 18, left: 0, width: "100%", zIndex: 2, display: "flex", justifyContent: "center", pointerEvents: "none" }}>
                <TextTitle>{t("hero.tagline")}</TextTitle>
            </Box>
        </Box>
    );
}
