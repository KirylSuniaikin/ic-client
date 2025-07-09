import {useEffect, useState} from "react";
import {Typography} from "@mui/material";


const colorRed = '#E44B4C';

function StatisticsComponent({isOpen, onClose}) {

    useEffect(() => {
        // async function initialize() {
        //     try {
        //         setLoading(true);
        //         const response = await getHistory();
        //         setOrders(response.orders);
        //     } catch (err) {
        //         setError(err.message);
        //     } finally {
        //         setLoading(false);
        //     }
        // }
        //
        // initialize();
    }, []);


    return (
        <Typography>Statiscics</Typography>
    )
}

export default StatisticsComponent;