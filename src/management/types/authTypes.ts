export type AuthRequest = {
    username: string;
    password: string;
}

export type AuthResponse = {
    token: string
}

export interface MyTokenPayload {
    sub: string;
    branchId: string;
    exp: number;
    userId: number;
    role: StaffRoles
}

export interface AuthContextType {
    branchId: string | null;
    username: string | null;
    userId: number | null;
    role: StaffRoles | null;
    logout: () => void;
    login: (token: string) => void;
}

export enum StaffRoles {
    COOK = "COOK",
    MANAGER = "MANAGER",
    SUPER_MANAGER = "SUPER_MANAGER"
}