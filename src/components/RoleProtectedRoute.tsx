import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "./auth-provider";
import { Loader2 } from "lucide-react";

interface RoleProtectedRouteProps {
    allowedRoles: string[];
}

export const RoleProtectedRoute = ({ allowedRoles }: RoleProtectedRouteProps) => {
    const { user, isAuthenticated, isLoading } = useAuth();

    if (isLoading) {
        return (
            <div className="h-screen w-full flex items-center justify-center bg-background">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    if (!isAuthenticated || !user) {
        return <Navigate to="/" replace />;
    }

    if (!allowedRoles.includes(user.role)) {
        return <Navigate to="/dashboard" replace />; // Redirect to dashboard if unauthorized
    }

    return <Outlet />;
};
