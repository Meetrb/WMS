/**
 * InboundProcessModal
 *
 * Shows complete inbound shipment details and a GRN creation form.
 * Backend response uses camelCase; items live in shipments[].items[].
 */
import React, { useState, useEffect } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
    FileText, Truck, Package, Building2,
    Loader2, ClipboardCheck, CheckCircle2, AlertCircle
} from "lucide-react";
import { toast } from "sonner";
import { inboundService } from "@/services/inboundService";
import { useAuth } from "@/components/auth-provider";

// ─── Props ────────────────────────────────────────────────────────────────────

interface InboundProcessModalProps {
    open: boolean;
    setOpen: (open: boolean) => void;
    shipmentId: string | null;
    asnNumber?: string | null;  // explicit ASN number for fallback ID resolution
    initialData?: any;   // normalised InboundDetail (for display UI)
    rawData?: any;       // raw API response — SINGLE SOURCE OF TRUTH for inboundId and asnShipmentItemId
    onSuccess?: () => void;
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface ShipmentItem {
    asnShipmentItemId: string;  // UUID from backend (camelCase)
    sku: string;
    description: string;
    barcode?: string;
    expectedQuantity: number;
    receivedQuantity: number;
    acceptedQuantity: number;
    rejectedQuantity: number;
    unit: string;
    batchNo?: string;
    expiryDate?: string;
}

interface GrnRow {
    asnShipmentItemId: string;
    received_quantity: number;
    accepted_quantity: number;
    rejected_quantity: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const isUUID = (v: string) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

const fmt = (d?: string | null) => {
    if (!d || d === 'N/A' || d === 'undefined') return '—';
    try { return new Date(d).toLocaleDateString(); } catch { return d; }
};

const getStatusColor = (status?: string) => {
    const s = (status || '').toLowerCase();
    if (s.includes('arrived') || s.includes('received') || s.includes('grn')) return 'bg-green-500 text-white';
    if (s.includes('pending') || s.includes('draft')) return 'bg-blue-500 text-white';
    if (s.includes('transit')) return 'bg-amber-500 text-white';
    if (s.includes('overdue')) return 'bg-destructive text-white';
    return 'bg-secondary text-secondary-foreground';
};

/** Pull all items from the raw API response, handling both camelCase and snake_case shapes */
const extractItems = (raw: any): ShipmentItem[] => {
    let rawItems: any[] = [];

    // Primary: shipments[].items[]
    if (raw?.shipments?.length) {
        raw.shipments.forEach((s: any) => {
            if (Array.isArray(s.items)) rawItems.push(...s.items);
        });
    }

    // Fallback: top-level items
    if (rawItems.length === 0 && Array.isArray(raw?.items)) {
        rawItems = raw.items;
    }

    return rawItems.map((i: any) => {
        const id = i.asnShipmentItemId || i.asn_shipment_item_id || i.id || '';
        return {
            asnShipmentItemId: isUUID(String(id)) ? String(id) : crypto.randomUUID(),
            sku: i.sku || i.sku_code || i.item_master?.sku_code || 'N/A',
            description: i.description || i.description_code || i.item_master?.description || 'N/A',
            barcode: i.barcode || i.barcodeNumber || i.barcode_number || '',
            expectedQuantity: Number(i.expectedQuantity || i.expected_quantity || i.quantity || 0),
            receivedQuantity: Number(i.receivedQuantity || i.received_quantity || 0),
            acceptedQuantity: Number(i.acceptedQuantity || i.accepted_quantity || 0),
            rejectedQuantity: Number(i.rejectedQuantity || i.rejected_quantity || 0),
            unit: i.unit || i.base_uom || i.item_master?.base_uom || 'PCS',
            batchNo: i.batchNo || i.batch_no || i.batch_number || '',
            expiryDate: i.expiryDate || i.expiry_date || '',
        };
    });
};

// ─── Sub-components ───────────────────────────────────────────────────────────

const Section = ({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) => (
    <div className="space-y-3">
        <div className="flex items-center gap-2 border-b pb-2">
            <span className="text-primary">{icon}</span>
            <h3 className="font-bold text-xs uppercase tracking-widest text-muted-foreground">{title}</h3>
        </div>
        {children}
    </div>
);

const InfoRow = ({ label, value }: { label: string; value?: string | null }) => (
    <div className="flex flex-col gap-0.5">
        <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">{label}</span>
        <span className="text-sm font-medium">{value || '—'}</span>
    </div>
);

// ─── Main component ───────────────────────────────────────────────────────────

export const InboundProcessModal: React.FC<InboundProcessModalProps> = ({
    open,
    setOpen,
    shipmentId,
    asnNumber: propAsnNumber,  // explicit ASN number passed from parent
    initialData,
    rawData,       // raw API response — always preferred for GRN UUIDs
    onSuccess,
}) => {
    const { user } = useAuth();

    // Raw API response
    const [raw, setRaw] = useState<any>(null);
    const [isLoadingDetail, setIsLoadingDetail] = useState(false);

    // Resolved real UUID for GRN (fetched by ASN number if inboundId is null)
    const [resolvedInboundId, setResolvedInboundId] = useState<string | null>(null);

    // GRN creation UI
    const [showGrnForm, setShowGrnForm] = useState(false);
    const [grnRows, setGrnRows] = useState<Record<string, GrnRow>>({});
    const [isSubmittingGrn, setIsSubmittingGrn] = useState(false);
    const [grnCreated, setGrnCreated] = useState(false);

    // ── Open / close lifecycle ─────────────────────────────────────────────
    useEffect(() => {
        if (!open) {
            setRaw(null);
            setShowGrnForm(false);
            setGrnRows({});
            setGrnCreated(false);
            setResolvedInboundId(null);
            return;
        }

        const hasEmbeddedAsnItems = Array.isArray(rawData?.shipments)
            && rawData.shipments.some((s: any) => Array.isArray(s?.items) && s.items.length > 0);

        // Seed immediately from initialData so the modal isn't blank
        if (initialData) setRaw(initialData);

        // Check if we already have a valid inboundId from rawData or initialData
        const existingId =
            rawData?.inboundId ||
            (rawData?.id && isUUID(String(rawData.id)) ? rawData.id : null) ||
            initialData?.inboundId ||
            (initialData?.id && isUUID(String(initialData.id)) ? initialData.id : null);

        if (existingId) {
            setResolvedInboundId(existingId);
            console.log('✅ inboundId from rawData:', existingId);
        } else {
            // inboundId is null — try to fetch it using ASN number
            const asnNumber = propAsnNumber || rawData?.asnNumber || rawData?.asn_number || initialData?.asn_number;
            if (asnNumber) {
                console.log('🔍 inboundId is null, fetching by ASN number:', asnNumber);
                inboundService.getByAsnNumber(asnNumber)
                    .then(data => {
                        const id = data?.inboundId || data?.id;
                        if (id && isUUID(String(id))) {
                            console.log('✅ Resolved inboundId via ASN lookup:', id);
                            setResolvedInboundId(String(id));
                            // Only replace raw if the new data actually has items
                            if (extractItems(data).length > 0) setRaw(data);
                        } else {
                            console.warn('⚠️ ASN lookup returned no valid UUID:', data);
                        }
                    })
                    .catch(err => {
                        console.warn('ASN lookup failed:', err);
                        // Last resort: try getById with shipmentId
                        if (shipmentId) {
                            inboundService.getById(shipmentId)
                                .then(data => {
                                    const id = data?.inboundId || data?.id;
                                    if (id && isUUID(String(id))) {
                                        setResolvedInboundId(String(id));
                                        if (extractItems(data).length > 0) setRaw(data);
                                    }
                                })
                                .catch(() => { });
                        }
                    });
            }
        }

        // If selected ASN already comes from /inbound/today/arrived with shipments[].items[],
        // avoid extra detail fetches and use that object as source of truth.
        if (!hasEmbeddedAsnItems) {
            const resolvedAsn = propAsnNumber || rawData?.asnNumber || rawData?.asn_number || initialData?.asn_number;
            if (resolvedAsn && resolvedAsn !== 'N/A') {
                setIsLoadingDetail(true);
                inboundService.getByAsnNumber(resolvedAsn)
                    .then(data => {
                        if (extractItems(data).length > 0) setRaw(data);
                        const id = data?.inboundId || data?.id;
                        if (id && isUUID(String(id))) setResolvedInboundId(String(id));
                    })
                    .catch(err => {
                        console.warn('GET /inbound/asn/:asn failed, trying getById', err);
                        if (shipmentId) {
                            inboundService.getById(shipmentId)
                                .then(data => {
                                    if (extractItems(data).length > 0) setRaw(data);
                                    const id = data?.inboundId || data?.id;
                                    if (id && isUUID(String(id))) setResolvedInboundId(String(id));
                                })
                                .catch(() => { });
                        }
                    })
                    .finally(() => setIsLoadingDetail(false));
            } else if (shipmentId) {
                setIsLoadingDetail(true);
                inboundService.getById(shipmentId)
                    .then(data => {
                        if (extractItems(data).length > 0) setRaw(data);
                        const id = data?.inboundId || data?.id;
                        if (id && isUUID(String(id))) setResolvedInboundId(String(id));
                    })
                    .catch(err => { console.warn('GET /inbound/:id failed, using initialData', err); })
                    .finally(() => setIsLoadingDetail(false));
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, shipmentId]);

    // ── Sync rawData prop → local raw when parent asynchronously adds items ──
    useEffect(() => {
        if (!open || !rawData) return;
        const newItems = extractItems(rawData);
        if (newItems.length > 0) {
            setRaw((prev: any) => {
                const currentItems = prev ? extractItems(prev) : [];
                // Prefer rawData when it gives us items and current raw has none
                if (currentItems.length === 0) return rawData;
                return prev;
            });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [rawData, open]);

    // ── Derived display values ─────────────────────────────────────────────
    // Support both camelCase (backend) and snake_case (normalised initialData)
    const d = raw || initialData;

    const displayId = d?.inboundId || d?.id || shipmentId || '—';
    const displayAsn = d?.asnNumber || d?.asn_number || '—';
    const displayStatus = d?.status || '—';
    const displayAsnDate = d?.asnDate || d?.asn_date;
    const displayExpected = d?.expectedDate || d?.expected_arrival_date || d?.expected_date;
    const displayArrival = d?.actualArrivalDate || d?.actual_arrival_date;

    // Supplier
    const displaySupplierName = d?.supplierName || d?.supplier_name || d?.supplier?.name || '—';
    const displaySupplierCode = d?.supplierCode || d?.supplier_code || d?.supplier?.code || '—';
    const displayGstin = d?.supplierGstin || d?.supplier_gstin || null;

    // Logistics
    const displayVehicle = d?.vehicleNumber || d?.vehicle_number || '—';
    const displayDriver = d?.driverName || d?.driver_name || '—';
    const displayPhone = d?.driverPhone || d?.driver_phone || '—';

    // Warehouse
    const displayWarehouse = d?.warehouseName || d?.warehouse_name || d?.warehouse?.name || '—';
    const displayDock = d?.receivingDock || d?.dock_number || '—';

    // GRN
    const displayGrnNumber = d?.grnNumber || d?.grn?.number || '—';
    const displayGrnStatus = d?.grnStatus || d?.grn?.status || '—';
    const grnIsGenerated = !!(d?.grn?.is_generated) || grnCreated;

    // Pull items from selected ASN response: shipments[].items[]
    const items: ShipmentItem[] = raw ? extractItems(raw) : (initialData?.items || []).map((i: any) => ({
        asnShipmentItemId: isUUID(String(i.id || '')) ? String(i.id) : crypto.randomUUID(),
        sku: i.sku || 'N/A',
        description: i.description || 'N/A',
        barcode: i.barcode || '',
        expectedQuantity: Number(i.expected_quantity || 0),
        receivedQuantity: Number(i.received_quantity || 0),
        acceptedQuantity: Number(i.accepted_quantity || 0),
        rejectedQuantity: Number(i.rejected_quantity || 0),
        unit: i.unit || 'PCS',
        batchNo: '',
        expiryDate: '',
    }));

    // ── GRN form helpers ───────────────────────────────────────────────────

    const openGrnForm = () => {
        const rows: Record<string, GrnRow> = {};
        items.forEach(item => {
            rows[item.asnShipmentItemId] = {
                asnShipmentItemId: item.asnShipmentItemId,
                received_quantity: item.receivedQuantity || item.expectedQuantity,
                accepted_quantity: item.acceptedQuantity || item.receivedQuantity || item.expectedQuantity,
                rejected_quantity: item.rejectedQuantity || 0,
            };
        });
        setGrnRows(rows);
        setShowGrnForm(true);
    };

    const updateGrnRow = (id: string, field: keyof Omit<GrnRow, 'asnShipmentItemId'>, value: number) => {
        setGrnRows(prev => {
            const row = { ...prev[id] };
            row[field] = value;

            // Auto-correct: if accepted + rejected > received, cap the other
            if (field === 'accepted_quantity') {
                const maxRejected = Math.max(0, row.received_quantity - value);
                if (row.rejected_quantity > maxRejected) row.rejected_quantity = maxRejected;
            }
            if (field === 'rejected_quantity') {
                const maxAccepted = Math.max(0, row.received_quantity - value);
                if (row.accepted_quantity > maxAccepted) row.accepted_quantity = maxAccepted;
            }
            return { ...prev, [id]: row };
        });
    };

    const validateGrn = (): boolean => {
        for (const row of Object.values(grnRows)) {
            if (row.accepted_quantity + row.rejected_quantity > row.received_quantity) {
                toast.error('Accepted + Rejected quantities cannot exceed Received quantity');
                return false;
            }
        }
        return true;
    };

    const handleGrnSubmit = async () => {
        if (!validateGrn()) return;

        // Priority: resolvedInboundId (fetched via ASN lookup) → rawData → raw → initialData
        // NEVER generate a random UUID
        const inboundId = resolvedInboundId ||
            (rawData?.inboundId) ||
            (rawData?.id && isUUID(String(rawData.id)) ? String(rawData.id) : null) ||
            (raw?.inboundId) ||
            (raw?.id && isUUID(String(raw.id)) ? String(raw.id) : null) ||
            (initialData?.inboundId) ||
            (initialData?.id && isUUID(String(initialData.id)) ? String(initialData.id) : null);

        if (!inboundId) {
            toast.error('Cannot create GRN: No valid Inbound Shipment ID found. Please refresh and try again.');
            return;
        }

        setIsSubmittingGrn(true);
        try {
            const payload = {
                inbound_shipment_id: inboundId,
                items: Object.values(grnRows).map(r => ({
                    asn_shipment_item_id: r.asnShipmentItemId,
                    received_quantity: r.received_quantity,
                    accepted_quantity: r.accepted_quantity,
                    rejected_quantity: r.rejected_quantity,
                })),
                created_by: user?.id || user?.email || 'admin',
            };
            console.log('📦 GRN Payload:', JSON.stringify(payload, null, 2));
            await inboundService.createGrn(payload);
            toast.success('GRN created successfully!');
            setGrnCreated(true);
            setShowGrnForm(false);
            onSuccess?.();
        } catch (err: any) {
            const msg = err?.response?.data?.detail || err?.message || 'Failed to create GRN';
            toast.error(msg);
            console.error('GRN Error:', err);
        } finally {
            setIsSubmittingGrn(false);
        }
    };

    // ── Render ─────────────────────────────────────────────────────────────
    return (
        <>
            <Dialog open={open} onOpenChange={(val) => { if (!val) setOpen(false); }}>
                <DialogContent className="max-w-5xl overflow-hidden p-0 flex flex-col h-[92vh]">

                    {/* ── Fixed Header ───────────────────────────────── */}
                    <div className="p-6 pb-4 bg-background border-b z-20 shrink-0 shadow-sm">
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2 text-xl font-heading">
                                <FileText className="h-5 w-5 text-primary" />
                                Inbound Shipment Details
                                {isLoadingDetail && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground ml-2" />}
                            </DialogTitle>
                            <DialogDescription className="flex flex-wrap items-center gap-2 mt-1" asChild>
                                <div>
                                    <span className="font-mono text-xs font-bold text-primary px-2 py-0.5 bg-primary/10 rounded-md">
                                        {displayAsn}
                                    </span>
                                    {displayStatus && displayStatus !== '—' && (
                                        <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${getStatusColor(displayStatus)}`}>
                                            {displayStatus}
                                        </span>
                                    )}
                                    {displayId && displayId !== '—' && (
                                        <span className="text-xs text-muted-foreground">ID: {displayId}</span>
                                    )}
                                </div>
                            </DialogDescription>
                        </DialogHeader>
                    </div>

                    {/* ── Scrollable Body ──────────────────────────────── */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-8 bg-background/50">

                        {!d ? (
                            <div className="flex flex-col items-center justify-center min-h-[300px] gap-3">
                                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                                <p className="text-muted-foreground text-sm animate-pulse">Loading shipment details...</p>
                            </div>
                        ) : (
                            <>
                                {/* ── 1. Header Info ───────────────────── */}
                                <Section title="Inbound Information" icon={<FileText className="h-4 w-4" />}>
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                        <InfoRow label="Shipment ID" value={String(displayId)} />
                                        <InfoRow label="ASN Number" value={displayAsn} />
                                        <InfoRow label="Status" value={displayStatus} />
                                        <InfoRow label="Arrival Date" value={fmt(displayArrival)} />
                                        <InfoRow label="ASN Date" value={fmt(displayAsnDate)} />
                                        <InfoRow label="Expected Date" value={fmt(displayExpected)} />
                                    </div>
                                </Section>

                                {/* ── 2. Supplier ──────────────────────── */}
                                <Section title="Supplier" icon={<Building2 className="h-4 w-4" />}>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                                        <InfoRow label="Supplier Name" value={displaySupplierName} />
                                        <InfoRow label="Supplier Code" value={displaySupplierCode} />
                                        <InfoRow label="GSTIN" value={displayGstin} />
                                    </div>
                                </Section>

                                {/* ── 3. Logistics ─────────────────────── */}
                                <Section title="Logistics" icon={<Truck className="h-4 w-4" />}>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                                        <InfoRow label="Vehicle Number" value={displayVehicle} />
                                        <InfoRow label="Driver Name" value={displayDriver} />
                                        <InfoRow label="Driver Phone" value={displayPhone} />
                                    </div>
                                </Section>

                                {/* ── 4. Warehouse ─────────────────────── */}
                                <Section title="Warehouse" icon={<Building2 className="h-4 w-4" />}>
                                    <div className="grid grid-cols-2 gap-4">
                                        <InfoRow label="Warehouse Name" value={displayWarehouse} />
                                        <InfoRow label="Receiving Dock" value={displayDock} />
                                    </div>
                                </Section>

                                {/* ── 5. GRN Status ────────────────────── */}
                                <Section title="GRN Status" icon={<CheckCircle2 className="h-4 w-4" />}>
                                    <div className="flex items-center gap-4">
                                        <div className="grid grid-cols-2 gap-4 flex-1">
                                            <InfoRow label="GRN Number" value={displayGrnNumber} />
                                            <InfoRow label="GRN Status" value={displayGrnStatus} />
                                        </div>
                                        {grnIsGenerated && (
                                            <Badge className="bg-green-500 text-white font-bold gap-1.5 px-3 py-1.5">
                                                <CheckCircle2 className="h-3.5 w-3.5" />
                                                GRN Generated
                                            </Badge>
                                        )}
                                    </div>
                                </Section>

                                {/* ── 6. Shipment Items Table ───────────── */}
                                <Section title="Shipment Items" icon={<Package className="h-4 w-4" />}>
                                    <div className="border rounded-md overflow-hidden">
                                        <Table>
                                            <TableHeader className="bg-muted/50">
                                                <TableRow>
                                                    <TableHead className="text-xs font-bold uppercase tracking-wider">SKU</TableHead>
                                                    <TableHead className="text-xs font-bold uppercase tracking-wider">Description</TableHead>
                                                    <TableHead className="text-xs font-bold uppercase tracking-wider">Barcode</TableHead>
                                                    <TableHead className="text-xs font-bold uppercase tracking-wider text-right">Expected</TableHead>
                                                    <TableHead className="text-xs font-bold uppercase tracking-wider text-right">Received</TableHead>
                                                    <TableHead className="text-xs font-bold uppercase tracking-wider text-right">Accepted</TableHead>
                                                    <TableHead className="text-xs font-bold uppercase tracking-wider text-right">Rejected</TableHead>
                                                    <TableHead className="text-xs font-bold uppercase tracking-wider">Unit</TableHead>
                                                    <TableHead className="text-xs font-bold uppercase tracking-wider">Batch</TableHead>
                                                    <TableHead className="text-xs font-bold uppercase tracking-wider">Expiry</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {items.length === 0 ? (
                                                    <TableRow>
                                                        <TableCell colSpan={10} className="text-center text-muted-foreground py-10 text-sm">
                                                            <div className="flex flex-col items-center gap-2">
                                                                <Package className="h-8 w-8 opacity-20" />
                                                                No shipment items found.
                                                            </div>
                                                        </TableCell>
                                                    </TableRow>
                                                ) : (
                                                    items.map((item, idx) => (
                                                        <TableRow key={item.asnShipmentItemId || idx}>
                                                            <TableCell className="font-mono text-primary font-bold text-xs">{item.sku}</TableCell>
                                                            <TableCell className="text-xs text-muted-foreground max-w-[160px] truncate">{item.description}</TableCell>
                                                            <TableCell className="font-mono text-xs text-muted-foreground">{item.barcode || '—'}</TableCell>
                                                            <TableCell className="text-right font-bold text-sm">{item.expectedQuantity}</TableCell>
                                                            <TableCell className="text-right text-sm">{item.receivedQuantity || '—'}</TableCell>
                                                            <TableCell className="text-right text-sm text-green-600 font-medium">{item.acceptedQuantity || '—'}</TableCell>
                                                            <TableCell className="text-right text-sm text-destructive font-medium">{item.rejectedQuantity || '—'}</TableCell>
                                                            <TableCell className="text-xs uppercase text-muted-foreground">{item.unit}</TableCell>
                                                            <TableCell className="text-xs text-muted-foreground">{item.batchNo || '—'}</TableCell>
                                                            <TableCell className="text-xs text-muted-foreground">{fmt(item.expiryDate) || '—'}</TableCell>
                                                        </TableRow>
                                                    ))
                                                )}
                                            </TableBody>
                                        </Table>
                                    </div>

                                    {/* Create GRN Button */}
                                    <div className="flex justify-end pt-4">
                                        <Button
                                            onClick={openGrnForm}
                                            disabled={grnIsGenerated || isSubmittingGrn}
                                            className="gap-2 px-6 bg-green-600 hover:bg-green-700 disabled:opacity-50"
                                        >
                                            {grnIsGenerated ? (
                                                <>
                                                    <CheckCircle2 className="h-4 w-4" />
                                                    GRN Already Created
                                                </>
                                            ) : (
                                                <>
                                                    <ClipboardCheck className="h-4 w-4" />
                                                    Create GRN
                                                </>
                                            )}
                                        </Button>
                                    </div>
                                </Section>

                            </>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            {/* ── GRN Creation Dialog ──────────────────────────────── */}
            <Dialog open={showGrnForm} onOpenChange={setShowGrnForm}>
                <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
                    <div className="p-6 pb-4 border-b bg-background shadow-sm shrink-0">
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2 text-xl font-heading">
                                <ClipboardCheck className="h-5 w-5 text-primary" /> Create GRN
                            </DialogTitle>
                            <DialogDescription className="flex items-center justify-between">
                                <span>Enter received, accepted, and rejected quantities for each item.</span>
                                <span className="flex items-center gap-1.5 text-xs text-amber-600 bg-amber-50 dark:bg-amber-950/30 px-3 py-1.5 rounded-full border border-amber-200 dark:border-amber-800">
                                    <AlertCircle className="h-3 w-3" />
                                    Accepted + Rejected ≤ Received
                                </span>
                            </DialogDescription>
                        </DialogHeader>
                    </div>

                    <div className="flex-1 overflow-y-auto p-6 bg-background/50">
                        <div className="border rounded-md overflow-hidden bg-background">
                            <Table>
                                <TableHeader className="bg-muted/70">
                                    <TableRow>
                                        <TableHead className="text-xs font-bold uppercase tracking-wider">Item</TableHead>
                                        <TableHead className="text-xs font-bold uppercase tracking-wider text-right">Expected</TableHead>
                                        <TableHead className="text-xs font-bold uppercase tracking-wider text-right w-[130px]">Received *</TableHead>
                                        <TableHead className="text-xs font-bold uppercase tracking-wider text-right w-[130px]">Accepted *</TableHead>
                                        <TableHead className="text-xs font-bold uppercase tracking-wider text-right w-[130px]">Rejected</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {items.map((item) => {
                                        const row = grnRows[item.asnShipmentItemId] || {
                                            received_quantity: item.expectedQuantity,
                                            accepted_quantity: item.expectedQuantity,
                                            rejected_quantity: 0,
                                        };
                                        const overLimit = (row.accepted_quantity + row.rejected_quantity) > row.received_quantity;

                                        return (
                                            <TableRow key={item.asnShipmentItemId} className={overLimit ? 'bg-destructive/5' : ''}>
                                                <TableCell>
                                                    <div className="flex flex-col">
                                                        <span className="font-mono text-primary font-bold text-xs">{item.sku}</span>
                                                        <span className="text-xs text-muted-foreground truncate max-w-[180px]">{item.description}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-right font-bold text-muted-foreground">{item.expectedQuantity}</TableCell>

                                                {/* Received */}
                                                <TableCell>
                                                    <Input
                                                        type="number" min="0"
                                                        className="h-8 text-right font-mono text-sm"
                                                        value={row.received_quantity}
                                                        onChange={e => updateGrnRow(item.asnShipmentItemId, 'received_quantity', Number(e.target.value))}
                                                        disabled={isSubmittingGrn}
                                                    />
                                                </TableCell>

                                                {/* Accepted */}
                                                <TableCell>
                                                    <Input
                                                        type="number" min="0"
                                                        className={`h-8 text-right font-mono text-sm ${overLimit ? 'border-destructive' : ''}`}
                                                        value={row.accepted_quantity}
                                                        onChange={e => updateGrnRow(item.asnShipmentItemId, 'accepted_quantity', Number(e.target.value))}
                                                        disabled={isSubmittingGrn}
                                                    />
                                                </TableCell>

                                                {/* Rejected */}
                                                <TableCell>
                                                    <Input
                                                        type="number" min="0"
                                                        className={`h-8 text-right font-mono text-sm ${overLimit ? 'border-destructive' : ''}`}
                                                        value={row.rejected_quantity}
                                                        onChange={e => updateGrnRow(item.asnShipmentItemId, 'rejected_quantity', Number(e.target.value))}
                                                        disabled={isSubmittingGrn}
                                                    />
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                    </div>

                    <div className="flex justify-between items-center p-6 border-t bg-background shrink-0">
                        <Button variant="outline" onClick={() => setShowGrnForm(false)} disabled={isSubmittingGrn}>
                            Cancel
                        </Button>
                        <Button onClick={handleGrnSubmit} disabled={isSubmittingGrn} className="gap-2 px-8 bg-green-600 hover:bg-green-700">
                            {isSubmittingGrn ? <><Loader2 className="w-4 h-4 animate-spin" />Generating... </> : <><ClipboardCheck className="w-4 h-4" />Submit GRN </>}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
};
