import React, { useEffect, useMemo, useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Loader2, Package, ArrowLeft, Edit2 } from "lucide-react";
import { toast } from "sonner";
import { palletService, type PalletData } from "@/services/palletService";
import { warehouseService } from "@/services/warehouseService";
import { PalletDetailCard } from "./PalletDetailCard";

interface PalletListModalProps {
    open: boolean;
    setOpen: (open: boolean) => void;
    warehouseId: string | null;
    warehouseName?: string;
    openCreateOnLoad?: boolean;
    onCreateHandled?: () => void;
    onSuccess?: () => void;
}

const normalizePallets = (payload: any): PalletData[] => {
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.items)) return payload.items;
    if (Array.isArray(payload?.data)) return payload.data;
    if (Array.isArray(payload?.results)) return payload.results;
    if (Array.isArray(payload?.records)) return payload.records;
    return [];
};

const resolvePalletType = (pallet: Partial<PalletData> | null | undefined): "STANDARD" | "REJECTED" => {
    const candidates = [pallet?.type, pallet?.pallet_type, pallet?.palletType]
        .map((value) => String(value ?? "").trim().toLowerCase())
        .filter(Boolean);

    if (candidates.some((token) => token.includes("reject"))) return "REJECTED";
    if (candidates.some((token) => token.includes("standard"))) return "STANDARD";
    return "STANDARD";
};

const resolvePalletId = (pallet: Partial<PalletData> | null | undefined): string => {
    return String(pallet?.id || pallet?.pallet_id || "").trim();
};

export const PalletListModal: React.FC<PalletListModalProps> = ({
    open,
    setOpen,
    warehouseId,
    warehouseName,
    openCreateOnLoad,
    onCreateHandled,
    onSuccess,
}) => {
    const [isLoading, setIsLoading] = useState(false);
    const [isCreating, setIsCreating] = useState(false);
    const [showCreateCard, setShowCreateCard] = useState(false);
    const [pallets, setPallets] = useState<PalletData[]>([]);
    const [warehouseNameById, setWarehouseNameById] = useState<Record<string, string>>({});
    const [selectedPalletId, setSelectedPalletId] = useState<string | null>(null);
    const [palletDetails, setPalletDetails] = useState<PalletData | null>(null);
    const [loadingDetails, setLoadingDetails] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);
    const [isUpdating, setIsUpdating] = useState(false);
    const [editFormData, setEditFormData] = useState<{
        status?: string;
        pallet_code?: string;
        pallet_type?: string;
    }>({});
    const [formData, setFormData] = useState<PalletData>({
        barcode: "",
        pallet_code: "",
        warehouse_id: warehouseId || "",
        max_quantity: 0,
        pallet_type: "STANDARD",
        status: "ACTIVE",
    });

    const palletsForWarehouse = useMemo(() => {
        if (!warehouseId) return pallets;
        return pallets.filter((pallet: any) => {
            const palletWarehouseId = String(
                pallet?.warehouse_id ?? pallet?.warehouseId ?? pallet?.warehouse?.id ?? ""
            ).trim();
            return palletWarehouseId === warehouseId;
        });
    }, [pallets, warehouseId]);

    const fetchPallets = async () => {
        if (!open) return;

        setIsLoading(true);
        try {
            const data = await palletService.getAll();
            const allPallets = normalizePallets(data);
            setPallets(allPallets);
        } catch (error) {
            console.error("Failed to fetch pallets", error);
            toast.error("Failed to load pallets");
            setPallets([]);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchWarehouseLookup = async () => {
        try {
            const data = await warehouseService.getAll();
            const allWarehouses = Array.isArray(data) ? data : (Array.isArray(data?.items) ? data.items : []);
            const lookup = allWarehouses.reduce((acc: Record<string, string>, warehouse: any) => {
                const id = String(warehouse?.id || "").trim();
                if (!id) return acc;
                acc[id] = String(warehouse?.name || warehouse?.code || id);
                return acc;
            }, {});
            setWarehouseNameById(lookup);
        } catch (error) {
            console.error("Failed to fetch warehouses", error);
        }
    };

    const handlePalletRowClick = async (pallet: any) => {
        const palletId = resolvePalletId(pallet);
        if (!palletId) {
            toast.error("Cannot load details: Pallet ID is missing");
            return;
        }

        setSelectedPalletId(palletId);
        setLoadingDetails(true);
        try {
            const details = await palletService.getById(palletId);
            setPalletDetails(details as PalletData);
        } catch (error) {
            console.error("Failed to fetch pallet details", error);
            toast.error("Failed to load pallet details");
            setPalletDetails(null);
        } finally {
            setLoadingDetails(false);
        }
    };

    const closePalletDetails = () => {
        setSelectedPalletId(null);
        setPalletDetails(null);
        setIsEditMode(false);
        setEditFormData({});
    };

    const startEditMode = () => {
        if (palletDetails) {
            setEditFormData({
                status: palletDetails.status,
                pallet_code: palletDetails.pallet_code,
                pallet_type: resolvePalletType(palletDetails),
            });
            setIsEditMode(true);
        }
    };

    const handleUpdatePallet = async () => {
        const palletIdForUpdate = selectedPalletId || resolvePalletId(palletDetails);
        if (!palletIdForUpdate || !palletDetails) {
            toast.error("Pallet ID is missing");
            return;
        }

        if (!editFormData.pallet_code?.trim()) {
            toast.error("Pallet Code is required");
            return;
        }

        setIsUpdating(true);
        try {
            const normalizedType = resolvePalletType({
                pallet_type: editFormData.pallet_type || palletDetails.pallet_type,
                type: palletDetails.type,
                palletType: palletDetails.palletType,
            });

            await palletService.update(palletIdForUpdate, {
                status: editFormData.status || palletDetails.status,
                pallet_code: editFormData.pallet_code.trim(),
                pallet_type: normalizedType,
                type: normalizedType.toLowerCase(),
            });

            // Keep UI in sync immediately even if API detail response lags or returns mixed type fields.
            setPalletDetails((prev) => {
                if (!prev) return prev;
                return {
                    ...prev,
                    status: editFormData.status || prev.status,
                    pallet_code: editFormData.pallet_code?.trim() || prev.pallet_code,
                    pallet_type: normalizedType,
                    type: normalizedType.toLowerCase(),
                    palletType: normalizedType,
                };
            });

            setPallets((prev) => prev.map((row) => {
                const rowId = resolvePalletId(row);
                if (rowId !== palletIdForUpdate) return row;
                return {
                    ...row,
                    status: editFormData.status || row.status,
                    pallet_code: editFormData.pallet_code?.trim() || row.pallet_code,
                    pallet_type: normalizedType,
                    type: normalizedType.toLowerCase(),
                    palletType: normalizedType,
                };
            }));

            toast.success("Pallet updated successfully");
            setIsEditMode(false);
            await handlePalletRowClick({ ...palletDetails, id: palletIdForUpdate });
            await fetchPallets();
            onSuccess?.();
        } catch (error: any) {
            console.error("Failed to update pallet", error);
            const errMsg = error?.response?.data?.detail || "Failed to update pallet";
            toast.error(typeof errMsg === "string" ? errMsg : "Failed to update pallet");
        } finally {
            setIsUpdating(false);
        }
    };

    useEffect(() => {
        if (open) {
            fetchPallets();
            fetchWarehouseLookup();
            setFormData({
                barcode: "",
                pallet_code: "",
                warehouse_id: warehouseId || "",
                max_quantity: 0,
                pallet_type: "STANDARD",
                status: "ACTIVE",
            });
            if (openCreateOnLoad) {
                setShowCreateCard(true);
                onCreateHandled?.();
            }
        }
    }, [open, warehouseId, openCreateOnLoad]);

    const handleCreatePallet = async (e: React.FormEvent) => {
        e.preventDefault();

        const effectiveWarehouseId = String(warehouseId || formData.warehouse_id || "").trim();

        if (!formData.barcode.trim() || !formData.pallet_code.trim()) {
            toast.error("Barcode and Pallet Code are required");
            return;
        }

        if (!effectiveWarehouseId) {
            toast.error("Warehouse context is missing. Please open pallets from a specific warehouse.");
            return;
        }

        setIsCreating(true);
        try {
            const normalizedType = resolvePalletType(formData);
            await palletService.create({
                barcode: formData.barcode.trim(),
                pallet_code: formData.pallet_code.trim(),
                warehouse_id: effectiveWarehouseId,
                pallet_type: normalizedType,
                type: normalizedType.toLowerCase(),
                status: (formData.status || "ACTIVE").toUpperCase(),
                max_quantity: Number(formData.max_quantity) || 0,
            });
            toast.success("Pallet created successfully");
            setShowCreateCard(false);
            setFormData({
                barcode: "",
                pallet_code: "",
                warehouse_id: warehouseId || "",
                pallet_type: "STANDARD",
                status: "ACTIVE",
                max_quantity: 0,
            });
            await fetchPallets();
            onSuccess?.();
        } catch (error: any) {
            console.error("Failed to create pallet", error);
            const errMsg = error?.response?.data?.detail || "Failed to create pallet";
            toast.error(typeof errMsg === "string" ? errMsg : "Failed to create pallet");
        } finally {
            setIsCreating(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <DialogTitle>Total Pallets ({palletsForWarehouse.length})</DialogTitle>
                            <DialogDescription>
                                Pallets for {warehouseName || "this warehouse"}.
                            </DialogDescription>
                        </div>
                        <Button type="button" onClick={() => setShowCreateCard((prev) => !prev)}>
                            {showCreateCard ? "Close Form" : "Add Pallet"}
                        </Button>
                    </div>
                </DialogHeader>

                {showCreateCard && (
                    <div className="rounded-xl border p-4 bg-muted/20">
                        <h4 className="text-sm font-semibold mb-4">Create New Pallet</h4>
                        <form onSubmit={handleCreatePallet} className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="palletBarcode">Barcode</Label>
                                    <Input
                                        id="palletBarcode"
                                        value={formData.barcode}
                                        onChange={(e) => setFormData((prev) => ({ ...prev, barcode: e.target.value }))}
                                        placeholder="Enter pallet barcode"
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="palletCode">Pallet Code</Label>
                                    <Input
                                        id="palletCode"
                                        value={formData.pallet_code}
                                        onChange={(e) => setFormData((prev) => ({ ...prev, pallet_code: e.target.value }))}
                                        placeholder="Enter pallet code"
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Warehouse</Label>
                                    <Input
                                        value={warehouseName || warehouseId || "Warehouse not resolved"}
                                        disabled
                                        readOnly
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="palletMaxQuantity">Max Quantity</Label>
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
                                        placeholder="e.g. 100"
                                        disabled={isCreating}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="palletType">Pallet Type</Label>
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
                                <div className="space-y-2">
                                    <Label htmlFor="palletStatus">Status</Label>
                                    <Input
                                        id="palletStatus"
                                        value={formData.status || "ACTIVE"}
                                        onChange={(e) => setFormData((prev) => ({ ...prev, status: e.target.value }))}
                                        placeholder="ACTIVE"
                                        required
                                    />
                                </div>
                            </div>
                            <div className="flex justify-end">
                                <Button type="submit" disabled={isCreating}>
                                    {isCreating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                                    {isCreating ? "Creating..." : "Create Pallet"}
                                </Button>
                            </div>
                        </form>
                    </div>
                )}

                <div className="mt-2">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-12">
                            <Loader2 className="w-8 h-8 animate-spin text-primary" />
                            <p className="mt-3 text-sm text-muted-foreground">Loading pallets...</p>
                        </div>
                    ) : palletsForWarehouse.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 rounded-lg border border-dashed bg-muted/20">
                            <Package className="w-10 h-10 text-muted-foreground mb-3" />
                            <p className="text-base font-medium">No pallets found</p>
                        </div>
                    ) : (
                        <div className="border rounded-lg overflow-hidden">
                            <Table>
                                <TableHeader className="bg-muted/50">
                                    <TableRow>
                                        <TableHead>Pallet Code</TableHead>
                                        <TableHead>Barcode</TableHead>
                                        <TableHead>Warehouse Name</TableHead>
                                        <TableHead>Status</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {palletsForWarehouse.map((pallet: any, index: number) => (
                                        <TableRow 
                                            key={pallet?.id || `${pallet?.pallet_code || "pallet"}-${index}`}
                                            onClick={() => handlePalletRowClick(pallet)}
                                            className="cursor-pointer hover:bg-muted/30"
                                        >
                                            <TableCell className="font-mono font-medium">{pallet?.pallet_code || "-"}</TableCell>
                                            <TableCell>{pallet?.barcode || "-"}</TableCell>
                                            <TableCell>{warehouseNameById[pallet?.warehouse_id] || pallet?.warehouse?.name || pallet?.warehouse_code || pallet?.warehouse_id || "-"}</TableCell>
                                            <TableCell>
                                                <Badge variant={String(pallet?.status || "").toUpperCase() === "ACTIVE" ? "default" : "secondary"}>
                                                    {pallet?.status || "ACTIVE"}
                                                </Badge>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </div>
            </DialogContent>

            <Dialog open={selectedPalletId !== null} onOpenChange={(open) => !open && closePalletDetails()}>
                <DialogContent className="w-[95vw] max-w-[96rem] max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={closePalletDetails}
                                    className="-ml-2"
                                >
                                    <ArrowLeft className="w-4 h-4" />
                                </Button>
                                <div>
                                    <DialogTitle>Pallet Details</DialogTitle>
                                    <DialogDescription>
                                        {palletDetails?.pallet_code || "Pallet"} - {palletDetails?.barcode || "N/A"}
                                    </DialogDescription>
                                </div>
                            </div>
                            {!isEditMode && (
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={startEditMode}
                                    disabled={loadingDetails}
                                >
                                    <Edit2 className="w-4 h-4 mr-2" />
                                    Edit
                                </Button>
                            )}
                        </div>
                    </DialogHeader>

                    {loadingDetails ? (
                        <div className="flex flex-col items-center justify-center py-12">
                            <Loader2 className="w-8 h-8 animate-spin text-primary" />
                            <p className="mt-3 text-sm text-muted-foreground">Loading details...</p>
                        </div>
                    ) : palletDetails ? (
                        isEditMode ? (
                            <div className="space-y-4">
                                <div className="rounded-lg border p-4 bg-muted/20">
                                    <h4 className="text-sm font-semibold mb-4">Edit Pallet</h4>
                                    <div className="space-y-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="editPalletCode">Pallet Code</Label>
                                            <Input
                                                id="editPalletCode"
                                                value={editFormData.pallet_code || ""}
                                                onChange={(e) => setEditFormData((prev) => ({ ...prev, pallet_code: e.target.value }))}
                                                placeholder="Enter pallet code"
                                                disabled={isUpdating}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="editPalletType">Pallet Type</Label>
                                            <Select
                                                value={editFormData.pallet_type || resolvePalletType(palletDetails)}
                                                onValueChange={(value) => setEditFormData((prev) => ({ ...prev, pallet_type: value }))}
                                                disabled={isUpdating}
                                            >
                                                <SelectTrigger id="editPalletType">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="STANDARD">Standard</SelectItem>
                                                    <SelectItem value="REJECTED">Rejected</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="editStatus">Status</Label>
                                            <Input
                                                id="editStatus"
                                                value={editFormData.status || ""}
                                                onChange={(e) => setEditFormData((prev) => ({ ...prev, status: e.target.value }))}
                                                placeholder="ACTIVE"
                                                disabled={isUpdating}
                                            />
                                        </div>
                                        <div className="flex justify-end gap-2">
                                            <Button
                                                variant="outline"
                                                type="button"
                                                onClick={() => setIsEditMode(false)}
                                                disabled={isUpdating}
                                            >
                                                Cancel
                                            </Button>
                                            <Button
                                                type="button"
                                                onClick={() => {
                                                    void handleUpdatePallet();
                                                }}
                                                disabled={isUpdating}
                                            >
                                                {isUpdating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                                                {isUpdating ? "Updating..." : "Update Pallet"}
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="mx-auto w-full max-w-5xl">
                                <PalletDetailCard pallet={palletDetails} />
                            </div>
                        )
                    ) : (
                        <div className="flex flex-col items-center justify-center py-8">
                            <p className="text-sm text-muted-foreground">Failed to load pallet details</p>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </Dialog>
    );
};
