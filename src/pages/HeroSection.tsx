import { Box, Fab } from "@mui/material";
import { TextTitle } from "../shared/components/typography";

interface HeroSectionProps {
    isKiosk: boolean;
}

export default function HeroSection({ isKiosk }: HeroSectionProps): JSX.Element {
    return (
        <Box sx={{ position: "relative", width: "100%", height: { xs: "70vh", sm: "70vh", md: "70vh" }, overflow: "hidden", backgroundColor: "#fbfaf6", mb: 0 }}>
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
            <Box sx={{ position: "absolute", bottom: 18, left: 0, width: "100%", zIndex: 2, display: "flex", justifyContent: "center", pointerEvents: "none" }}>
                <TextTitle>BETTER THAN YOU THINK</TextTitle>
            </Box>
            <Box sx={{ position: "absolute", top: 16, right: 16, zIndex: 2, display: "flex", gap: 1 }}>
                <Fab size="medium" onClick={() => window.open("https://url-eu.mykeeta.com/4creMhXz", "_blank")} sx={{ p: 0, minHeight: "unset", minWidth: "unset", width: 40, height: 40, borderRadius: "50%", boxShadow: "none" }}>
                    <Box component="img" src="/keeta-logo.png" alt="Jahez" sx={{ width: "100%", height: "100%", objectFit: "contain", borderRadius: "50%", display: "block", padding: "3px" }} />
                </Fab>
            </Box>
        </Box>
    );
}
