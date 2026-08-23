import { logger } from "../../../shared/utils/logger";
import {createContext, useContext, useEffect, useState} from "react";
import {jwtDecode} from "jwt-decode";
import {AuthContextType, MyTokenPayload, StaffRoles} from "../types";
import {getCurrentStaff} from "../../../shared/api/management";


const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export function AuthProvider ({ children }:{children:React.ReactNode}) {
    const [branchId, setBranchId] = useState<string>(null);
    const [userId, setUserId] = useState<number>(null);
    const [username, setUsername] = useState<string>(null);
    const [role, setRole] = useState<StaffRoles>(null);
    const [isAuthLoading, setIsAuthLoading] = useState<boolean>(true);

    useEffect(() => {
        const token = localStorage.getItem('jwt_token');
        if (token) {
            try {
                const decoded = jwtDecode<MyTokenPayload>(token);

                if (decoded.exp * 1000 < Date.now()) {
                    logger.error("Token expired");
                    throw new Error("Token expired");
                }

                setBranchId(decoded.branchId);
                setUsername(decoded.sub);
                setRole(decoded.role);
                setUserId(decoded.userId)

                // The claim above is only a starting value. It is frozen at the moment this
                // token was issued, and a staff member can now be moved between branches from
                // the Account Manager -- so without this they would keep working against their
                // old branch until the token expired.
                //
                // Deliberately NOT awaited before clearing isAuthLoading: the app must not hang
                // on a slow or dead network, and the claim is a correct value in the overwhelming
                // majority of loads. A failure leaves the claim in place rather than signing
                // anyone out.
                void refreshBranchFromServer();
            } catch (error) {
                localStorage.removeItem('jwt_token');
                setBranchId(null);
                setRole(null);
                setUsername(null);
                setUserId(null);
            }
            finally {
                setIsAuthLoading(false);
            }
        }
        else{
            setIsAuthLoading(false);
        }
    }, []);

    async function refreshBranchFromServer(): Promise<void> {
        try {
            const me = await getCurrentStaff();
            if (me.branchId) setBranchId(me.branchId);
        } catch (error) {
            logger.error("Failed to confirm the current branch, keeping the token's claim:", error);
        }
    }

    const logout = () => {
        localStorage.removeItem('jwt_token');
        setBranchId(null);
        setUsername(null);
        setUserId(null);
        setRole(null);
        window.location.href = '/auth';
    };

    const login = (token: string) => {
        localStorage.setItem("jwt_token", token);

        const decoded = jwtDecode<MyTokenPayload>(token);

        setUsername(decoded.sub);
        setBranchId(decoded.branchId);
        setRole(decoded.role);
        setUserId(decoded.userId)
    };

    return (
        <AuthContext.Provider value={{ branchId, username, userId, role, logout, login, isAuthLoading }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => useContext(AuthContext);
