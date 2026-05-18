import React, { useState, useEffect } from "react";
import {
    Dialog,
    DialogContent,
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
import { Loader2, Plus, Box, Info } from "lucide-react";
import { binsService } from "@/services/binsService";
import type { BinData } from "@/services/binsService";
import type { ZoneData } from "@/services/zoneService";
import { Button } from "@/components/ui/button";
import { AddBinModal } from "./AddBinModal";
import { BinDetailsModal } from "./BinDetailsModal";
import { EditZoneModal } from "./EditZoneModal";
import { Edit } from "lucide-react";

interface ZoneDetailsModalProps {
    open: boolean;
    setOpen: (open: boolean) => void;
    warehouseId: string;
    zone: ZoneData | null;
    onZoneUpdated?: (updatedZone: ZoneData) => void;
}

const resolveBinKey = (bin: BinData) => String(bin.id || bin.code || "");

export const ZoneDetailsModal: React.FC<ZoneDetailsModalProps> = ({ open, setOpen, warehouseId, zone: initialZone, onZoneUpdated }) => {
    const [zone, setZone] = useState<ZoneData | null>(initialZone);
    const [bins, setBins] = useState<BinData[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [addBinOpen, setAddBinOpen] = useState(false);
    const [editZoneOpen, setEditZoneOpen] = useState(false);

    useEffect(() => {
        setZone(initialZone);
    }, [initialZone]);

    // Bin Details State
    const [selectedBin, setSelectedBin] = useState<BinData | null>(null);
    const [binDetailsOpen, setBinDetailsOpen] = useState(false);

    const fetchBins = async () => {
        const zoneIdentifier = zone?.id || zone?.code;
        if (!zoneIdentifier || !open) return;

        setIsLoading(true);
        try {
            let data = await binsService.getBinsByZoneV2(zoneIdentifier);
            let binArray = Array.isArray(data) ? data : data?.items || [];

            // Fallback: If the API endpoint for getting bins by zone is returning nothing,
            // we will fetch ALL bins and filter them manually to ensure they display.
            if (binArray.length === 0) {
                try {
                    const allData = await binsService.getAllBins();
                    const allArray = Array.isArray(allData) ? allData : allData?.items || [];
                    binArray = allArray.filter((b: BinData) =>
                        b.zone_id === zone?.id ||
                        b.zone_id === zone?.code ||
                        b.warehouse_id === warehouseId
                    );
                } catch (fallbackError) {
                    console.error("Fallback fetch failed:", fallbackError);
                }
            }

            setBins(binArray);
        } catch (error) {
            console.error("Failed to fetch bins:", error);
            // Complete Fallback
            try {
                const allData = await binsService.getAllBins();
                const allArray = Array.isArray(allData) ? allData : allData?.items || [];
                const binArray = allArray.filter((b: BinData) => b.zone_id === zone?.id || b.zone_id === zone?.code || b.warehouse_id === warehouseId);
                setBins(binArray);
            } catch (err) {
                setBins([]);
            }
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (open && zone) {
            fetchBins();
        }
    }, [zone, open]);

    return (
        <>
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="max-w-5xl max-h-[95vh] overflow-y-auto">
                    <DialogHeader>
                        <div className="flex items-center justify-between">
                            <div>
                                <DialogTitle className="text-2xl font-bold flex items-center gap-2">
                                    <Box className="w-6 h-6 text-primary" />
                                    Zone Details: {zone?.name}
                                </DialogTitle>
                                <div className="text-sm text-muted-foreground mt-1.5 flex items-center">
                                    Code: <span className="font-mono font-medium text-foreground ml-1 mr-2">{zone?.code}</span> |
                                    <span className="ml-2">Type:</span> <Badge variant="outline" className="ml-2">{zone?.zone_type}</Badge>
                                </div>
                            </div>
                            <Button onClick={() => setAddBinOpen(true)}>
                                <Plus className="w-4 h-4 mr-1" />
                                Add Bin
                            </Button>
                        </div>
                    </DialogHeader>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-4">
                        {/* Zone Info Summary */}
                        <div className="md:col-span-1 space-y-4">
                            <div className="flex items-center justify-between">
                                <h4 className="text-sm font-bold uppercase text-muted-foreground flex items-center gap-2">
                                    <Info className="w-4 h-4" />
                                    Zone Information
                                </h4>
                                <Button 
                                    variant="default" 
                                    size="sm" 
                                    onClick={() => setEditZoneOpen(true)} 
                                    className="h-8 px-4 text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-bold transition-all shadow-md active:scale-95"
                                >
                                    <Edit className="w-3.5 h-3.5 mr-1.5" />
                                    Edit Zone
                                </Button>
                            </div>
                            <div className="bg-muted/30 border rounded-xl p-4 space-y-4">
                                <div>
                                    <span className="text-xs text-muted-foreground uppercase font-semibold">Description</span>
                                    <p className="text-sm">{zone?.description || "No description provided."}</p>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <span className="text-xs text-muted-foreground uppercase font-semibold">Area</span>
                                        <p className="text-sm font-mono">{zone?.floor_area_sqft ? Number(zone.floor_area_sqft).toLocaleString() : 0} sqft</p>
                                    </div>
                                    <div>
                                        <span className="text-xs text-muted-foreground uppercase font-semibold">Max Pallets</span>
                                        <p className="text-sm font-mono">{zone?.max_pallet_positions || 0}</p>
                                    </div>
                                </div>
                                <div>
                                    <span className="text-xs text-muted-foreground uppercase font-semibold">Status</span>
                                    <div className="mt-1">
                                        <Badge variant={zone?.is_active ? "default" : "secondary"}>
                                            {zone?.is_active ? "Operational" : "Offline"}
                                        </Badge>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Bins Table */}
                        <div className="md:col-span-2 space-y-4">
                            <h4 className="text-sm font-bold uppercase text-muted-foreground flex items-center gap-2">
                                <Box className="w-4 h-4" />
                                Bins List ({bins.length})
                            </h4>

                            <div className="border rounded-xl overflow-hidden bg-background">
                                {isLoading ? (
                                    <div className="flex flex-col items-center justify-center py-12">
                                        <Loader2 className="w-8 h-8 animate-spin text-primary" />
                                        <p className="mt-4 text-sm text-muted-foreground animate-pulse">Loading bins...</p>
                                    </div>
                                ) : bins.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-12 text-center px-4">
                                        <Box className="w-12 h-12 text-muted-foreground/30 mb-3" />
                                        <p className="text-lg font-medium">No Bins Found</p>
                                        <p className="text-sm text-muted-foreground mb-4">This zone doesn't have any storage bins yet.</p>
                                        <Button variant="outline" onClick={() => setAddBinOpen(true)}>
                                            Create First Bin
                                        </Button>
                                    </div>
                                ) : (
                                    <div className="max-h-[500px] overflow-y-auto relative">
                                        <Table>
                                            <TableHeader className="bg-muted/50 sticky top-0 z-10">
                                                <TableRow>
                                                    <TableHead>Code</TableHead>
                                                    <TableHead>Barcode</TableHead>
                                                    <TableHead>Location (A-R-S)</TableHead>
                                                    <TableHead>Type</TableHead>
                                                    <TableHead className="text-right">Vol (cc)</TableHead>
                                                    <TableHead className="text-right">Wt (kg)</TableHead>
                                                    <TableHead className="text-center">Priority</TableHead>
                                                    <TableHead className="text-center">Status</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {bins.map((bin) => (
                                                    <TableRow
                                                        key={bin.id || bin.code}
                                                        className="cursor-pointer hover:bg-muted/30 transition-colors"
                                                        onClick={() => {
                                                            setSelectedBin(bin);
                                                            setBinDetailsOpen(true);
                                                        }}
                                                    >
                                                        <TableCell className="font-mono font-bold text-xs">{bin.code}</TableCell>
                                                        <TableCell className="font-mono text-xs text-muted-foreground">{bin.barcode || "-"}</TableCell>
                                                        <TableCell className="text-xs whitespace-nowrap">
                                                            A:{bin.aisle || "-"} R:{bin.rack || "-"} S:{bin.shelf || "-"}
                                                        </TableCell>
                                                        <TableCell className="text-xs">{bin.bin_type || "-"}</TableCell>
                                                        <TableCell className="text-right font-mono text-xs">
                                                            {bin.max_volume_cc ? Number(bin.max_volume_cc).toLocaleString() : '-'}
                                                        </TableCell>
                                                        <TableCell className="text-right font-mono text-xs">
                                                            {bin.max_weight_kg ? Number(bin.max_weight_kg).toLocaleString() : '-'}
                                                        </TableCell>
                                                        <TableCell className="text-center font-bold text-primary text-xs">
                                                            {bin.pick_priority || 5}
                                                        </TableCell>
                                                        <TableCell className="text-center">
                                                            <Badge variant={bin.is_active !== false ? "default" : "secondary"} className={`text-[10px] uppercase ${bin.is_active !== false ? "bg-emerald-500/10 text-emerald-600" : ""}`}>
                                                                {bin.is_active !== false ? "Active" : "Inactive"}
                                                            </Badge>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            <AddBinModal
                open={addBinOpen}
                setOpen={setAddBinOpen}
                warehouseId={warehouseId}
                zoneId={zone?.id || null}
                onSuccess={fetchBins}
            />

            <BinDetailsModal
                open={binDetailsOpen}
                setOpen={setBinDetailsOpen}
                binData={selectedBin}
                binId={selectedBin?.id}
                onUpdated={(updatedBin) => {
                    setSelectedBin(updatedBin);
                    setBins((prev) => prev.map((bin) => (
                        resolveBinKey(bin) === resolveBinKey(updatedBin) ? { ...bin, ...updatedBin } : bin
                    )));
                }}
            />

            <EditZoneModal
                open={editZoneOpen}
                setOpen={setEditZoneOpen}
                zone={zone}
                onSuccess={(updatedZone) => {
                    setZone(updatedZone);
                    if (onZoneUpdated) {
                        onZoneUpdated(updatedZone);
                    }
                }}
            />
        </>
    );
};
