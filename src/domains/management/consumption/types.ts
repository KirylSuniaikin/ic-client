export type ConsumptionReportTO = {
    id: number;
    title: string;
    branchNo: number
    userId: number;
    finalPrice: number;
    consumptionProducts: ConsumptionProductTO[]
}

export type ConsumptionProductTO = {
    productName: string;
    quantity: number;
    finalPrice: number;
}
