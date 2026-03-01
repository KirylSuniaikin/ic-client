import {useAuth} from "./AuthProvider";
import {Navigate, useLocation} from "react-router-dom";

export function ProtectedRoute({children}: {children: JSX.Element}) {
    const { branchId } = useAuth();
    const location = useLocation();

    if(!branchId){
        return <Navigate to={`/auth`} state={{from: location}} replace/>
    }

    return children;
}