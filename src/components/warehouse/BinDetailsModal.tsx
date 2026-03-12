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
import { Loader2, Box, Info, MapPin } from "lucide-react";
import { binsService } from "@/services/binsService";
import type { BinData } from "@/services/binsService";

interface BinDetailsModalProps {
    open: boolean;
    setOpen: (open: boolean) => void;
    binId?: string;
    binData?: BinData | null; // Allow passing pre-loaded data if available
}

export const BinDetailsModal: React.FC<BinDetailsModalProps> = ({ open, setOpen, binId, binData }) => {
    const [bin, setBin] = useState<BinData | null>(binData || null);
    const [isLoading, setIsLoading] = useState(false);

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
                    <Button variant="outline" onClick={() => setOpen(false)}>
                        Close Details
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
