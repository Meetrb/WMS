import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "./auth-provider";
import { Loader2 } from "lucide-react";

export const ProtectedRoute = () => {
    const { isAuthenticated, isLoading } = useAuth();

    if (isLoading) {
        return (
            <div className="h-screen w-full flex items-center justify-center bg-background">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    if (!isAuthenticated) {
        return <Navigate to="/" replace />;
    }
    return <Outlet />;
};
