import { useAuth } from "@/components/auth-provider";
import { POManagementView } from "@/pages/POManagementView";
import GrnManagerArrived from "@/pages/GrnManagerArrived";
import InspectionQueue from "@/pages/InspectionQueue";
import { Navigate } from "react-router-dom";

const PurchaseOrders = () => {
    const { user } = useAuth();
    const role = String(user?.role ?? "").toLowerCase();

    if (role === "admin" || role === "general manager") {
        return <POManagementView />;
    }

    if (role === "grn manager") {
        return <GrnManagerArrived />;
    }

    if (role === "inspection worker") {
        return <InspectionQueue />;
    }

    // Fallback or unauthorized view
    return <Navigate to="/dashboard" replace />;
};

export default PurchaseOrders;
