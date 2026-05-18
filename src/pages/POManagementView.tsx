import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/components/auth-provider";

import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Eye, Box, User, LayoutGrid, List, ClipboardCheck } from "lucide-react";
import { toast } from "sonner";
import { inboundService } from "@/services/inboundService";
import { InboundCard } from "@/components/ui/InboundCard";
import { ArrivedModal } from "@/components/ui/ArrivedModal";
import { InboundProcessModal } from "@/components/inbound/InboundProcessModal";
import { formatDisplayDate } from "@/lib/date";

import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";





// --- Types ---

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

interface OverviewSectionData {
    data: InboundItem[];
    count: number;
    display_message?: string;
    title?: string;
    description?: string;
    total_items?: number;
    total_quantity?: number;
}

interface PaginationMetadata {
    total_overdue: number;
    total_today: number;
    total_arrived_today: number;
    has_more_overdue: boolean;
    has_more_today: boolean;
    has_more_arrived_today: boolean;
}

interface FilterMetadata {
    warehouse_id?: string;
    supplier_id?: string;
    search_term?: string;
}

interface InboundOverview {
    overdue: OverviewSectionData;
    today: OverviewSectionData;
    arrived_today: OverviewSectionData;
    summary?: any;
    pagination: PaginationMetadata;
    filters_applied: FilterMetadata;
}

interface InboundDetail {
    id: string;
    inboundId?: string; // Preserved UUID from backend (inboundId) for GRN payload
    asn_number: string;
    asn_date: string;
    expected_arrival_date: string;
    actual_arrival_date: string;
    status: string;
    priority: string;
    supplier_name: string;
    supplier_code: string;
    supplier_gstin: string | null;
    vehicle_number: string | null;
    driver_name: string | null;
    driver_phone: string | null;
    dock_number: string | null;
    items_count: number;
    total_quantity: number;
    items: any[];
    supplier_address: string | null;
    supplier_contact: string | null;
    supplier_phone: string | null;
    supplier_email: string | null;
    notes: string | null;
    is_arrived: boolean;
    arrival_time: string | null;
    arrival_status: string | null;
    grn: {
        status: string | null;
        number: string | null;
        date: string | null;
        is_generated: boolean;
    };
}



// --- Sub-components ---

const normalizeInboundItem = (item: any): InboundItem => {
    const data = item || {};
    const firstShipment = data.shipments?.[0] || {};

    // Dates
    const expected = data.expectedDate || data.expected_date || data.expected_arrival_date || data.asnDate || data.asn_date || firstShipment.expected_date;
    const actual = data.actualArrivalDate || data.actual_arrival_date || data.arrival_date || firstShipment.actual_arrival_date;

    // Items and Quantities
    const itemsRaw = Array.isArray(data.items) ? data.items : (Array.isArray(firstShipment.items) ? firstShipment.items : []);
    const icount = data.items_count || data.itemsCount || firstShipment.items_count || itemsRaw.length;
    const iqty = data.total_quantity || data.totalQuantity || firstShipment.total_quantity || itemsRaw.reduce((acc: number, i: any) => acc + (Number(i.expected_quantity || i.quantity || 0)), 0);

    // Supplier Lookup
    let sName = data.supplier_name || data.supplierName || data.vendor_name || data.supplier?.name || firstShipment.supplier_name || firstShipment.vendor_name || "N/A";
    let sCode = data.supplier_code || data.supplierCode || data.vendor_code || data.supplier?.code || firstShipment.supplier_code || firstShipment.vendor_code || "N/A";

    if (sName === "N/A" || !sName) {
        const altSupplier = data.suppliers?.[0] || firstShipment.suppliers?.[0];
        if (altSupplier) {
            sName = altSupplier.name || altSupplier.vendor_name || sName;
            sCode = altSupplier.code || altSupplier.vendor_code || sCode;
        }
    }

    // Logistics & Dock
    const vehicle = data.vehicle_number || data.vehicleNumber || data.truck_number || data.truckNumber || firstShipment.vehicle_number || firstShipment.truck_number || firstShipment.vehicleNumber || firstShipment.truckNumber || "N/A";
    const driver = data.driver_name || data.driverName || firstShipment.driver_name || firstShipment.driverName || "N/A";
    const dock = data.receivingDock || data.dock_number || data.receiving_dock || data.dockName || data.dock_name || firstShipment.receiving_dock || firstShipment.dock_number || firstShipment.receivingDock || "N/A";

    return {
        id: String(data.inboundId || data.shipmentId || data.id || data.asn_id || data.shipment_id || Math.random()),
        asn_number: String(data.asnNumber || data.asn_number || data.asn_no || "N/A"),
        supplier_name: String(sName),
        supplier_code: String(sCode),
        expected_arrival_date: expected ? String(expected) : new Date().toISOString(),
        actual_arrival_date: actual ? String(actual) : undefined,
        status: String(data.status || "Pending"),
        priority: String(data.priority || "Medium"),
        items_count: Number(icount) || 0,
        total_quantity: Number(iqty) || 0,
        vehicle_number: String(vehicle),
        driver_name: String(driver),
        dock_number: String(dock),
        warehouse_name: String(data.warehouseName || data.warehouse_name || data.warehouse?.name || "N/A"),
        warehouse_code: String(
            data.warehouseCode ||
            data.warehouse_code ||
            data.warehouse?.code ||
            firstShipment.warehouse_code ||
            "N/A"
        ),
        shipment_id: String(data.shipmentId || data.shipment_id || firstShipment.shipment_id || "N/A"),
        is_overdue: !!data.is_overdue || (expected && new Date(expected) < new Date() && !actual),
        days_overdue: Number(data.days_overdue) || 0,
        raw: data
    };
};



const normalizeInboundDetail = (data: any): InboundDetail => {
    // Some backend endpoints return the object wrapped in a 'data' property
    const item = data?.data || data || {};
    const firstShipment = item.shipments?.[0] || {};

    console.log("🧐 Normalizing Inbound Detail. Raw data:", item);

    // Dates
    const asnDate = item.asn_date || item.asnDate || item.date || firstShipment.asn_date;
    const expectedDate = item.expected_arrival_date || item.expectedDate || item.expected_date || item.asn_date || item.asnDate || firstShipment.expected_date;
    const actualArrivalDate = item.actual_arrival_date || item.actualArrivalDate || item.arrival_date || firstShipment.actual_arrival_date;

    // Items and Quantities
    // If shipments exist, extract all items from all shipments
    let itemsRaw = item.items || [];
    if (itemsRaw.length === 0 && item.shipments?.length > 0) {
        itemsRaw = item.shipments.reduce((acc: any[], s: any) => [...acc, ...(s.items || [])], []);
    }

    const itemsCount = item.items_count || item.itemsCount || (itemsRaw.length > 0 ? itemsRaw.length : 0);
    const totalQty = item.total_quantity || item.totalQuantity || (itemsRaw.length > 0 ? itemsRaw.reduce((acc: number, i: any) => acc + (Number(i.expected_quantity || i.quantity || 0)), 0) : 0);

    // Supplier Lookup
    let sName = item.supplier_name || item.supplierName || item.supplier?.name || item.vendor_name || item.vendorName || firstShipment.supplier_name || firstShipment.vendor_name || firstShipment.supplierName || firstShipment.vendorName || "N/A";
    let sCode = item.supplier_code || item.supplierCode || item.supplier?.code || item.vendor_code || item.vendorCode || firstShipment.supplier_code || firstShipment.vendor_code || firstShipment.supplierCode || firstShipment.vendorCode || "N/A";
    let sGstin = item.supplier_gstin || item.supplierGstin || item.supplier?.gstin || item.tax_id || item.taxId || firstShipment.supplier_gstin || firstShipment.tax_id || null;

    if (sName === "N/A" || !sName) {
        const altSupplier = item.suppliers?.[0] || firstShipment.suppliers?.[0];
        if (altSupplier) {
            sName = altSupplier.name || altSupplier.vendor_name || sName;
            sCode = altSupplier.code || altSupplier.vendor_code || sCode;
            sGstin = altSupplier.gstin || altSupplier.tax_id || sGstin;
        }
    }

    // Logistics & Dock
    const vehicle = item.vehicle_number || item.vehicleNumber || item.truck_number || item.truckNumber || firstShipment.vehicle_number || firstShipment.truck_number || firstShipment.vehicleNumber || firstShipment.truckNumber || "N/A";
    const driver = item.driver_name || item.driverName || firstShipment.driver_name || firstShipment.driverName || "N/A";
    const dock = item.dock_number || item.dockNumber || item.receivingDock || item.receiving_dock || item.dockName || item.dock_name || firstShipment.receiving_dock || firstShipment.dock_number || firstShipment.receivingDock || "N/A";

    // Preserve the raw UUID (inboundId) so the modal can use it for GRN payload
    const rawInboundId = item.inboundId || null;
    const resolvedId = (item.inboundId || item.shipmentId || item.id || item.asn_id || item.shipment_id || "N/A").toString();

    return {
        id: resolvedId,
        inboundId: rawInboundId, // ← real UUID for POST /inbound/grn inbound_shipment_id
        asn_number: item.asnNumber || item.asn_number || item.asn_no || "N/A",
        asn_date: asnDate,
        expected_arrival_date: expectedDate,
        actual_arrival_date: actualArrivalDate,
        status: item.status || "UNKNOWN",
        priority: item.priority || "NORMAL",
        supplier_name: sName,
        supplier_code: sCode,
        supplier_gstin: sGstin,
        vehicle_number: vehicle,
        driver_name: driver,
        driver_phone: item.driver_phone || item.driverPhone || firstShipment.driver_phone || firstShipment.driverPhone || null,
        dock_number: dock,
        warehouse_name: item.warehouse_name || item.warehouseName || item.warehouse?.name || firstShipment.warehouse_name || null,
        warehouse_code: item.warehouse_code || item.warehouseCode || item.warehouse?.code || firstShipment.warehouse_code || null,
        items_count: Number(itemsCount) || 0,
        total_quantity: Number(totalQty) || 0,
        items: itemsRaw.map((i: any) => ({
            // asnShipmentItemId must be preserved for GRN payload
            id: i.asnShipmentItemId || i.asn_shipment_item_id || i.id || crypto.randomUUID(),
            sku: i.sku || i.sku_code || i.item_master?.sku_code || "N/A",
            description: i.description || i.description_code || i.item_master?.description || "N/A",
            barcode: i.barcode || i.barcodeNumber || i.barcode_number || "",
            expected_quantity: Number(i.expectedQuantity || i.expected_quantity || i.quantity || 0),
            received_quantity: Number(i.receivedQuantity || i.received_quantity || 0),
            accepted_quantity: Number(i.acceptedQuantity || i.accepted_quantity || 0),
            rejected_quantity: Number(i.rejectedQuantity || i.rejected_quantity || 0),
            unit: i.unit || i.base_uom || i.item_master?.base_uom || "PCS",
            batchNo: i.batchNo || i.batch_no || "",
            expiryDate: i.expiryDate || i.expiry_date || "",
        })),
        supplier_address: item.supplier_address || item.supplier?.address || null,
        supplier_contact: item.supplier_contact || item.supplier?.contact_person || null,
        supplier_phone: item.supplier_phone || item.supplier?.phone || null,
        supplier_email: item.supplier_email || item.supplier?.email || null,
        notes: item.notes || firstShipment.notes || firstShipment.remarks || null,
        is_arrived: !!(item.is_arrived || item.isArrived),
        arrival_time: item.arrival_time || item.arrivalTime || null,
        arrival_status: item.arrival_status || item.arrivalStatus || null,
        grn: {
            status: item.grn?.status || null,
            number: item.grn?.number || null,
            date: item.grn?.date || null,
            is_generated: !!item.grn?.is_generated
        }
    };
};


const getStatusColor = (status: string) => {
    const s = status?.toLowerCase();
    if (s.includes('arrived') || s.includes('received')) return 'bg-green-500 text-white';
    if (s.includes('pending') || s.includes('draft')) return 'bg-blue-500 text-white';
    if (s.includes('transit')) return 'bg-amber-500 text-white';
    if (s.includes('overdue')) return 'bg-destructive text-white';
    return 'bg-secondary text-secondary-foreground';
};

const ShipmentRow = ({ item, onView, onMarkArrived, isArriving }: { item: InboundItem, onView: (id: string) => void, onMarkArrived: (item: InboundItem) => void, isArriving?: boolean }) => {
    const canMarkArrived = ['draft', 'pending', 'in_transit', 'transit'].includes(String(item.status).toLowerCase());

    return (
        <TableRow className="group hover:bg-muted/30 transition-colors">
            <TableCell className="font-mono font-bold text-xs text-primary">
                {item.asn_number}
            </TableCell>
            <TableCell className="max-w-[150px]">
                <div className="flex flex-col">
                    <span className="text-xs font-bold truncate">{item.supplier_name}</span>
                    <span className="text-[10px] text-muted-foreground font-mono">{item.supplier_code}</span>
                </div>
            </TableCell>
            <TableCell className="text-[11px] font-medium">
                {item.expected_arrival_date && item.expected_arrival_date !== "N/A" && item.expected_arrival_date !== "undefined" ? formatDisplayDate(item.expected_arrival_date, "N/A") : 'N/A'}
            </TableCell>
            <TableCell className="text-[11px] font-bold text-green-600">
                {item.actual_arrival_date && item.actual_arrival_date !== "N/A" && item.actual_arrival_date !== "undefined" ? formatDisplayDate(item.actual_arrival_date, "Pending") : 'Pending'}
            </TableCell>
            <TableCell className="text-center">
                <div className="flex flex-col items-center">
                    <span className="text-[11px] font-black">{item.items_count}</span>
                    <span className="text-[9px] text-muted-foreground uppercase font-bold">Items</span>
                </div>
            </TableCell>
            <TableCell className="text-center">
                <div className="flex flex-col items-center">
                    <span className="text-[11px] font-black">{item.total_quantity}</span>
                    <span className="text-[9px] text-muted-foreground uppercase font-bold">Qty</span>
                </div>
            </TableCell>
            <TableCell className="max-w-[120px]">
                <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-1.5 text-[10px]">
                        <Box className="h-3 w-3 text-muted-foreground" />
                        <span className="font-mono font-bold truncate">{item.vehicle_number}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px]">
                        <User className="h-3 w-3 text-muted-foreground" />
                        <span className="truncate">{item.driver_name}</span>
                    </div>
                </div>
            </TableCell>
            <TableCell>
                <Badge variant="outline" className="text-[9px] font-black bg-muted/50">
                    DOCK {item.dock_number}
                </Badge>
            </TableCell>
            <TableCell>
                <Badge className={`text-[9px] font-black uppercase border-none px-2 py-0.5 ${getStatusColor(item.status)}`}>
                    {item.status}
                </Badge>
            </TableCell>
            <TableCell className="text-right">
                <div className="flex justify-end gap-2">
                    {canMarkArrived && (
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={isArriving}
                            className="h-8 border-border text-foreground hover:bg-muted hover:text-foreground transition-all gap-1 font-bold text-[10px] uppercase disabled:opacity-50"
                            onClick={() => onMarkArrived(item)}
                        >
                            {isArriving ? <div className="h-3 w-3 animate-spin rounded-full border-b-2 border-foreground/70"></div> : <ClipboardCheck className="h-3 w-3" />}
                            {isArriving ? 'Arriving...' : 'Arrived'}
                        </Button>
                    )}
                    <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-muted/30 hover:text-primary transition-all" onClick={() => onView(item.id)}>
                        <Eye className="h-4 w-4" />
                    </Button>
                </div>
            </TableCell>
        </TableRow>
    );
};



const InboundSection = ({
    title,
    count,
    items,
    color,
    onLoadMore,
    hasMore,
    displayMessage,
    onView,
    viewMode,
    onMarkArrived,
    arrivingAsns
}: {

    title: string,
    count: number,
    items: InboundItem[],
    color: 'red' | 'blue' | 'green',
    onLoadMore: () => void,
    hasMore: boolean,
    displayMessage?: string,
    onView: (id: string) => void,
    viewMode: 'table' | 'grid',
    onMarkArrived: (item: InboundItem) => void,
    arrivingAsns?: Set<string>
}) => {
    const theme = {
        red: { accent: 'text-destructive', border: 'border-destructive/20', badge: 'destructive' },
        blue: { accent: 'text-primary', border: 'border-primary/20', badge: 'default' },
        green: { accent: 'text-green-600', border: 'border-green-600/20', badge: 'outline' }
    }[color];

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between border-b pb-2">
                <div className="flex items-center gap-3">
                    <h2 className={`text-xl font-bold ${theme.accent}`}>{title}</h2>
                    <Badge variant={theme.badge as any} className="font-mono">{count}</Badge>
                </div>
                {displayMessage && <p className="text-xs text-muted-foreground italic">{displayMessage}</p>}
            </div>

            {viewMode === 'table' ? (
                <Card className={`border-l-4 ${theme.border}`}>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader className="bg-muted/50">
                                <TableRow>
                                    <TableHead className="text-[10px] uppercase font-black tracking-wider">ASN No</TableHead>
                                    <TableHead className="text-[10px] uppercase font-black tracking-wider">Supplier</TableHead>
                                    <TableHead className="text-[10px] uppercase font-black tracking-wider">Expected</TableHead>
                                    <TableHead className="text-[10px] uppercase font-black tracking-wider">Arrival</TableHead>
                                    <TableHead className="text-[10px] uppercase font-black tracking-wider text-center">Items</TableHead>
                                    <TableHead className="text-[10px] uppercase font-black tracking-wider text-center">Qty</TableHead>
                                    <TableHead className="text-[10px] uppercase font-black tracking-wider">Vehicle/Driver</TableHead>
                                    <TableHead className="text-[10px] uppercase font-black tracking-wider">Dock</TableHead>
                                    <TableHead className="text-[10px] uppercase font-black tracking-wider">Status</TableHead>
                                    <TableHead className="w-[100px] text-right pr-4 text-[10px] uppercase font-black tracking-wider">Action</TableHead>
                                </TableRow>
                            </TableHeader>


                            <TableBody>
                                {items.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center py-12">

                                            <div className="flex flex-col items-center justify-center text-muted-foreground gap-2">
                                                <Box className="h-8 w-8 opacity-20" />
                                                <p>{displayMessage || "No shipments found in this category."}</p>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    items.map((item, index) => (
                                        <ShipmentRow
                                            key={`${item.id || item.shipment_id || item.asn_number || "shipment"}-${index}`}
                                            item={item}
                                            onView={onView}
                                            onMarkArrived={onMarkArrived}
                                            isArriving={arrivingAsns?.has(item.id)}
                                        />
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid grid-cols-1 gap-6">
                    {items.length === 0 ? (
                        <div className="col-span-full border border-dashed rounded-xl py-20 flex flex-col items-center justify-center text-muted-foreground gap-2">
                            <Box className="h-10 w-10 opacity-20" />
                            <p className="text-sm font-medium">{displayMessage || "No shipments found in this category."}</p>
                        </div>
                    ) : (
                        items.map((item, index) => (
                            <InboundCard
                                key={`${item.id || item.shipment_id || item.asn_number || "inbound"}-${index}`}
                                item={item}
                                onView={onView}
                                onMarkArrived={onMarkArrived}
                                isArriving={arrivingAsns?.has(item.id)}
                            />
                        ))
                    )}
                </div>
            )}

            {hasMore && (
                <div className="flex justify-center pt-2">
                    <Button variant="outline" size="sm" onClick={onLoadMore} className="gap-2">
                        Load More
                    </Button>
                </div>
            )}
        </div>
    );
};






export const POManagementView = () => {
    // State
    const { user } = useAuth();
    const [overview, setOverview] = useState<InboundOverview | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [viewMode, setViewMode] = useState<'table' | 'grid'>('grid');


    // Filter State
    const [filters, setFilters] = useState<FilterMetadata>({
        warehouse_id: '',
        supplier_id: '',
        search_term: ''
    });

    // Independent Pagination State
    const [pagination, setPagination] = useState({
        overdue: { skip: 0, limit: 10 },
        today: { skip: 0, limit: 10 },
        arrived: { skip: 0, limit: 10 }
    });

    const [viewDetailsOpen, setViewDetailsOpen] = useState(false);
    const [selectedDetail, setSelectedDetail] = useState<InboundDetail | null>(null);
    const [rawInboundData, setRawInboundData] = useState<any>(null); // raw API response — preserves inboundId & asnShipmentItemId
    const [selectedAsnNumber, setSelectedAsnNumber] = useState<string | null>(null); // ASN number for fallback ID resolution
    const [activeCategory, setActiveCategory] = useState<string>("all");
    const [arrivedModalItem, setArrivedModalItem] = useState<InboundItem | null>(null);

    // Extract fetch logic so it can be called again
    const fetchOverviewData = async () => {
        setIsLoading(true);
        try {
            const ensureArray = (val: any) => {
                if (Array.isArray(val)) return val;
                if (val && typeof val === 'object') {
                    if (Array.isArray(val.items)) return val.items;
                    if (Array.isArray(val.data)) return val.data;
                    if (val.detail || !Object.keys(val).length) return [];
                }
                return [];
            };

            // Fetch each section independently — one failure won't kill the others
            const safeFetch = async (fn: () => Promise<any>): Promise<any[]> => {
                try { return ensureArray(await fn()); }
                catch (e) { console.warn('Section fetch failed:', e); return []; }
            };

            let overdueData: any[] = [];
            let todayData: any[] = [];
            let arrivedData: any[] = [];

            if (activeCategory === 'all' || activeCategory === 'overdue') {
                overdueData = (await safeFetch(() => inboundService.getOverdue(pagination.overdue.skip, pagination.overdue.limit))).map(normalizeInboundItem);
            }

            if (activeCategory === 'all' || activeCategory === 'today') {
                todayData = (await safeFetch(() => inboundService.getExpectedToday(pagination.today.skip, pagination.today.limit))).map(normalizeInboundItem);
            }

            if (activeCategory === 'all' || activeCategory === 'arrived') {
                arrivedData = (await safeFetch(() => inboundService.getArrivedToday(pagination.arrived.skip, pagination.arrived.limit))).map(normalizeInboundItem);
            }

            console.log("API Responses:", { overdueData, todayData, arrivedData });

            // --- Fail-safe Fallback: if all sections empty, try ASN service ---
            if (activeCategory === 'all' && overdueData.length === 0 && todayData.length === 0 && arrivedData.length === 0) {
                console.log("All specialized endpoints empty, falling back to ASN service...");
                try {
                    const { asnService } = await import("@/services/asnService");
                    const allAsns = await asnService.getAll();
                    const normalizedAsns = ensureArray(allAsns).map(normalizeInboundItem);
                    const todayStr = new Date().toISOString().split('T')[0];

                    overdueData = normalizedAsns.filter((a: any) => a.is_overdue);
                    todayData = normalizedAsns.filter((a: any) => String(a.expected_arrival_date || '').startsWith(todayStr) && !a.actual_arrival_date);
                    arrivedData = normalizedAsns.filter((a: any) =>
                        String(a.actual_arrival_date || '').startsWith(todayStr) ||
                        String(a.status).toLowerCase().includes('arrived') ||
                        String(a.status).toLowerCase().includes('received')
                    );
                } catch (fbErr) {
                    console.error("Fallback to asnService failed:", fbErr);
                }
            }

            setOverview({
                overdue: { data: overdueData, count: overdueData.length },
                today: { data: todayData, count: todayData.length },
                arrived_today: { data: arrivedData, count: arrivedData.length },
                pagination: {
                    total_overdue: overdueData.length,
                    total_today: todayData.length,
                    total_arrived_today: arrivedData.length,
                    has_more_overdue: false,
                    has_more_today: false,
                    has_more_arrived_today: false
                },
                filters_applied: filters
            });

        } catch (error) {
            console.error("Error fetching inbound overview:", error);
            toast.error("Failed to load inbound shipments data");
        } finally {
            setIsLoading(false);
        }
    };


    useEffect(() => {
        fetchOverviewData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pagination, activeCategory]);



    const handleLoadMore = async (section: 'overdue' | 'today' | 'arrived') => {
        const currentPaging = pagination[section];
        const nextPaging = { skip: currentPaging.skip + 10, limit: 10 };

        try {
            let newData: any[] = [];
            if (section === 'overdue') {
                newData = await inboundService.getOverdue(nextPaging.skip, nextPaging.limit);
            } else if (section === 'today') {
                newData = await inboundService.getExpectedToday(nextPaging.skip, nextPaging.limit);
            } else if (section === 'arrived') {
                newData = await inboundService.getArrivedToday(nextPaging.skip, nextPaging.limit);
            }

            // Incrementally update overview
            setOverview(prev => {
                if (!prev) return prev;
                const sectionMap: Record<string, keyof InboundOverview> = {
                    'overdue': 'overdue',
                    'today': 'today',
                    'arrived': 'arrived_today'
                };
                const key = sectionMap[section];
                return {
                    ...prev,
                    [key]: {
                        ...prev[key],
                        data: [...prev[key].data, ...newData]
                    }
                };
            });
            setPagination(prev => ({
                ...prev,
                [section]: nextPaging
            }));

        } catch (error) {
            console.error(error);
            toast.error(`Failed to load more ${section} shipments`);
        }
    };


    const handleViewInbound = async (id: string) => {
        console.log("🚀 handleViewInbound called with ID:", id);

        const allItems = [...sortedOverdue, ...sortedToday, ...sortedArrived];
        const localItem = allItems.find(i => i.id === id);

        // Always store the raw API object — this preserves inboundId and asnShipmentItemId
        const rawData = localItem?.raw || null;
        setRawInboundData(rawData);

        // Store ASN number for modal fallback ID resolution
        const asnNumber = localItem?.asn_number || rawData?.asnNumber || rawData?.asn_number || null;
        setSelectedAsnNumber(asnNumber);

        // Open modal immediately with whatever local data we have (fast UX)
        if (rawData) {
            setSelectedDetail(normalizeInboundDetail(rawData));
        }
        setViewDetailsOpen(true);

        // Fetch from /inbound/today/arrived and match selected ASN by inboundId.
        // Items are already included under shipments[].items[].
        try {
            const arrivedResponse = await inboundService.getArrivedToday(0, 500);
            const arrivedRows: any[] = Array.isArray(arrivedResponse)
                ? arrivedResponse
                : (Array.isArray(arrivedResponse?.items)
                    ? arrivedResponse.items
                    : (Array.isArray(arrivedResponse?.data) ? arrivedResponse.data : []));

            const targetInboundId = String(rawData?.inboundId || rawData?.id || id);
            const selectedASN = arrivedRows.find((row: any) =>
                String(row?.inboundId || row?.id || '') === targetInboundId
            ) || (asnNumber
                ? arrivedRows.find((row: any) => String(row?.asnNumber || row?.asn_number || '') === String(asnNumber))
                : null);

            if (selectedASN) {
                const asnItems = Array.isArray(selectedASN.shipments)
                    ? selectedASN.shipments.flatMap((s: any) => Array.isArray(s?.items) ? s.items : [])
                    : [];

                const selectedWithItems = {
                    ...selectedASN,
                    items: asnItems,
                };

                setRawInboundData(selectedWithItems);
                setSelectedDetail(normalizeInboundDetail(selectedWithItems));
            }
        } catch (error) {
            console.error("Failed to fetch /inbound/today/arrived for View Details:", error);
        }
    };


    const handleMarkArrived = (item: InboundItem) => {
        setArrivedModalItem(item);
    };

    const handleArrivedSuccess = async () => {
        await fetchOverviewData();
        setArrivedModalItem(null);
        setActiveCategory('arrived');
        setPagination(prev => ({
            ...prev,
            arrived: { skip: 0, limit: prev.arrived.limit }
        }));
    };

    console.log("Rendering POManagementView, selectedDetail:", selectedDetail);

    // Sorting and Data Preparation
    const sortedOverdue = [...(overview?.overdue?.data || [])].sort((a, b) => (b.days_overdue || 0) - (a.days_overdue || 0));
    const sortedToday = [...(overview?.today?.data || [])].sort((a, b) => {
        const dateA = a.expected_arrival_date && a.expected_arrival_date !== "N/A" && a.expected_arrival_date !== "undefined" ? new Date(a.expected_arrival_date).getTime() : 0;
        const dateB = b.expected_arrival_date && b.expected_arrival_date !== "N/A" && b.expected_arrival_date !== "undefined" ? new Date(b.expected_arrival_date).getTime() : 0;
        return dateA - dateB;
    });
    const sortedArrived = [...(overview?.arrived_today?.data || [])].sort((a, b) => {
        const dateA = a.actual_arrival_date && a.actual_arrival_date !== "N/A" && a.actual_arrival_date !== "undefined" ? new Date(a.actual_arrival_date).getTime() : 0;
        const dateB = b.actual_arrival_date && b.actual_arrival_date !== "N/A" && b.actual_arrival_date !== "undefined" ? new Date(b.actual_arrival_date).getTime() : 0;
        return dateB - dateA;
    });

    return (
        <div className="p-4 md:p-8 space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="font-heading text-3xl font-bold">Inbound Management</h1>
                    <p className="text-muted-foreground">Manage incoming shipments and containers</p>
                </div>

                {/* Simplified Filter Bar */}
                <div className="flex flex-wrap items-center gap-4">
                    <div className="flex items-center border rounded-md p-1 bg-muted/20">
                        <Button
                            variant={viewMode === 'table' ? 'secondary' : 'ghost'}
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={() => setViewMode('table')}
                        >
                            <List className="h-4 w-4" />
                        </Button>
                        <Button
                            variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={() => setViewMode('grid')}
                        >
                            <LayoutGrid className="h-4 w-4" />
                        </Button>
                    </div>

                    <Select value={activeCategory} onValueChange={setActiveCategory}>
                        <SelectTrigger className="w-[200px] h-9">
                            <SelectValue placeholder="Select Category" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Inbounds</SelectItem>
                            <SelectItem value="overdue">Overdue</SelectItem>
                            <SelectItem value="today">Today</SelectItem>
                            <SelectItem value="arrived">Arrived Today</SelectItem>
                        </SelectContent>
                    </Select>

                    <div className="relative">

                        <input
                            type="text"
                            placeholder="Search ASN..."
                            className="h-9 w-48 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                            value={filters.search_term}
                            onChange={(e) => setFilters(f => ({ ...f, search_term: e.target.value }))}
                        />
                    </div>
                </div>
            </div>


            {isLoading && !overview ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
                    <p className="text-muted-foreground animate-pulse">Loading inbound overview...</p>
                </div>
            ) : overview ? (
                <div className="space-y-12">
                    {(activeCategory === 'all' || activeCategory === 'overdue') && (
                        <InboundSection
                            title="Overdue Shipments"
                            count={overview.pagination.total_overdue}
                            items={sortedOverdue}
                            color="red"
                            hasMore={overview.pagination.has_more_overdue}
                            onLoadMore={() => handleLoadMore('overdue')}
                            displayMessage={overview.overdue.display_message}
                            onView={handleViewInbound}
                            viewMode={viewMode}
                            onMarkArrived={handleMarkArrived}
                        />
                    )}

                    {(activeCategory === 'all' || activeCategory === 'today') && (
                        <InboundSection
                            title="Today's Expected Shipments"
                            count={overview.pagination.total_today}
                            items={sortedToday}
                            color="blue"
                            hasMore={overview.pagination.has_more_today}
                            onLoadMore={() => handleLoadMore('today')}
                            displayMessage={overview.today.display_message}
                            onView={handleViewInbound}
                            viewMode={viewMode}
                            onMarkArrived={handleMarkArrived}
                        />
                    )}

                    {(activeCategory === 'all' || activeCategory === 'arrived') && (
                        <InboundSection
                            title="Arrived Today"
                            count={overview.pagination.total_arrived_today}
                            items={sortedArrived}
                            color="green"
                            hasMore={overview.pagination.has_more_arrived_today}
                            onLoadMore={() => handleLoadMore('arrived')}
                            displayMessage={overview.arrived_today.display_message}
                            onView={handleViewInbound}
                            viewMode={viewMode}
                            onMarkArrived={handleMarkArrived}
                        />
                    )}
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center py-20 gap-3 border border-dashed rounded-xl bg-muted/5">
                    <Box className="h-10 w-10 text-muted-foreground opacity-20" />
                    <p className="text-muted-foreground">Unable to load inbound data. Please check your connection or server.</p>
                    <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
                        Retry
                    </Button>
                </div>
            )}



            {/* Consolidated Details Dialog */}
            <ArrivedModal
                open={!!arrivedModalItem}
                setOpen={(open) => !open && setArrivedModalItem(null)}
                inbound={arrivedModalItem}
                onSuccess={handleArrivedSuccess}
            />

            <InboundProcessModal
                open={viewDetailsOpen}
                setOpen={(open) => { setViewDetailsOpen(open); if (!open) { setRawInboundData(null); setSelectedAsnNumber(null); } }}
                shipmentId={selectedDetail?.id || null}
                asnNumber={selectedAsnNumber}
                initialData={selectedDetail}
                rawData={rawInboundData}
                onSuccess={handleArrivedSuccess}
                allowGrnCreation={user?.role !== "admin"}
            />

        </div>
    );
};