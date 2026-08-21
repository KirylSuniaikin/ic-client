import {useAuth} from "../context/AuthProvider";
import {Navigate, useLocation} from "react-router-dom";
import { LoadingIndicator } from "../../../shared/components/LoadingIndicator";

export function ProtectedRoute({children}: {children: JSX.Element}) {
    const { branchId, isAuthLoading } = useAuth();
    const location = useLocation();

    if(isAuthLoading) {
        return <LoadingIndicator minHeight="100dvh" />
    }

    if(!branchId){
        return <Navigate to={`/auth`} state={{from: location}} replace/>
    }

    return children;
}
