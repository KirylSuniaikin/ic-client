import {createContext, useContext, useEffect, useState} from "react";
import {jwtDecode} from "jwt-decode";
import {AuthContextType, MyTokenPayload, StaffRoles} from "../types/authTypes";


const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export function AuthProvider ({ children }:{children:React.ReactNode}) {
    const [branchId, setBranchId] = useState<string>(null);
    const [userId, setUserId] = useState<number>(null);
    const [username, setUsername] = useState<string>(null);
    const [role, setRole] = useState<StaffRoles>(null);

    useEffect(() => {
        const token = localStorage.getItem('jwt_token');
        if (token) {
            try {
                const decoded = jwtDecode<MyTokenPayload>(token);

                if (decoded.exp * 1000 < Date.now()) {
                    console.error("Token expired");
                    throw new Error("Token expired");
                }

                setBranchId(decoded.branchId);
                setUsername(decoded.sub);
                setRole(decoded.role);
                setUserId(decoded.userId)
            } catch (error) {
                localStorage.removeItem('jwt_token');
                setBranchId(null);
                setRole(null);
                setUsername(null);
                setUserId(null);
            }
        }
    }, []);

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
        <AuthContext.Provider value={{ branchId, username, userId, role, logout, login }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => useContext(AuthContext);