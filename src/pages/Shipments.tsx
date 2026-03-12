import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Truck, Plus, Calendar, MapPin } from "lucide-react";

const shipments = [
    { id: "SHP-2024-001", dest: "Austin, TX distribution center", status: "In Transit", date: "Feb 16, 2026", items: 15 },
    { id: "SHP-2024-002", dest: "Seattle, WA Retail Store", status: "Pending", date: "Feb 17, 2026", items: 42 },
    { id: "SHP-2024-003", dest: "Miami, FL Warehouse", status: "Delivered", date: "Feb 14, 2026", items: 8 },
    { id: "SHP-2024-004", dest: "New York, NY Fulfillment", status: "Processing", date: "Feb 17, 2026", items: 120 },
    { id: "SHP-2024-005", dest: "Chicago, IL Hub", status: "In Transit", date: "Feb 15, 2026", items: 65 },
];

const getStatusVariant = (status: string) => {
    switch (status) {
        case "Delivered": return "default";
        case "In Transit": return "secondary";
        case "Processing": return "outline";
        default: return "destructive";
    }
};

const Shipments = () => {
    return (
        <div className="p-6 space-y-6 animate-in fade-in duration-500">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-heading font-bold tracking-tight">Shipments</h2>
                    <p className="text-muted-foreground">Track outbound deliveries and logistics.</p>
                </div>
                <Button>
                    <Plus className="w-4 h-4 mr-2" />
                    New Shipment
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Active Shipments</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Shipment ID</TableHead>
                                <TableHead>Destination</TableHead>
                                <TableHead>Date</TableHead>
                                <TableHead className="text-right">Items</TableHead>
                                <TableHead>Status</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {shipments.map((shipment) => (
                                <TableRow key={shipment.id}>
                                    <TableCell className="font-mono text-xs font-medium text-primary">
                                        {shipment.id}
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
                                            {shipment.dest}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2 text-muted-foreground">
                                            <Calendar className="w-3.5 h-3.5" />
                                            {shipment.date}
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right font-medium">
                                        {shipment.items}
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant={getStatusVariant(shipment.status) as any}>
                                            <Truck className="w-3 h-3 mr-1" />
                                            {shipment.status}
                                        </Badge>
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

export default Shipments;
