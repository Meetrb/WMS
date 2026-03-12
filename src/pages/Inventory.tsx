import { useState } from "react";
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
import { Input } from "@/components/ui/input";
import { Search, Filter, Warehouse, MapPin, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";

// Mock Data
const inventoryData = [
    { id: "INV-001", product: "Wireless Headphones", sku: "WH-2024-BLK", location: "Zone A - Bin 12", stock: 150, reorder: 50, status: "In Stock", incoming: 0 },
    { id: "INV-002", product: "USB-C Cables (Pack)", sku: "CB-USBC-2M", location: "Zone A - Bin 15", stock: 500, reorder: 100, status: "In Stock", incoming: 200 },
    { id: "INV-003", product: "LED Monitors 27\"", sku: "MN-LED-27", location: "Zone B - Pallet 4", stock: 12, reorder: 20, status: "Low Stock", incoming: 50 },
    { id: "INV-004", product: "Mechanical Keyboard", sku: "KB-MECH-RGB", location: "Zone A - Bin 08", stock: 0, reorder: 30, status: "Out of Stock", incoming: 100 },
    { id: "INV-005", product: "Gaming Mouse", sku: "MS-GAME-PRO", location: "Zone A - Bin 09", stock: 350, reorder: 50, status: "In Stock", incoming: 0 },
    { id: "INV-006", product: "Laptop Stand", sku: "AC-LAP-STD", location: "Zone C - Shelf 2", stock: 85, reorder: 40, status: "In Stock", incoming: 0 },
    { id: "INV-007", product: "Webcam 4K", sku: "CM-WEB-4K", location: "Zone A - Bin 02", stock: 18, reorder: 25, status: "Low Stock", incoming: 100 },
];

const Inventory = () => {
    const [searchTerm, setSearchTerm] = useState("");

    const filteredData = inventoryData.filter(item =>
        item.product.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.sku.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const getStatusColor = (status: string) => {
        switch (status) {
            case "In Stock": return "default";
            case "Low Stock": return "secondary"; // Or warning color if available
            case "Out of Stock": return "destructive";
            default: return "outline";
        }
    };

    return (
        <div className="p-6 space-y-6 animate-in fade-in duration-500">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-heading font-bold tracking-tight">Inventory</h2>
                    <p className="text-muted-foreground">Manage stock levels, locations, and movements.</p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline">
                        <Filter className="w-4 h-4 mr-2" />
                        Filter
                    </Button>
                    <Button>
                        <Warehouse className="w-4 h-4 mr-2" />
                        Add Product
                    </Button>
                </div>
            </div>

            <Card>
                <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                        <CardTitle>Current Stock</CardTitle>
                        <div className="relative w-full max-w-sm">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                type="search"
                                placeholder="Search products or SKU..."
                                className="pl-8"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Product Details</TableHead>
                                <TableHead>SKU</TableHead>
                                <TableHead>Location</TableHead>
                                <TableHead className="text-right">Stock Level</TableHead>
                                <TableHead className="text-right">Incoming</TableHead>
                                <TableHead>Status</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredData.map((item) => (
                                <TableRow key={item.id}>
                                    <TableCell>
                                        <div className="flex flex-col">
                                            <span className="font-medium">{item.product}</span>
                                            <span className="text-xs text-muted-foreground">{item.id}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="font-mono text-xs">{item.sku}</TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                            <MapPin className="w-3 h-3" />
                                            {item.location}
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right font-medium">{item.stock}</TableCell>
                                    <TableCell className="text-right">
                                        {item.incoming > 0 ? (
                                            <div className="flex items-center justify-end gap-1 text-green-600 dark:text-green-400">
                                                <Truck className="w-3 h-3" />
                                                +{item.incoming}
                                            </div>
                                        ) : (
                                            <span className="text-muted-foreground">-</span>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant={getStatusColor(item.status) as any}>
                                            {item.status}
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

export default Inventory;
