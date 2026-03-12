import React, { useState, useEffect } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { inboundService } from "@/services/inboundService";
import { warehouseService } from "@/services/warehouseService";

interface InboundData {
    id: string;
    asn_number?: string;
    warehouse_code?: string;
    expectedDate?: string;
    expected_arrival_date?: string;
    driverName?: string;
    driver_name?: string;
    driverPhone?: string;
    driver_phone?: string;
    vehicleNumber?: string;
    vehicle_number?: string;
    receivingDock?: string;
    dock_number?: string;
    notes?: string;
}

interface ArrivedModalProps {
    open: boolean;
    setOpen: (open: boolean) => void;
    inbound: InboundData | null;
    onSuccess: () => void;
}

export const ArrivedModal: React.FC<ArrivedModalProps> = ({ open, setOpen, inbound, onSuccess }) => {
    const [isLoading, setIsLoading] = useState(false);
    const [defaultWarehouseCode, setDefaultWarehouseCode] = useState<string>("");
    const [formData, setFormData] = useState({
        expectedDate: "",
        driverName: "",
        driverPhone: "",
        vehicleNumber: "",
        receivingDock: "",
        notes: "",
        status: "arrived"
    });

    useEffect(() => {
        if (open) {
            // Fetch default warehouse code to prevent 400 Errors on missing data
            warehouseService.getAll().then((data) => {
                if (data && data.items && data.items.length > 0) {
                    setDefaultWarehouseCode(data.items[0].code || "");
                } else if (data && data.length > 0) {
                    setDefaultWarehouseCode(data[0].code || "");
                }
            }).catch(console.error);
        }

        if (inbound && open) {
            // Format datetime-local string (YYYY-MM-DDThh:mm)
            let formattedDate = "";
            const rawDate = inbound.expectedDate || inbound.expected_arrival_date;

            if (rawDate && rawDate !== "N/A" && rawDate !== "undefined") {
                try {
                    const d = new Date(rawDate);
                    if (!isNaN(d.getTime())) {
                        formattedDate = d.toISOString().slice(0, 16);
                    }
                } catch (e) {
                    console.error("Invalid date parsing", e);
                }
            }

            setFormData({
                expectedDate: formattedDate,
                driverName: inbound.driverName || inbound.driver_name || "",
                driverPhone: inbound.driverPhone || inbound.driver_phone || "",
                vehicleNumber: inbound.vehicleNumber || inbound.vehicle_number || "",
                receivingDock: inbound.receivingDock || inbound.dock_number || "",
                notes: inbound.notes || "",
                status: "arrived"
            });
        }
    }, [inbound, open]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!inbound?.id) {
            toast.error("Invalid Inbound ID");
            return;
        }

        setIsLoading(true);
        try {
            // Map form data exactly to requested backend schema
            const payload = {
                actual_arrival_date: formData.expectedDate ? new Date(formData.expectedDate).toISOString() : new Date().toISOString(),
                receiving_dock: formData.receivingDock || null,
                driver_name: formData.driverName || null,
                driver_phone: formData.driverPhone || null,
                vehicle_number: formData.vehicleNumber || null,
                notes: formData.notes || null,
                warehouse_code: (inbound.warehouse_code && inbound.warehouse_code !== "N/A" && inbound.warehouse_code !== "undefined") ? inbound.warehouse_code : (defaultWarehouseCode || "WH-DXB-01") // Fallback if missing or invalid
            };

            // Use POST method for arrival at /inbound/asn/{asn_number}/arrive
            await inboundService.updateArrival(inbound.asn_number || inbound.id, payload);

            toast.success("Shipment marked as arrived successfully");
            setOpen(false);
            onSuccess();
        } catch (error) {
            console.error("Error updating inbound status:", error);
            toast.error("Failed to update shipment status");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Mark as Arrived</DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="expectedDate">Expected Date & Time</Label>
                        <Input
                            id="expectedDate"
                            name="expectedDate"
                            type="datetime-local"
                            value={formData.expectedDate}
                            onChange={handleInputChange}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="driverName">Driver Name</Label>
                            <Input
                                id="driverName"
                                name="driverName"
                                value={formData.driverName}
                                onChange={handleInputChange}
                                placeholder="Enter driver name"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="driverPhone">Driver Phone</Label>
                            <Input
                                id="driverPhone"
                                name="driverPhone"
                                value={formData.driverPhone}
                                onChange={handleInputChange}
                                placeholder="Enter phone number"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="vehicleNumber">Vehicle Number</Label>
                            <Input
                                id="vehicleNumber"
                                name="vehicleNumber"
                                value={formData.vehicleNumber}
                                onChange={handleInputChange}
                                placeholder="Enter vehicle number"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="receivingDock">Receiving Dock</Label>
                            <Input
                                id="receivingDock"
                                name="receivingDock"
                                value={formData.receivingDock}
                                onChange={handleInputChange}
                                placeholder="Enter dock"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="notes">Notes</Label>
                        <Textarea
                            id="notes"
                            name="notes"
                            value={formData.notes}
                            onChange={handleInputChange}
                            placeholder="Add any additional notes here..."
                            rows={3}
                        />
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setOpen(false)}
                            disabled={isLoading}
                        >
                            Cancel
                        </Button>
                        <Button type="submit" disabled={isLoading} className="bg-green-600 hover:bg-green-700">
                            {isLoading ? "Saving..." : "Mark as Arrived"}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
};
