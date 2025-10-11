import {Box} from "@mui/material";
import Lottie from "lottie-react";
import kitchenPhaseAnimation from "./kitchen_phase_animatiom.json";
import React, {useEffect, useState} from "react";

const KitchenPhaseAnimation = () => {
    const [isLoaded, setIsLoaded] = useState(false);

    useEffect(() => {
        const timeout = setTimeout(() => setIsLoaded(true), 100);
        return () => clearTimeout(timeout);
    }, []);

    if (!isLoaded) return null;

    return (
        <Box
            sx={{
                position: "fixed",
                top: 0,
                left: 0,
                width: "100vw",
                height: "100vh",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                zIndex: 9999,
            }}
        >
            <Lottie
                animationData={kitchenPhaseAnimation}
                loop
                autoplay
                style={{ width: 280, height: 280 }}
            />
        </Box>
    );
};


export default KitchenPhaseAnimation;