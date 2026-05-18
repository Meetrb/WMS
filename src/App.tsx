import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useParams } from "react-router-dom";
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
import PutawayTaskDetails from "./pages/PutawayTaskDetails";
import WorkerCompletedTasks from "./pages/WorkerCompletedTasks";
import PickingTasks from "./pages/PickingTasks";
import PickingTaskDetails from "./pages/PickingTaskDetails";
import CompletedPickingTasks from "./pages/CompletedPickingTasks";
import Packing from "./pages/Packing";
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
import SupplierManagement from "./pages/SupplierManagement";
import ReplenishmentTasks from "./pages/ReplenishmentTasks";
import GrnDashboard from "./pages/GrnDashboard";
import TrolleyManagement from "./pages/TrolleyManagement";
import TrolleyDetail from "./pages/TrolleyDetail";

import DashboardLayout from "./layouts/DashboardLayout";

import { useAuth } from "@/components/auth-provider";
import RequiredFieldAsteriskProvider from "@/components/RequiredFieldAsteriskProvider";
import { useGlobalEnterNavigation } from "@/hooks/useGlobalEnterNavigation";

const DashboardHome = () => {
  const { user } = useAuth();
  const role = String(user?.role ?? "").toLowerCase();

  if (role === 'putaway worker') {
    return <Navigate to="/dashboard/worker" replace />;
  }

  if (role === 'grn manager') {
    return <Navigate to="/dashboard/grn-dashboard" replace />;
  }

  if (role === 'inspection worker') {
    return <Navigate to="/dashboard/purchase-orders" replace />;
  }

  if (role === 'replenishment worker') {
    return <Navigate to="/dashboard/replenishment-tasks" replace />;
  }

  if (role === 'picker') {
    return <Navigate to="/dashboard/picking-tasks" replace />;
  }

  if (role === 'packer') {
    return <Navigate to="/dashboard/packing" replace />;
  }

  return <Dashboard />;
};

const TrolleyDetailRedirect = () => {
  const { trolley_id } = useParams();
  return <Navigate to={`/dashboard/trolleys/${trolley_id}`} replace />;
};

const queryClient = new QueryClient();

const App = () => {
  useGlobalEnterNavigation(true);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
        <AuthProvider>
          <RequiredFieldAsteriskProvider />
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

                  <Route element={<RoleProtectedRoute allowedRoles={['putaway worker', 'picker', 'packer', 'replenishment worker', 'admin', 'General manager']} />}>
                    <Route path="completed-tasks" element={<WorkerCompletedTasks />} />
                  </Route>

                  <Route element={<RoleProtectedRoute allowedRoles={['putaway worker']} />}>
                    <Route path="worker" element={<WorkerDashboard />} />
                    <Route path="worker/completed" element={<WorkerCompletedTasks />} />
                    <Route path="worker/tasks/:taskId" element={<PutawayTaskDetails />} />
                  </Route>

                  <Route element={<RoleProtectedRoute allowedRoles={['grn manager']} />}>
                    <Route path="grn-dashboard" element={<GrnDashboard />} />
                  </Route>

                  <Route element={<RoleProtectedRoute allowedRoles={['putaway worker', 'admin', 'General manager']} />}>
                    <Route path="putaway" element={<PutawayTasks />} />
                    <Route path="putaway/:taskId" element={<PutawayTaskDetails />} />
                    <Route path="putaway-tasks" element={<PutawayTasks />} />
                    <Route path="putaway-tasks/:taskId" element={<PutawayTaskDetails />} />
                  </Route>


                  <Route element={<RoleProtectedRoute allowedRoles={['picker', 'admin', 'General manager']} />}>
                    <Route path="picking" element={<PickingTasks />} />
                    <Route path="picking-tasks" element={<PickingTasks />} />
                    <Route path="picking-tasks/:taskId" element={<PickingTaskDetails />} />
                  </Route>

                  <Route element={<RoleProtectedRoute allowedRoles={['picker']} />}>
                    <Route path="completed-picking-tasks" element={<CompletedPickingTasks />} />
                  </Route>

                  <Route element={<RoleProtectedRoute allowedRoles={['packer', 'admin', 'General manager']} />}>
                    <Route path="packing" element={<Packing />} />
                  </Route>

                  <Route element={<RoleProtectedRoute allowedRoles={['admin', 'General manager']} />}>
                    <Route path="sales-orders" element={<SalesOrders />} />
                    <Route path="supplier-management" element={<SupplierManagement />} />
                    <Route path="warehouse-management" element={<WarehouseManagement />} />
                    <Route path="inventory" element={<Inventory />} />
                    <Route path="reports" element={<Reports />} />
                    <Route path="shipments" element={<Shipments />} />
                    <Route path="sku-management" element={<SkuManagement />} />
                    <Route path="asns" element={<Asns />} />
                    <Route path="asns/create" element={<CreateAsn />} />
                  </Route>

                  <Route element={<RoleProtectedRoute allowedRoles={['admin', 'General manager', 'replenishment worker']} />}>
                    <Route path="replenishment-tasks" element={<ReplenishmentTasks />} />
                  </Route>

                  <Route element={<RoleProtectedRoute allowedRoles={['admin']} />}>
                    <Route path="users" element={<Users />} />
                    <Route path="trolleys" element={<TrolleyManagement />} />
                    <Route path="trolleys/:trolley_id" element={<TrolleyDetail />} />
                  </Route>
                  <Route path="settings" element={<Settings />} />
                  <Route path="notifications" element={<Notifications />} />
                  <Route path="account" element={<Account />} />
                </Route>
              </Route>

              <Route element={<ProtectedRoute />}>
                <Route element={<RoleProtectedRoute allowedRoles={['admin']} />}>
                  <Route path="/trolleys" element={<Navigate to="/dashboard/trolleys" replace />} />
                  <Route path="/trolleys/:trolley_id" element={<TrolleyDetailRedirect />} />
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
};

export default App;
