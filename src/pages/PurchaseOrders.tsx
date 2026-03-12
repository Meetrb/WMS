import { useAuth } from "@/components/auth-provider";
import { POManagementView } from "@/pages/POManagementView";
import { POScannerView } from "@/pages/POScannerView";
import { Navigate } from "react-router-dom";

const PurchaseOrders = () => {
    const { user } = useAuth();
    const role = user?.role;

    if (role === "admin" || role === "manager") {
        return <POManagementView />;
    }

    if (role === "grn_manager") {
        return <POScannerView />;
    }

    // Fallback or unauthorized view
    return <Navigate to="/dashboard" replace />;
};

export default PurchaseOrders;
