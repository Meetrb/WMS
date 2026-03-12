import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, Truck } from "lucide-react";

const mockSalesOrders = [
    {
        id: "SO-2024-882",
        customer: "Acme Corp",
        date: "Feb 14, 2024",
        status: "Shipped",
        total: "$1,250.00",
        items: 12,
    },
    {
        id: "SO-2024-883",
        customer: "Global Tech",
        date: "Feb 15, 2024",
        status: "Processing",
        total: "$3,400.00",
        items: 45,
    },
    {
        id: "SO-2024-884",
        customer: "Local Retailer",
        date: "Feb 15, 2024",
        status: "Pending",
        total: "$850.50",
        items: 8,
    },
];

const SalesOrders = () => {
    const [orders] = useState(mockSalesOrders);

    const statusVariant = (status: string) => {
        switch (status) {
            case "Shipped":
                return "default";
            case "Processing":
                return "secondary";
            case "Pending":
                return "outline";
            default:
                return "destructive";
        }
    };

    return (
        <div className="p-4 md:p-8 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="font-heading text-3xl font-bold">Sales Orders</h1>
                    <p className="text-muted-foreground">
                        Manage outgoing customer orders
                    </p>
                </div>
                <Button className="gap-2">
                    <FileText className="h-4 w-4" />
                    New Order
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>All Orders</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Order ID</TableHead>
                                <TableHead>Customer</TableHead>
                                <TableHead>Date</TableHead>
                                <TableHead className="text-right">Items</TableHead>
                                <TableHead className="text-right">Total</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Action</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {orders.map((order) => (
                                <TableRow key={order.id}>
                                    <TableCell className="font-mono text-xs text-primary font-medium">
                                        {order.id}
                                    </TableCell>
                                    <TableCell className="font-medium">{order.customer}</TableCell>
                                    <TableCell className="text-muted-foreground text-sm">
                                        {order.date}
                                    </TableCell>
                                    <TableCell className="text-right">{order.items}</TableCell>
                                    <TableCell className="text-right font-medium">
                                        {order.total}
                                    </TableCell>
                                    <TableCell>
                                        <Badge
                                            variant={statusVariant(order.status) as "default" | "secondary" | "outline" | "destructive"}
                                            className="text-xs"
                                        >
                                            {order.status}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button size="icon" variant="ghost">
                                            <Truck className="h-4 w-4" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
};

export default SalesOrders;
