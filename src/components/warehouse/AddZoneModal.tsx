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
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { zoneService } from "@/services/zoneService";
import type { ZoneData } from "@/services/zoneService";
import { Loader2 } from "lucide-react";

interface AddZoneModalProps {
    open: boolean;
    setOpen: (open: boolean) => void;
    warehouseId: string | null;
    onSuccess: () => void;
}

export const AddZoneModal: React.FC<AddZoneModalProps> = ({ open, setOpen, warehouseId, onSuccess }) => {
    const [isLoading, setIsLoading] = useState(false);
    const [formData, setFormData] = useState<Partial<ZoneData>>({
        code: "",
        name: "",
        description: "",
        zone_type: "",
        length_meters: 0,
        width_meters: 0,
        height_meters: 0,
        floor_area_sqft: 0,
        temperature_min_celsius: 0,
        temperature_max_celsius: 0,
        humidity_percent: 0,
        is_hazardous: false,
        is_refrigerated: false,
        is_clean_room: false,
        special_condition: "",
        max_pallet_positions: 0,
        is_active: true,
    });

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value, type } = e.target;

        let parsedValue: any = value;
        if (type === "number") {
            parsedValue = value === "" ? 0 : Number(value);
        }

        setFormData(prev => ({
            ...prev,
            [name]: parsedValue
        }));
    };

    const handleCheckboxChange = (name: string, checked: boolean) => {
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

        if (!formData.code || !formData.name || !formData.zone_type) {
            toast.error("Code, Name, and Zone Type are required.");
            return;
        }

        setIsLoading(true);
        try {
            const payload: ZoneData = {
                ...formData as ZoneData,
                warehouse_id: warehouseId
            };

            await zoneService.createZone(payload);

            toast.success("Zone created successfully");
            setOpen(false);
            onSuccess();
            // Reset form
            setFormData({
                code: "",
                name: "",
                description: "",
                zone_type: "",
                length_meters: 0,
                width_meters: 0,
                height_meters: 0,
                floor_area_sqft: 0,
                temperature_min_celsius: 0,
                temperature_max_celsius: 0,
                humidity_percent: 0,
                is_hazardous: false,
                is_refrigerated: false,
                is_clean_room: false,
                special_condition: "",
                max_pallet_positions: 0,
                is_active: true,
            });
        } catch (error: any) {
            console.error("Error creating zone:", error);
            const errMsg = error?.response?.data?.detail || "Failed to create zone";
            toast.error(typeof errMsg === 'string' ? errMsg : "Failed to create zone");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Add New Zone</DialogTitle>
                    <DialogDescription>
                        Create a new storage zone in this warehouse facility.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-6 pt-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="code">Zone Code *</Label>
                            <Input id="code" name="code" value={formData.code} onChange={handleInputChange} placeholder="e.g. ZN-A1" required />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="name">Zone Name *</Label>
                            <Input id="name" name="name" value={formData.name} onChange={handleInputChange} placeholder="e.g. Cold Storage Alpha" required />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="description">Description</Label>
                        <Textarea id="description" name="description" value={formData.description} onChange={handleInputChange} placeholder="Details about this zone..." />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="zone_type">Zone Type *</Label>
                            <Input id="zone_type" name="zone_type" value={formData.zone_type} onChange={handleInputChange} placeholder="e.g. RACK, FLOOR, COLD" required />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="max_pallet_positions">Max Pallet Positions</Label>
                            <Input type="number" id="max_pallet_positions" name="max_pallet_positions" value={formData.max_pallet_positions} onChange={handleInputChange} min="0" />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="length_meters">Length (m)</Label>
                            <Input type="number" step="0.1" id="length_meters" name="length_meters" value={formData.length_meters} onChange={handleInputChange} min="0" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="width_meters">Width (m)</Label>
                            <Input type="number" step="0.1" id="width_meters" name="width_meters" value={formData.width_meters} onChange={handleInputChange} min="0" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="height_meters">Height (m)</Label>
                            <Input type="number" step="0.1" id="height_meters" name="height_meters" value={formData.height_meters} onChange={handleInputChange} min="0" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="floor_area_sqft">Area (sqft)</Label>
                            <Input type="number" step="0.1" id="floor_area_sqft" name="floor_area_sqft" value={formData.floor_area_sqft} onChange={handleInputChange} min="0" />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="temperature_min_celsius">Min Temp (°C)</Label>
                            <Input type="number" step="0.1" id="temperature_min_celsius" name="temperature_min_celsius" value={formData.temperature_min_celsius} onChange={handleInputChange} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="temperature_max_celsius">Max Temp (°C)</Label>
                            <Input type="number" step="0.1" id="temperature_max_celsius" name="temperature_max_celsius" value={formData.temperature_max_celsius} onChange={handleInputChange} />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="humidity_percent">Humidity (%)</Label>
                            <Input type="number" step="0.1" id="humidity_percent" name="humidity_percent" value={formData.humidity_percent} onChange={handleInputChange} min="0" max="100" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="special_condition">Special Handling Condition</Label>
                            <Input id="special_condition" name="special_condition" value={formData.special_condition} onChange={handleInputChange} placeholder="e.g. Fragile" />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2">
                        <div className="flex items-center space-x-2">
                            <Checkbox id="is_hazardous" checked={formData.is_hazardous} onCheckedChange={(c) => handleCheckboxChange("is_hazardous", c === true)} />
                            <Label htmlFor="is_hazardous">Hazardous</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                            <Checkbox id="is_refrigerated" checked={formData.is_refrigerated} onCheckedChange={(c) => handleCheckboxChange("is_refrigerated", c === true)} />
                            <Label htmlFor="is_refrigerated">Refrigerated</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                            <Checkbox id="is_clean_room" checked={formData.is_clean_room} onCheckedChange={(c) => handleCheckboxChange("is_clean_room", c === true)} />
                            <Label htmlFor="is_clean_room">Clean Room</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                            <Checkbox id="is_active" checked={formData.is_active} onCheckedChange={(c) => handleCheckboxChange("is_active", c === true)} />
                            <Label htmlFor="is_active">Active</Label>
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t">
                        <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isLoading}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={isLoading}>
                            {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                            Create Zone
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
};
