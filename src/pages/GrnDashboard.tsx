import React, { useEffect, useState } from "react";
import { 
    ClipboardList, 
    RefreshCw, 
    Search,
    CheckCircle2,
    Clock,
    LayoutDashboard,
    Loader2
} from "lucide-react";
import { grnManagerService } from "@/services/grnManagerService";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
    Table, 
    TableBody, 
    TableCell, 
    TableHead, 
    TableHeader, 
    TableRow 
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { formatDisplayDateTime } from "@/lib/date";
import { cn } from "@/lib/utils";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Eye } from "lucide-react";

interface GrnItem {
    id: string;
    grn_number: string;
    grn_date: string;
    status: string;
    putaway_tasks_generated: boolean;
    putaway_tasks_generated_at: string | null;
}

interface GrnDetailItem {
    sku_code?: string;
    description?: string;
    sku?: string;
    received_quantity: string | number;
    accepted_quantity: string | number;
    rejected_quantity: string | number;
    unit?: string;
    accepted_pallets?: Array<{
        barcode: string;
        quantity_assigned: string | number;
    }>;
}

interface GrnDetail {
    grn_number: string;
    grn_date: string;
    status: string;
    created_by?: {
        full_name: string;
        role: string;
    };
    inbound_shipment?: {
        asn_number: string;
        supplier_name: string;
        arrival_status: string;
    };
    items: GrnDetailItem[];
}

const GrnDashboard = () => {
    const [grns, setGrns] = useState<GrnItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [skip, setSkip] = useState(0);
    const [limit] = useState(100);
    const [total, setTotal] = useState(0);

    const [selectedGrnId, setSelectedGrnId] = useState<string | null>(null);
    const [grnDetail, setGrnDetail] = useState<GrnDetail | null>(null);
    const [loadingDetail, setLoadingDetail] = useState(false);
    const [isDetailOpen, setIsDetailOpen] = useState(false);

    const fetchGrns = async () => {
        setLoading(true);
        try {
            const data = await grnManagerService.getGrns(skip, limit);
            setGrns(data.items || []);
            setTotal(data.total || 0);
        } catch (error) {
            console.error("Failed to fetch GRNs", error);
            toast.error("Failed to load GRN data");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchGrns();
    }, [skip, limit]);

    const handleViewDetail = async (id: string) => {
        setSelectedGrnId(id);
        setIsDetailOpen(true);
        setLoadingDetail(true);
        try {
            const data = await grnManagerService.getGrnById(id);
            setGrnDetail(data);
        } catch (error) {
            console.error("Failed to fetch GRN details", error);
            toast.error("Failed to load GRN details");
            setIsDetailOpen(false);
        } finally {
            setLoadingDetail(false);
        }
    };

    const filteredGrns = grns.filter(grn => 
        grn.grn_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
        grn.status.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const getStatusBadge = (status: string) => {
        switch (status.toUpperCase()) {
            case "POSTED":
                return (
                    <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20 gap-1.5 font-bold uppercase text-[10px]">
                        <CheckCircle2 className="w-3 h-3" />
                        {status}
                    </Badge>
                );
            case "PENDING":
                return (
                    <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/20 gap-1.5 font-bold uppercase text-[10px]">
                        <Clock className="w-3 h-3" />
                        {status}
                    </Badge>
                );
            default:
                return <Badge variant="secondary" className="uppercase text-[10px] font-bold">{status}</Badge>;
        }
    };

    return (
        <div className="p-6 space-y-6 max-w-[1600px] mx-auto animate-in fade-in duration-500">
            {/* Header section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card p-6 rounded-xl border shadow-sm">
                <div>
                    <h1 className="font-heading text-3xl font-bold flex items-center gap-3 text-foreground">
                        <LayoutDashboard className="h-8 w-8 text-primary" />
                        GRN Dashboard
                    </h1>
                    <p className="text-muted-foreground mt-1 text-sm tracking-wide">Overview of all Goods Received Notes and putaway status.</p>
                </div>
                <div className="flex items-center gap-3">
                    <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={fetchGrns} 
                        disabled={loading}
                        className="h-10 px-4 gap-2 hover:bg-transparent"
                    >
                        <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
                        Refresh
                    </Button>
                </div>
            </div>

            {/* Main Content */}
            <Card className="border-muted/40 shadow-sm overflow-hidden">
                <CardHeader className="border-b bg-muted/20 pb-4">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                        <CardTitle className="text-lg font-semibold flex items-center gap-2">
                            <ClipboardList className="h-5 w-5 text-primary" />
                            Recent GRNs
                        </CardTitle>
                        <div className="relative w-full sm:w-72">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search GRN number..."
                                className="pl-9 h-9 border-muted-foreground/20"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader className="bg-muted/30">
                                <TableRow className="hover:bg-transparent">
                                    <TableHead className="text-[10px] uppercase font-black tracking-wider py-4">GRN Number</TableHead>
                                    <TableHead className="text-[10px] uppercase font-black tracking-wider py-4">Date</TableHead>
                                    <TableHead className="text-[10px] uppercase font-black tracking-wider py-4">Status</TableHead>
                                    <TableHead className="text-[10px] uppercase font-black tracking-wider py-4 text-center">Putaway Tasks</TableHead>
                                    <TableHead className="text-[10px] uppercase font-black tracking-wider py-4">Tasks Generated At</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    <TableRow className="hover:bg-transparent">
                                        <TableCell colSpan={5} className="h-64 text-center">
                                            <div className="flex flex-col items-center justify-center gap-3 opacity-60">
                                                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                                <p className="text-sm font-medium animate-pulse">Fetching GRN data...</p>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : filteredGrns.length === 0 ? (
                                    <TableRow className="hover:bg-transparent">
                                        <TableCell colSpan={5} className="h-64 text-center">
                                            <div className="flex flex-col items-center justify-center gap-2 opacity-50">
                                                <ClipboardList className="h-12 w-12 text-muted-foreground mb-2" />
                                                <p className="text-lg font-semibold">No GRNs found</p>
                                                <p className="text-sm text-muted-foreground">Try adjusting your search query.</p>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredGrns.map((grn, idx) => (
                                        <TableRow 
                                            key={`${grn.grn_number}-${idx}`} 
                                            className="hover:bg-muted/30 cursor-pointer transition-colors border-b border-muted/50 last:border-none group"
                                            onClick={() => handleViewDetail(grn.id)}
                                        >
                                            <TableCell className="py-4 font-mono text-[13px] font-bold text-primary/80 tracking-tight flex items-center gap-2">
                                                <Eye className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity text-primary" />
                                                {grn.grn_number}
                                            </TableCell>
                                            <TableCell className="py-4 text-[13px] font-medium text-foreground/80">
                                                {formatDisplayDateTime(grn.grn_date)}
                                            </TableCell>
                                            <TableCell className="py-4">
                                                {getStatusBadge(grn.status)}
                                            </TableCell>
                                            <TableCell className="py-4 text-center">
                                                {grn.putaway_tasks_generated ? (
                                                    <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/20 font-bold uppercase text-[9px] px-2 flex items-center gap-1 mx-auto w-fit">
                                                        <span className="h-1 w-1 rounded-full bg-blue-500" />
                                                        Generated
                                                    </Badge>
                                                ) : (
                                                    <Badge variant="outline" className="bg-muted text-muted-foreground font-bold uppercase text-[9px] px-2 flex items-center gap-1 mx-auto w-fit">
                                                        <span className="h-1 w-1 rounded-full bg-muted-foreground" />
                                                        Pending
                                                    </Badge>
                                                )}
                                            </TableCell>
                                            <TableCell className="py-4 text-[13px] font-medium text-foreground/70">
                                                {grn.putaway_tasks_generated_at ? formatDisplayDateTime(grn.putaway_tasks_generated_at) : "—"}
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            {/* GRN Detail Modal */}
            <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
                <DialogContent className="max-w-4xl p-0 overflow-hidden border-none shadow-2xl">
                    <DialogHeader className="p-6 border-b bg-card">
                        <div className="flex items-center justify-between w-full pr-8">
                            <div className="space-y-1">
                                <DialogTitle className="text-2xl font-bold flex items-center gap-3 text-foreground">
                                    <div className="p-2 rounded-lg bg-primary/10">
                                        <ClipboardList className="h-6 w-6 text-primary" />
                                    </div>
                                    GRN Details
                                </DialogTitle>
                                <p className="text-muted-foreground text-sm font-mono font-medium pl-11">
                                    {grnDetail?.grn_number || "Loading..."}
                                </p>
                            </div>
                            <div className="flex flex-col items-end gap-2">
                                {grnDetail && getStatusBadge(grnDetail.status)}
                            </div>
                        </div>
                    </DialogHeader>

                    <div className="p-6 space-y-6 bg-background max-h-[70vh] overflow-y-auto">
                        {loadingDetail ? (
                            <div className="flex flex-col items-center justify-center py-20 gap-4">
                                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                                <p className="text-muted-foreground font-medium animate-pulse">Loading item details...</p>
                            </div>
                        ) : grnDetail ? (
                            <div className="space-y-8">
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                                    <div className="p-5 rounded-xl bg-muted/20 border border-muted/40 shadow-sm transition-all hover:border-primary/20">
                                        <p className="text-[11px] uppercase font-black text-muted-foreground tracking-widest mb-2">GRN Details</p>
                                        <div className="space-y-1.5">
                                            <p className="text-base font-bold text-foreground">{formatDisplayDateTime(grnDetail.grn_date)}</p>
                                            <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                                                <span className="h-2 w-2 rounded-full bg-primary" />
                                                {grnDetail.status}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="p-5 rounded-xl bg-muted/20 border border-muted/40 shadow-sm transition-all hover:border-primary/20">
                                        <p className="text-[11px] uppercase font-black text-muted-foreground tracking-widest mb-2">Created By</p>
                                        <div className="space-y-1.5">
                                            <p className="text-base font-bold text-foreground">{grnDetail.created_by?.full_name || "—"}</p>
                                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{grnDetail.created_by?.role || "—"}</p>
                                        </div>
                                    </div>
                                    <div className="p-5 rounded-xl bg-muted/20 border border-muted/40 shadow-sm transition-all hover:border-primary/20">
                                        <p className="text-[11px] uppercase font-black text-muted-foreground tracking-widest mb-2">Shipment Info</p>
                                        <div className="space-y-1.5">
                                            <p className="text-base font-bold text-foreground">{grnDetail.inbound_shipment?.asn_number || "—"}</p>
                                            <p className="text-xs font-semibold text-muted-foreground truncate">{grnDetail.inbound_shipment?.supplier_name || "—"}</p>
                                        </div>
                                    </div>
                                    <div className="p-5 rounded-xl bg-muted/20 border border-muted/40 shadow-sm transition-all hover:border-primary/20">
                                        <p className="text-[11px] uppercase font-black text-muted-foreground tracking-widest mb-2">Stats</p>
                                        <div className="space-y-1.5">
                                            <p className="text-base font-bold text-foreground">{grnDetail.items?.length || 0} Unique SKUs</p>
                                            <p className="text-xs font-bold text-primary uppercase tracking-wider">{grnDetail.inbound_shipment?.arrival_status?.replace(/_/g, " ") || "—"}</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="rounded-xl border border-muted/60 overflow-hidden shadow-sm">
                                    <Table>
                                        <TableHeader className="bg-muted/50">
                                            <TableRow className="hover:bg-transparent">
                                                <TableHead className="text-xs uppercase font-black py-4">SKU</TableHead>
                                                <TableHead className="text-xs uppercase font-black py-4">Description</TableHead>
                                                <TableHead className="text-xs uppercase font-black py-4 text-center">Received</TableHead>
                                                <TableHead className="text-xs uppercase font-black py-4 text-center">Accepted</TableHead>
                                                <TableHead className="text-xs uppercase font-black py-4 text-center">Rejected</TableHead>
                                                <TableHead className="text-xs uppercase font-black py-4">Unit</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {grnDetail.items?.map((item, idx) => (
                                                <React.Fragment key={idx}>
                                                    <TableRow className="hover:bg-muted/10 transition-colors border-b border-muted/40 group">
                                                        <TableCell className="font-mono text-sm font-bold py-5 text-primary/80">
                                                            {item.sku_code || item.sku || "—"}
                                                        </TableCell>
                                                        <TableCell className="text-sm font-semibold py-5 max-w-[200px] truncate text-foreground/80">
                                                            {item.description || (item as any).item_description || (item as any).sku_description || "—"}
                                                        </TableCell>
                                                        <TableCell className="text-sm font-black text-center py-5 tabular-nums">
                                                            {Number(item.received_quantity || 0).toFixed(3)}
                                                        </TableCell>
                                                        <TableCell className="text-sm font-black text-center py-5 text-green-600 tabular-nums">
                                                            {Number(item.accepted_quantity || 0).toFixed(3)}
                                                        </TableCell>
                                                        <TableCell className="text-sm font-black text-center py-5 text-destructive tabular-nums">
                                                            {Number(item.rejected_quantity || 0).toFixed(3)}
                                                        </TableCell>
                                                        <TableCell className="text-xs font-black uppercase text-muted-foreground/60 py-5 tracking-tighter">
                                                            {item.unit || "PCS"}
                                                        </TableCell>
                                                    </TableRow>
                                                    {((item.accepted_pallets && item.accepted_pallets.length > 0) || ((item as any).rejected_pallets && (item as any).rejected_pallets.length > 0)) && (
                                                        <TableRow className="bg-muted/5 hover:bg-muted/10 transition-colors border-b border-muted/40 last:border-none">
                                                            <TableCell colSpan={6} className="py-3 px-8">
                                                                <div className="flex flex-col gap-3">
                                                                    {item.accepted_pallets && item.accepted_pallets.length > 0 && (
                                                                        <div className="flex flex-wrap gap-4">
                                                                            {item.accepted_pallets.map((p, pIdx) => (
                                                                                <div key={pIdx} className="flex items-center gap-2.5 bg-background border border-green-500/30 px-4 py-1.5 rounded-full shadow-sm">
                                                                                    <span className="text-[10px] font-black text-green-600 uppercase tracking-widest">Accepted</span>
                                                                                    <span className="text-xs font-bold font-mono text-primary">{p.barcode}</span>
                                                                                    <span className="h-3 w-[1px] bg-muted/60 mx-1" />
                                                                                    <span className="text-xs font-black text-foreground tabular-nums">{Number(p.quantity_assigned || 0).toFixed(3)}</span>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    )}
                                                                    {(item as any).rejected_pallets && (item as any).rejected_pallets.length > 0 && (
                                                                        <div className="flex flex-wrap gap-4">
                                                                            {(item as any).rejected_pallets.map((p: any, pIdx: number) => (
                                                                                <div key={pIdx} className="flex items-center gap-2.5 bg-background border border-destructive/30 px-4 py-1.5 rounded-full shadow-sm">
                                                                                    <span className="text-[10px] font-black text-destructive uppercase tracking-widest">Rejected</span>
                                                                                    <span className="text-xs font-bold font-mono text-primary">{p.barcode}</span>
                                                                                    <span className="h-3 w-[1px] bg-muted/60 mx-1" />
                                                                                    <span className="text-xs font-black text-foreground tabular-nums">{Number(p.quantity_assigned || p.quantity || 0).toFixed(3)}</span>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </TableCell>
                                                        </TableRow>
                                                    )}
                                                </React.Fragment>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            </div>
                        ) : (
                            <div className="text-center py-12">
                                <p className="text-muted-foreground">Failed to load GRN details.</p>
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default GrnDashboard;
