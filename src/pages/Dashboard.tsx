import React from "react";
import {
    Package,
    ClipboardList,
    Truck,
    AlertTriangle,
    Users,
    Layers,
    ShoppingCart,
    Clock,
    Activity,
    CheckCircle,
    RefreshCw,
    LayoutDashboard,
    BarChart3,
    WifiOff,
    History,
    FileText
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    AreaChart,
    Area,
    PieChart,
    Pie,
    Cell,
} from "recharts";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { dashboardService } from "@/services/dashboardService";
import { Skeleton } from "@/components/ui/skeleton";

const Dashboard = () => {
    // Queries for all 12 requested endpoints
    const summaryQuery = useQuery({ queryKey: ["dashboard", "summary"], queryFn: dashboardService.getSummary });
    const inventoryAnalyticsQuery = useQuery({ queryKey: ["dashboard", "inventory-analytics"], queryFn: dashboardService.getInventoryAnalytics });
    const utilizationQuery = useQuery({ queryKey: ["dashboard", "warehouse-utilization"], queryFn: dashboardService.getWarehouseUtilization });
    const salesOrdersQuery = useQuery({ queryKey: ["dashboard", "recent-sales-orders"], queryFn: dashboardService.getRecentSalesOrders });
    const asnsQuery = useQuery({ queryKey: ["dashboard", "recent-asns"], queryFn: dashboardService.getRecentAsns });
    const alertsQuery = useQuery({ queryKey: ["dashboard", "alerts"], queryFn: dashboardService.getAlerts });
    const activitiesQuery = useQuery({ queryKey: ["dashboard", "recent-activities"], queryFn: dashboardService.getRecentActivities });
    const lowStockQuery = useQuery({ queryKey: ["dashboard", "low-stock-products"], queryFn: dashboardService.getLowStockProducts });

    // Handle Connection Errors
    if (summaryQuery.isError) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[80vh] p-6 text-center space-y-4">
                <div className="p-4 rounded-full bg-rose-500/10 text-rose-500"><WifiOff className="w-12 h-12" /></div>
                <h1 className="text-2xl font-bold tracking-tight">API Connection Issue</h1>
                <p className="text-muted-foreground max-w-md">We couldn't load the dashboard. This usually happens when the API is unreachable or blocked by security policies.</p>
                <Button onClick={() => window.location.reload()} variant="outline" className="gap-2"><RefreshCw className="w-4 h-4" />Retry</Button>
            </div>
        );
    }

    const formatNum = (val: any) => Number(val ?? 0).toLocaleString();
    const statsData = summaryQuery.data || {} as any;
    
    const stats = [
        { title: "Total SKUs", value: formatNum(statsData.total_skus), change: statsData.sku_change_percent, icon: Layers, color: "text-blue-500", bg: "bg-blue-500/10" },
        { title: "Total Inventory", value: formatNum(statsData.total_inventory), change: statsData.inventory_change_count, icon: Package, color: "text-emerald-500", bg: "bg-emerald-500/10" },
        { title: "Available", value: formatNum(statsData.available_inventory), icon: CheckCircle, color: "text-blue-400", bg: "bg-blue-400/10" },
        { title: "Pending Orders", value: formatNum(statsData.pending_orders), icon: ShoppingCart, color: "text-indigo-500", bg: "bg-indigo-500/10" },
    ];

    const secondaryStats = [
        { title: "Reserved", value: formatNum(statsData.reserved_inventory), icon: Clock, color: "text-amber-500" },
        { title: "Active Shipments", value: formatNum(statsData.active_shipments), icon: Truck, color: "text-sky-500" },
        { title: "Low Stock Items", value: formatNum(statsData.low_stock_count), icon: AlertTriangle, color: "text-rose-500" },
        { title: "Utilization", value: `${statsData.warehouse_utilization ?? 0}%`, icon: Activity, color: "text-indigo-400" },
    ];

    const getStatusColor = (status: string) => {
        const s = status.toLowerCase();
        if (s.includes("pending") || s.includes("waiting")) return "bg-amber-500/10 text-amber-600 border-amber-500/20";
        if (s.includes("ship") || s.includes("transit") || s.includes("progress")) return "bg-blue-500/10 text-blue-600 border-blue-500/20";
        if (s.includes("deliver") || s.includes("complete") || s.includes("done") || s.includes("arrived")) return "bg-emerald-500/10 text-emerald-600 border-emerald-500/20";
        if (s.includes("cancel") || s.includes("fail") || s.includes("reject")) return "bg-rose-500/10 text-rose-600 border-rose-500/20";
        return "bg-muted text-muted-foreground border-border";
    };

    return (
        <div className="p-6 space-y-6 bg-background min-h-screen">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                    <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
                        <LayoutDashboard className="w-8 h-8 text-primary" />
                        Executive Overview
                    </h1>
                    <p className="text-muted-foreground text-sm pl-1">Operational intelligence and real-time warehouse metrics.</p>
                </div>
                <div className="flex items-center gap-3">
                    <Button variant="outline" size="sm" onClick={() => summaryQuery.refetch()} className="gap-2">
                        <RefreshCw className={cn("w-3.5 h-3.5", summaryQuery.isFetching && "animate-spin")} />
                        Sync Data
                    </Button>
                </div>
            </div>

            {/* Primary Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {summaryQuery.isLoading ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32 w-full rounded-2xl" />) :
                stats.map((stat, i) => (
                    <Card key={i} className="bg-card border-border/60 shadow-sm overflow-hidden group hover:border-primary/30 transition-all">
                        <CardContent className="p-6">
                            <div className="flex items-center justify-between">
                                <div className={cn("p-2.5 rounded-xl transition-colors", stat.bg, stat.color)}><stat.icon className="w-5 h-5" /></div>
                                {stat.change && <Badge className="bg-emerald-500/10 text-emerald-500 border-none text-[10px] font-bold">{stat.change}</Badge>}
                            </div>
                            <div className="mt-4 space-y-1">
                                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{stat.title}</p>
                                <h3 className="text-3xl font-bold tracking-tight">{stat.value}</h3>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Secondary Stats Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {summaryQuery.isLoading ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />) :
                secondaryStats.map((stat, i) => (
                    <div key={i} className="flex flex-col items-start justify-between p-5 bg-muted/20 rounded-xl border border-border/40 hover:border-primary/20 transition-colors">
                        <div className="flex items-center gap-3 w-full">
                            <stat.icon className={cn("w-6 h-6 flex-shrink-0", stat.color)} />
                            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest truncate">{stat.title}</p>
                        </div>
                        <p className="text-2xl font-bold mt-3">{stat.value}</p>
                    </div>
                ))}
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="bg-card border-border/60 shadow-sm">
                    <CardHeader className="pb-4"><CardTitle className="text-sm font-bold flex items-center gap-2"><BarChart3 className="w-4 h-4 text-primary" />Inventory Trends</CardTitle></CardHeader>
                    <CardContent className="h-[350px]">
                        {inventoryAnalyticsQuery.isLoading ? <Skeleton className="h-full w-full rounded-lg" /> :
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={inventoryAnalyticsQuery.data || []}>
                                <defs><linearGradient id="colorVal" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/><stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/></linearGradient></defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border) / 0.3)" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
                                <Tooltip />
                                <Area type="monotone" dataKey="value" stroke="hsl(var(--primary))" fillOpacity={1} fill="url(#colorVal)" />
                            </AreaChart>
                        </ResponsiveContainer>}
                    </CardContent>
                </Card>

                <Card className="bg-card border-border/60 shadow-sm">
                    <CardHeader className="pb-4"><CardTitle className="text-sm font-bold flex items-center gap-2"><Activity className="w-4 h-4 text-primary" />Storage Utilization</CardTitle></CardHeader>
                    <CardContent className="h-[350px] flex items-center justify-center relative">
                        {utilizationQuery.isLoading ? <Skeleton className="h-48 w-48 rounded-full" /> :
                        <><ResponsiveContainer width="100%" height="100%">
                            <PieChart><Pie data={utilizationQuery.data || []} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                                {(utilizationQuery.data || []).map((_, index) => <Cell key={index} fill={index === 0 ? "hsl(var(--primary))" : "hsl(var(--muted))"} />)}
                            </Pie><Tooltip /></PieChart>
                        </ResponsiveContainer>
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                            <span className="text-3xl font-bold">{statsData.warehouse_utilization ?? 0}%</span>
                            <span className="text-xs text-muted-foreground uppercase tracking-wide">Utilized</span>
                        </div></>}
                    </CardContent>
                </Card>
            </div>

            {/* Tables Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Recent Sales */}
                <Card className="lg:col-span-2 bg-card border-border/60 shadow-sm overflow-hidden">
                    <CardHeader className="flex flex-row items-center justify-between pb-4"><CardTitle className="text-sm font-bold">Recent Sales Orders</CardTitle>
                        <Button variant="ghost" size="sm" className="text-xs font-bold text-primary hover:text-primary/80">View All</Button>
                    </CardHeader>
                    <CardContent className="p-0 overflow-x-auto">
                        <Table>
                            <TableHeader className="bg-muted/20"><TableRow>
                                <TableHead className="text-xs font-bold h-11 px-4 whitespace-nowrap">Order ID</TableHead>
                                <TableHead className="text-xs font-bold h-11 whitespace-nowrap">Customer</TableHead>
                                <TableHead className="text-xs font-bold h-11 text-center whitespace-nowrap">Quantity</TableHead>
                                <TableHead className="text-xs font-bold h-11 text-right pr-4 whitespace-nowrap">Status</TableHead>
                            </TableRow></TableHeader>
                            <TableBody>
                                {salesOrdersQuery.isLoading ? Array.from({ length: 5 }).map((_, i) => <TableRow key={i}><TableCell colSpan={4} className="px-4 py-3"><Skeleton className="h-4 w-full" /></TableCell></TableRow>) :
                                (salesOrdersQuery.data || []).length === 0 ? <TableRow><TableCell colSpan={4} className="text-center py-8 text-xs text-muted-foreground italic">No recent sales orders</TableCell></TableRow> :
                                (salesOrdersQuery.data || []).slice(0, 8).map((order) => (
                                    <TableRow key={order.id} className="hover:bg-muted/30 transition-colors">
                                        <TableCell className="text-xs font-bold text-primary px-4 py-3 whitespace-nowrap">{order.id}</TableCell>
                                        <TableCell className="text-xs py-3 max-w-xs truncate">{order.customer}</TableCell>
                                        <TableCell className="text-xs text-center py-3 whitespace-nowrap">{order.qty}</TableCell>
                                        <TableCell className="text-right pr-4 py-3"><Badge variant="outline" className={cn("text-xs font-bold px-2.5 py-1 whitespace-nowrap", getStatusColor(order.status))}>{order.status}</Badge></TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>

                {/* Alerts/Activities */}
                <div className="space-y-6">
                    <Card className="bg-card border-border/60 shadow-sm flex flex-col">
                        <CardHeader className="pb-3"><CardTitle className="text-sm font-bold flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-rose-500" />Priority Alerts</CardTitle></CardHeader>
                        <CardContent className="p-0 flex-1 max-h-[320px] overflow-y-auto">
                            {alertsQuery.isLoading ? <div className="p-4 space-y-3"><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /></div> : 
                            (alertsQuery.data || []).length === 0 ? <div className="p-6 text-center text-xs text-muted-foreground italic">No active alerts</div> :
                            (alertsQuery.data || []).map((alert, i) => (
                                <div key={i} className="p-4 border-b border-border/30 hover:bg-muted/10 transition-colors last:border-b-0">
                                    <h4 className="text-xs font-bold text-rose-600 uppercase tracking-tight">{alert.title}</h4>
                                    <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">{alert.description}</p>
                                </div>
                            ))}
                        </CardContent>
                    </Card>

                    <Card className="bg-card border-border/60 shadow-sm flex flex-col">
                        <CardHeader className="pb-3"><CardTitle className="text-sm font-bold flex items-center gap-2"><History className="w-4 h-4 text-primary" />Recent Activities</CardTitle></CardHeader>
                        <CardContent className="p-0 flex-1 max-h-[320px] overflow-y-auto">
                            {activitiesQuery.isLoading ? <div className="p-4 space-y-3"><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /></div> : 
                            (activitiesQuery.data || []).length === 0 ? <div className="p-6 text-center text-xs text-muted-foreground italic">No recent activity</div> :
                            (activitiesQuery.data || []).map((act, i) => (
                                <div key={i} className="p-4 border-b border-border/30 flex items-start gap-3 hover:bg-muted/10 transition-colors last:border-b-0">
                                    <div className="mt-2 w-2 h-2 rounded-full bg-primary flex-shrink-0" />
                                    <div className="min-w-0 flex-1">
                                        <h4 className="text-xs font-bold truncate">{act.title}</h4>
                                        <p className="text-xs text-muted-foreground truncate">{act.sub}</p>
                                        <p className="text-xs text-muted-foreground/60 mt-1.5">{act.time}</p>
                                    </div>
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Bottom Row: ASNs and Low Stock */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="bg-card border-border/60 shadow-sm overflow-hidden">
                    <CardHeader className="pb-4"><CardTitle className="text-sm font-bold flex items-center gap-2"><FileText className="w-4 h-4 text-primary" />Recent ASNs</CardTitle></CardHeader>
                    <CardContent className="p-0 overflow-x-auto">
                        <Table>
                            <TableHeader className="bg-muted/20"><TableRow>
                                <TableHead className="text-xs font-bold h-11 px-4 whitespace-nowrap">ASN ID</TableHead>
                                <TableHead className="text-xs font-bold h-11 whitespace-nowrap">Supplier</TableHead>
                                <TableHead className="text-xs font-bold h-11 text-right pr-4 whitespace-nowrap">Status</TableHead>
                            </TableRow></TableHeader>
                            <TableBody>
                                {asnsQuery.isLoading ? Array.from({ length: 4 }).map((_, i) => <TableRow key={i}><TableCell colSpan={3} className="px-4 py-3"><Skeleton className="h-4 w-full" /></TableCell></TableRow>) :
                                (asnsQuery.data || []).length === 0 ? <TableRow><TableCell colSpan={3} className="text-center py-8 text-xs text-muted-foreground italic">No recent ASNs</TableCell></TableRow> :
                                (asnsQuery.data || []).slice(0, 8).map((asn) => (
                                    <TableRow key={asn.id} className="hover:bg-muted/30 transition-colors">
                                        <TableCell className="text-xs font-bold px-4 py-3 whitespace-nowrap">{asn.id}</TableCell>
                                        <TableCell className="text-xs py-3 max-w-xs truncate">{asn.supplier}</TableCell>
                                        <TableCell className="text-right pr-4 py-3"><Badge variant="outline" className={cn("text-xs font-bold px-2.5 py-1 whitespace-nowrap", getStatusColor(asn.status))}>{asn.status}</Badge></TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>

                <Card className="bg-card border-border/60 shadow-sm overflow-hidden">
                    <CardHeader className="pb-4"><CardTitle className="text-sm font-bold flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-rose-500" />Low Stock Products</CardTitle></CardHeader>
                    <CardContent className="p-0 overflow-x-auto">
                        <Table>
                            <TableHeader className="bg-muted/20"><TableRow>
                                <TableHead className="text-xs font-bold h-11 px-4 whitespace-nowrap">SKU</TableHead>
                                <TableHead className="text-xs font-bold h-11 whitespace-nowrap">Stock</TableHead>
                                <TableHead className="text-xs font-bold h-11 text-right pr-4 whitespace-nowrap">Threshold</TableHead>
                            </TableRow></TableHeader>
                            <TableBody>
                                {lowStockQuery.isLoading ? Array.from({ length: 4 }).map((_, i) => <TableRow key={i}><TableCell colSpan={3} className="px-4 py-3"><Skeleton className="h-4 w-full" /></TableCell></TableRow>) :
                                (lowStockQuery.data || []).length === 0 ? <TableRow><TableCell colSpan={3} className="text-center py-8 text-xs text-muted-foreground italic">No low stock items</TableCell></TableRow> :
                                (lowStockQuery.data || []).slice(0, 8).map((product) => (
                                    <TableRow key={product.sku_code} className="hover:bg-muted/30 transition-colors">
                                        <TableCell className="text-xs font-bold px-4 py-3 whitespace-nowrap">{product.sku_code}</TableCell>
                                        <TableCell className="text-xs font-bold text-rose-500 py-3 whitespace-nowrap">{product.current_stock}</TableCell>
                                        <TableCell className="text-xs text-right pr-4 py-3 text-muted-foreground whitespace-nowrap">{product.threshold}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default Dashboard;
