import React, { useState } from "react";
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
    LineChart,
    Line,
    AreaChart,
    Area,
    ScatterChart,
    Scatter,
    ZAxis
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import {
    DollarSign,
    TrendingUp,
    Package,
    Activity,
    Calendar,
    ArrowUpRight,
    ArrowDownRight,
    ShoppingCart,
    Truck,
    Target,
    Database,
    RefreshCw,
    Download,
    Maximize2,
    Filter,
    Clock,
    AlertCircle,
    FileText,
    Grid,
    Layout,
    MoreVertical,
    CheckCircle2,
    BarChart3,
    Users
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { reportsService, type AnalyticsResponse } from "@/services/reportsService";
import { cn } from "@/lib/utils";

// --- Types ---

interface WidgetProps {
    title: string;
    icon: React.ElementType;
    queryKey: string;
    queryFn: () => Promise<AnalyticsResponse>;
    children: (data: AnalyticsResponse) => React.ReactNode;
}

// --- Constants ---

const COLORS = {
    primary: '#3b82f6',
    success: '#10b981',
    warning: '#f59e0b',
    danger: '#ef4444',
    purple: '#8b5cf6',
    pink: '#ec4899',
    neutral: '#94a3b8',
    charts: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16']
};

const CHART_COLORS = COLORS.charts;

// --- Shared Components ---

const ReportWidget = ({ title, icon: Icon, queryKey, queryFn, children }: WidgetProps) => {
    const [isFullscreen, setIsFullscreen] = useState(false);

    const { data, isLoading, error, refetch, isFetching } = useQuery({
        queryKey: ['reports', queryKey], // Using array for better invalidation
        queryFn: queryFn,
        refetchOnWindowFocus: false,
        staleTime: 5 * 60 * 1000,
    });

    const handleRefresh = () => {
        refetch();
    };

    if (isFullscreen) {
        return (
            <div className="fixed inset-0 z-[100] bg-background p-8 overflow-auto animate-in zoom-in-95 duration-200">
                <div className="max-w-7xl mx-auto space-y-6">
                    <div className="flex items-center justify-between border-b pb-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-primary/10 rounded-lg">
                                <Icon className="w-6 h-6 text-primary" />
                            </div>
                            <h2 className="text-2xl font-bold">{title}</h2>
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => setIsFullscreen(false)}>
                            <Maximize2 className="w-5 h-5 rotate-45" />
                        </Button>
                    </div>
                    {data && typeof children === 'function' && children(data)}
                </div>
            </div>
        );
    }

    return (
        <Card className={cn(
            "group flex flex-col h-full border-muted/60 shadow-sm hover:shadow-md transition-all duration-300",
            error ? "border-destructive/50" : "hover:border-primary/30"
        )}>
            <CardHeader className="p-4 flex flex-row items-center justify-between space-y-0 border-b bg-muted/20">
                <div className="flex items-center gap-3">
                    <div className="p-1.5 bg-background rounded-md border shadow-sm group-hover:scale-110 transition-transform">
                        <Icon className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <div className="space-y-0.5">
                        <CardTitle className="text-sm font-bold tracking-tight">{title}</CardTitle>
                        <div className="flex items-center gap-1.5">
                            <div className={cn(
                                "w-1.5 h-1.5 rounded-full",
                                isFetching ? "bg-amber-500 animate-pulse" : (error ? "bg-destructive" : "bg-emerald-500")
                            )} />
                            <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-tighter">
                                {isFetching ? "Syncing..." : (error ? "Connection Failed" : "Live Data")}
                            </span>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleRefresh} title="Refresh">
                        <RefreshCw className={cn("h-3.5 w-3.5", isFetching && "animate-spin")} />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" title="Fullscreen" onClick={() => setIsFullscreen(true)}>
                        <Maximize2 className="h-3.5 w-3.5" />
                    </Button>
                </div>
            </CardHeader>

            <CardContent className="p-4 flex-grow">
                {isLoading ? (
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-3">
                            <Skeleton className="h-16 rounded-lg" />
                            <Skeleton className="h-16 rounded-lg" />
                        </div>
                        <Skeleton className="h-[200px] w-full rounded-xl" />
                    </div>
                ) : error ? (
                    <div className="h-[300px] flex flex-col items-center justify-center text-center space-y-3 p-6 bg-destructive/5 rounded-xl border border-destructive/10">
                        <AlertCircle className="w-10 h-10 text-destructive opacity-50" />
                        <div>
                            <p className="font-bold text-destructive">Component Error</p>
                            <p className="text-xs text-muted-foreground mt-1">Failed to established connection with {title} service.</p>
                        </div>
                        <Button variant="outline" size="sm" className="mt-2" onClick={handleRefresh}>
                            Retry Connection
                        </Button>
                    </div>
                ) : data ? (
                    <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                        {typeof children === 'function' && children(data)}
                    </div>
                ) : (
                    <div className="h-[300px] flex items-center justify-center text-muted-foreground text-xs italic">
                        No data available for this segment.
                    </div>
                )}
            </CardContent>

            <CardFooter className="p-3 border-t bg-muted/10 flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-medium">
                    <Clock className="w-3 h-3" />
                    Sync: {data?.last_updated ? new Date(data.last_updated).toLocaleTimeString() : 'Never'}
                </div>
                <Button variant="link" size="sm" className="h-auto p-0 text-[10px] font-bold uppercase tracking-widest text-primary hover:no-underline">
                    View Logs →
                </Button>
            </CardFooter>
        </Card>
    );
};

const KPIItem = ({ label, value, sub, trend }: any) => {
    const displayValue = (value === null || value === undefined || value === "") ? "---" : value;

    return (
        <div className="p-3 rounded-lg border bg-background/50 hover:border-primary/30 transition-colors">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">{label}</p>
            <div className="flex items-baseline justify-between">
                <h4 className="text-xl font-black tracking-tight">{displayValue}</h4>
                {trend && (
                    <span className={cn(
                        "text-[10px] font-bold flex items-center",
                        trend.toString().startsWith('+') ? "text-emerald-500" : "text-destructive"
                    )}>
                        {trend.toString().startsWith('+') ? <ArrowUpRight className="w-3 h-3 mr-0.5" /> : <ArrowDownRight className="w-3 h-3 mr-0.5" />}
                        {trend}
                    </span>
                )}
            </div>
            {sub && <p className="text-[10px] text-muted-foreground mt-1 font-medium italic">{sub}</p>}
        </div>
    );
};

// --- Analytics Widgets ---

const SalesWidget = (data: AnalyticsResponse) => {
    const summary = data?.summary || {};
    const chartData = (data?.charts?.status || []) as any[];

    return (
        <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3">
                <KPIItem label="Total Orders" value={summary.total_orders} />
                <KPIItem label="Total Revenue" value={summary.total_revenue ? `₹${summary.total_revenue.toLocaleString()}` : "$0"} />
                <KPIItem label="Avg. Order Value" value={summary.average_order_value ? `₹${summary.average_order_value.toLocaleString()}` : "$0"} />
                <KPIItem label="Pending Orders" value={summary.pending_orders} />
            </div>
            
            <div className="h-[220px] w-full mt-4">
                {chartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.1} />
                            <XAxis dataKey="status" axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
                            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
                            <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ borderRadius: '8px', border: 'none' }} />
                            <Bar dataKey="count" fill={COLORS.primary} radius={[4, 4, 0, 0]} barSize={40} />
                        </BarChart>
                    </ResponsiveContainer>
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground bg-muted/5 rounded-xl border border-dashed">
                        <Activity className="w-8 h-8 mb-2 opacity-20" />
                        <p className="text-xs font-medium uppercase tracking-tighter">No data available</p>
                    </div>
                )}
            </div>
        </div>
    );
};

const InventoryWidget = (data: AnalyticsResponse) => {
    const summary = data?.summary || {};
    const chartData = (data?.charts?.fast_moving || []) as any[];

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
                <KPIItem label="Total SKUs" value={summary.total_skus} />
                <KPIItem label="On-Hand" value={summary.total_on_hand} />
                <KPIItem label="Available" value={summary.total_available} />
                <KPIItem label="In-Transit" value={summary.total_in_transit} />
            </div>

            <div className="h-[220px] w-full mt-2">
                {chartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={chartData}
                                cx="50%"
                                cy="50%"
                                innerRadius={50}
                                outerRadius={70}
                                paddingAngle={5}
                                dataKey="total_picked"
                                nameKey="item_sku"
                            >
                                {chartData.map((_, index) => (
                                    <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                                ))}
                            </Pie>
                            <Tooltip />
                        </PieChart>
                    </ResponsiveContainer>
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground bg-muted/5 rounded-xl border border-dashed">
                        <Activity className="w-8 h-8 mb-2 opacity-20" />
                        <p className="text-xs font-medium uppercase tracking-tighter italic">No category data</p>
                    </div>
                )}
            </div>
        </div>
    );
};


const InboundWidget = (data: AnalyticsResponse) => {
    const summary = data?.summary || {};
    const chartData = (data?.charts?.suppliers || []) as any[];

    return (
        <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3">
                <KPIItem label="Shipments" value={summary.total_shipments} />
                <KPIItem label="Total GRNs" value={summary.total_grns} />
                <KPIItem label="Qty Received" value={summary.total_received} />
                <KPIItem label="Rejection Rate" value={summary.rejection_rate ? `${summary.rejection_rate}%` : "0%"} />
            </div>

            <div className="h-[200px] w-full mt-2">
                {chartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData} layout="vertical">
                            <CartesianGrid strokeDasharray="3 3" horizontal={false} strokeOpacity={0.1} />
                            <XAxis type="number" hide />
                            <YAxis type="category" dataKey="supplier_name" hide />
                            <Tooltip contentStyle={{ fontSize: '10px' }} cursor={{ fill: 'transparent' }} />
                            <Bar dataKey="total_received" fill={COLORS.primary} radius={[0, 4, 4, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground bg-muted/5 rounded-xl border border-dashed">
                        <Activity className="w-8 h-8 mb-2 opacity-20" />
                        <p className="text-xs font-medium uppercase tracking-tighter italic">No supplier data</p>
                    </div>
                )}
            </div>
        </div>
    );
};

const PickingWidget = (data: AnalyticsResponse) => {
    const summary = data?.summary || {};
    const chartData = (data?.charts?.status || []) as any[];

    return (
        <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3">
                <KPIItem label="Total Tasks" value={summary.total_tasks} />
                <KPIItem label="Completed" value={summary.completed_tasks} />
                <KPIItem label="Qty Picked" value={summary.total_picked} />
                <KPIItem label="Completion" value={summary.completion_rate ? `${summary.completion_rate}%` : "0%"} />
            </div>

            <div className="h-[200px] w-full mt-2">
                {chartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.1} />
                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
                            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
                            <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ borderRadius: '8px', border: 'none' }} />
                            <Bar dataKey="value" fill={COLORS.success} radius={[4, 4, 0, 0]} barSize={40} />
                        </BarChart>
                    </ResponsiveContainer>
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground bg-muted/5 rounded-xl border border-dashed">
                        <Activity className="w-8 h-8 mb-2 opacity-20" />
                        <p className="text-xs font-medium uppercase tracking-tighter italic">No task data</p>
                    </div>
                )}
            </div>
        </div>
    );
};

const UtilizationWidget = (data: AnalyticsResponse) => {
    const summary = data?.summary || {};
    const chartData = (data?.charts?.zones || []) as any[];

    return (
        <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3">
                <KPIItem label="Total Bins" value={summary.total_bins} />
                <KPIItem label="Occupied" value={summary.occupied_bins} />
                <KPIItem label="Utilization" value={summary.utilization ? `${summary.utilization}%` : "0%"} />
                <KPIItem label="Empty Bins" value={summary.empty_bins} />
            </div>

            <div className="h-[200px] w-full mt-2">
                {chartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.1} />
                            <XAxis dataKey="zone_name" axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
                            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
                            <Tooltip cursor={{ fill: 'transparent' }} />
                            <Bar dataKey="utilization_percentage" fill={COLORS.primary} radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground bg-muted/5 rounded-xl border border-dashed">
                        <Activity className="w-8 h-8 mb-2 opacity-20" />
                        <p className="text-xs font-medium uppercase tracking-tighter italic">No zone data</p>
                    </div>
                )}
            </div>
        </div>
    );
};

const ReplenishmentWidget = (data: AnalyticsResponse) => {
    const summary = data?.summary || {};
    const chartData = (data?.charts?.skus || []) as any[];

    return (
        <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3">
                <KPIItem label="Total Tasks" value={summary.total_tasks} />
                <KPIItem label="Completed" value={summary.completed_tasks} />
                <KPIItem label="Qty Replenished" value={summary.total_replenished} />
                <KPIItem label="Completion" value={summary.completion_rate ? `${summary.completion_rate}%` : "0%"} />
            </div>

            <div className="h-[200px] w-full mt-2">
                {chartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData} layout="vertical">
                            <CartesianGrid strokeDasharray="3 3" horizontal={false} strokeOpacity={0.1} />
                            <XAxis type="number" hide />
                            <YAxis type="category" dataKey="item_sku" hide />
                            <Tooltip contentStyle={{ fontSize: '10px' }} cursor={{ fill: 'transparent' }} />
                            <Bar dataKey="total_picked" fill={COLORS.primary} radius={[0, 4, 4, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground bg-muted/5 rounded-xl border border-dashed">
                        <Activity className="w-8 h-8 mb-2 opacity-20" />
                        <p className="text-xs font-medium uppercase tracking-tighter italic">No replenishment data</p>
                    </div>
                )}
            </div>
        </div>
    );
};

const WorkerPerformanceWidget = (data: AnalyticsResponse) => {
    const summary = data?.summary || {};
    const chartData = (data?.charts?.performers || []) as any[];

    return (
        <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3">
                <KPIItem label="Active Workers" value={summary.active_workers} />
                <KPIItem label="Top Performance" value={chartData[0]?.completion_rate ? `${chartData[0].completion_rate}%` : "0%"} />
            </div>

            <div className="space-y-3 mt-4">
                {chartData.length > 0 ? chartData.slice(0, 3).map((worker, i) => (
                    <div key={i} className="p-3 rounded-lg bg-muted/10 border border-border/40 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">
                                {worker.worker_name?.charAt(0)}
                            </div>
                            <div>
                                <p className="text-xs font-bold">{worker.worker_name}</p>
                                <p className="text-[10px] text-muted-foreground">{worker.total_tasks_completed} Tasks Done</p>
                            </div>
                        </div>
                        <div className="text-right">
                            <p className="text-xs font-black text-primary">{worker.completion_rate}%</p>
                            <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-tighter">Efficiency</p>
                        </div>
                    </div>
                )) : (
                    <div className="flex flex-col items-center justify-center h-[120px] text-muted-foreground bg-muted/5 rounded-xl border border-dashed italic text-xs">
                        No performance data
                    </div>
                )}
            </div>
        </div>
    );
};

// --- Main Page ---

const Reports = () => {
    const queryClient = useQueryClient();
    const [warehouse, setWarehouse] = useState("all");
    const [dateRange, setDateRange] = useState("30d");

    const refreshAll = () => {
        // Invalidate all queries under the 'reports' key
        queryClient.invalidateQueries({ queryKey: ['reports'] });
    };

    return (
        <div className="p-6 space-y-6 bg-background min-h-screen animate-in fade-in duration-700">
            {/* Enterprise Header Section */}
            <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-6 pb-6 border-b">
                <div className="space-y-1">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary rounded-xl shadow-lg shadow-primary/20">
                            <Layout className="w-6 h-6 text-primary-foreground" />
                        </div>
                        <div>
                            <h2 className="text-3xl font-black tracking-tighter text-slate-900 dark:text-slate-50 uppercase">
                                Analytics <span className="text-primary">Dashboard</span>
                            </h2>
                        </div>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    {/* Filter Bar */}
                    <div className="flex items-center gap-2 p-1.5 bg-muted/40 rounded-xl border backdrop-blur-sm">
                        <div className="px-2 border-r flex items-center gap-2">
                            <Filter className="w-3.5 h-3.5 text-muted-foreground" />
                            <span className="text-[10px] font-black uppercase tracking-tighter text-muted-foreground">Global Filters</span>
                        </div>
                        <Select value={warehouse} onValueChange={setWarehouse}>
                            <SelectTrigger className="h-8 w-[140px] border-none bg-transparent shadow-none text-[11px] font-bold focus:ring-0">
                                <SelectValue placeholder="Warehouse" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Global (All)</SelectItem>
                                <SelectItem value="wh-01">WH-North-01</SelectItem>
                                <SelectItem value="wh-02">WH-South-02</SelectItem>
                            </SelectContent>
                        </Select>
                        <Select value={dateRange} onValueChange={setDateRange}>
                            <SelectTrigger className="h-8 w-[140px] border-none bg-transparent shadow-none text-[11px] font-bold focus:ring-0">
                                <SelectValue placeholder="Period" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="24h">Last 24h</SelectItem>
                                <SelectItem value="7d">Last 7d</SelectItem>
                                <SelectItem value="30d">Last 30d</SelectItem>
                                <SelectItem value="qtr">QTD</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" className="h-11 px-4 border-muted/60 shadow-sm font-bold uppercase tracking-widest text-[10px]" onClick={refreshAll}>
                            <RefreshCw className="w-3.5 h-3.5 mr-2" />
                            Refresh
                        </Button>
                        <Button size="sm" className="h-11 px-6 shadow-lg shadow-primary/20 font-bold uppercase tracking-widest text-[10px]">
                            <FileText className="w-3.5 h-3.5 mr-2" />
                            Export PDF
                        </Button>
                        <Button variant="ghost" size="icon" className="h-11 w-11 rounded-xl border border-muted/60">
                            <MoreVertical className="w-5 h-5" />
                        </Button>
                    </div>
                </div>
            </div>

            {/* Dashboard Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                <ReportWidget
                    title="Sales Analytics"
                    icon={ShoppingCart}
                    queryKey="sales"
                    queryFn={reportsService.getSalesAnalytics}
                >
                    {(data) => <SalesWidget {...data} />}
                </ReportWidget>

                <ReportWidget
                    title="Inventory Analytics"
                    icon={Package}
                    queryKey="inventory"
                    queryFn={reportsService.getInventoryAnalytics}
                >
                    {(data) => <InventoryWidget {...data} />}
                </ReportWidget>

                <ReportWidget
                    title="Inbound Analytics"
                    icon={Truck}
                    queryKey="inbound"
                    queryFn={reportsService.getInboundAnalytics}
                >
                    {(data) => <InboundWidget {...data} />}
                </ReportWidget>

                <ReportWidget
                    title="Picking Analytics"
                    icon={Target}
                    queryKey="picking"
                    queryFn={reportsService.getPickingAnalytics}
                >
                    {(data) => <PickingWidget {...data} />}
                </ReportWidget>

                <ReportWidget
                    title="Utilization Analytics"
                    icon={Database}
                    queryKey="utilization"
                    queryFn={reportsService.getWarehouseUtilization}
                >
                    {(data) => <UtilizationWidget {...data} />}
                </ReportWidget>

                <ReportWidget
                    title="Replenishment Analytics"
                    icon={RefreshCw}
                    queryKey="replenishment"
                    queryFn={reportsService.getReplenishmentTrends}
                >
                    {(data) => <ReplenishmentWidget {...data} />}
                </ReportWidget>

                <ReportWidget
                    title="Worker Performance"
                    icon={Users}
                    queryKey="worker-performance"
                    queryFn={reportsService.getWorkerPerformance}
                >
                    {(data) => <WorkerPerformanceWidget {...data} />}
                </ReportWidget>
            </div>

            {/* Bottom Status Bar */}
            <div className="flex items-center justify-between pt-6 border-t text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                <div className="flex items-center gap-6">
                    <div className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                        Systems Operational
                    </div>
                    <div className="flex items-center gap-1.5">
                        <BarChart3 className="w-3.5 h-3.5 text-primary" />
                        Real-time Pipeline
                    </div>
                </div>
                <div>
                    Sync: {new Date().toLocaleTimeString()}
                </div>
            </div>
        </div>
    );
};

export default Reports;
