import React, { useState, useEffect } from "react";
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
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

// ✅ Clean list — matches backend enum exactly
const zoneTypes = [
    // Inbound / Outbound
    { value: 'RECEIVING',  label: 'Receiving Area',       category: 'Inbound/Outbound' },
    { value: 'STAGING',    label: 'Staging / Cross-Dock', category: 'Inbound/Outbound' },
    { value: 'DISPATCH',   label: 'Dispatch / Shipping',  category: 'Inbound/Outbound' },
    // Storage
    { value: 'BULK',       label: 'Bulk Storage',         category: 'Storage' },
    { value: 'PALLET',     label: 'Pallet Racking',       category: 'Storage' },
    { value: 'RACK',       label: 'Rack / Shelf Storage', category: 'Storage' },
    { value: 'FLOOR',      label: 'Floor Storage',        category: 'Storage' },
    // Picking
    { value: 'PICKER',     label: 'Pick Face (A-Class)',  category: 'Picking' },
    { value: 'NORMAL',     label: 'Standard Pick Zone',   category: 'Picking' },
    // Processing
    { value: 'PACKING',    label: 'Packing Station',      category: 'Processing' },
    { value: 'RETURNS',    label: 'Returns Processing',   category: 'Processing' },
    // Special Handling
    { value: 'QUARANTINE', label: 'Quarantine',           category: 'Special Handling' },
    { value: 'REJECTED',   label: 'Rejected / Damaged',   category: 'Special Handling' },
    { value: 'HAZMAT',     label: 'Hazardous Materials',  category: 'Special Handling' },
    { value: 'HIGH_VALUE', label: 'High Value (Secure)',  category: 'Special Handling' },
    { value: 'COLD_STORAGE', label: 'Cold Storage',        category: 'Special Handling' },
];

// Separate dropdown for storage condition
const storageConditions = [
    { value: 'AMBIENT',  label: 'Ambient (Default)' },
    { value: 'CHILLED',  label: 'Chilled (8-15°C)' },
    { value: 'COLD',     label: 'Cold (2-8°C)' },
    { value: 'FROZEN',   label: 'Frozen (-18°C)' },
    { value: 'HAZMAT',   label: 'Hazardous' },
];

interface EditZoneModalProps {
    open: boolean;
    setOpen: (open: boolean) => void;
    zone: ZoneData | null;
    onSuccess: (updatedZone: ZoneData) => void;
}

export const EditZoneModal: React.FC<EditZoneModalProps> = ({ open, setOpen, zone, onSuccess }) => {
    const [isLoading, setIsLoading] = useState(false);
    const [formData, setFormData] = useState<Partial<ZoneData>>({
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
        storage_condition: "AMBIENT",
    });

    useEffect(() => {
        if (zone) {
            setFormData({
                name: zone.name || "",
                description: zone.description || "",
                zone_type: zone.zone_type || "",
                length_meters: zone.length_meters || 0,
                width_meters: zone.width_meters || 0,
                height_meters: zone.height_meters || 0,
                floor_area_sqft: zone.floor_area_sqft || 0,
                temperature_min_celsius: zone.temperature_min_celsius || 0,
                temperature_max_celsius: zone.temperature_max_celsius || 0,
                humidity_percent: zone.humidity_percent || 0,
                is_hazardous: zone.is_hazardous || false,
                is_refrigerated: zone.is_refrigerated || false,
                is_clean_room: zone.is_clean_room || false,
                special_condition: zone.special_condition || "",
                max_pallet_positions: zone.max_pallet_positions || 0,
                is_active: zone.is_active !== false,
                storage_condition: (zone as any).storage_condition || "AMBIENT",
            });
        }
    }, [zone, open]);

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

    const handleSelectChange = (name: string, value: string) => {
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!zone?.id) {
            toast.error("Invalid Zone ID");
            return;
        }

        if (!formData.name || !formData.zone_type) {
            toast.error("Name and Zone Type are required.");
            return;
        }

        setIsLoading(true);
        try {
            const updatedZone = await zoneService.updateZone(zone.id, formData);
            toast.success("Zone updated successfully");
            setOpen(false);
            onSuccess(updatedZone);
        } catch (error: any) {
            console.error("Error updating zone:", error);
            const errMsg = error?.response?.data?.detail || "Failed to update zone";
            toast.error(typeof errMsg === 'string' ? errMsg : "Failed to update zone");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Edit Zone: {zone?.code}</DialogTitle>
                    <DialogDescription>
                        Update the details for this storage zone.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-6 pt-4">
                    <div className="grid grid-cols-1 gap-4">
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
                            <Select 
                                value={formData.zone_type} 
                                onValueChange={(v) => handleSelectChange("zone_type", v)}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select Zone Type" />
                                </SelectTrigger>
                                <SelectContent>
                                    {Array.from(new Set(zoneTypes.map(z => z.category))).map(category => (
                                        <SelectGroup key={category}>
                                            <SelectLabel className="text-xs font-bold text-muted-foreground uppercase px-2 py-1.5">{category}</SelectLabel>
                                            {zoneTypes.filter(z => z.category === category).map(type => (
                                                <SelectItem key={type.value} value={type.value}>
                                                    {type.label}
                                                </SelectItem>
                                            ))}
                                        </SelectGroup>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="storage_condition">Storage Condition</Label>
                            <Select 
                                value={formData.storage_condition} 
                                onValueChange={(v) => handleSelectChange("storage_condition", v)}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select Condition" />
                                </SelectTrigger>
                                <SelectContent>
                                    {storageConditions.map(condition => (
                                        <SelectItem key={condition.value} value={condition.value}>
                                            {condition.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="max_pallet_positions">Max Pallet Positions</Label>
                            <Input type="number" id="max_pallet_positions" name="max_pallet_positions" value={formData.max_pallet_positions} onChange={handleInputChange} min="0" />
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
                            Save Changes
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
};
