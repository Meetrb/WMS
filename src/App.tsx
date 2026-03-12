import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";

import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider } from "@/components/auth-provider";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { RoleProtectedRoute } from "@/components/RoleProtectedRoute";
import Dashboard from "./pages/Dashboard";
import WorkerDashboard from "./pages/WorkerDashboard";
import PurchaseOrders from "./pages/PurchaseOrders";
import PutawayTasks from "./pages/PutawayTasks";
import PickingTasks from "./pages/PickingTasks";
import SalesOrders from "./pages/SalesOrders";
import Users from "./pages/Users";
import Settings from "./pages/Settings";
import Notifications from "./pages/Notifications";

import Account from "./pages/Account";
import Inventory from "./pages/Inventory";
import Reports from "./pages/Reports";
import Shipments from "./pages/Shipments";
import SkuManagement from "./pages/SkuManagement";
import Asns from "./pages/Asns";
import CreateAsn from "./pages/CreateAsn";
import WarehouseManagement from "./pages/WarehouseManagement";

import DashboardLayout from "./layouts/DashboardLayout";

import { useAuth } from "@/components/auth-provider";

const DashboardHome = () => {
  const { user } = useAuth();

  if (user?.role === 'putaway_worker') {
    return <Navigate to="/dashboard/worker" replace />;
  }

  if (user?.role === 'picker') {
    return <Navigate to="/dashboard/picking-tasks" replace />;
  }

  return <Dashboard />;
};

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/login" element={<Index />} />
              <Route path="/unauthorized" element={<NotFound />} />
              <Route element={<ProtectedRoute />}>
                <Route path="/dashboard" element={<DashboardLayout />}>
                  <Route index element={<DashboardHome />} />
                  <Route path="purchase-orders" element={<PurchaseOrders />} />

                  <Route element={<RoleProtectedRoute allowedRoles={['putaway_worker']} />}>
                    <Route path="worker" element={<WorkerDashboard />} />
                  </Route>

                  <Route element={<RoleProtectedRoute allowedRoles={['putaway_worker', 'admin', 'manager']} />}>
                    <Route path="putaway" element={<PutawayTasks />} />
                    <Route path="putaway-tasks" element={<PutawayTasks />} />
                  </Route>


                  <Route element={<RoleProtectedRoute allowedRoles={['picker', 'admin', 'manager']} />}>
                    <Route path="picking" element={<PickingTasks />} />
                    <Route path="picking-tasks" element={<PickingTasks />} />
                  </Route>

                  <Route element={<RoleProtectedRoute allowedRoles={['admin', 'manager']} />}>
                    <Route path="sales-orders" element={<SalesOrders />} />
                    <Route path="warehouse-management" element={<WarehouseManagement />} />
                    <Route path="inventory" element={<Inventory />} />
                    <Route path="reports" element={<Reports />} />
                    <Route path="shipments" element={<Shipments />} />
                    <Route path="sku-management" element={<SkuManagement />} />
                    <Route path="asns" element={<Asns />} />
                    <Route path="asns/create" element={<CreateAsn />} />
                  </Route>

                  <Route element={<RoleProtectedRoute allowedRoles={['admin']} />}>
                    <Route path="users" element={<Users />} />
                  </Route>
                  <Route path="settings" element={<Settings />} />
                  <Route path="notifications" element={<Notifications />} />
                  <Route path="account" element={<Account />} />
                </Route>
              </Route>
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
