import {
    Warehouse,
    LayoutDashboard,
    Package,
    ClipboardList,
    Truck,
    Users,
    BarChart3,
    LogOut,
    MapPin,
    ShoppingCart,
    ScanBarcode,
    FileCheck,
    Repeat,
} from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { NavLink } from "@/components/NavLink";
import {
    Sidebar,
    SidebarContent,
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarFooter,
    SidebarHeader,
} from "@/components/ui/sidebar";

const mainNav = [
    { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
    { title: "Worker Dashboard", url: "/dashboard/worker", icon: LayoutDashboard },
    { title: "GRN Dashboard", url: "/dashboard/grn-dashboard", icon: LayoutDashboard },
    { title: "Completed Work", url: "/dashboard/worker/completed", icon: FileCheck },
    { title: "ASNs", url: "/dashboard/asns", icon: FileCheck },
    { title: "Inbounds", url: "/dashboard/purchase-orders", icon: ClipboardList },
    { title: "Putaway Tasks", url: "/dashboard/putaway-tasks", icon: MapPin },
    { title: "Inventory", url: "/dashboard/inventory", icon: Warehouse },
    { title: "Replenishment Tasks", url: "/dashboard/replenishment-tasks", icon: Repeat },
    { title: "Sales Orders", url: "/dashboard/sales-orders", icon: ShoppingCart },
    { title: "Picking Tasks", url: "/dashboard/picking-tasks", icon: Package },
    { title: "Completed Picking Tasks", url: "/dashboard/completed-picking-tasks", icon: FileCheck },
    { title: "Packing Tasks", url: "/dashboard/packing", icon: Package },
    { title: "Shipments", url: "/dashboard/shipments", icon: Truck },
    { title: "Supplier Management", url: "/dashboard/supplier-management", icon: Users },
    { title: "Warehouse Management", url: "/dashboard/warehouse-management", icon: Warehouse },
    { title: "SKU Management", url: "/dashboard/sku-management", icon: ScanBarcode },
    { title: "Trolley Management", url: "/dashboard/trolleys", icon: Package },
    { title: "Reports", url: "/dashboard/reports", icon: BarChart3 },
];

const secondaryNav = [
    { title: "Users", url: "/dashboard/users", icon: Users },
];

export function AppSidebar() {
    const { logout, user } = useAuth();
    const normalizedRole = String(user?.role ?? "").toLowerCase();
    const isPacker = normalizedRole === "packer";

    // Filter navigation based on role
    const filteredMainNav = mainNav.filter((item) => {
        const role = normalizedRole;

        if (role === "packer") {
            return item.title === "Picking Tasks";
        }

        if (item.title === "Dashboard" && (role === "putaway worker" || role === "picker")) {
            return false;
        }

        if (item.title === "Worker Dashboard" || item.title === "Completed Work") {
            if (role !== "putaway worker") return false;
        }

        if (item.title === "GRN Dashboard" && role !== "grn manager") {
            return false;
        }

        if (role === "grn manager") {
            return item.title === "GRN Dashboard" || item.title === "Inbounds";
        }

        if (role === "inspection worker") {
            return item.title === "Inbounds";
        }

        if (role === "putaway worker") {
            return item.title === "Worker Dashboard" || item.title === "Completed Work";
        }

        if (role === "replenishment worker") {
            return item.title === "Replenishment Tasks";
        }

        if (item.title === "Putaway Tasks" && role !== "putaway worker" && role !== "admin" && role !== "general manager") {
            return false;
        }

        if (role === "picker") {
            return item.title === "Picking Tasks" || item.title === "Completed Picking Tasks";
        }

        if (item.title === "Completed Picking Tasks" && role !== "picker") {
            return false;
        }

        if (item.title === "Picking Tasks" && role !== "picker" && role !== "admin" && role !== "general manager") {
            return false;
        }

        if (item.title === "Replenishment Tasks" && role !== "replenishment worker" && role !== "admin" && role !== "general manager") {
            return false;
        }

        if (item.title === "Trolley Management" && role !== "admin") {
            return false;
        }

        return true;
    });

    const filteredSecondaryNav = secondaryNav.filter((item) => {
        if (item.title === "Users" && user?.role !== "admin") {
            return false;
        }
        return true;
    });

    return (
        <Sidebar className="border-r border-border" collapsible="icon">
            <SidebarHeader className="p-4">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center">
                        <Warehouse className="w-5 h-5 text-primary-foreground" />
                    </div>
                    <div className="group-data-[collapsible=icon]:hidden">
                        <h2 className="font-heading font-bold text-sm text-foreground leading-none">
                            WareHouse
                        </h2>
                        <p className="text-muted-foreground text-xs mt-0.5">
                            {user?.role === "admin" ? "WMS Admin" : user?.username}
                        </p>
                    </div>
                </div>
            </SidebarHeader>

            <SidebarContent>
                <SidebarGroup>
                    <SidebarGroupLabel>Main</SidebarGroupLabel>
                    <SidebarGroupContent>
                        <SidebarMenu>
                            {filteredMainNav.map((item) => (
                                <SidebarMenuItem key={item.title}>
                                    <SidebarMenuButton asChild>
                                        <NavLink
                                            to={isPacker && item.title === "Picking Tasks" ? "/dashboard/packing" : item.url}
                                            end
                                            className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-muted-foreground hover:bg-primary/10 hover:text-foreground transition-colors"
                                            activeClassName="bg-primary/10 text-primary font-medium"
                                        >
                                            <item.icon className="w-4 h-4" />
                                            <span>{item.title}</span>
                                        </NavLink>
                                    </SidebarMenuButton>
                                </SidebarMenuItem>
                            ))}
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>

                {filteredSecondaryNav.length > 0 && (
                    <SidebarGroup>
                        <SidebarGroupLabel>System</SidebarGroupLabel>
                        <SidebarGroupContent>
                            <SidebarMenu>
                                {filteredSecondaryNav.map((item) => (
                                    <SidebarMenuItem key={item.title}>
                                        <SidebarMenuButton asChild>
                                            <NavLink
                                                to={item.url}
                                                end
                                                className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-muted-foreground hover:bg-primary/10 hover:text-foreground transition-colors"
                                                activeClassName="bg-primary/10 text-primary font-medium"
                                            >
                                                <item.icon className="w-4 h-4" />
                                                <span>{item.title}</span>
                                            </NavLink>
                                        </SidebarMenuButton>
                                    </SidebarMenuItem>
                                ))}
                            </SidebarMenu>
                        </SidebarGroupContent>
                    </SidebarGroup>
                )}
            </SidebarContent>

            <SidebarFooter className="p-4 border-t border-border">
                <button
                    onClick={logout}
                    className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-muted-foreground hover:bg-primary/10 hover:text-destructive transition-colors w-full"
                >
                    <LogOut className="w-4 h-4" />
                    <span className="group-data-[collapsible=icon]:hidden">Logout</span>
                </button>
            </SidebarFooter>
        </Sidebar>
    );
}
