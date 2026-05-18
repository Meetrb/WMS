/**
 * InboundProcessModal
 *
 * Shows complete inbound shipment details and a GRN creation form.
 * Backend response uses camelCase; items live in shipments[].items[].
 */
import React, { useEffect, useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
    FileText, Truck, Building2,
    Loader2, ClipboardCheck, CheckCircle2, AlertCircle
} from "lucide-react";
import { toast } from "sonner";
import { inboundService } from "@/services/inboundService";
import { palletService, type PalletData } from "@/services/palletService";
import { useAuth } from "@/components/auth-provider";
import { formatDisplayDate } from "@/lib/date";

// ─── Props ────────────────────────────────────────────────────────────────────

interface InboundProcessModalProps {
    open: boolean;
    setOpen: (open: boolean) => void;
    shipmentId: string | null;
    asnNumber?: string | null;  // explicit ASN number for fallback ID resolution
    initialData?: any;   // normalised InboundDetail (for display UI)
    rawData?: any;       // raw API response — SINGLE SOURCE OF TRUTH for inboundId and asnShipmentItemId
    onSuccess?: () => void;
    allowGrnCreation?: boolean;
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
    shortage_note?: string;
}

const extractPallets = (payload: any): PalletData[] => {
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.items)) return payload.items;
    if (Array.isArray(payload?.data)) return payload.data;
    if (Array.isArray(payload?.results)) return payload.results;
    if (Array.isArray(payload?.pallets)) return payload.pallets;
    return [];
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const isUUID = (v: string) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

const fmt = (d?: string | null) => {
    if (!d || d === 'N/A' || d === 'undefined') return '—';
    return formatDisplayDate(d, '—');
};

const firstText = (...values: Array<string | null | undefined>) => {
    for (const value of values) {
        const text = String(value ?? '').trim();
        if (text && text !== 'N/A' && text !== 'undefined' && text !== '—') return text;
    }
    return '—';
};

const getStatusColor = (status?: string) => {
    const s = (status || '').toLowerCase();
    if (s.includes('arrived') || s.includes('received') || s.includes('grn')) return 'bg-green-500 text-white';
    if (s.includes('pending') || s.includes('draft')) return 'bg-blue-500 text-white';
    if (s.includes('transit')) return 'bg-amber-500 text-white';
    if (s.includes('overdue')) return 'bg-destructive text-white';
    return 'bg-secondary text-secondary-foreground';
};

const normalizeLookupValue = (value: unknown) => String(value ?? '').trim().toLowerCase();

const normalizeStatus = (value: unknown) => String(value ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_');

const isCompletedStatus = (value: unknown) => {
    const status = normalizeStatus(value);
    return ['completed', 'complete', 'done', 'closed', 'finalized', 'generated', 'posted', 'grn_completed'].includes(status);
};

const palletMatchesWarehouse = (pallet: PalletData, warehouseId?: string, warehouseCode?: string) => {
    if (!warehouseId && !warehouseCode) return true;

    const palletValues = [
        pallet.warehouse_id,
        pallet.warehouse_code,
        pallet.warehouse?.id,
        pallet.warehouse?.code,
        (pallet as any)?.warehouseId,
        (pallet as any)?.warehouseCode,
    ].map(normalizeLookupValue).filter(Boolean);

    const expectedValues = [warehouseId, warehouseCode].map(normalizeLookupValue).filter(Boolean);
    return expectedValues.some((value) => palletValues.includes(value));
};

const palletMatchesSupplier = (
    pallet: PalletData,
    supplierId?: string,
    supplierCode?: string,
    supplierName?: string
) => {
    if (!supplierId && !supplierCode && !supplierName) return true;

    const palletValues = [
        (pallet as any)?.supplier_id,
        (pallet as any)?.supplierId,
        (pallet as any)?.supplier_code,
        (pallet as any)?.supplierCode,
        (pallet as any)?.supplier_name,
        (pallet as any)?.supplierName,
        (pallet as any)?.supplier?.id,
        (pallet as any)?.supplier?.code,
        (pallet as any)?.supplier?.name,
        (pallet as any)?.vendor_id,
        (pallet as any)?.vendorId,
        (pallet as any)?.vendor_code,
        (pallet as any)?.vendorCode,
        (pallet as any)?.vendor_name,
        (pallet as any)?.vendorName,
        (pallet as any)?.vendor?.id,
        (pallet as any)?.vendor?.code,
        (pallet as any)?.vendor?.name,
    ].map(normalizeLookupValue).filter(Boolean);

    // If pallet payload carries no supplier information, exclude it when supplier context exists.
    if (palletValues.length === 0) return false;

    const expectedValues = [supplierId, supplierCode, supplierName].map(normalizeLookupValue).filter(Boolean);
    return expectedValues.some((value) => palletValues.includes(value));
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
    allowGrnCreation = true,
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
    const [availablePallets, setAvailablePallets] = useState<PalletData[]>([]);
    const [isLoadingPallets, setIsLoadingPallets] = useState(false);
    const [palletNumber, setPalletNumber] = useState("");
    const [commonPalletId, setCommonPalletId] = useState("");

    const handleNumberKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        // 1. Allow control keys (backspace, delete, tab, arrows, etc.)
        const isControlKey = [
            'Backspace', 'Delete', 'Tab', 'Enter', 'Escape',
            'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
            'Home', 'End'
        ].includes(e.key);

        // 2. Allow CMD/CTRL shortcuts (A, C, V, X)
        const isShortcut = (e.ctrlKey || e.metaKey) && ['a', 'c', 'v', 'x'].includes(e.key.toLowerCase());

        if (isControlKey || isShortcut) return;

        // 3. ONLY allow numeric digits 0-9
        // This explicitly blocks +, -, ., e, etc.
        if (!/^[0-9]$/.test(e.key)) {
            e.preventDefault();
        }
    };

    const handleNumberPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
        const pasteData = e.clipboardData.getData('text');
        // Let it paste, but our onChange will strip non-numeric characters instantly
        // This provides the "Silent Sanitization" UX requested
        if (!/^\d+$/.test(pasteData)) {
            // No toast/alert as per requirements - silently sanitize via onChange
        }
    };

    // ── Open / close lifecycle ─────────────────────────────────────────────
    useEffect(() => {
        if (!open) {
            setRaw(null);
            setShowGrnForm(false);
            setGrnRows({});
            setGrnCreated(false);
            setResolvedInboundId(null);
            setAvailablePallets([]);
            setPalletNumber("");
            setCommonPalletId("");
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
    const d = raw || initialData || rawData;

    const shipmentSource = Array.isArray(d?.shipments) ? d.shipments[0] : null;

    const displayId = firstText(d?.inboundId, d?.id, shipmentId);
    const displayAsn = firstText(d?.asnNumber, d?.asn_number, shipmentSource?.asnNumber, shipmentSource?.asn_number);
    const displayStatus = firstText(d?.status, d?.grnStatus, d?.grn_status);
    const displayAsnDate = d?.asnDate || d?.asn_date || null;
    const displayExpected = d?.expectedDate || d?.expected_arrival_date || d?.expected_date || null;
    const displayArrival = d?.actualArrivalDate || d?.actual_arrival_date || null;

    // Supplier
    const displaySupplierName = firstText(
        d?.supplierName,
        d?.supplier_name,
        d?.supplier?.name,
        d?.supplier?.full_name,
        shipmentSource?.supplierName,
        shipmentSource?.supplier_name,
        d?.supplier?.code ? undefined : undefined
    );
    const displaySupplierCode = firstText(
        d?.supplierCode,
        d?.supplier_code,
        d?.supplier?.code,
        shipmentSource?.supplierCode,
        shipmentSource?.supplier_code
    );
    const displayGstin = d?.supplierGstin || d?.supplier_gstin || null;
    const currentSupplierId = String(d?.supplier?.id || d?.supplier_id || '').trim() || undefined;
    const currentSupplierCode = String(d?.supplierCode || d?.supplier_code || d?.supplier?.code || '').trim() || undefined;
    const currentSupplierName = String(d?.supplierName || d?.supplier_name || d?.supplier?.name || '').trim() || undefined;

    // Logistics
    const displayVehicle = firstText(d?.vehicleNumber, d?.vehicle_number, shipmentSource?.vehicleNumber, shipmentSource?.vehicle_number);
    const displayDriver = firstText(d?.driverName, d?.driver_name, shipmentSource?.driverName, shipmentSource?.driver_name);
    const displayPhone = firstText(d?.driverPhone, d?.driver_phone, shipmentSource?.driverPhone, shipmentSource?.driver_phone);

    // Warehouse
    const displayWarehouse = firstText(
        d?.warehouseName,
        d?.warehouse_name,
        d?.warehouse?.name,
        d?.warehouse?.code,
        d?.warehouse_code,
        d?.warehouseCode
    );
    const currentWarehouseId = String(
        d?.warehouse?.id ||
        d?.warehouse_id ||
        d?.warehouseId ||
        (typeof d?.warehouse === 'string' && isUUID(d.warehouse) ? d.warehouse : '') ||
        ''
    ).trim() || undefined;
    const currentWarehouseCode = String(
        d?.warehouseCode ||
        d?.warehouse_code ||
        d?.warehouse?.code ||
        (typeof d?.warehouse === 'string' && !isUUID(d.warehouse) ? d.warehouse : '') ||
        ''
    ).trim() || undefined;
    const displayDock = firstText(
        d?.receivingDock,
        d?.receiving_dock,
        d?.dock_number,
        d?.dockNumber,
        d?.dock_name,
        d?.dockName,
        shipmentSource?.receivingDock,
        shipmentSource?.receiving_dock,
        shipmentSource?.dock_number,
        shipmentSource?.dockNumber,
        shipmentSource?.dock_name,
        shipmentSource?.dockName
    );
    const isGrnManager = normalizeLookupValue(user?.role) === 'grn manager';

    // GRN
    const displayGrnNumber = firstText(d?.grnNumber, d?.grn_number, d?.grn?.number, d?.grn?.grn_number);
    const displayGrnStatus = firstText(d?.grnStatus, d?.grn_status, d?.grn?.status);
    const grnIsCompleted = isCompletedStatus(displayGrnStatus);
    const grnIsGenerated = !!(d?.grn?.is_generated) || grnCreated;
    const grnCreationLocked = grnIsGenerated || grnIsCompleted;
    const canCreateGrn = allowGrnCreation && !grnCreationLocked;

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

    const fetchAvailablePallets = async () => {
        setIsLoadingPallets(true);
        try {
            // GRN managers must always be warehouse-scoped; never show global pallet pool.
            if (isGrnManager && !currentWarehouseId && !currentWarehouseCode) {
                setAvailablePallets([]);
                toast.error('Warehouse context missing for this shipment. Cannot load pallets.');
                return;
            }

            const response = await palletService.getAll(0, 500, {
                warehouse_id: currentWarehouseId,
                warehouse_code: currentWarehouseCode,
                supplier_id: currentSupplierId,
                supplier_code: currentSupplierCode,
            });
            const pallets = extractPallets(response).filter((pallet) => {
                const matchesWarehouse = palletMatchesWarehouse(pallet, currentWarehouseId, currentWarehouseCode);
                const matchesSupplier = palletMatchesSupplier(pallet, currentSupplierId, currentSupplierCode, currentSupplierName);
                if (isGrnManager) {
                    return matchesWarehouse && matchesSupplier;
                }
                return matchesWarehouse && matchesSupplier;
            });
            setAvailablePallets(pallets);
        } catch (error) {
            console.error('Failed to fetch pallets for GRN:', error);
            setAvailablePallets([]);
            toast.error('Failed to load pallet suggestions');
        } finally {
            setIsLoadingPallets(false);
        }
    };

    const openGrnForm = () => {
        if (grnCreationLocked) {
            toast.error('GRN is already completed for this inbound shipment.');
            return;
        }

        const rows: Record<string, GrnRow> = {};
        items.forEach(item => {
            rows[item.asnShipmentItemId] = {
                asnShipmentItemId: item.asnShipmentItemId,
                received_quantity: item.receivedQuantity || item.expectedQuantity,
                accepted_quantity: item.acceptedQuantity || item.receivedQuantity || item.expectedQuantity,
                rejected_quantity: item.rejectedQuantity || 0,
                shortage_note: '',
            };
        });
        setGrnRows(rows);
        setPalletNumber('');
        setCommonPalletId('');
        setShowGrnForm(true);
        void fetchAvailablePallets();
    };

    const updateGrnRow = (id: string, field: string, value: number | string) => {
        setGrnRows(prev => {
            const row = { ...prev[id] };
            const item = items.find(i => i.asnShipmentItemId === id);
            const expected = Number(item?.expectedQuantity || 0);

            if (field === 'received_quantity') {
                const newReceived = Math.trunc(Number(value) || 0);
                if (newReceived > expected) {
                    toast.error(`Received quantity cannot exceed Expected (${expected}).`);
                    return prev;
                }
            }

            if (field === 'accepted_quantity') {
                const newAccepted = Math.trunc(Number(value) || 0);
                if (newAccepted > row.received_quantity) {
                    toast.error(`Accepted quantity cannot exceed Received (${row.received_quantity}).`);
                    return prev;
                }
            }

            (row as any)[field] = value;

            if (field === 'received_quantity') {
                // When received is changed, reset accepted and rejected to 0
                row.accepted_quantity = 0;
                row.rejected_quantity = 0;
            }

            if (field === 'accepted_quantity') {
                // When accepted is changed, rejected = received - accepted
                const newAccepted = Math.trunc(Number(value) || 0);
                row.rejected_quantity = Math.max(0, row.received_quantity - newAccepted);
            }

            if (field === 'rejected_quantity') {
                // When rejected is changed, accepted = received - rejected
                const newRejected = Math.trunc(Number(value) || 0);
                row.accepted_quantity = Math.max(0, row.received_quantity - newRejected);
            }

            return { ...prev, [id]: row };
        });
    };

    const validateGrn = (): boolean => {
        for (const row of Object.values(grnRows)) {
            const item = items.find((i) => i.asnShipmentItemId === row.asnShipmentItemId);
            const expectedQty = Number(item?.expectedQuantity || 0);

            if (row.received_quantity > expectedQty) {
                toast.error('Received quantity cannot exceed Expected quantity');
                return false;
            }

            if (row.accepted_quantity > row.received_quantity) {
                toast.error('Accepted quantity cannot exceed Received quantity');
                return false;
            }

            if (row.accepted_quantity + row.rejected_quantity > row.received_quantity) {
                toast.error('Accepted + Rejected quantities cannot exceed Received quantity');
                return false;
            }

            // For GRN manager: if received quantity is lower than expected quantity, shortage note is mandatory.
            if (isGrnManager && row.received_quantity < expectedQty && !String(row.shortage_note || '').trim()) {
                toast.error(`Shortage note is required for SKU ${item?.sku || row.asnShipmentItemId} when received is lower than expected.`);
                return false;
            }

        }

        const hasAnyQuantity = Object.values(grnRows).some(
            (row) => row.accepted_quantity > 0 || row.rejected_quantity > 0,
        );

        if (hasAnyQuantity && !selectedPallet) {
            toast.error('Please select one common pallet for all GRN items');
            return false;
        }

        return true;
    };

    const handleGrnSubmit = async () => {
        if (grnCreationLocked) {
            toast.error('GRN is already completed for this inbound shipment.');
            return;
        }

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
            const payloadItems = Object.values(grnRows).map((r) => {
                return {
                    asn_shipment_item_id: r.asnShipmentItemId,
                    received_quantity: r.received_quantity,
                    accepted_quantity: r.accepted_quantity,
                    rejected_quantity: r.rejected_quantity,
                    shortage_note: String(r.shortage_note || '').trim() || null,
                    pallet_barcode: selectedPallet?.pallet_code || selectedPallet?.barcode || null,
                    reject_pallet_barcode: selectedPallet?.pallet_code || selectedPallet?.barcode || null,
                };
            });

            const payload = isGrnManager ? {
                // GRN manager payload format requested by user
                inbound_shipment_id: inboundId,
                items: payloadItems,
            } : {
                inbound_shipment_id: inboundId,
                items: payloadItems,
                created_by: user?.id || user?.email || 'admin',
            };
            const rejectedQtyTotal = payloadItems.reduce((sum, item) => sum + Number(item.rejected_quantity || 0), 0);
            console.log('📦 GRN Payload:', JSON.stringify(payload, null, 2));
            await inboundService.createGrn(payload);
            toast.success('GRN completed. Putaway tasks generated successfully.');
            if (rejectedQtyTotal > 0) {
                toast.info('Rejected quantities are logged. Inspection will be created after rejected putaway completion.');
            }
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

    const palletSuggestions = (() => {
        const query = normalizeLookupValue(palletNumber);
        const matchingPallets = availablePallets.filter((pallet) => {
            if (!query) return true;
            return normalizeLookupValue(pallet.pallet_code).includes(query)
                || normalizeLookupValue(pallet.barcode).includes(query);
        });
        return matchingPallets.slice(0, 8);
    })();

    const selectedPallet = availablePallets.find((pallet) => String(pallet.id || '') === commonPalletId)
        || availablePallets.find((pallet) => normalizeLookupValue(pallet.pallet_code) === normalizeLookupValue(palletNumber));

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
                                        <InfoRow label="ASN Number" value={displayAsn} />
                                        <InfoRow label="Status" value={displayStatus} />
                                        <InfoRow label="Arrival Date" value={fmt(displayArrival)} />
                                        <InfoRow label="ASN Date" value={fmt(displayAsnDate)} />
                                        <InfoRow label="Expected Date" value={fmt(displayExpected)} />
                                    </div>
                                </Section>

                                {/* ── 2. Supplier ──────────────────────── */}
                                <Section title="Supplier" icon={<Building2 className="h-4 w-4" />}>
                                    <div className="grid grid-cols-2 sm:grid-cols-2 gap-4">
                                        <InfoRow label="Supplier Name" value={displaySupplierName} />
                                        <InfoRow label="Supplier Code" value={displaySupplierCode} />
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

                            </>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            {/* ── GRN Creation Dialog ──────────────────────────────── */}
            {allowGrnCreation && (
                <Dialog open={showGrnForm} onOpenChange={setShowGrnForm}>
                    <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
                        <div className="p-6 pb-4 border-b bg-background shadow-sm shrink-0">
                            <DialogHeader>
                                <DialogTitle className="flex items-center gap-2 text-xl font-heading">
                                    <ClipboardCheck className="h-5 w-5 text-primary" /> Create GRN with Pallet Tracking
                                </DialogTitle>
                                <DialogDescription>
                                    <div className="space-y-2">
                                        <p>Enter received, accepted, and rejected quantities for each item. Use one common pallet selection for all items.</p>
                                        <div className="flex items-center gap-1.5 text-xs text-amber-600 bg-amber-50 dark:bg-amber-950/30 px-3 py-1.5 rounded-full border border-amber-200 dark:border-amber-800 w-fit">
                                            <AlertCircle className="h-3 w-3 flex-shrink-0" />
                                            Accepted + Rejected ≤ Received | One common pallet selection required
                                        </div>
                                    </div>
                                </DialogDescription>
                            </DialogHeader>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 bg-background/50">
                            <div className="mb-6 rounded-lg border bg-background p-4">
                                <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-start">
                                    <div className="space-y-2">
                                        <div>
                                            <p className="text-sm font-semibold">Pallet Number</p>
                                            <p className="text-xs text-muted-foreground">Start typing a pallet code or barcode to see matching available pallets.</p>
                                        </div>
                                        <Input
                                            list="grn-pallet-suggestions"
                                            value={palletNumber}
                                            onChange={(e) => {
                                                const nextValue = e.target.value;
                                                setPalletNumber(nextValue);
                                                const exactMatch = availablePallets.find(
                                                    (pallet) => normalizeLookupValue(pallet.pallet_code) === normalizeLookupValue(nextValue)
                                                        || normalizeLookupValue(pallet.barcode) === normalizeLookupValue(nextValue),
                                                );
                                                setCommonPalletId(exactMatch?.id || '');
                                            }}
                                            placeholder="Search pallet number"
                                            disabled={isSubmittingGrn || isLoadingPallets}
                                        />
                                        <datalist id="grn-pallet-suggestions">
                                            {palletSuggestions.map((pallet) => (
                                                <option key={pallet.id || pallet.pallet_code} value={pallet.pallet_code}>
                                                    {pallet.barcode || pallet.status || ''}
                                                </option>
                                            ))}
                                        </datalist>
                                        {palletNumber.trim() !== '' && palletSuggestions.length > 0 && (
                                            <div className="flex flex-wrap gap-2">
                                                {palletSuggestions.map((pallet) => (
                                                    <button
                                                        key={pallet.id || pallet.pallet_code}
                                                        type="button"
                                                        className="rounded-full border px-3 py-1 text-xs font-medium hover:bg-muted/30"
                                                        onClick={() => {
                                                            setPalletNumber(pallet.pallet_code);
                                                            setCommonPalletId(pallet.id || '');
                                                        }}
                                                        disabled={isSubmittingGrn}
                                                    >
                                                        {pallet.pallet_code}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                        <div className="space-y-1">
                                            <p className="text-xs font-semibold text-muted-foreground">Common pallet for all items</p>
                                            <select
                                                value={commonPalletId}
                                                onChange={(e) => {
                                                    const nextId = e.target.value;
                                                    setCommonPalletId(nextId);
                                                    const pallet = availablePallets.find((entry) => String(entry.id || '') === nextId);
                                                    if (pallet?.pallet_code) setPalletNumber(pallet.pallet_code);
                                                }}
                                                disabled={isSubmittingGrn || isLoadingPallets}
                                                className="h-9 w-full text-xs rounded border border-input bg-background px-2 py-1 focus:outline-none focus:ring-1 focus:ring-ring"
                                            >
                                                <option value="">Select one pallet for all items...</option>
                                                {availablePallets.map((pallet) => (
                                                    <option key={pallet.id || pallet.pallet_code} value={pallet.id || ''}>
                                                        {pallet.pallet_code} {pallet.barcode ? `(${pallet.barcode})` : ''}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                        {selectedPallet && (
                                            <p className="text-xs text-muted-foreground">
                                                Common selected pallet: <span className="font-mono text-foreground">{selectedPallet.pallet_code}</span>
                                                {selectedPallet.barcode ? ` | Barcode: ${selectedPallet.barcode}` : ''}
                                                {selectedPallet.status ? ` | Status: ${selectedPallet.status}` : ''}
                                            </p>
                                        )}
                                    </div>
                                    <div className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
                                        {isLoadingPallets ? 'Loading pallets...' : `${availablePallets.length} pallet${availablePallets.length === 1 ? '' : 's'} available`}
                                    </div>
                                </div>
                            </div>

                            <div className="border rounded-md overflow-hidden bg-background">
                                <div className="overflow-x-auto">
                                    <Table>
                                        <TableHeader className="bg-muted/70">
                                            <TableRow>
                                                <TableHead className="text-xs font-bold uppercase tracking-wider">Item</TableHead>
                                                <TableHead className="text-xs font-bold uppercase tracking-wider text-right min-w-[80px]">Expected</TableHead>
                                                <TableHead className="text-xs font-bold uppercase tracking-wider text-right min-w-[110px]">Received *</TableHead>
                                                <TableHead className="text-xs font-bold uppercase tracking-wider min-w-[180px]">Shortage Note</TableHead>
                                                <TableHead className="text-xs font-bold uppercase tracking-wider text-right min-w-[110px]">Accepted *</TableHead>
                                                <TableHead className="text-xs font-bold uppercase tracking-wider text-right min-w-[110px]">Rejected</TableHead>
                                                <TableHead className="text-xs font-bold uppercase tracking-wider min-w-[140px]">Common Pallet</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {items.map((item) => {
                                                const row = grnRows[item.asnShipmentItemId] || {
                                                    received_quantity: item.expectedQuantity,
                                                    accepted_quantity: item.expectedQuantity,
                                                    rejected_quantity: 0,
                                                    shortage_note: '',
                                                };
                                                const overLimit = (row.accepted_quantity + row.rejected_quantity) > row.received_quantity;
                                                const isShortReceived = row.received_quantity < item.expectedQuantity;

                                                return (
                                                    <TableRow key={item.asnShipmentItemId} className={overLimit ? 'bg-destructive/5' : ''}>
                                                        <TableCell>
                                                            <div className="flex flex-col">
                                                                <span className="font-mono text-primary font-bold text-xs">{item.sku}</span>
                                                                <span className="text-xs text-muted-foreground truncate max-w-[160px]">{item.description}</span>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="text-right font-bold text-muted-foreground text-sm">{item.expectedQuantity}</TableCell>

                                                        {/* Received */}
                                                        <TableCell>
                                                            <Input
                                                                type="text"
                                                                inputMode="numeric"
                                                                className="h-8 text-right font-mono text-sm"
                                                                value={row.received_quantity}
                                                                onChange={e => {
                                                                    const val = e.target.value.replace(/[^0-9]/g, '');
                                                                    updateGrnRow(item.asnShipmentItemId, 'received_quantity', val === '' ? 0 : parseInt(val, 10));
                                                                }}
                                                                onKeyDown={handleNumberKeyDown}
                                                                onPaste={handleNumberPaste}
                                                                disabled={isSubmittingGrn}
                                                            />
                                                        </TableCell>

                                                        {/* Shortage Note */}
                                                        <TableCell>
                                                            <Input
                                                                className={`h-8 text-xs ${isShortReceived && !String(row.shortage_note || '').trim() ? 'border-destructive' : ''}`}
                                                                value={row.shortage_note || ''}
                                                                onChange={e => updateGrnRow(item.asnShipmentItemId, 'shortage_note', e.target.value)}
                                                                placeholder={isShortReceived ? 'Required: reason for shortage' : 'Optional'}
                                                                disabled={isSubmittingGrn}
                                                            />
                                                        </TableCell>

                                                        {/* Accepted Qty */}
                                                        <TableCell>
                                                            <Input
                                                                type="text"
                                                                inputMode="numeric"
                                                                className={`h-8 text-right font-mono text-sm ${overLimit ? 'border-destructive' : ''}`}
                                                                value={row.accepted_quantity}
                                                                onChange={e => {
                                                                    const val = e.target.value.replace(/[^0-9]/g, '');
                                                                    updateGrnRow(item.asnShipmentItemId, 'accepted_quantity', val === '' ? 0 : parseInt(val, 10));
                                                                }}
                                                                onKeyDown={handleNumberKeyDown}
                                                                onPaste={handleNumberPaste}
                                                                disabled={isSubmittingGrn}
                                                            />
                                                        </TableCell>

                                                        {/* Rejected Qty */}
                                                        <TableCell>
                                                            <Input
                                                                type="text"
                                                                inputMode="numeric"
                                                                className={`h-8 text-right font-mono text-sm ${overLimit ? 'border-destructive' : ''}`}
                                                                value={row.rejected_quantity}
                                                                onChange={e => {
                                                                    const val = e.target.value.replace(/[^0-9]/g, '');
                                                                    updateGrnRow(item.asnShipmentItemId, 'rejected_quantity', val === '' ? 0 : parseInt(val, 10));
                                                                }}
                                                                onKeyDown={handleNumberKeyDown}
                                                                onPaste={handleNumberPaste}
                                                                disabled={isSubmittingGrn}
                                                            />
                                                        </TableCell>

                                                        <TableCell>
                                                            {(row.accepted_quantity > 0 || row.rejected_quantity > 0) && selectedPallet ? (
                                                                <Badge variant="outline" className="whitespace-nowrap text-xs">{selectedPallet.pallet_code}</Badge>
                                                            ) : (
                                                                <span className="text-xs text-muted-foreground">Select above</span>
                                                            )}
                                                        </TableCell>
                                                    </TableRow>
                                                );
                                            })}
                                        </TableBody>
                                    </Table>
                                </div>
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
            )}
        </>
    );
};
