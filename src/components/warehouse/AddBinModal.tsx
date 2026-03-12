import React, { useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { binsService } from "@/services/binsService";
import type { BinData } from "@/services/binsService";
import { Loader2 } from "lucide-react";

interface AddBinModalProps {
    open: boolean;
    setOpen: (open: boolean) => void;
    warehouseId: string;
    zoneId: string | null;
    onSuccess: () => void;
}

export const AddBinModal: React.FC<AddBinModalProps> = ({ open, setOpen, warehouseId, zoneId, onSuccess }) => {
    const [isLoading, setIsLoading] = useState(false);
    const [formData, setFormData] = useState<Partial<BinData>>({
        code: "",
        barcode: "",
        rfid_tag: "",
        aisle: "",
        rack: "",
        shelf: "",
        bin_position: "",
        bin_type: "",
        length_cm: 0,
        width_cm: 0,
        height_cm: 0,
        max_volume_cc: 0,
        max_weight_kg: 0,
        max_sku_count: 1,
        max_quantity: 0,
        max_stack_height: 1,
        x_coordinate: 0,
        y_coordinate: 0,
        z_coordinate: 0,
        pick_priority: 5,
        distance_from_packing: 0,
        fefo_allowed: true,
        fifo_allowed: true,
    });

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value, type } = e.target;

        let parsedValue: any = value;
        if (type === "number") {
            // Coordinate fields must be integers according to backend schema
            if (name.includes('coordinate')) {
                parsedValue = value === "" ? null : Math.round(Number(value));
            } else {
                parsedValue = value === "" ? 0 : Number(value);
            }
        }

        setFormData(prev => ({
            ...prev,
            [name]: parsedValue
        }));
    };

    const handleSwitchChange = (name: string, checked: boolean) => {
        setFormData(prev => ({
            ...prev,
            [name]: checked
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!warehouseId) {
            toast.error("Invalid Warehouse ID");
            return;
        }

        if (!formData.code) {
            toast.error("Bin Code is required.");
            return;
        }

        if (!formData.bin_type) {
            toast.error("Bin Type is required.");
            return;
        }

        setIsLoading(true);
        try {
            // Aggressive cleaning to prevent 500 errors
            const cleanValue = (val: any) => (val === "" || val === undefined) ? null : val;

            const payload: any = {
                code: formData.code,
                bin_type: formData.bin_type,
                warehouse_id: warehouseId,
                zone_id: zoneId || null,

                // Optional fields as null instead of empty string
                barcode: cleanValue(formData.barcode),
                rfid_tag: cleanValue(formData.rfid_tag),
                aisle: cleanValue(formData.aisle),
                rack: cleanValue(formData.rack),
                shelf: cleanValue(formData.shelf),
                bin_position: cleanValue(formData.bin_position),

                // Coordinates as integers or null
                x_coordinate: formData.x_coordinate !== null ? Math.round(Number(formData.x_coordinate)) : null,
                y_coordinate: formData.y_coordinate !== null ? Math.round(Number(formData.y_coordinate)) : null,
                z_coordinate: formData.z_coordinate !== null ? Math.round(Number(formData.z_coordinate)) : null,

                // Numeric fields
                length_cm: Number(formData.length_cm) || 0,
                width_cm: Number(formData.width_cm) || 0,
                height_cm: Number(formData.height_cm) || 0,
                max_volume_cc: Number(formData.max_volume_cc) || 0,
                max_weight_kg: Number(formData.max_weight_kg) || 0,
                max_sku_count: Number(formData.max_sku_count) || 1,
                max_quantity: Number(formData.max_quantity) || 0,
                max_stack_height: Number(formData.max_stack_height) || 1,
                pick_priority: Number(formData.pick_priority) || 5,
                distance_from_packing: Number(formData.distance_from_packing) || 0,

                // Booleans
                fefo_allowed: !!formData.fefo_allowed,
                fifo_allowed: !!formData.fifo_allowed
            };

            await binsService.createBin(payload as BinData);

            toast.success("Bin created successfully");
            setOpen(false);
            onSuccess();
            // Reset form
            setFormData({
                code: "",
                barcode: "",
                rfid_tag: "",
                aisle: "",
                rack: "",
                shelf: "",
                bin_position: "",
                bin_type: "",
                length_cm: 0,
                width_cm: 0,
                height_cm: 0,
                max_volume_cc: 0,
                max_weight_kg: 0,
                max_sku_count: 1,
                max_quantity: 0,
                max_stack_height: 1,
                x_coordinate: 0,
                y_coordinate: 0,
                z_coordinate: 0,
                pick_priority: 5,
                distance_from_packing: 0,
                fefo_allowed: true,
                fifo_allowed: true,
            });
        } catch (error: any) {
            console.error("Error creating bin:", error);
            const errMsg = error?.response?.data?.detail || "Failed to create bin";
            toast.error(typeof errMsg === 'string' ? errMsg : "Failed to create bin");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Add New Bin</DialogTitle>
                    <DialogDescription>
                        Create a new storage bin in this zone.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-6 pt-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="code">Bin Code *</Label>
                            <Input id="code" name="code" value={formData.code} onChange={handleInputChange} placeholder="e.g. BIN-001" required />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="barcode">Barcode</Label>
                            <Input id="barcode" name="barcode" value={formData.barcode} onChange={handleInputChange} placeholder="Barcode string" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="rfid_tag">RFID Tag</Label>
                            <Input id="rfid_tag" name="rfid_tag" value={formData.rfid_tag} onChange={handleInputChange} placeholder="RFID string" />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="aisle">Aisle</Label>
                            <Input id="aisle" name="aisle" value={formData.aisle} onChange={handleInputChange} placeholder="e.g. A1" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="rack">Rack</Label>
                            <Input id="rack" name="rack" value={formData.rack} onChange={handleInputChange} placeholder="e.g. R2" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="shelf">Shelf</Label>
                            <Input id="shelf" name="shelf" value={formData.shelf} onChange={handleInputChange} placeholder="e.g. S3" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="bin_position">Position</Label>
                            <Input id="bin_position" name="bin_position" value={formData.bin_position} onChange={handleInputChange} placeholder="e.g. P1" />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="bin_type">Bin Type</Label>
                            <Input id="bin_type" name="bin_type" value={formData.bin_type} onChange={handleInputChange} placeholder="e.g. STANDARD, BULK" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="pick_priority">Pick Priority (1-10)</Label>
                            <Input type="number" id="pick_priority" name="pick_priority" value={formData.pick_priority} onChange={handleInputChange} min="1" max="10" />
                        </div>
                    </div>

                    <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
                        <div className="space-y-2 md:col-span-2">
                            <Label htmlFor="length_cm">Length (cm)</Label>
                            <Input type="number" step="0.1" id="length_cm" name="length_cm" value={formData.length_cm} onChange={handleInputChange} min="0" />
                        </div>
                        <div className="space-y-2 md:col-span-2">
                            <Label htmlFor="width_cm">Width (cm)</Label>
                            <Input type="number" step="0.1" id="width_cm" name="width_cm" value={formData.width_cm} onChange={handleInputChange} min="0" />
                        </div>
                        <div className="space-y-2 md:col-span-2">
                            <Label htmlFor="height_cm">Height (cm)</Label>
                            <Input type="number" step="0.1" id="height_cm" name="height_cm" value={formData.height_cm} onChange={handleInputChange} min="0" />
                        </div>
                        <div className="space-y-2 md:col-span-3">
                            <Label htmlFor="max_volume_cc">Max Volume (cc)</Label>
                            <Input type="number" step="0.1" id="max_volume_cc" name="max_volume_cc" value={formData.max_volume_cc} onChange={handleInputChange} min="0" />
                        </div>
                        <div className="space-y-2 md:col-span-3">
                            <Label htmlFor="max_weight_kg">Max Weight (kg)</Label>
                            <Input type="number" step="0.1" id="max_weight_kg" name="max_weight_kg" value={formData.max_weight_kg} onChange={handleInputChange} min="0" />
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="max_sku_count">Max SKUs</Label>
                            <Input type="number" id="max_sku_count" name="max_sku_count" value={formData.max_sku_count} onChange={handleInputChange} min="1" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="max_quantity">Max Quantity</Label>
                            <Input type="number" id="max_quantity" name="max_quantity" value={formData.max_quantity} onChange={handleInputChange} min="0" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="max_stack_height">Max Stack</Label>
                            <Input type="number" id="max_stack_height" name="max_stack_height" value={formData.max_stack_height} onChange={handleInputChange} min="1" />
                        </div>
                    </div>

                    <div className="grid grid-cols-4 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="x_coordinate">X Coord</Label>
                            <Input type="number" step="0.1" id="x_coordinate" name="x_coordinate" value={formData.x_coordinate} onChange={handleInputChange} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="y_coordinate">Y Coord</Label>
                            <Input type="number" step="0.1" id="y_coordinate" name="y_coordinate" value={formData.y_coordinate} onChange={handleInputChange} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="z_coordinate">Z Coord</Label>
                            <Input type="number" step="0.1" id="z_coordinate" name="z_coordinate" value={formData.z_coordinate} onChange={handleInputChange} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="distance_from_packing">Dist to Pack (m)</Label>
                            <Input type="number" step="0.1" id="distance_from_packing" name="distance_from_packing" value={formData.distance_from_packing} onChange={handleInputChange} min="0" />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 pt-2">
                        <div className="flex items-center space-x-2 border p-3 rounded-lg">
                            <Switch id="fefo_allowed" checked={formData.fefo_allowed} onCheckedChange={(c) => handleSwitchChange("fefo_allowed", c)} />
                            <Label htmlFor="fefo_allowed">FEFO Allowed</Label>
                        </div>
                        <div className="flex items-center space-x-2 border p-3 rounded-lg">
                            <Switch id="fifo_allowed" checked={formData.fifo_allowed} onCheckedChange={(c) => handleSwitchChange("fifo_allowed", c)} />
                            <Label htmlFor="fifo_allowed">FIFO Allowed</Label>
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t">
                        <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isLoading}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={isLoading}>
                            {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                            Create Bin
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
};
