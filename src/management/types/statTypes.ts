export type DoughUsageRow = {
    id: string
    doughType: string;
    monday: number;
    tuesday: number;
    wednesday: number;
    thursday: number;
    friday: number;
    saturday: number;
    sunday: number;
    isTotal?: boolean
}