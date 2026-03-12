import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Search, Bell, User, Settings, LogOut } from "lucide-react";
import { Outlet, Link, useNavigate } from "react-router-dom";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth-provider";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

import { useEffect } from "react";

const DashboardLayout = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        if (user?.role === "grn_manager" && location.pathname === "/dashboard") {
            navigate("/dashboard/purchase-orders");
        }
    }, [user, navigate]);

    const handleLogout = () => {
        logout();
        navigate("/");
    };

    return (
        <SidebarProvider>
            <div className="flex min-h-screen w-full">
                <AppSidebar />
                <main className="flex-1 overflow-auto">
                    {/* Top Bar */}
                    <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm border-b border-border px-6 py-3 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <SidebarTrigger />
                            <div>
                                <h1 className="font-heading text-xl font-bold text-foreground">Dashboard</h1>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="relative hidden sm:block">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                <input
                                    placeholder="Search..."
                                    className="h-9 w-56 pl-9 pr-4 rounded-lg bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                                />
                            </div>
                            <ThemeToggle />

                            <Link to="/dashboard/notifications">
                                <Button variant="ghost" size="icon" className="relative rounded-lg hover:bg-secondary">
                                    <Bell className="w-5 h-5 text-muted-foreground" />
                                    <span className="absolute top-2 right-2 w-2 h-2 bg-primary rounded-full" />
                                </Button>
                            </Link>

                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" className="relative h-9 w-9 rounded-full">
                                        <Avatar className="h-9 w-9">
                                            <AvatarImage src="/placeholder-avatar.jpg" alt={user?.username} />
                                            <AvatarFallback className="bg-primary text-primary-foreground font-heading font-bold">
                                                {user?.username?.charAt(0).toUpperCase()}
                                            </AvatarFallback>
                                        </Avatar>
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent className="w-56" align="end" forceMount>
                                    <DropdownMenuLabel className="font-normal">
                                        <div className="flex flex-col space-y-1">
                                            <p className="text-sm font-medium leading-none">{user?.username}</p>
                                            <p className="text-xs leading-none text-muted-foreground">
                                                {user?.email}
                                            </p>
                                        </div>
                                    </DropdownMenuLabel>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem asChild>
                                        <Link to="/dashboard/account" className="cursor-pointer">
                                            <User className="mr-2 h-4 w-4" />
                                            <span>Account</span>
                                        </Link>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem asChild>
                                        <Link to="/dashboard/settings" className="cursor-pointer">
                                            <Settings className="mr-2 h-4 w-4" />
                                            <span>Settings</span>
                                        </Link>
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-destructive focus:text-destructive">
                                        <LogOut className="mr-2 h-4 w-4" />
                                        <span>Log out</span>
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    </header>

                    {/* Content */}
                    <Outlet />
                </main>
            </div>
        </SidebarProvider>
    );
};

export default DashboardLayout;
