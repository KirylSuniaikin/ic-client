import {Box} from "@mui/material";
import Lottie from "lottie-react";
import kitchenPhaseAnimationData from "../../../../assets/animations/kitchen_phase_animatiom.json";
import React, {useEffect, useState} from "react";

// cast is needed because lottie-react expects AnimationConfigWithData['animationData']
// but JSON modules are typed as `unknown` per global.d.ts
const animData = kitchenPhaseAnimationData as object;

const KitchenPhaseAnimation = (): JSX.Element => {
    const [isLoaded, setIsLoaded] = useState(false);

    useEffect(() => {
        const timeout = setTimeout(() => setIsLoaded(true), 100);
        return () => clearTimeout(timeout);
    }, []);

    if (!isLoaded) return <></>;

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
                animationData={animData}
                loop
                autoplay
                style={{ width: 280, height: 280 }}
            />
        </Box>
    );
};


export default KitchenPhaseAnimation;
