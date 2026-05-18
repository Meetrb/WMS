import React, { useEffect, useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Box, Info, MapPin } from "lucide-react";
import { toast } from "sonner";
import { binsService } from "@/services/binsService";
import type { BinData, BinUpdateData } from "@/services/binsService";
import { BinTypeSelect } from "./BinTypeSelect";

interface BinDetailsModalProps {
    open: boolean;
    setOpen: (open: boolean) => void;
    binId?: string;
    binData?: BinData | null; // Allow passing pre-loaded data if available
    onUpdated?: (bin: BinData) => void;
}

interface BinEditFormData {
    zone_id: string;
    barcode: string;
    rfid_tag: string;
    bin_type: string;
    length_cm: string;
    width_cm: string;
    height_cm: string;
    max_volume_cc: string;
    max_weight_kg: string;
    max_sku_count: string;
    max_quantity: string;
    max_stack_height: string;
    x_coordinate: string;
    y_coordinate: string;
    z_coordinate: string;
    pick_priority: string;
    distance_from_packing: string;
    compatibility_rules: string;
    fefo_allowed: boolean;
    fifo_allowed: boolean;
    status: string;
    is_blocked: boolean;
    blocked_reason: string;
}

const toInputValue = (value: unknown) => {
    if (value === null || value === undefined) return "";
    return String(value);
};

const buildEditForm = (currentBin: BinData | null): BinEditFormData => ({
    zone_id: toInputValue(currentBin?.zone_id),
    barcode: toInputValue(currentBin?.barcode),
    rfid_tag: toInputValue(currentBin?.rfid_tag),
    bin_type: toInputValue(currentBin?.bin_type),
    length_cm: toInputValue(currentBin?.length_cm),
    width_cm: toInputValue(currentBin?.width_cm),
    height_cm: toInputValue(currentBin?.height_cm),
    max_volume_cc: toInputValue(currentBin?.max_volume_cc),
    max_weight_kg: toInputValue(currentBin?.max_weight_kg),
    max_sku_count: toInputValue(currentBin?.max_sku_count),
    max_quantity: toInputValue(currentBin?.max_quantity),
    max_stack_height: toInputValue(currentBin?.max_stack_height),
    x_coordinate: toInputValue(currentBin?.x_coordinate),
    y_coordinate: toInputValue(currentBin?.y_coordinate),
    z_coordinate: toInputValue(currentBin?.z_coordinate),
    pick_priority: toInputValue(currentBin?.pick_priority),
    distance_from_packing: toInputValue(currentBin?.distance_from_packing),
    compatibility_rules: JSON.stringify(currentBin?.compatibility_rules || {}, null, 2),
    fefo_allowed: currentBin?.fefo_allowed ?? true,
    fifo_allowed: currentBin?.fifo_allowed ?? true,
    status: currentBin?.status || (currentBin?.is_active !== false ? "ACTIVE" : "INACTIVE"),
    is_blocked: currentBin?.is_blocked ?? false,
    blocked_reason: toInputValue(currentBin?.blocked_reason),
});

const toNullableNumber = (value: string) => {
    if (value.trim() === "") return null;
    const parsed = Number(value);
    return Number.isNaN(parsed) ? null : parsed;
};

const toNullableInteger = (value: string) => {
    if (value.trim() === "") return null;
    const parsed = Number(value);
    return Number.isNaN(parsed) ? null : Math.round(parsed);
};

export const BinDetailsModal: React.FC<BinDetailsModalProps> = ({ open, setOpen, binId, binData, onUpdated }) => {
    const [bin, setBin] = useState<BinData | null>(binData || null);
    const [isLoading, setIsLoading] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [editForm, setEditForm] = useState<BinEditFormData>(() => buildEditForm(binData || null));

    useEffect(() => {
        if (!open) return;

        const fetchBinDetails = async () => {
            if (binId) {
                setIsLoading(true);
                try {
                    const data = await binsService.getBinById(binId);
                    setBin(data);
                } catch (error) {
                    console.error("Failed to fetch bin details:", error);
                } finally {
                    setIsLoading(false);
                }
            } else if (binData) {
                setBin(binData);
            }
        };

        fetchBinDetails();
    }, [open, binId, binData]);

    useEffect(() => {
        setEditForm(buildEditForm(bin));
    }, [bin]);

    useEffect(() => {
        if (!open) {
            setIsEditing(false);
            setIsSaving(false);
        }
    }, [open]);

    const handleInputChange = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = event.target;
        setEditForm((prev) => ({
            ...prev,
            [name]: value,
        }));
    };

    const handleSwitchChange = (name: keyof Pick<BinEditFormData, "fefo_allowed" | "fifo_allowed" | "is_blocked">, checked: boolean) => {
        setEditForm((prev) => ({
            ...prev,
            [name]: checked,
            ...(name === "is_blocked" && !checked ? { blocked_reason: "" } : {}),
        }));
    };

    const handleEditStart = () => {
        setEditForm(buildEditForm(bin));
        setIsEditing(true);
    };

    const handleEditCancel = () => {
        setEditForm(buildEditForm(bin));
        setIsEditing(false);
    };

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();

        const resolvedBinId = bin?.id || binId;
        if (!resolvedBinId) {
            toast.error("Bin ID is missing.");
            return;
        }

        let compatibilityRules: Record<string, any> | null = null;
        const rawRules = editForm.compatibility_rules.trim();
        if (rawRules) {
            try {
                const parsed = JSON.parse(rawRules);
                if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
                    compatibilityRules = parsed;
                } else {
                    toast.error("Compatibility rules must be a valid JSON object.");
                    return;
                }
            } catch {
                toast.error("Compatibility rules must be valid JSON.");
                return;
            }
        }

        const payload: BinUpdateData = {
            zone_id: editForm.zone_id.trim() || null,
            barcode: editForm.barcode.trim() || null,
            rfid_tag: editForm.rfid_tag.trim() || null,
            bin_type: editForm.bin_type.trim() || null,
            length_cm: toNullableNumber(editForm.length_cm),
            width_cm: toNullableNumber(editForm.width_cm),
            height_cm: toNullableNumber(editForm.height_cm),
            max_volume_cc: toNullableNumber(editForm.max_volume_cc),
            max_weight_kg: toNullableNumber(editForm.max_weight_kg),
            max_sku_count: toNullableInteger(editForm.max_sku_count),
            max_quantity: toNullableNumber(editForm.max_quantity),
            max_stack_height: toNullableInteger(editForm.max_stack_height),
            x_coordinate: toNullableInteger(editForm.x_coordinate),
            y_coordinate: toNullableInteger(editForm.y_coordinate),
            z_coordinate: toNullableInteger(editForm.z_coordinate),
            pick_priority: toNullableInteger(editForm.pick_priority),
            distance_from_packing: toNullableNumber(editForm.distance_from_packing),
            compatibility_rules: compatibilityRules,
            fefo_allowed: editForm.fefo_allowed,
            fifo_allowed: editForm.fifo_allowed,
            status: editForm.status.trim() || null,
            is_blocked: editForm.is_blocked,
            blocked_reason: editForm.is_blocked ? (editForm.blocked_reason.trim() || null) : null,
        };

        setIsSaving(true);
        try {
            const updatedBin = await binsService.updateBin(resolvedBinId, payload);
            setBin(updatedBin);
            setIsEditing(false);
            onUpdated?.(updatedBin);
            toast.success("Bin updated successfully");
        } catch (error: any) {
            console.error("Failed to update bin:", error);
            const detail = error?.response?.data?.detail;
            toast.error(typeof detail === "string" ? detail : "Failed to update bin");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <DialogTitle className="text-2xl font-bold flex items-center gap-2">
                                <Box className="w-6 h-6 text-primary" />
                                Bin: {bin?.code}
                            </DialogTitle>
                            <DialogDescription className="mt-2">
                                Detail Overview for Bin ID: {bin?.id || binId}
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <div className="mt-4">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-12">
                            <Loader2 className="w-8 h-8 animate-spin text-primary" />
                            <p className="mt-4 text-sm text-muted-foreground animate-pulse">Loading Bin Details...</p>
                        </div>
                    ) : !bin ? (
                        <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                            <Box className="w-12 h-12 mb-4 opacity-20" />
                            <p>No Bin Details found.</p>
                        </div>
                    ) : isEditing ? (
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="zone_id">Zone ID</Label>
                                    <Input id="zone_id" name="zone_id" value={editForm.zone_id} onChange={handleInputChange} />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="barcode">Barcode</Label>
                                    <Input id="barcode" name="barcode" value={editForm.barcode} onChange={handleInputChange} />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="rfid_tag">RFID Tag</Label>
                                    <Input id="rfid_tag" name="rfid_tag" value={editForm.rfid_tag} onChange={handleInputChange} />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="bin_type">Bin Type</Label>
                                    <BinTypeSelect 
                                        value={editForm.bin_type} 
                                        onValueChange={(value) => setEditForm(prev => ({ ...prev, bin_type: value }))}
                                        id="bin_type"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="status">Status</Label>
                                    <Input id="status" name="status" value={editForm.status} onChange={handleInputChange} placeholder="ACTIVE" />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="blocked_reason">Blocked Reason</Label>
                                    <Input id="blocked_reason" name="blocked_reason" value={editForm.blocked_reason} onChange={handleInputChange} disabled={!editForm.is_blocked} />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="length_cm">Length (cm)</Label>
                                    <Input type="number" step="0.01" id="length_cm" name="length_cm" value={editForm.length_cm} onChange={handleInputChange} />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="width_cm">Width (cm)</Label>
                                    <Input type="number" step="0.01" id="width_cm" name="width_cm" value={editForm.width_cm} onChange={handleInputChange} />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="height_cm">Height (cm)</Label>
                                    <Input type="number" step="0.01" id="height_cm" name="height_cm" value={editForm.height_cm} onChange={handleInputChange} />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="max_volume_cc">Max Volume (cc)</Label>
                                    <Input type="number" step="0.01" id="max_volume_cc" name="max_volume_cc" value={editForm.max_volume_cc} onChange={handleInputChange} />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="max_weight_kg">Max Weight (kg)</Label>
                                    <Input type="number" step="0.01" id="max_weight_kg" name="max_weight_kg" value={editForm.max_weight_kg} onChange={handleInputChange} />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="max_sku_count">Max SKU Count</Label>
                                    <Input type="number" id="max_sku_count" name="max_sku_count" value={editForm.max_sku_count} onChange={handleInputChange} />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="max_quantity">Max Quantity</Label>
                                    <Input type="number" step="0.01" id="max_quantity" name="max_quantity" value={editForm.max_quantity} onChange={handleInputChange} />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="max_stack_height">Max Stack Height</Label>
                                    <Input type="number" id="max_stack_height" name="max_stack_height" value={editForm.max_stack_height} onChange={handleInputChange} />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="x_coordinate">X Coordinate</Label>
                                    <Input type="number" id="x_coordinate" name="x_coordinate" value={editForm.x_coordinate} onChange={handleInputChange} />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="y_coordinate">Y Coordinate</Label>
                                    <Input type="number" id="y_coordinate" name="y_coordinate" value={editForm.y_coordinate} onChange={handleInputChange} />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="z_coordinate">Z Coordinate</Label>
                                    <Input type="number" id="z_coordinate" name="z_coordinate" value={editForm.z_coordinate} onChange={handleInputChange} />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="pick_priority">Pick Priority</Label>
                                    <Input type="number" id="pick_priority" name="pick_priority" value={editForm.pick_priority} onChange={handleInputChange} />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="distance_from_packing">Distance From Packing</Label>
                                    <Input type="number" step="0.01" id="distance_from_packing" name="distance_from_packing" value={editForm.distance_from_packing} onChange={handleInputChange} />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="compatibility_rules">Compatibility Rules (JSON)</Label>
                                <Textarea id="compatibility_rules" name="compatibility_rules" value={editForm.compatibility_rules} onChange={handleInputChange} rows={6} className="font-mono text-xs" />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="flex items-center justify-between border rounded-lg p-3">
                                    <Label htmlFor="fefo_allowed">FEFO Allowed</Label>
                                    <Switch id="fefo_allowed" checked={editForm.fefo_allowed} onCheckedChange={(checked) => handleSwitchChange("fefo_allowed", checked)} />
                                </div>
                                <div className="flex items-center justify-between border rounded-lg p-3">
                                    <Label htmlFor="fifo_allowed">FIFO Allowed</Label>
                                    <Switch id="fifo_allowed" checked={editForm.fifo_allowed} onCheckedChange={(checked) => handleSwitchChange("fifo_allowed", checked)} />
                                </div>
                                <div className="flex items-center justify-between border rounded-lg p-3">
                                    <Label htmlFor="is_blocked">Is Blocked</Label>
                                    <Switch id="is_blocked" checked={editForm.is_blocked} onCheckedChange={(checked) => handleSwitchChange("is_blocked", checked)} />
                                </div>
                            </div>
                        </form>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Primary Information */}
                            <div className="space-y-4">
                                <h4 className="text-sm font-bold uppercase text-muted-foreground flex items-center gap-2 border-b pb-2">
                                    <Info className="w-4 h-4" />
                                    General Information
                                </h4>
                                <div className="grid grid-cols-2 gap-y-4 gap-x-2">
                                    <div>
                                        <div className="text-xs text-muted-foreground uppercase font-semibold">Barcode</div>
                                        <div className="font-mono text-sm">{bin.barcode || "-"}</div>
                                    </div>
                                    <div>
                                        <div className="text-xs text-muted-foreground uppercase font-semibold">RFID Tag</div>
                                        <div className="font-mono text-sm">{bin.rfid_tag || "-"}</div>
                                    </div>
                                    <div>
                                        <div className="text-xs text-muted-foreground uppercase font-semibold">Bin Type</div>
                                        <div className="text-sm">{bin.bin_type || "-"}</div>
                                    </div>
                                    <div>
                                        <div className="text-xs text-muted-foreground uppercase font-semibold">Status</div>
                                        <div className="mt-1">
                                            <Badge variant={bin.is_active !== false ? "default" : "secondary"} className={bin.is_active !== false ? "bg-emerald-500/10 text-emerald-600" : ""}>
                                                {bin.is_active !== false ? "Active" : "Inactive"}
                                            </Badge>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Location Indicators */}
                            <div className="space-y-4">
                                <h4 className="text-sm font-bold uppercase text-muted-foreground flex items-center gap-2 border-b pb-2">
                                    <MapPin className="w-4 h-4" />
                                    Location Details
                                </h4>
                                <div className="grid grid-cols-2 gap-y-4 gap-x-2">
                                    <div>
                                        <div className="text-xs text-muted-foreground uppercase font-semibold">Aisle</div>
                                        <div className="text-sm font-mono font-bold bg-muted/50 p-1 rounded inline-block px-2">{bin.aisle || "-"}</div>
                                    </div>
                                    <div>
                                        <div className="text-xs text-muted-foreground uppercase font-semibold">Rack</div>
                                        <div className="text-sm font-mono font-bold bg-muted/50 p-1 rounded inline-block px-2">{bin.rack || "-"}</div>
                                    </div>
                                    <div>
                                        <div className="text-xs text-muted-foreground uppercase font-semibold">Shelf</div>
                                        <div className="text-sm font-mono font-bold bg-muted/50 p-1 rounded inline-block px-2">{bin.shelf || "-"}</div>
                                    </div>
                                    <div>
                                        <div className="text-xs text-muted-foreground uppercase font-semibold">Position</div>
                                        <div className="text-sm font-mono font-bold bg-muted/50 p-1 rounded inline-block px-2">{bin.bin_position || "-"}</div>
                                    </div>
                                </div>
                            </div>

                            {/* Dimensions and Constraints */}
                            <div className="col-span-1 md:col-span-2 space-y-4">
                                <h4 className="text-sm font-bold uppercase text-muted-foreground border-b pb-2 mt-2">
                                    Dimensions & Constraints
                                </h4>
                                <div className="grid grid-cols-3 md:grid-cols-5 gap-y-4 gap-x-2 p-4 bg-muted/10 rounded-xl border border-primary/10">
                                    <div>
                                        <div className="text-[10px] text-muted-foreground uppercase font-semibold">L x W x H (cm)</div>
                                        <div className="text-sm font-mono">{bin.length_cm || 0} x {bin.width_cm || 0} x {bin.height_cm || 0}</div>
                                    </div>
                                    <div>
                                        <div className="text-[10px] text-muted-foreground uppercase font-semibold">Max Vol (cc)</div>
                                        <div className="text-sm font-mono">{bin.max_volume_cc ? Number(bin.max_volume_cc).toLocaleString() : 0}</div>
                                    </div>
                                    <div>
                                        <div className="text-[10px] text-muted-foreground uppercase font-semibold">Max Wt (kg)</div>
                                        <div className="text-sm font-mono">{bin.max_weight_kg ? Number(bin.max_weight_kg).toLocaleString() : 0}</div>
                                    </div>
                                    <div>
                                        <div className="text-[10px] text-muted-foreground uppercase font-semibold">Max SKUs</div>
                                        <div className="text-sm font-mono">{bin.max_sku_count || 1}</div>
                                    </div>
                                    <div>
                                        <div className="text-[10px] text-muted-foreground uppercase font-semibold">Pick Priority</div>
                                        <div className="text-sm font-mono font-bold text-primary">{bin.pick_priority || 5}</div>
                                    </div>
                                </div>
                            </div>

                            {/* Picking Metadata */}
                            <div className="col-span-1 md:col-span-2 space-y-4">
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    <div className="border border-input rounded-lg p-3 text-center">
                                        <div className="text-xs text-muted-foreground uppercase">FEFO Allowed</div>
                                        <div className={`mt-1 font-bold ${bin.fefo_allowed ? 'text-emerald-500' : 'text-red-500'}`}>
                                            {bin.fefo_allowed ? 'YES' : 'NO'}
                                        </div>
                                    </div>
                                    <div className="border border-input rounded-lg p-3 text-center">
                                        <div className="text-xs text-muted-foreground uppercase">FIFO Allowed</div>
                                        <div className={`mt-1 font-bold ${bin.fifo_allowed ? 'text-emerald-500' : 'text-red-500'}`}>
                                            {bin.fifo_allowed ? 'YES' : 'NO'}
                                        </div>
                                    </div>
                                    <div className="border border-input rounded-lg p-3 text-center col-span-2 md:col-span-2 flex flex-col justify-center">
                                        <div className="text-xs text-muted-foreground uppercase">Coordinates (X, Y, Z)</div>
                                        <div className="mt-1 font-mono text-sm">
                                            {bin.x_coordinate || 0}, {bin.y_coordinate || 0}, {bin.z_coordinate || 0}
                                        </div>
                                    </div>
                                </div>
                            </div>

                        </div>
                    )}
                </div>

                <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
                    {isEditing ? (
                        <>
                            <Button type="button" variant="outline" onClick={handleEditCancel} disabled={isSaving}>
                                Cancel Edit
                            </Button>
                            <Button type="submit" onClick={handleSubmit} disabled={isSaving || isLoading}>
                                {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                                Edit Bin
                            </Button>
                        </>
                    ) : (
                        <>
                            <Button variant="outline" onClick={() => setOpen(false)}>
                                Close Details
                            </Button>
                            <Button onClick={handleEditStart} disabled={!bin || isLoading}>
                                Edit Facility
                            </Button>
                        </>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
