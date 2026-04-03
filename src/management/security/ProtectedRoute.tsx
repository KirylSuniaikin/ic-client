import {useAuth} from "./AuthProvider";
import {Navigate, useLocation} from "react-router-dom";
import PizzaLoader from "../../components/loadingAnimations/PizzaLoader.jsx";

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