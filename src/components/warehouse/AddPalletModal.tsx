import React, { useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Loader2, Package, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { palletService, type PalletData } from "@/services/palletService";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface AddPalletModalProps {
    open: boolean;
    setOpen: (open: boolean) => void;
    warehouseId: string | null;
    warehouseName?: string;
    onSuccess?: () => void;
}

export const AddPalletModal: React.FC<AddPalletModalProps> = ({
    open,
    setOpen,
    warehouseId,
    warehouseName,
    onSuccess,
}) => {
    const [isCreating, setIsCreating] = useState(false);
    const resolvePalletType = (value: unknown): "STANDARD" | "REJECTED" => {
        const token = String(value ?? "").trim().toLowerCase();
        return token.includes("reject") ? "REJECTED" : "STANDARD";
    };

    const [formData, setFormData] = useState<PalletData>({
        barcode: "",
        pallet_code: "",
        warehouse_id: warehouseId || "",
        max_quantity: 0,
        max_weight_kg: 0,
        max_volume_cm3: 0,
        pallet_type: "STANDARD",
        status: "ACTIVE",
    });

    const handleOpenChange = (newOpen: boolean) => {
        setOpen(newOpen);
        if (!newOpen) {
            setFormData({
                barcode: "",
                pallet_code: "",
                warehouse_id: warehouseId || "",
                max_quantity: 0,
                max_weight_kg: 0,
                max_volume_cm3: 0,
                pallet_type: "STANDARD",
                status: "ACTIVE",
            });
        }
    };

    const handleCreatePallet = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.barcode.trim()) {
            toast.error("Barcode is required");
            return;
        }

        if (!formData.pallet_code.trim()) {
            toast.error("Pallet Code is required");
            return;
        }

        if (!formData.warehouse_id.trim()) {
            toast.error("Warehouse ID is required");
            return;
        }

        setIsCreating(true);
        try {
            const normalizedType = resolvePalletType(formData.pallet_type || formData.type);
            await palletService.create({
                barcode: formData.barcode.trim(),
                pallet_code: formData.pallet_code.trim(),
                warehouse_id: formData.warehouse_id.trim(),
                max_quantity: Number(formData.max_quantity) || 0,
                max_weight_kg: Number(formData.max_weight_kg) || 0,
                max_volume_cm3: Number(formData.max_volume_cm3) || 0,
                pallet_type: normalizedType,
                type: normalizedType.toLowerCase(),
                status: (formData.status || "ACTIVE").toUpperCase(),
            });

            toast.success("Pallet created successfully!");
            setFormData({
                barcode: "",
                pallet_code: "",
                warehouse_id: warehouseId || "",
                max_quantity: 0,
                max_weight_kg: 0,
                max_volume_cm3: 0,
                pallet_type: "STANDARD",
                status: "ACTIVE",
            });
            setOpen(false);
            onSuccess?.();
        } catch (error: any) {
            console.error("Failed to create pallet", error);
            const errMsg = error?.response?.data?.detail || error?.message || "Failed to create pallet";
            toast.error(typeof errMsg === "string" ? errMsg : "Failed to create pallet");
        } finally {
            setIsCreating(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Package className="h-5 w-5 text-primary" />
                        Create New Pallet
                    </DialogTitle>
                    <DialogDescription>
                        Add a new pallet to {warehouseName || "this warehouse"}. Fill in all required fields.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleCreatePallet} className="space-y-5">
                    <Alert className="border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-800">
                        <AlertCircle className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                        <AlertDescription className="text-blue-800 dark:text-blue-200 text-sm">
                            Barcode and Pallet Code must be unique within the warehouse.
                        </AlertDescription>
                    </Alert>

                    {/* Pallet Barcode */}
                    <div className="space-y-2.5">
                        <Label htmlFor="palletBarcode" className="text-sm font-semibold">
                            Pallet Barcode <span className="text-destructive">*</span>
                        </Label>
                        <Input
                            id="palletBarcode"
                            type="text"
                            value={formData.barcode}
                            onChange={(e) => setFormData((prev) => ({ ...prev, barcode: e.target.value }))}
                            placeholder="e.g., BAR-123456789"
                            disabled={isCreating}
                            required
                        />
                    </div>

                    {/* Pallet Code */}
                    <div className="space-y-2.5">
                        <Label htmlFor="palletCode" className="text-sm font-semibold">
                            Pallet Code <span className="text-destructive">*</span>
                        </Label>
                        <Input
                            id="palletCode"
                            type="text"
                            value={formData.pallet_code}
                            onChange={(e) => setFormData((prev) => ({ ...prev, pallet_code: e.target.value }))}
                            placeholder="e.g., PLT-001"
                            disabled={isCreating}
                            required
                        />
                    </div>

                    <div className="grid gap-4 md:grid-cols-3">
                        <div className="space-y-2.5">
                            <Label htmlFor="palletMaxQuantity" className="text-sm font-semibold">
                                Max Quantity
                            </Label>
                            <Input
                                id="palletMaxQuantity"
                                type="number"
                                min="0"
                                step="1"
                                value={formData.max_quantity ?? 0}
                                onChange={(e) =>
                                    setFormData((prev) => ({
                                        ...prev,
                                        max_quantity: Number(e.target.value) || 0,
                                    }))
                                }
                                placeholder="e.g., 100"
                                disabled={isCreating}
                            />
                        </div>
                        <div className="space-y-2.5">
                            <Label htmlFor="palletMaxWeight" className="text-sm font-semibold">
                                Max Weight (kg)
                            </Label>
                            <Input
                                id="palletMaxWeight"
                                type="number"
                                min="0"
                                step="0.01"
                                value={formData.max_weight_kg ?? 0}
                                onChange={(e) =>
                                    setFormData((prev) => ({
                                        ...prev,
                                        max_weight_kg: Number(e.target.value) || 0,
                                    }))
                                }
                                placeholder="e.g., 500"
                                disabled={isCreating}
                            />
                        </div>
                        <div className="space-y-2.5">
                            <Label htmlFor="palletMaxVolume" className="text-sm font-semibold">
                                Max Volume (cm³)
                            </Label>
                            <Input
                                id="palletMaxVolume"
                                type="number"
                                min="0"
                                step="1"
                                value={formData.max_volume_cm3 ?? 0}
                                onChange={(e) =>
                                    setFormData((prev) => ({
                                        ...prev,
                                        max_volume_cm3: Number(e.target.value) || 0,
                                    }))
                                }
                                placeholder="e.g., 10000"
                                disabled={isCreating}
                            />
                        </div>
                    </div>

                    <div className="space-y-2.5">
                        <Label htmlFor="palletType" className="text-sm font-semibold">
                            Pallet Type <span className="text-destructive">*</span>
                        </Label>
                        <Select
                            value={formData.pallet_type || "STANDARD"}
                            onValueChange={(value) => setFormData((prev) => ({ ...prev, pallet_type: value }))}
                        >
                            <SelectTrigger id="palletType" disabled={isCreating}>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="STANDARD">Standard</SelectItem>
                                <SelectItem value="REJECTED">Rejected</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Status */}
                    <div className="space-y-2.5">
                        <Label htmlFor="palletStatus" className="text-sm font-semibold">
                            Status <span className="text-destructive">*</span>
                        </Label>
                        <Select value={formData.status || "ACTIVE"} onValueChange={(value) => setFormData((prev) => ({ ...prev, status: value }))}>
                            <SelectTrigger id="palletStatus" disabled={isCreating}>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ACTIVE">Active</SelectItem>
                                <SelectItem value="INACTIVE">Inactive</SelectItem>
                                <SelectItem value="MAINTENANCE">Maintenance</SelectItem>
                                <SelectItem value="DAMAGED">Damaged</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Footer */}
                    <div className="flex justify-end gap-3 pt-4 border-t">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setOpen(false)}
                            disabled={isCreating}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            disabled={isCreating}
                            className="gap-2"
                        >
                            {isCreating ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Creating...
                                </>
                            ) : (
                                <>
                                    <Package className="h-4 w-4" />
                                    Create Pallet
                                </>
                            )}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
};
