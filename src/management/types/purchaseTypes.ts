import {ProductTO} from "./inventoryTypes";

export type BasePurchaseResponse = {
    id: number;
    title: string;
    finalPrice: number;
    createdAt: string
}

export type VendorTO = {
    id: number;
    vendorName: string;
}

export type PurchaseProductTO = {
    product: ProductTO;
    quantity: number;
    finalPrice: number;
    price: number;
    vendorName: string;
    purchaseDate: string
}

export type PurchaseTO = {
    id: number;
    title: string;
    finalPrice: number;
    userId: number;
    purchaseDate: string;
    purchaseProducts: PurchaseProductTO[];
}

export type CreatePurchasePayload = {
    title: string;
    finalPrice: number;
    userId: number;
    purchaseDate: string;
    branchNo: number;
    purchaseProducts: {
        id: number;
        quantity: number;
        finalPrice: number;
        price: number;
        vendorName: string;
    }[];
}

export type EditPurchasePayload = CreatePurchasePayload & { id: number };

export type PurchaseRow = {
    id: string;
    purchaseDate: string;
    productId: number | null;
    price: number;
    quantity: number;
    finalPrice: number;
    vendorName: string | null;
};





