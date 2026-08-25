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
    const [fullName, setFullName] = useState<string>(null);
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

                // The claims above are only starting values. They are frozen at the moment this
                // token was issued, and a staff member can now be moved between branches from
                // the Account Manager -- so without this they would keep working against their
                // old branch until the token expired. The token carries no full name at all,
                // which is the other half of what this call is for.
                //
                // Deliberately NOT awaited before clearing isAuthLoading: the app must not hang
                // on a slow or dead network, and the claims are correct in the overwhelming
                // majority of loads. A failure leaves them in place rather than signing anyone
                // out -- callers fall back to the username.
                void refreshIdentityFromServer();
            } catch (error) {
                localStorage.removeItem('jwt_token');
                setBranchId(null);
                setRole(null);
                setUsername(null);
                setFullName(null);
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

    async function refreshIdentityFromServer(): Promise<void> {
        try {
            const me = await getCurrentStaff();
            if (me.branchId) setBranchId(me.branchId);
            setFullName(me.fullName);
        } catch (error) {
            logger.error("Failed to confirm the current identity, keeping the token's claims:", error);
        }
    }

    const logout = () => {
        localStorage.removeItem('jwt_token');
        setBranchId(null);
        setUsername(null);
        setFullName(null);
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

        // The token has no full name, so the freshly-signed-in user would otherwise stay
        // identified by their login until the next reload.
        void refreshIdentityFromServer();
    };

    return (
        <AuthContext.Provider value={{ branchId, username, fullName, userId, role, logout, login, isAuthLoading }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => useContext(AuthContext);
