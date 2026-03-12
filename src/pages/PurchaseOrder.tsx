import { useState } from "react";
import { Button } from "@/components/ui/button";
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
import { Scanner } from "@/components/Scanner";
import { Scan } from "lucide-react";
import { toast } from "sonner";

// Mock Data
const initialPO = {
    id: "PO-2024-001",
    vendor: "TechSupplies Inc.",
    items: [
        {
            id: "1",
            name: "Wireless Mouse",
            barcode: "8901234567890",
            expectedQty: 50,
            scannedQty: 0,
            status: "pending",
        },
        {
            id: "2",
            name: "Mechanical Keyboard",
            barcode: "1234567890123",
            expectedQty: 20,
            scannedQty: 0,
            status: "pending",
        },
        {
            id: "3",
            name: "USB-C Cable (2m)",
            barcode: "9876543210987",
            expectedQty: 100,
            scannedQty: 0,
            status: "pending",
        },
    ],
};

const PurchaseOrder = () => {
    const [poData, setPoData] = useState(initialPO);
    const [isScanning, setIsScanning] = useState(false);

    const handleScan = (decodedText: string) => {
        // Find item with matching barcode
        const itemIndex = poData.items.findIndex(
            (item) => item.barcode === decodedText
        );

        if (itemIndex === -1) {
            toast.error("Unknown Product", {
                description: `Barcode ${decodedText} not found in this PO.`,
            });
            return;
        }

        const item = poData.items[itemIndex];

        // Check if already fully scanned
        if (item.scannedQty >= item.expectedQty) {
            toast.warning("Excess Quantity", {
                description: `${item.name} is already fully scanned.`,
            });
            return;
        }

        // Update Scan Qty
        const updatedItems = [...poData.items];
        updatedItems[itemIndex] = {
            ...item,
            scannedQty: item.scannedQty + 1,
            status:
                item.scannedQty + 1 === item.expectedQty ? "verified" : "pending",
        };

        setPoData({ ...poData, items: updatedItems });

        toast.success("Product Verified", {
            description: `Scanned 1 unit of ${item.name}`,
        });

        // Optional: Close scanner after success if needed, or keep open for continuous scanning
        // setIsScanning(false); 
    };

    const progress = Math.round(
        (poData.items.reduce((acc, item) => acc + item.scannedQty, 0) /
            poData.items.reduce((acc, item) => acc + item.expectedQty, 0)) *
        100
    );

    return (
        <div className="p-4 md:p-8 space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="font-heading text-3xl font-bold">{poData.id}</h1>
                    <p className="text-muted-foreground">{poData.vendor}</p>
                </div>
                <Button onClick={() => setIsScanning(true)} className="gap-2">
                    <Scan className="h-4 w-4" />
                    Scan Items
                </Button>
            </div>

            {/* Progress Card */}
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                        Receiving Progress
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{progress}%</div>
                    <div className="h-2 w-full bg-secondary mt-2 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-primary transition-all duration-500"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                </CardContent>
            </Card>

            {/* Items Table */}
            <Card>
                <CardHeader>
                    <CardTitle>Items</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Product Name</TableHead>
                                <TableHead>Barcode</TableHead>
                                <TableHead className="text-right">Qty</TableHead>
                                <TableHead className="text-right">Scanned</TableHead>
                                <TableHead className="text-right">Status</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {poData.items.map((item) => (
                                <TableRow key={item.id}>
                                    <TableCell className="font-medium">{item.name}</TableCell>
                                    <TableCell className="font-mono text-xs">
                                        {item.barcode}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        {item.expectedQty}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        {item.scannedQty}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        {item.status === "verified" ? (
                                            <Badge
                                                variant="outline"
                                                className="bg-green-500/10 text-green-500 border-green-500/20"
                                            >
                                                Verified
                                            </Badge>
                                        ) : (
                                            <Badge variant="secondary">Pending</Badge>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {isScanning && (
                <Scanner
                    onScan={handleScan}
                    onClose={() => setIsScanning(false)}
                />
            )}
        </div>
    );
};

export default PurchaseOrder;
