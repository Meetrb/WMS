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
    { title: "ASNs", url: "/dashboard/asns", icon: FileCheck },
    { title: "Inbounds", url: "/dashboard/purchase-orders", icon: ClipboardList },
    { title: "Sales Orders", url: "/dashboard/sales-orders", icon: ShoppingCart },
    { title: "Inventory", url: "/dashboard/inventory", icon: Warehouse },
    { title: "Shipments", url: "/dashboard/shipments", icon: Truck },
    { title: "Reports", url: "/dashboard/reports", icon: BarChart3 },
    { title: "SKU Management", url: "/dashboard/sku-management", icon: ScanBarcode },
    { title: "Warehouse Management", url: "/dashboard/warehouse-management", icon: Warehouse },
    { title: "Putaway Tasks", url: "/dashboard/putaway-tasks", icon: MapPin },
    { title: "Picking Tasks", url: "/dashboard/picking-tasks", icon: Package },
];

const secondaryNav = [
    { title: "Users", url: "/dashboard/users", icon: Users },
];

export function AppSidebar() {
    const { logout, user } = useAuth();

    // Filter navigation based on role
    const filteredMainNav = mainNav.filter((item) => {
        const role = user?.role;

        if (item.title === "Dashboard" && (role === "putaway_worker" || role === "picker")) {
            return false;
        }

        if (item.title === "Worker Dashboard" && role !== "putaway_worker") {
            return false;
        }

        if (role === "grn_manager") {
            return item.title === "Purchase Orders";
        }

        if (role === "putaway_worker") {
            return item.title === "Worker Dashboard";
        }

        if (item.title === "Putaway Tasks" && role !== "putaway_worker" && role !== "admin" && role !== "manager") {
            return false;
        }

        if (role === "picker") {
            return item.title === "Picking Tasks";
        }

        if (item.title === "Picking Tasks" && role !== "picker" && role !== "admin" && role !== "manager") {
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
                                            to={item.url}
                                            end
                                            className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
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
                                                className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
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
                    className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors w-full"
                >
                    <LogOut className="w-4 h-4" />
                    <span className="group-data-[collapsible=icon]:hidden">Logout</span>
                </button>
            </SidebarFooter>
        </Sidebar>
    );
}
