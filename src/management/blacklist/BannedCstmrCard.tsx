import {BlackListCstmr} from "../types/blacklistTypes";
import {Button, Card, CardHeader, Typography} from "@mui/material";

type Props = {
    customer: BlackListCstmr
    onDeleteClick: (telephoneNo: string) => void
}

const BRAND = "#E44B4C";

export default function BannedCstmrCard({ customer , onDeleteClick}: Props) {
    return (

        <Card key={customer.id} variant="outlined" sx={{ borderRadius: 4, borderColor: "snow" }}>
            <CardHeader
                title={
                    <Typography variant="h6" sx={{ fontWeight: 700 }}>
                        +{customer.telephoneNo}
                    </Typography>
                }
                action={
                    <Button
                        size="small"
                        variant="outlined"
                        onClick={() => onDeleteClick(customer.telephoneNo)}
                        sx={{
                            borderRadius: 4,
                            borderWidth: 1,
                            textTransform: "none",
                            fontWeight: 700,
                            px: 2,
                            borderColor: BRAND,
                            color: BRAND,
                            "&:hover": { borderColor: BRAND, backgroundColor: `${BRAND}14` },
                        }}
                    >
                        Delete
                    </Button>
                }
                sx={{
                    alignItems: "center",
                    "& .MuiCardHeader-action": { alignSelf: "center" },
                }}
            />
        </Card>

    )
}