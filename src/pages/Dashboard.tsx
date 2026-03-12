import {
    Package,
    ClipboardList,
    Truck,
    AlertTriangle,
    TrendingUp,
    TrendingDown,
    ArrowUpRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    LineChart,
    Line,
    PieChart,
    Pie,
    Cell,
} from "recharts";

const stats = [
    {
        title: "Total Products",
        value: "2,847",
        change: "+12.5%",
        trend: "up" as const,
        icon: Package,
    },
    {
        title: "Pending Orders",
        value: "184",
        change: "-3.2%",
        trend: "down" as const,
        icon: ClipboardList,
    },
    {
        title: "Active Shipments",
        value: "43",
        change: "+8.1%",
        trend: "up" as const,
        icon: Truck,
    },
    {
        title: "Low Stock Alerts",
        value: "12",
        change: "+2",
        trend: "up" as const,
        icon: AlertTriangle,
    },
];

const inventoryData = [
    { month: "Jul", inbound: 420, outbound: 380 },
    { month: "Aug", inbound: 510, outbound: 440 },
    { month: "Sep", inbound: 390, outbound: 520 },
    { month: "Oct", inbound: 480, outbound: 460 },
    { month: "Nov", inbound: 560, outbound: 490 },
    { month: "Dec", inbound: 620, outbound: 530 },
    { month: "Jan", inbound: 580, outbound: 560 },
];

const orderTrendData = [
    { day: "Mon", orders: 32 },
    { day: "Tue", orders: 45 },
    { day: "Wed", orders: 38 },
    { day: "Thu", orders: 52 },
    { day: "Fri", orders: 48 },
    { day: "Sat", orders: 28 },
    { day: "Sun", orders: 18 },
];

const categoryData = [
    { name: "Electronics", value: 35 },
    { name: "Clothing", value: 25 },
    { name: "Food & Bev", value: 20 },
    { name: "Hardware", value: 20 },
];

const COLORS = [
    "hsl(213, 52%, 38%)",
    "hsl(177, 30%, 49%)",
    "hsl(88, 46%, 52%)",
    "hsl(215, 52%, 27%)",
];

const recentOrders = [
    { id: "ORD-7291", product: "Wireless Headphones", qty: 150, status: "Processing", date: "Feb 12" },
    { id: "ORD-7290", product: "USB-C Cables (Pack)", qty: 500, status: "Shipped", date: "Feb 11" },
    { id: "ORD-7289", product: "LED Monitors 27\"", qty: 30, status: "Delivered", date: "Feb 11" },
    { id: "ORD-7288", product: "Keyboard Mechanical", qty: 200, status: "Processing", date: "Feb 10" },
    { id: "ORD-7287", product: "Mouse Wireless", qty: 350, status: "Pending", date: "Feb 10" },
];

const statusVariant = (status: string) => {
    switch (status) {
        case "Delivered":
            return "default";
        case "Shipped":
            return "secondary";
        case "Processing":
            return "outline";
        default:
            return "destructive";
    }
};

const Dashboard = () => {
    return (
        <div className="p-6 space-y-6">
            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                {stats.map((stat) => (
                    <Card key={stat.title} className="bg-card border-border">
                        <CardContent className="p-5">
                            <div className="flex items-start justify-between">
                                <div>
                                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                                        {stat.title}
                                    </p>
                                    <p className="text-2xl font-heading font-bold text-foreground mt-1">
                                        {stat.value}
                                    </p>
                                    <div className="flex items-center gap-1 mt-2">
                                        {stat.trend === "up" ? (
                                            <TrendingUp className="w-3.5 h-3.5 text-primary" />
                                        ) : (
                                            <TrendingDown className="w-3.5 h-3.5 text-destructive" />
                                        )}
                                        <span
                                            className={`text-xs font-medium ${stat.trend === "up" ? "text-primary" : "text-destructive"
                                                }`}
                                        >
                                            {stat.change}
                                        </span>
                                        <span className="text-xs text-muted-foreground">vs last month</span>
                                    </div>
                                </div>
                                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                                    <stat.icon className="w-5 h-5 text-primary" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Inventory Flow */}
                <Card className="lg:col-span-2 bg-card border-border">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-heading font-semibold text-foreground">
                            Inventory Flow
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={260}>
                            <BarChart data={inventoryData} barGap={4}>
                                <CartesianGrid strokeDasharray="3 3" stroke="hsl(216, 24%, 87%)" />
                                <XAxis dataKey="month" tick={{ fill: "hsl(215, 15%, 50%)", fontSize: 12 }} axisLine={false} tickLine={false} />
                                <YAxis tick={{ fill: "hsl(215, 15%, 50%)", fontSize: 12 }} axisLine={false} tickLine={false} />
                                <Tooltip
                                    contentStyle={{
                                        background: "hsl(0, 0%, 100%)",
                                        border: "1px solid hsl(216, 24%, 87%)",
                                        borderRadius: "12px",
                                        color: "hsl(215, 35%, 25%)",
                                        fontSize: "12px",
                                    }}
                                />
                                <Bar dataKey="inbound" fill="hsl(213, 52%, 38%)" radius={[6, 6, 0, 0]} />
                                <Bar dataKey="outbound" fill="hsl(88, 46%, 52%)" radius={[6, 6, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                {/* Category Distribution */}
                <Card className="bg-card border-border">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-heading font-semibold text-foreground">
                            Categories
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-col items-center">
                        <ResponsiveContainer width="100%" height={180}>
                            <PieChart>
                                <Pie
                                    data={categoryData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={50}
                                    outerRadius={75}
                                    dataKey="value"
                                    stroke="none"
                                >
                                    {categoryData.map((_, index) => (
                                        <Cell key={index} fill={COLORS[index]} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    contentStyle={{
                                        background: "hsl(0, 0%, 100%)",
                                        border: "1px solid hsl(216, 24%, 87%)",
                                        borderRadius: "12px",
                                        color: "hsl(215, 35%, 25%)",
                                        fontSize: "12px",
                                    }}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                        <div className="grid grid-cols-2 gap-x-6 gap-y-1 mt-2">
                            {categoryData.map((cat, i) => (
                                <div key={cat.name} className="flex items-center gap-2 text-xs">
                                    <span
                                        className="w-2.5 h-2.5 rounded-full"
                                        style={{ backgroundColor: COLORS[i] }}
                                    />
                                    <span className="text-muted-foreground">{cat.name}</span>
                                    <span className="text-foreground font-medium">{cat.value}%</span>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Bottom Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Recent Orders */}
                <Card className="lg:col-span-2 bg-card border-border">
                    <CardHeader className="pb-2 flex flex-row items-center justify-between">
                        <CardTitle className="text-sm font-heading font-semibold text-foreground">
                            Recent Orders
                        </CardTitle>
                        <button className="text-xs text-primary hover:text-primary/80 flex items-center gap-1 transition-colors">
                            View All <ArrowUpRight className="w-3 h-3" />
                        </button>
                    </CardHeader>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow className="border-border hover:bg-transparent">
                                    <TableHead className="text-xs">Order ID</TableHead>
                                    <TableHead className="text-xs">Product</TableHead>
                                    <TableHead className="text-xs text-right">Qty</TableHead>
                                    <TableHead className="text-xs">Status</TableHead>
                                    <TableHead className="text-xs text-right">Date</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {recentOrders.map((order) => (
                                    <TableRow key={order.id} className="border-border">
                                        <TableCell className="font-mono text-xs text-primary">
                                            {order.id}
                                        </TableCell>
                                        <TableCell className="text-sm">{order.product}</TableCell>
                                        <TableCell className="text-sm text-right">{order.qty}</TableCell>
                                        <TableCell>
                                            <Badge variant={statusVariant(order.status) as "default" | "secondary" | "outline" | "destructive"} className="text-xs">
                                                {order.status}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-sm text-right text-muted-foreground">
                                            {order.date}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>

                {/* Order Trend */}
                <Card className="bg-card border-border">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-heading font-semibold text-foreground">
                            Weekly Orders
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={240}>
                            <LineChart data={orderTrendData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="hsl(216, 24%, 87%)" />
                                <XAxis dataKey="day" tick={{ fill: "hsl(215, 15%, 50%)", fontSize: 12 }} axisLine={false} tickLine={false} />
                                <YAxis tick={{ fill: "hsl(215, 15%, 50%)", fontSize: 12 }} axisLine={false} tickLine={false} />
                                <Tooltip
                                    contentStyle={{
                                        background: "hsl(0, 0%, 100%)",
                                        border: "1px solid hsl(216, 24%, 87%)",
                                        borderRadius: "12px",
                                        color: "hsl(215, 35%, 25%)",
                                        fontSize: "12px",
                                    }}
                                />
                                <Line
                                    type="monotone"
                                    dataKey="orders"
                                    stroke="hsl(177, 30%, 49%)"
                                    strokeWidth={2}
                                    dot={{ fill: "hsl(177, 30%, 49%)", r: 4 }}
                                    activeDot={{ r: 6 }}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default Dashboard;
