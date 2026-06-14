import {useAuth} from "../context/AuthProvider";
import {Navigate, useLocation} from "react-router-dom";
import PizzaLoader from "../../order-status/components/animations/PizzaLoader";

export function ProtectedRoute({children}: {children: JSX.Element}) {
    const { branchId, isAuthLoading } = useAuth();
    const location = useLocation();

    if(isAuthLoading) {
        return <PizzaLoader/>
    }

    if(!branchId){
        return <Navigate to={`/auth`} state={{from: location}} replace/>
    }

    return children;
}
