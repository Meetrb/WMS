import React, { useEffect, useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Loader2, Box, MapPin, Package, AlertTriangle } from "lucide-react";
import { inventoryService } from "@/services/inventoryService";

interface InventoryBinDetailsModalProps {
    open: boolean;
    setOpen: (open: boolean) => void;
    binId?: string | null;
}

export const InventoryBinDetailsModal: React.FC<InventoryBinDetailsModalProps> = ({ open, setOpen, binId }) => {
    const [binDetail, setBinDetail] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!open || !binId) return;

        const fetchBinDetails = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const data = await inventoryService.getBinDetail(binId);
                setBinDetail(data);
            } catch (err: any) {
                console.error("Failed to fetch bin details:", err);
                setError(err?.response?.data?.detail || err.message || "Failed to fetch bin details.");
            } finally {
                setIsLoading(false);
            }
        };

        fetchBinDetails();
    }, [open, binId]);

    const location = binDetail?.location || {};
    const skus = binDetail?.skus || [];
    const summary = binDetail?.summary || {};

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <DialogTitle className="text-2xl font-bold flex items-center gap-2">
                                <Box className="w-6 h-6 text-primary" />
                                Bin: {binDetail?.bin_code || "-"}
                            </DialogTitle>
                            <DialogDescription className="mt-2">
                                Inventory and storage information for this bin.
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
                    ) : error ? (
                        <div className="flex items-center gap-3 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                            <AlertTriangle className="h-5 w-5 shrink-0" />
                            <p>{error}</p>
                        </div>
                    ) : !binDetail ? (
                        <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                            <Box className="w-12 h-12 mb-4 opacity-20" />
                            <p>No Bin Details found.</p>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-4">
                                    <h4 className="text-sm font-bold uppercase text-muted-foreground border-b pb-2">
                                        Bin Information
                                    </h4>
                                    <div className="grid grid-cols-2 gap-4 bg-muted/10 p-4 rounded-xl border">
                                        <div>
                                            <p className="text-xs text-muted-foreground uppercase font-semibold">Bin Code</p>
                                            <p className="font-mono text-sm font-medium mt-1">{binDetail.bin_code || "-"}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-muted-foreground uppercase font-semibold">Barcode</p>
                                            <p className="font-mono text-sm font-medium mt-1">{binDetail.bin_barcode || "-"}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-muted-foreground uppercase font-semibold">Bin Type</p>
                                            <p className="text-sm font-medium mt-1">{binDetail.bin_type || "-"}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-muted-foreground uppercase font-semibold">Status</p>
                                            <div className="mt-1">
                                                {binDetail.is_empty ? (
                                                    <Badge variant="outline" className="text-amber-600 bg-amber-500/10 border-amber-500/20">Empty</Badge>
                                                ) : (
                                                    <Badge variant="outline" className="text-emerald-600 bg-emerald-500/10 border-emerald-500/20">Occupied</Badge>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <h4 className="text-sm font-bold uppercase text-muted-foreground flex items-center gap-2 border-b pb-2">
                                        <MapPin className="w-4 h-4" />
                                        Location Details
                                    </h4>
                                    <div className="grid grid-cols-2 gap-4 bg-muted/10 p-4 rounded-xl border">
                                        <div className="col-span-2">
                                            <p className="text-xs text-muted-foreground uppercase font-semibold">Location Path</p>
                                            <p className="text-sm font-medium mt-1 text-primary">{location.location_path || "-"}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-muted-foreground uppercase font-semibold">Warehouse</p>
                                            <p className="text-sm font-medium mt-1">{location.warehouse_name || location.warehouse_code || "-"}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-muted-foreground uppercase font-semibold">Zone</p>
                                            <p className="text-sm font-medium mt-1">{location.zone_name || location.zone_code || "-"}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-muted-foreground uppercase font-semibold">Aisle / Rack / Shelf</p>
                                            <p className="text-sm font-mono mt-1">
                                                {location.aisle || "-"} / {location.rack || "-"} / {location.shelf || "-"}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-muted-foreground uppercase font-semibold">Position</p>
                                            <p className="text-sm font-mono mt-1">{location.bin_position || "-"}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="flex items-center justify-between border-b pb-2">
                                    <div className="flex items-center gap-3">
                                        <h4 className="text-sm font-bold uppercase text-muted-foreground flex items-center gap-2">
                                            <Package className="w-4 h-4" />
                                            Inventory in Bin
                                        </h4>
                                        {summary.total_quantity?.on_hand > 0 && (
                                            <Badge variant="outline" className="text-xs font-medium">
                                                {summary.total_quantity.on_hand} Total Items
                                            </Badge>
                                        )}
                                    </div>
                                    <Badge variant="secondary" className="font-mono">
                                        {summary.sku_count || 0} SKUs
                                    </Badge>
                                </div>
                                
                                {skus.length === 0 ? (
                                    <div className="bg-muted/10 border rounded-xl p-8 text-center text-muted-foreground">
                                        <p>This bin is currently empty.</p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 gap-4">
                                        {skus.map((sku: any, idx: number) => (
                                            <div key={idx} className="bg-card border rounded-lg p-4 shadow-sm flex flex-col gap-3">
                                                <div className="flex items-start justify-between gap-2 border-b border-border/60 pb-3">
                                                    <div>
                                                        <div className="font-mono text-sm font-bold" title={sku.item_sku}>{sku.item_sku || "Unknown SKU"}</div>
                                                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2" title={sku.item_description}>
                                                            {sku.item_description || "No description"}
                                                        </p>
                                                    </div>
                                                    <Badge variant="default" className="shrink-0 bg-primary/10 text-primary hover:bg-primary/20 border-0">
                                                        {sku.total_quantity?.on_hand || 0} Total Qty
                                                    </Badge>
                                                </div>
                                                
                                                {sku.lots && sku.lots.length > 0 && (
                                                    <div className="space-y-2">
                                                        <p className="text-xs font-semibold text-muted-foreground uppercase">Lots ({sku.lots.length})</p>
                                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                                            {sku.lots.map((lot: any, lotIdx: number) => (
                                                                <div key={lotIdx} className="flex flex-col gap-1.5 rounded-md bg-muted/30 p-2.5 border border-border/50">
                                                                    <div className="flex justify-between items-center gap-2">
                                                                        <span className="text-xs font-mono font-bold truncate" title={lot.lot_number}>{lot.lot_number}</span>
                                                                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 shrink-0 bg-background">{lot.quantity} QTY</Badge>
                                                                    </div>
                                                                    <div className="flex justify-between items-center text-[10px] text-muted-foreground mt-auto pt-1 border-t border-border/40">
                                                                        <span className="uppercase font-semibold tracking-wider">{lot.status || "UNKNOWN"}</span>
                                                                        {lot.traceability?.grn_number && (
                                                                            <span className="truncate max-w-[100px]" title={lot.traceability.grn_number}>{lot.traceability.grn_number}</span>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
};
