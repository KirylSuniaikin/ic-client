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
}

export interface IBranch {
    id: number;
    externalId: string;
    branchNo: number;
}

export interface ICreateReport {
    title: string;
    type: ReportType;
    branchNo: number;
    userId: number;
    inventoryProducts: IInventoryProducts[];
}

export interface IInventoryProducts {
    id: number;
    quantity: number;
    finalPrice: number;
}

export interface IEditReport {
    id: number;
    title: string;
    type: ReportType;
    branchNo: number;
    userId: number;
    inventoryProducts: IInventoryProducts[];
}

export interface IUser {
    id: number;
    userName: string;
}

export type ProductTO = {
    id: number;
    name: string;
    price: number;
    isInventory: boolean;
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