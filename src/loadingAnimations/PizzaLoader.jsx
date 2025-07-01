import React from "react";
import Lottie from "lottie-react";
import pizzaAnimation from "./pizza-loader.json"
import {Box} from "@mui/material";

const PizzaLoader = () => {
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
            <Lottie animationData={pizzaAnimation} loop={true} style={{ width: 200, height: 200 }}/>
        </Box>
    );
};

export default PizzaLoader;