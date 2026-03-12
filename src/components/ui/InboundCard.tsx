import { Card, CardContent } from "@/components/ui/card";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Truck,
    User,
    Calendar,
    Box,
    ArrowRight,
    AlertCircle,
    MapPin,
    ClipboardCheck
} from "lucide-react";
import { cn } from "@/lib/utils";

interface InboundItem {
    id: string;
    asn_number: string;
    supplier_name: string;
    supplier_code: string;
    expected_arrival_date: string;
    actual_arrival_date?: string;
    status: string;
    priority: string;
    items_count: number;
    total_quantity: number;
    vehicle_number: string;
    driver_name: string;
    dock_number: string;
    warehouse_name?: string;
    warehouse_code?: string;
    shipment_id?: string;
    is_overdue: boolean;
    days_overdue: number;
    raw?: any;
}

interface InboundCardProps {
    item: InboundItem;
    onView: (id: string) => void;
    onMarkArrived: (item: InboundItem) => void;
    isArriving?: boolean;
}

const getPriorityColor = (priority: string) => {
    switch (priority?.toLowerCase()) {
        case 'high': return 'bg-destructive/10 text-destructive border-destructive/20';
        case 'medium': return 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20';
        case 'low': return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
        default: return 'bg-secondary text-secondary-foreground';
    }
};

const getStatusColor = (status: string) => {
    const s = status?.toLowerCase();
    if (s.includes('arrived') || s.includes('received')) return 'bg-green-500/10 text-green-600 border-green-500/20';
    if (s.includes('pending') || s.includes('draft')) return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
    if (s.includes('transit')) return 'bg-amber-500/10 text-amber-600 border-amber-500/20';
    if (s.includes('overdue')) return 'bg-destructive/10 text-destructive border-destructive/20';
    return 'bg-secondary text-secondary-foreground';
};

export const InboundCard = ({ item, onView, onMarkArrived, isArriving }: InboundCardProps) => {
    const isOverdue = item.is_overdue;
    const canMarkArrived = ['draft', 'pending', 'in_transit', 'transit'].includes(String(item.status).toLowerCase());

    return (
        <Card className={cn(
            "group overflow-hidden transition-all duration-300 hover:shadow-xl hover:-translate-y-1 border-l-4",
            isOverdue ? "border-l-destructive" : "border-l-primary/40"
        )}>
            <CardContent className="p-0">
                {/* Header Section */}
                <div className="p-4 flex items-center justify-between bg-muted/30 border-b">
                    <div className="flex flex-col">
                        <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">ASN Number</span>
                        <span className="font-mono font-black text-lg text-primary tracking-tight">
                            {item.asn_number}
                        </span>
                    </div>
                    <div className="flex flex-col items-end gap-1.5">
                        <Badge className={cn("text-[10px] uppercase font-bold px-2 py-0.5", getStatusColor(item.status))}>
                            {item.status}
                        </Badge>
                        <Badge variant="outline" className={cn("text-[10px] uppercase font-bold", getPriorityColor(item.priority))}>
                            {item.priority} Priority
                        </Badge>
                    </div>
                </div>

                {/* Main Content */}
                <div className="p-5 space-y-5">
                    {/* Supplier Info */}
                    <div className="flex items-start gap-3">
                        <div className="mt-0.5 p-2 rounded-full bg-primary/10 text-primary">
                            <Box className="h-4 w-4" />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-sm font-bold leading-tight group-hover:text-primary transition-colors">
                                {item.supplier_name}
                            </span>
                            <span className="text-[11px] text-muted-foreground font-mono">
                                {item.supplier_code}
                            </span>
                        </div>
                    </div>

                    {/* Logistics & Timing Information */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="space-y-4">
                            <span className="text-[10px] text-muted-foreground uppercase font-black letter-spacing-widest">Shipment Info</span>
                            <div className="flex items-center gap-3 text-xs">
                                <Truck className="h-4 w-4 text-primary/60" />
                                <span className="font-mono font-bold uppercase tracking-tight">{item.vehicle_number}</span>
                            </div>
                            <div className="flex items-center gap-3 text-xs">
                                <User className="h-4 w-4 text-primary/60" />
                                <span className="font-medium underline decoration-primary/20 underline-offset-4">{item.driver_name}</span>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <span className="text-[10px] text-muted-foreground uppercase font-black letter-spacing-widest">Location & Timing</span>
                            <div className="flex items-center gap-3 text-xs">
                                <MapPin className="h-4 w-4 text-primary/60" />
                                <span className="bg-primary/10 text-primary px-2 py-1 rounded font-black text-[10px]">DOCK {item.dock_number}</span>
                            </div>
                            <div className="flex items-center gap-3 text-xs">
                                <Calendar className="h-4 w-4 text-primary/60" />
                                <span className="font-bold">{item.expected_arrival_date && item.expected_arrival_date !== "N/A" && item.expected_arrival_date !== "undefined" ? new Date(item.expected_arrival_date).toLocaleString() : 'N/A'}</span>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <span className="text-[10px] text-muted-foreground uppercase font-black letter-spacing-widest">Payload Details</span>
                            <div className="flex gap-8">
                                <div className="flex flex-col">
                                    <span className="text-[11px] font-black text-primary">{item.items_count}</span>
                                    <span className="text-[9px] text-muted-foreground uppercase font-bold">Total Items</span>
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-[11px] font-black text-primary">{item.total_quantity}</span>
                                    <span className="text-[9px] text-muted-foreground uppercase font-bold">Total Qty</span>
                                </div>
                            </div>
                            {isOverdue && (
                                <div className="flex items-center gap-2 text-destructive font-black uppercase text-[10px] bg-destructive/5 p-2 rounded border border-destructive/10 w-fit">
                                    <AlertCircle className="h-3.5 w-3.5 animate-pulse" />
                                    <span>{item.days_overdue}d Overdue</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>


                {/* Action Section */}
                <div className="px-5 pb-5 mt-2 flex gap-2">
                    <Button
                        onClick={() => onView(item.id)}
                        className="flex-1 group/btn relative overflow-hidden h-10 bg-primary/95 hover:bg-primary"
                    >
                        <span className="relative z-10 flex items-center justify-center gap-2 font-bold text-xs uppercase tracking-widest">
                            View Details
                            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover/btn:translate-x-1" />
                        </span>
                        <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 -translate-x-full group-hover/btn:animate-shimmer" />
                    </Button>

                    {canMarkArrived && (
                        <Button
                            onClick={(e) => {
                                e.stopPropagation();
                                onMarkArrived(item);
                            }}
                            disabled={isArriving}
                            className="flex-1 h-10 bg-green-600 hover:bg-green-700 font-bold text-xs uppercase tracking-widest gap-2 disabled:opacity-50"
                        >
                            {isArriving ? <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-white"></div> : <ClipboardCheck className="h-4 w-4" />}
                            {isArriving ? 'Arriving...' : 'Arrived'}
                        </Button>
                    )}
                </div>
            </CardContent>
        </Card>
    );
};
