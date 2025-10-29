import Decimal from "decimal.js-light";

export type ReportType =
    "INVENTORY"

export interface IManagementResponse {
    id: number;
    type: ReportType;
    title: string;
    createdAt: string;
    branchNo: number;
    userName: string;
    finalPrice: number;
}

export interface IBranch {
    id: number;
    externalId: string;
    branchNo: number;
    branchName: string;
}

export interface IUser {
    id: number;
    userName: string;
}

export type ProductTO = {
    id: number;
    name: string;
    targetPrice: number;
    price: number;
    isInventory: boolean;
    isPurchasable: boolean;
    isBundle: boolean;
    topVendor: string;
}

export type ReportInventoryProductDTO = {
    product: ProductTO;
    quantity: number;
    finalPrice: number;
};

export type ReportTO = {
    id: number;
    title: string;
    branchNo: number;
    userId: number;
    finalPrice: number;
    inventoryProducts: ReportInventoryProductDTO[];
}

export type ReportLineTO = {
    productId: number;
    name: string;
    quantity: number;
    finalPrice: number;
}

export type InventoryRow = {
    productId: number;
    name: string;
    quantity: Decimal;
    finalPrice: Decimal;
    price: Decimal;
    isInventory: boolean;
}