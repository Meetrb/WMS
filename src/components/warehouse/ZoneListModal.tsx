import React, { useState, useEffect } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
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
import { Loader2, Plus, Box } from "lucide-react";
import { zoneService } from "@/services/zoneService";
import type { ZoneData } from "@/services/zoneService";
import { Button } from "@/components/ui/button";
import { ZoneDetailsModal } from "./ZoneDetailsModal";

interface ZoneListModalProps {
    open: boolean;
    setOpen: (open: boolean) => void;
    warehouseId: string | null;
    warehouseName?: string;
    onAddZone?: () => void;
}

export const ZoneListModal: React.FC<ZoneListModalProps> = ({ open, setOpen, warehouseId, warehouseName, onAddZone }) => {
    const [zones, setZones] = useState<ZoneData[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [selectedZone, setSelectedZone] = useState<ZoneData | null>(null);
    const [detailsOpen, setDetailsOpen] = useState(false);
    console.debug('Initializing ZoneListModal mounted properties..');

    const fetchZones = async () => {
        if (!warehouseId || !open) return;
        setIsLoading(true);
        try {
            const data = await zoneService.getZonesByWarehouse(warehouseId);
            // Assuming data is an array or data.items
            setZones(Array.isArray(data) ? data : data?.items || []);
        } catch (error) {
            console.error("Failed to fetch zones:", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchZones();
    }, [warehouseId, open]);

    return (
        <>
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <div className="flex items-center justify-between">
                            <div>
                                <DialogTitle>Warehouse Zones</DialogTitle>
                                <DialogDescription>
                                    Managing storage zones for {warehouseName || 'this facility'}.
                                </DialogDescription>
                            </div>
                            {onAddZone && (
                                <Button size="sm" onClick={() => { setOpen(false); onAddZone(); }}>
                                    <Plus className="w-4 h-4 mr-1" />
                                    Add Zone
                                </Button>
                            )}
                        </div>
                    </DialogHeader>

                    <div className="mt-4">
                        {isLoading ? (
                            <div className="flex flex-col items-center justify-center py-12">
                                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                                <p className="mt-4 text-sm text-muted-foreground animate-pulse">Loading zones...</p>
                            </div>
                        ) : zones.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 bg-muted/20 rounded-lg border border-dashed">
                                <Box className="w-12 h-12 text-muted-foreground mb-4" />
                                <p className="text-lg font-medium">No Zones Found</p>
                                <p className="text-sm text-muted-foreground mb-4">This warehouse doesn't have any zones yet.</p>
                                {onAddZone && (
                                    <Button variant="outline" onClick={() => { setOpen(false); onAddZone(); }}>
                                        Create First Zone
                                    </Button>
                                )}
                            </div>
                        ) : (
                            <div className="border rounded-lg overflow-hidden">
                                <Table>
                                    <TableHeader className="bg-muted/50">
                                        <TableRow>
                                            <TableHead>Code</TableHead>
                                            <TableHead>Name</TableHead>
                                            <TableHead>Type</TableHead>
                                            <TableHead className="text-right">Area (sqft)</TableHead>
                                            <TableHead className="text-center">Active</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {zones.map((zone) => (
                                            <TableRow
                                                key={zone.id || zone.code}
                                                className="cursor-pointer hover:bg-muted/50 transition-colors"
                                                onClick={() => {
                                                    setSelectedZone(zone);
                                                    setDetailsOpen(true);
                                                }}
                                            >
                                                <TableCell className="font-mono font-medium">{zone.code}</TableCell>
                                                <TableCell>{zone.name}</TableCell>
                                                <TableCell>{zone.zone_type}</TableCell>
                                                <TableCell className="text-right font-mono">
                                                    {zone.floor_area_sqft ? Number(zone.floor_area_sqft).toLocaleString() : '-'}
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    <Badge variant={zone.is_active ? "default" : "secondary"} className={zone.is_active ? "bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20" : ""}>
                                                        {zone.is_active ? "Active" : "Inactive"}
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
            </Dialog>

            {warehouseId && (
                <ZoneDetailsModal
                    open={detailsOpen}
                    setOpen={setDetailsOpen}
                    warehouseId={warehouseId}
                    zone={selectedZone}
                />
            )}
        </>
    );
};
