import React from "react";
import Lottie from "lottie-react";
import pizzaAnimationData from "../../../../assets/animations/pizza-loader.json"
import {Box} from "@mui/material";

// cast is needed because lottie-react expects AnimationConfigWithData['animationData']
// but JSON modules are typed as `unknown` per global.d.ts
const animData = pizzaAnimationData as object;

const PizzaLoader = (): JSX.Element => {
    return (
        <Box style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            backgroundColor: "#fff",
            zIndex: 9999,
        }}>
            <Lottie animationData={animData} loop={true} style={{ width: 200, height: 200 }}/>
        </Box>
    );
};

export default PizzaLoader;
