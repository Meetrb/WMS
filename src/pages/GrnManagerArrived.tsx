import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { AlertTriangle, BarChart3, Building2, CalendarDays, Check, ChevronsUpDown, ClipboardList, MessageSquare, Plus, RefreshCw, Trash2, Truck } from "lucide-react";
import { cn } from "@/lib/utils";
import { grnManagerService, type GrnManagerPallet } from "@/services/grnManagerService";
import { warehouseService } from "@/services/warehouseService";
import { palletService, PalletStatus } from "@/services/palletService";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
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
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { formatDisplayDateTime } from "@/lib/date";

interface ArrivedItem {
    asnShipmentItemId: string;
    sku: string;
    description: string;
    expectedQuantity: string;
    receivedQuantity: string;
    acceptedQuantity: string;
    rejectedQuantity: string;
    unit: string;
    lot: string;
    expiryDate: string;
    batchNo: string;
    hsnCode: string;
}

interface ArrivedShipment {
    poNumber: string;
    supplierCode: string;
    supplierName: string;
    items: ArrivedItem[];
}

interface ArrivedInbound {
    asnNumber: string;
    asnDate: string;
    expectedDate: string;
    actualArrivalDate: string;
    shipmentId: string;
    status: string;
    inboundId: string;
    warehouseId: string;
    warehouseCode: string;
    warehouseName: string;
    receivingDock: string;
    supplierCode: string;
    supplierName: string;
    supplierGST: string;
    driverName: string;
    driverPhone: string;
    vehicleNumber: string;
    grnNumber: string;
    grnId: string;
    grnStatus: string;
    total_items: number;
    totalExpectedQty: string;
    totalReceivedQty: string;
    totalAcceptedQty: string;
    totalRejectedQty: string;
    shipments: ArrivedShipment[];
}

interface GrnItemRow {
    asn_shipment_item_id: string;
    sku: string;
    description: string;
    expected_quantity: string;
    received_quantity: number;
    accepted_quantity: number;
    rejected_quantity: number;
    shortage_note: string;
    rejection_note: string;
    pallet_barcode: string;
    reject_pallet_barcode: string;
    pallet_splits: Array<{
        pallet_barcode: string;
        quantity: number;
    }>;
}

interface PalletOption {
    id: string;
    barcode: string;
    palletCode: string;
    status: string;
    palletType: string;
    isRejectedType: boolean;
    maxQuantity: number;
}

const asString = (value: unknown, fallback = "-") => {
    if (value === null || value === undefined) return fallback;
    const parsed = String(value).trim();
    return parsed || fallback;
};

const asArray = <T,>(value: unknown): T[] => {
    return Array.isArray(value) ? (value as T[]) : [];
};

const extractList = <T,>(payload: unknown): T[] => {
    if (Array.isArray(payload)) return payload as T[];
    const record = (payload ?? {}) as Record<string, unknown>;
    if (Array.isArray(record.items)) return record.items as T[];
    if (Array.isArray(record.results)) return record.results as T[];
    if (Array.isArray(record.data)) return record.data as T[];
    return [];
};

const formatDateTime = (value: unknown) => {
    return formatDisplayDateTime(value, "-");
};

const normalizeItem = (raw: unknown): ArrivedItem => {
    const item = (raw ?? {}) as Record<string, unknown>;
    return {
        asnShipmentItemId: asString(item.asnShipmentItemId),
        sku: asString(item.sku),
        description: asString(item.description),
        expectedQuantity: asString(item.expectedQuantity, "0"),
        receivedQuantity: asString(item.receivedQuantity, "0"),
        acceptedQuantity: asString(item.acceptedQuantity, "0"),
        rejectedQuantity: asString(item.rejectedQuantity, "0"),
        unit: asString(item.unit),
        lot: asString(item.lot),
        expiryDate: asString(item.expiryDate),
        batchNo: asString(item.batchNo),
        hsnCode: asString(item.hsnCode),
    };
};

const normalizeShipment = (raw: unknown): ArrivedShipment => {
    const shipment = (raw ?? {}) as Record<string, unknown>;
    return {
        poNumber: asString(shipment.poNumber),
        supplierCode: asString(shipment.supplierCode),
        supplierName: asString(shipment.supplierName),
        items: asArray<unknown>(shipment.items).map(normalizeItem),
    };
};

const normalizeInbound = (raw: unknown): ArrivedInbound => {
    const entry = (raw ?? {}) as Record<string, unknown>;
    const warehouseRecord = (entry.warehouse ?? {}) as Record<string, unknown>;
    return {
        asnNumber: asString(entry.asnNumber),
        asnDate: asString(entry.asnDate),
        expectedDate: asString(entry.expectedDate),
        actualArrivalDate: asString(entry.actualArrivalDate),
        shipmentId: asString(entry.shipmentId),
        status: asString(entry.status),
        inboundId: asString(entry.inboundId),
        warehouseId: asString(
            entry.warehouseId ||
            entry.warehouse_id ||
            warehouseRecord.id,
            "",
        ),
        warehouseCode: asString(entry.warehouseCode || entry.warehouse_code || warehouseRecord.code),
        warehouseName: asString(entry.warehouseName || entry.warehouse_name || warehouseRecord.name),
        receivingDock: asString(entry.receivingDock),
        supplierCode: asString(entry.supplierCode),
        supplierName: asString(entry.supplierName),
        supplierGST: asString(entry.supplierGST),
        driverName: asString(entry.driverName),
        driverPhone: asString(entry.driverPhone),
        vehicleNumber: asString(entry.vehicleNumber),
        grnNumber: asString(entry.grnNumber),
        grnId: asString(entry.grnId),
        grnStatus: asString(entry.grnStatus),
        total_items: Number(entry.total_items ?? 0) || 0,
        totalExpectedQty: asString(entry.totalExpectedQty, "0"),
        totalReceivedQty: asString(entry.totalReceivedQty, "0"),
        totalAcceptedQty: asString(entry.totalAcceptedQty, "0"),
        totalRejectedQty: asString(entry.totalRejectedQty, "0"),
        shipments: (() => {
            const parsedShipments = asArray<unknown>(entry.shipments).map(normalizeShipment);
            if ((parsedShipments.length === 0 || parsedShipments.every(s => s.items.length === 0)) && Array.isArray(entry.items) && entry.items.length > 0) {
                return [
                    {
                        poNumber: asString(entry.poNumber),
                        supplierCode: asString(entry.supplierCode),
                        supplierName: asString(entry.supplierName),
                        items: asArray<unknown>(entry.items).map(normalizeItem),
                    }
                ];
            }
            return parsedShipments;
        })(),
    };
};

const statusVariant = (status: string): "default" | "secondary" | "outline" | "destructive" => {
    const normalized = status.toLowerCase();
    if (normalized.includes("arrived") || normalized.includes("received") || normalized.includes("completed")) return "default";
    if (normalized.includes("pending") || normalized.includes("processing")) return "secondary";
    if (normalized.includes("draft") || normalized.includes("new")) return "outline";
    return "destructive";
};

const toNumber = (value: unknown): number => {
    const normalized = String(value ?? "0").replace(/^\+/, "").trim();
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
};

const normalizePalletBarcode = (value: unknown): string => {
    return String(value ?? "").trim();
};

const toNormalizedToken = (value: unknown): string => {
    return String(value ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
};

const isRejectedPalletType = (raw: Record<string, unknown>): boolean => {
    const typeLikeFields = [
        raw.type,
        raw.pallet_type,
        raw.palletType,
        raw.category,
        raw.pallet_category,
        raw.disposition,
        raw.condition,
        raw.quality_status,
        raw.status,
    ];

    return typeLikeFields.some((value) => {
        const normalized = toNormalizedToken(value);
        return normalized.includes("rejected") || normalized.includes("reject");
    });
};

const isStandardPalletType = (raw: Record<string, unknown>): boolean => {
    const typeLikeFields = [
        raw.type,
        raw.pallet_type,
        raw.palletType,
        raw.category,
        raw.pallet_category,
        raw.disposition,
        raw.condition,
        raw.quality_status,
        raw.status,
    ];

    return typeLikeFields.some((value) => {
        const normalized = toNormalizedToken(value);
        if (normalized === "standard" || normalized.includes("standard")) return true;
        if (normalized.includes("reject")) return false;
        return false;
    });
};

const normalizePalletOption = (raw: unknown): PalletOption | null => {
    const pallet = (raw ?? {}) as Record<string, unknown>;
    const id = asString(pallet.id, "");
    const barcode = asString(pallet.barcode, "");
    const palletCode = asString(pallet.pallet_code, "");
    const status = asString(pallet.status, "");
    const maxQuantity = toNumber(pallet.max_quantity ?? pallet.maxQuantity ?? pallet.capacity ?? 0);

    if (!barcode && !palletCode) return null;

    const explicitType = asString(
        pallet.type || pallet.pallet_type || pallet.palletType || pallet.category || pallet.pallet_category,
        "",
    );
    const explicitTypeToken = toNormalizedToken(explicitType);

    const normalizedExplicitType = explicitTypeToken.includes("reject")
        ? "rejected"
        : explicitTypeToken.includes("standard")
            ? "standard"
            : "";

    const derivedType = normalizedExplicitType
        || (isRejectedPalletType(pallet) ? "rejected" : "")
        || (isStandardPalletType(pallet) ? "standard" : "");

    return {
        id,
        barcode,
        palletCode,
        status,
        palletType: derivedType,
        isRejectedType: isRejectedPalletType(pallet),
        maxQuantity,
    };
};

const isStandardPalletOption = (option: PalletOption): boolean => {
    const typeToken = toNormalizedToken(option.palletType);
    return typeToken === "standard";
};

const isRejectedPalletOption = (option: PalletOption): boolean => {
    const typeToken = toNormalizedToken(option.palletType);
    return typeToken === "rejected";
};

const toPalletOptionValue = (option: PalletOption): string => {
    return option.palletCode || option.barcode || "";
};

const toPalletOptionLabel = (option: PalletOption): string => {
    if (option.palletCode && option.barcode) return `${option.palletCode} (Barcode: ${option.barcode})`;
    return option.palletCode || option.barcode || "—";
};

const palletBelongsToWarehouse = (
    pallet: GrnManagerPallet,
    warehouseId?: string,
    warehouseCode?: string,
): boolean => {
    const normalizedWarehouseId = toNormalizedToken(warehouseId);
    const normalizedWarehouseCode = toNormalizedToken(warehouseCode);

    const rowIds = [
        pallet.warehouse_id,
        pallet.warehouse?.id,
        (pallet as Record<string, unknown>).warehouseId,
    ].map(toNormalizedToken).filter(Boolean);

    const rowCodes = [
        pallet.warehouse_code,
        pallet.warehouse?.code,
        (pallet as Record<string, unknown>).warehouseCode,
        (pallet as Record<string, unknown>).warehouse_name,
    ].map(toNormalizedToken).filter(Boolean);

    if (normalizedWarehouseId) return rowIds.includes(normalizedWarehouseId);
    if (normalizedWarehouseCode) return rowCodes.includes(normalizedWarehouseCode);
    return false;
};

const GrnManagerArrived = () => {
    const [arrivedList, setArrivedList] = useState<ArrivedInbound[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selected, setSelected] = useState<ArrivedInbound | null>(null);
    const [detailOpen, setDetailOpen] = useState(false);
    const [createGrnOpen, setCreateGrnOpen] = useState(false);
    const [currentGrnStep, setCurrentGrnStep] = useState<1 | 2 | 3 | 4>(1);
    const [isCreatingGrn, setIsCreatingGrn] = useState(false);
    const [inboundShipmentId, setInboundShipmentId] = useState("");
    const [grnRows, setGrnRows] = useState<GrnItemRow[]>([]);
    const [palletOptions, setPalletOptions] = useState<PalletOption[]>([]);
    const [palletsLoading, setPalletsLoading] = useState(false);
    const [commonAcceptedPalletBarcode, setCommonAcceptedPalletBarcode] = useState("");
    const [commonRejectPalletBarcode, setCommonRejectPalletBarcode] = useState("");
    const [openPalletDropdowns, setOpenPalletDropdowns] = useState<Record<string, boolean>>({});
    const [step1Errors, setStep1Errors] = useState<Record<string, Record<string, string>>>({});

    const nextButtonRef = useRef<HTMLButtonElement>(null);
    const addPalletButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({});
    const qtyRefs = useRef<Record<string, HTMLInputElement | null>>({});
    const receivedRefs = useRef<Record<string, HTMLInputElement | null>>({});
    const palletInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
    const noteRefs = useRef<Record<string, HTMLInputElement | null>>({});
    const rejectionPalletRefs = useRef<Record<string, HTMLButtonElement | null>>({});

    // Validation logic for Step 1
    useEffect(() => {
        if (currentGrnStep !== 1) return;

        const newErrors: Record<string, Record<string, string>> = {};

        grnRows.forEach((row) => {
            const errors: Record<string, string> = {};
            const received = Number(row.received_quantity) || 0;
            const accepted = Number(row.accepted_quantity) || 0;
            const rejected = Number(row.rejected_quantity) || 0;
            const expected = toNumber(row.expected_quantity);

            // Rule 1: Received > 0
            if (received <= 0) {
                errors.received = "Received quantity is required and must be greater than 0";
            }

            // Rule 2: Sum validation
            if (accepted + rejected !== received) {
                errors.sum = `Accepted (${accepted}) + Rejected (${rejected}) must equal Received (${received}). Current total: ${accepted + rejected}`;
            }

            // Rule 3 & 4: At least one > 0 if Received > 0
            if (received > 0 && accepted === 0 && rejected === 0) {
                errors.accepted = "Either accepted or rejected quantity must be greater than 0";
            }

            if (Object.keys(errors).length > 0) {
                newErrors[row.asn_shipment_item_id] = errors;
            }
        });

        setStep1Errors(newErrors);
    }, [grnRows, currentGrnStep]);

    // Auto-focus logic
    useEffect(() => {
        const focusFirst = () => {
            if (currentGrnStep === 1) {
                const firstRowId = grnRows[0]?.asn_shipment_item_id;
                if (firstRowId) receivedRefs.current[firstRowId]?.focus();
            } else if (currentGrnStep === 2) {
                const firstAllocatableRow = grnRows.find(r => (Number(r.accepted_quantity) || 0) > 0);
                if (firstAllocatableRow) {
                    palletInputRefs.current[`${firstAllocatableRow.asn_shipment_item_id}-0`]?.focus();
                } else {
                    nextButtonRef.current?.focus();
                }
            } else if (currentGrnStep === 3) {
                const firstRow = grnRows.find(r =>
                    Number(r.received_quantity) < toNumber(r.expected_quantity) ||
                    (Number(r.rejected_quantity) || 0) > 0
                );
                if (firstRow) {
                    const hasShortage = Number(firstRow.received_quantity) < toNumber(firstRow.expected_quantity);
                    if (hasShortage) {
                        noteRefs.current[`${firstRow.asn_shipment_item_id}-shortage`]?.focus();
                    } else {
                        rejectionPalletRefs.current[firstRow.asn_shipment_item_id]?.focus();
                    }
                }
            } else if (currentGrnStep === 4) {
                nextButtonRef.current?.focus();
            }
        };
        const timer = setTimeout(focusFirst, 200);
        return () => clearTimeout(timer);
    }, [currentGrnStep, grnRows.length]);

    const standardPalletOptions = useMemo(
        () => palletOptions.filter((option) => isStandardPalletOption(option)),
        [palletOptions],
    );

    const acceptedPalletOptions = standardPalletOptions;
    const rejectedPalletOptions = useMemo(
        () => palletOptions.filter((option) => isRejectedPalletOption(option)),
        [palletOptions],
    );

    const hasAnyAcceptedQty = useMemo(
        () => grnRows.some((row) => (Number(row.accepted_quantity) || 0) > 0),
        [grnRows],
    );

    const hasAnyRejectedQty = useMemo(
        () => grnRows.some((row) => (Number(row.rejected_quantity) || 0) > 0),
        [grnRows],
    );

    const loadArrived = useCallback(async (isRefresh = false) => {
        if (isRefresh) {
            setRefreshing(true);
        } else {
            setLoading(true);
        }

        setError(null);

        try {
            const list = await grnManagerService.getArrivedInbounds(0, 100);
            setArrivedList(list.map(normalizeInbound));
        } catch (err) {
            const message = err instanceof Error ? err.message : "Failed to fetch arrived inbounds.";
            setError(message);
            setArrivedList([]);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        void loadArrived(false);
    }, [loadArrived]);

    useEffect(() => {
        if (!detailOpen) return;

        let disposed = false;

        const loadPallets = async () => {
            setPalletsLoading(true);
            try {
                const selectedWarehouseId = String(selected?.warehouseId ?? "").trim();
                const selectedWarehouseCode = String(selected?.warehouseCode ?? "").trim();
                let resolvedWarehouseId = selectedWarehouseId;

                if (!resolvedWarehouseId && selectedWarehouseCode) {
                    try {
                        const byCodeResponse = await warehouseService.getByCode(selectedWarehouseCode);
                        const byCodeRecord = (byCodeResponse ?? {}) as Record<string, unknown>;
                        resolvedWarehouseId = String(
                            byCodeRecord.id ||
                            (byCodeRecord.data as Record<string, unknown> | undefined)?.id ||
                            (byCodeRecord.item as Record<string, unknown> | undefined)?.id ||
                            "",
                        ).trim();
                    } catch {
                        resolvedWarehouseId = "";
                    }
                }

                if (!resolvedWarehouseId && selectedWarehouseCode) {
                    try {
                        const warehouses = extractList<Record<string, unknown>>(await warehouseService.getAll());
                        const matched = warehouses.find((row) =>
                            toNormalizedToken(row.code || row.warehouse_code) === toNormalizedToken(selectedWarehouseCode),
                        );
                        resolvedWarehouseId = String(matched?.id ?? "").trim();
                    } catch {
                        resolvedWarehouseId = "";
                    }
                }

                if (resolvedWarehouseId && resolvedWarehouseId !== selectedWarehouseId && !disposed) {
                    setSelected((prev) => (prev ? { ...prev, warehouseId: resolvedWarehouseId } : prev));
                }

                if (!resolvedWarehouseId) {
                    if (!selectedWarehouseCode) {
                        if (!disposed) {
                            setPalletOptions([]);
                        }
                        toast.error("Warehouse ID is missing for this inbound. Cannot load pallets.");
                        return;
                    }
                }

                const fetchedList = resolvedWarehouseId
                    ? await grnManagerService.getPalletsByWarehouseId(resolvedWarehouseId)
                    : await grnManagerService.getPallets(0, 500, { warehouse_code: selectedWarehouseCode });

                // Try explicit type-scoped queries first to avoid relying on inconsistent type metadata in payloads.
                // First try explicit type queries
                const [standardbytype, rejectedbytype] = await Promise.all([
                    grnManagerService.getPallets(0, 500, {
                        warehouse_id: resolvedWarehouseId || undefined,
                        warehouse_code: selectedWarehouseCode || undefined,
                        type: "standard",
                    }).catch((err) => {
                        console.warn("[grn] Failed to fetch standard pallets with type param:", err);
                        return [];
                    }),
                    grnManagerService.getPallets(0, 500, {
                        warehouse_id: resolvedWarehouseId || undefined,
                        warehouse_code: selectedWarehouseCode || undefined,
                        type: "rejected",
                    }).catch((err) => {
                        console.warn("[grn] Failed to fetch rejected pallets with type param:", err);
                        return [];
                    }),
                ]);

                const standardByType = standardbytype;
                const rejectedByType = rejectedbytype;

                // If type queries returned nothing, try fetching all pallets and filter on frontend
                let allPallets = [...standardByType, ...rejectedByType];
                if (allPallets.length === 0) {
                    try {
                        console.log("[grn] Type queries returned 0 results. Fetching all pallets to filter frontend...");
                        allPallets = await grnManagerService.getPallets(0, 500, {
                            warehouse_id: resolvedWarehouseId || undefined,
                            warehouse_code: selectedWarehouseCode || undefined,
                        });
                        console.log("[grn] All pallets fetched:", allPallets.length, "total pallets");
                    } catch (err) {
                        console.warn("[grn] Failed to fetch all pallets:", err);
                        allPallets = [];
                    }
                }

                console.log("[grn] Pallet Query Results:", {
                    warehouse_id: resolvedWarehouseId,
                    warehouse_code: selectedWarehouseCode,
                    standard_from_type_query: standardByType.length,
                    rejected_from_type_query: rejectedByType.length,
                    total_all_pallets: allPallets.length,
                });

                // Force-label explicitly typed pallets to guarantee classification
                const combinedList = [
                    ...standardByType.map((row) => ({
                        ...row,
                        type: "standard",
                        pallet_type: "standard",
                        palletType: "standard",
                    })),
                    ...rejectedByType.map((row) => ({
                        ...row,
                        type: "rejected",
                        pallet_type: "rejected",
                        palletType: "rejected",
                    })),
                    // Include all pallets (should be empty if type queries succeeded)
                    ...allPallets
                        .filter((p) => !standardByType.some((s) => (s.id || s.barcode) === (p.id || p.barcode)))
                        .filter((p) => !rejectedByType.some((r) => (r.id || r.barcode) === (p.id || p.barcode))),
                ];

                const finalList = combinedList.length > 0 ? combinedList : fetchedList;

                console.log("[grn] Combined List:", {
                    combined_count: combinedList.length,
                    final_count: finalList.length,
                    using_combined: combinedList.length > 0,
                });

                const seenValues = new Set<string>();
                const normalized = finalList
                    .map((entry) => {
                        const opt = normalizePalletOption(entry as GrnManagerPallet);
                        if (opt && toNormalizedToken(opt.palletType) === "rejected") {
                            console.log("[grn] Rejected pallet found:", { raw: entry, normalized: opt });
                        }
                        return opt;
                    })
                    .filter((entry): entry is PalletOption => entry !== null)
                    .filter((entry) => {
                        const value = toPalletOptionValue(entry);
                        if (!value || seenValues.has(value)) return false;
                        seenValues.add(value);
                        return true;
                    });

                const standardList = normalized.filter(isStandardPalletOption);
                const rejectedList = normalized.filter(isRejectedPalletOption);

                console.log("[grn] Final Pallet Options:", {
                    total: normalized.length,
                    standard: standardList.length,
                    rejected: rejectedList.length,
                    rejected_options: rejectedList,
                });

                if (!disposed) {
                    setPalletOptions(normalized);
                }
            } catch {
                if (!disposed) {
                    setPalletOptions([]);
                    toast.error("Failed to load pallets.");
                }
            } finally {
                if (!disposed) {
                    setPalletsLoading(false);
                }
            }
        };

        void loadPallets();

        return () => {
            disposed = true;
        };
    }, [detailOpen, selected?.warehouseCode, selected?.warehouseId]);

    const totalItems = useMemo(
        () => arrivedList.reduce((sum, record) => sum + record.total_items, 0),
        [arrivedList],
    );

    const openDetails = (record: ArrivedInbound) => {
        setSelected(record);
        setInboundShipmentId(record.inboundId || "");
        const rows = record.shipments.flatMap((shipment) =>
            shipment.items.map((item) => ({
                asn_shipment_item_id: item.asnShipmentItemId,
                sku: item.sku,
                description: item.description,
                expected_quantity: item.expectedQuantity,
                received_quantity: toNumber(item.receivedQuantity),
                accepted_quantity: toNumber(item.acceptedQuantity),
                rejected_quantity: toNumber(item.rejectedQuantity),
                shortage_note: "",
                rejection_note: "",
                pallet_barcode: "",
                reject_pallet_barcode: "",
                pallet_splits: [],
            })),
        );
        setGrnRows(rows);
        setCommonAcceptedPalletBarcode("");
        setCommonRejectPalletBarcode("");
        setDetailOpen(true);
    };

    const updateGrnRow = <K extends keyof GrnItemRow>(
        asnShipmentItemId: string,
        field: K,
        value: GrnItemRow[K],
    ) => {
        setGrnRows((prev) =>
            prev.map((row) => {
                if (row.asn_shipment_item_id !== asnShipmentItemId) return row;

                if (field === "received_quantity") {
                    const newReceived = Number(value) || 0;
                    const expected = toNumber(row.expected_quantity);
                    if (newReceived > expected) {
                        toast.error(`Received quantity cannot exceed Expected (${expected}) for SKU ${row.sku}.`);
                        return row;
                    }
                }

                if (field === "accepted_quantity") {
                    const newAccepted = Number(value) || 0;
                    const received = Number(row.received_quantity) || 0;
                    if (newAccepted > received) {
                        toast.error(`Accepted quantity cannot exceed Received (${received}) for SKU ${row.sku}.`);
                        return row;
                    }
                }

                const nextRow = { ...row, [field]: value };

                if (field === "rejected_quantity") {
                    const rejectedQty = Number(nextRow.rejected_quantity) || 0;
                    if (rejectedQty <= 0) {
                        nextRow.rejection_note = "";
                    }
                }

                if (field === "accepted_quantity" || field === "received_quantity") {
                    const receivedQty = Number(nextRow.received_quantity) || 0;
                    let acceptedQty = Number(nextRow.accepted_quantity) || 0;

                    if (acceptedQty > receivedQty) {
                        acceptedQty = receivedQty;
                        nextRow.accepted_quantity = acceptedQty as any;
                    }

                    const rejectedQty = Math.max(0, receivedQty - acceptedQty);

                    nextRow.rejected_quantity = rejectedQty as any;

                    if (rejectedQty <= 0) {
                        nextRow.rejection_note = "";
                    }
                }

                return nextRow;
            })
        );
    };

    const addPalletSplit = (asnShipmentItemId: string) => {
        setGrnRows((prev) =>
            prev.map((row) =>
                row.asn_shipment_item_id === asnShipmentItemId
                    ? {
                        ...row,
                        pallet_splits: [...row.pallet_splits, { pallet_barcode: "", quantity: 1 }],
                    }
                    : row,
            ),
        );

        // Focus the newly added pallet input after state update
        setTimeout(() => {
            const row = grnRows.find(r => r.asn_shipment_item_id === asnShipmentItemId);
            if (row) {
                const newIndex = row.pallet_splits.length;
                const key = `${asnShipmentItemId}-${newIndex}`;
                palletInputRefs.current[key]?.focus();
            }
        }, 100);
    };

    const updatePalletSplit = (
        asnShipmentItemId: string,
        splitIndex: number,
        field: "pallet_barcode" | "quantity",
        value: string | number,
    ) => {
        setGrnRows((prev) =>
            prev.map((row) => {
                if (row.asn_shipment_item_id !== asnShipmentItemId) return row;

                const nextSplits = row.pallet_splits.map((split, index) =>
                    index === splitIndex
                        ? {
                            ...split,
                            [field]: field === "quantity" ? (Number.isFinite(Number(value)) ? Number(value) : 0) : String(value),
                        }
                        : split,
                );

                return {
                    ...row,
                    pallet_splits: nextSplits,
                };
            }),
        );
    };

    const removePalletSplit = (asnShipmentItemId: string, splitIndex: number) => {
        setGrnRows((prev) =>
            prev.map((row) => {
                if (row.asn_shipment_item_id !== asnShipmentItemId) return row;
                return {
                    ...row,
                    pallet_splits: row.pallet_splits.filter((_, index) => index !== splitIndex),
                };
            }),
        );
    };

    const validateStep1EnterQuantities = (): boolean => {
        for (const row of grnRows) {
            const received = Number(row.received_quantity) || 0;
            const accepted = Number(row.accepted_quantity) || 0;
            const rejected = Number(row.rejected_quantity) || 0;
            const expected = toNumber(row.expected_quantity);

            if (received < 0 || accepted < 0 || rejected < 0) {
                toast.error(`Quantities cannot be negative for SKU ${row.sku}.`);
                return false;
            }

            if (received > expected) {
                toast.error(`Received quantity cannot exceed Expected for SKU ${row.sku}.`);
                return false;
            }

            if (accepted > received) {
                toast.error(`Accepted quantity cannot exceed Received for SKU ${row.sku}.`);
                return false;
            }
        }
        return true;
    };

    const validateStep2HandleRejection = (): boolean => {
        for (const row of grnRows) {
            const accepted = Number(row.accepted_quantity) || 0;
            const hasValidSplits = row.pallet_splits.length > 0;

            if (!hasValidSplits && accepted > 0) {
                toast.error(`At least one pallet split is required for SKU ${row.sku}.`);
                return false;
            }

            const computedAllocated = row.pallet_splits.reduce((sum, split) => sum + (Number(split.quantity) || 0), 0);

            if (computedAllocated !== accepted) {
                toast.error(`Total allocated (${computedAllocated}) must equal Accepted (${accepted}) for SKU ${row.sku}.`);
                return false;
            }

            const hasInvalidSplit = row.pallet_splits.some((split) => {
                const splitBarcode = String(split.pallet_barcode || "").trim();
                const splitQty = Number(split.quantity) || 0;
                return !splitBarcode || splitQty <= 0;
            });

            if (hasInvalidSplit) {
                toast.error(`Each pallet split needs both pallet barcode and quantity for SKU ${row.sku}.`);
                return false;
            }

            // Validate split pallet capacities
            for (const split of row.pallet_splits) {
                const splitBarcode = normalizePalletBarcode(split.pallet_barcode);
                const splitQty = Number(split.quantity) || 0;
                const splitPalletOption = standardPalletOptions.find((option) => normalizePalletBarcode(toPalletOptionValue(option)) === splitBarcode);

                if (splitPalletOption && splitPalletOption.maxQuantity > 0 && splitQty > splitPalletOption.maxQuantity) {
                    toast.error(
                        `Split pallet '${splitBarcode}' with quantity ${splitQty} exceeds its capacity (max ${splitPalletOption.maxQuantity}). Please use a different pallet or adjust the split quantity.`
                    );
                    return false;
                }
            }
        }

        return true;
    };

    const validateStep3Discrepancies = (): boolean => {
        const globalRejectBarcode = normalizePalletBarcode(commonRejectPalletBarcode);

        for (const row of grnRows) {
            const received = Number(row.received_quantity) || 0;
            const rejected = Number(row.rejected_quantity) || 0;
            const expected = toNumber(row.expected_quantity);

            const rowRejectBarcode = normalizePalletBarcode(row.reject_pallet_barcode || globalRejectBarcode);

            if (rejected > 0 && !rowRejectBarcode) {
                toast.error(`Reject pallet barcode is required for SKU ${row.sku}.`);
                return false;
            }

            if (received < expected && !String(row.shortage_note ?? "").trim()) {
                toast.error(`Shortage note is required for SKU ${row.sku}.`);
                return false;
            }

            const splitBarcodes = row.pallet_splits
                .map((split) => normalizePalletBarcode(split.pallet_barcode))
                .filter(Boolean);

            if (rowRejectBarcode && splitBarcodes.includes(rowRejectBarcode)) {
                toast.error(`Reject pallet barcode cannot match split pallet barcode for SKU ${row.sku}.`);
                return false;
            }
        }
        return true;
    };

    const goToNextGrnStep = () => {
        if (currentGrnStep === 1) {
            if (!validateStep1EnterQuantities()) return;
            // Initialize 1 split row for each item if empty, prefilled with accepted_quantity
            const updatedRows = grnRows.map(row => {
                if (row.pallet_splits.length === 0) {
                    return {
                        ...row,
                        pallet_splits: [{ pallet_barcode: "", quantity: Number(row.accepted_quantity) || 0 }]
                    };
                }
                return row;
            });
            setGrnRows(updatedRows);
            setCurrentGrnStep(2);
            return;
        }

        if (currentGrnStep === 2) {
            if (!validateStep2HandleRejection()) return;
            setCurrentGrnStep(3);
            return;
        }

        if (currentGrnStep === 3) {
            if (!validateStep3Discrepancies()) return;
            setCurrentGrnStep(4);
        }
    };

    const normalizeEnum = (value?: string) => String(value || "").trim().toUpperCase();

    const handleCreateGrn = async () => {
        if (!selected || isCreatingGrn) return;

        const trimmedInboundShipmentId = String(inboundShipmentId ?? "").trim();
        if (!trimmedInboundShipmentId || trimmedInboundShipmentId === "-") {
            toast.error("Inbound shipment ID is missing.");
            return;
        }

        if (grnRows.length === 0) {
            toast.error("No shipment items available for GRN.");
            return;
        }

        const rejectBarcode = normalizePalletBarcode(commonRejectPalletBarcode);
        const warehouseId = String(selected?.warehouseId ?? "").trim();

        if (!warehouseId) {
            toast.error("Warehouse ID is missing. Cannot proceed with pallet validation.");
            return;
        }

        // 1. Initial Validation loop
        for (const row of grnRows) {
            const received = Number(row.received_quantity) || 0;
            const accepted = Number(row.accepted_quantity) || 0;
            const expected = toNumber(row.expected_quantity);
            const computedAllocated = row.pallet_splits.reduce((sum, split) => sum + (Number(split.quantity) || 0), 0);

            const splitBarcodes = row.pallet_splits
                .map((split) => normalizePalletBarcode(split.pallet_barcode))
                .filter(Boolean);

            if (received < 0 || accepted < 0) {
                toast.error(`Quantities cannot be negative for SKU ${row.sku}.`);
                return;
            }

            if (computedAllocated !== accepted) {
                toast.error(`Total allocated (${computedAllocated}) must equal Accepted (${accepted}) for SKU ${row.sku}.`);
                return;
            }

            if (received < expected && !String(row.shortage_note ?? "").trim()) {
                toast.error(`Shortage note is required when Received is less than Expected for SKU ${row.sku}.`);
                return;
            }

            const rowRejectBarcode = row.reject_pallet_barcode || rejectBarcode;

            if (rowRejectBarcode && splitBarcodes.includes(normalizePalletBarcode(rowRejectBarcode))) {
                toast.error(`Reject pallet barcode cannot match split pallet barcode for SKU ${row.sku}.`);
                return;
            }

            const hasInvalidSplit = row.pallet_splits.some((split) => {
                const splitBarcode = String(split.pallet_barcode || "").trim();
                const splitQty = Number(split.quantity) || 0;
                return !splitBarcode || splitQty <= 0;
            });

            if (hasInvalidSplit) {
                toast.error(`Each pallet split needs both pallet barcode and quantity for SKU ${row.sku}.`);
                return;
            }

            // Validate split pallet capacities
            for (const split of row.pallet_splits) {
                const splitBarcode = normalizePalletBarcode(split.pallet_barcode);
                const splitQty = Number(split.quantity) || 0;
                const splitPalletOption = standardPalletOptions.find((option) => normalizePalletBarcode(toPalletOptionValue(option)) === splitBarcode);

                if (splitPalletOption && splitPalletOption.maxQuantity > 0 && splitQty > splitPalletOption.maxQuantity) {
                    toast.error(
                        `Split pallet '${splitBarcode}' with quantity ${splitQty} exceeds its capacity (max ${splitPalletOption.maxQuantity}). Please use a different pallet or adjust the split quantity.`
                    );
                    return;
                }
            }
        }

        setIsCreatingGrn(true);
        try {
            // 2. Identify and create missing pallets
            const palletsToProcess = new Set<string>();
            grnRows.forEach(row => {
                row.pallet_splits.forEach(split => {
                    if (split.pallet_barcode) palletsToProcess.add(normalizePalletBarcode(split.pallet_barcode));
                });
                const rowRejectBarcode = row.reject_pallet_barcode || rejectBarcode;
                if (rowRejectBarcode) palletsToProcess.add(normalizePalletBarcode(rowRejectBarcode));
            });

            // Requirement 6: Correctly compare against both barcode and palletCode
            // and Requirement 8: Add debugging logs
            console.log("Fetched pallet options:", palletOptions);
            
            const currentPalletBarcodes = new Set<string>();
            palletOptions.forEach(opt => {
                if (opt.barcode) currentPalletBarcodes.add(normalizePalletBarcode(opt.barcode));
                if (opt.palletCode) currentPalletBarcodes.add(normalizePalletBarcode(opt.palletCode));
            });
            
            console.log("Current pallet barcodes in state:", Array.from(currentPalletBarcodes));

            const missingBarcodes = Array.from(palletsToProcess).filter(bc => {
                console.log("Processing pallet barcode:", bc);
                const exists = currentPalletBarcodes.has(bc);
                if (exists) console.log(`Pallet ${bc} already exists in local state. Skipping creation.`);
                return !exists;
            });

            console.log("Missing barcodes identified for creation:", missingBarcodes);

            if (missingBarcodes.length > 0) {
                console.log("[grn] Creating missing pallets:", missingBarcodes);
                for (const barcode of missingBarcodes) {
                    await palletService.create({
                        barcode: barcode,
                        pallet_code: barcode,
                        warehouse_id: warehouseId,
                        status: PalletStatus.ACTIVE, // Requirement 11: ACTIVE enum
                        is_active: true
                    });
                }
                
                // Refresh pallet data
                const updatedPallets = await grnManagerService.getPalletsByWarehouseId(warehouseId);
                const normalized = updatedPallets
                    .map((entry) => normalizePalletOption(entry as GrnManagerPallet))
                    .filter((entry): entry is PalletOption => entry !== null);
                setPalletOptions(normalized);
            }

            // 3. Submit GRN with normalized enums
            const payload = {
                inbound_shipment_id: trimmedInboundShipmentId,
                items: grnRows.map((row) => {
                    const validSplits = row.pallet_splits
                        .map((split) => ({
                            pallet_barcode: String(split.pallet_barcode ?? "").trim(),
                            quantity: Number(split.quantity) || 0,
                        }))
                        .filter((split) => split.pallet_barcode && split.quantity > 0);

                    const rowRejectBarcode = row.reject_pallet_barcode || rejectBarcode;
                    const computedRejected = Number(row.rejected_quantity) || 0;

                    const finalPallets = validSplits.map(s => ({
                        pallet_id: null,
                        pallet_barcode: s.pallet_barcode,
                        quantity: s.quantity,
                        status: normalizeEnum(PalletStatus.ACCEPTED) // Requirement 4 & 8: ACCEPTED enum normalized
                    }));

                    const finalRejectedPallets = (computedRejected > 0 && rowRejectBarcode)
                        ? [{ 
                            pallet_barcode: rowRejectBarcode, 
                            quantity: computedRejected, 
                            status: normalizeEnum(PalletStatus.REJECTED), // Requirement 4 & 8: REJECTED enum normalized
                            reason: String(row.rejection_note ?? "").trim() 
                        }]
                        : [];

                    return {
                        asn_shipment_item_id: row.asn_shipment_item_id,
                        received_quantity: Number(row.received_quantity) || 0,
                        accepted_quantity: Number(row.accepted_quantity) || 0,
                        rejected_quantity: computedRejected,
                        reject_pallet_barcode: rowRejectBarcode || null,
                        pallets: finalPallets,
                        rejected_pallets: finalRejectedPallets,
                        pallet_splits: validSplits,
                        shortage_note: String(row.shortage_note ?? "").trim(),
                        rejection_note: String(row.rejection_note ?? "").trim(),
                    };
                }),
            };

            console.log("Final pallet payload:", payload); // Requirement 9
            await grnManagerService.createGrn(payload);
            toast.success("GRN completed. Putaway tasks generated successfully.");
            
            const rejectedQtyTotal = grnRows.reduce((sum, row) => sum + (Number(row.rejected_quantity) || 0), 0);
            if (rejectedQtyTotal > 0) {
                toast.info("Rejected quantities are logged. Inspection will be created after rejected putaway completion.");
            }
            
            setDetailOpen(false);
            setSelected(null);
            setGrnRows([]);
            setCommonAcceptedPalletBarcode("");
            setCommonRejectPalletBarcode("");
            setCreateGrnOpen(false);
            await loadArrived(true);
        } catch (err) {
            const message = err instanceof Error ? err.message : "Failed to create GRN.";
            toast.error(message);
        } finally {
            setIsCreatingGrn(false);
        }
    };

    return (
        <div className="p-4 md:p-8 space-y-6">
            <div className="flex items-center justify-between gap-4">
                <div>
                    <h1 className="font-heading text-3xl font-bold">GRN Inbounds</h1>
                    <p className="text-muted-foreground">Arrived inbounds from GET /inbound/today/arrived</p>
                </div>
                <Button variant="outline" className="gap-2" onClick={() => void loadArrived(true)} disabled={refreshing}>
                    <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
                    {refreshing ? "Refreshing..." : "Refresh"}
                </Button>
            </div>

            {error && (
                <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    {error}
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Arrived Inbounds</CardTitle></CardHeader>
                    <CardContent className="text-2xl font-semibold">{arrivedList.length}</CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total Items</CardTitle></CardHeader>
                    <CardContent className="text-2xl font-semibold">{totalItems}</CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">With GRN</CardTitle></CardHeader>
                    <CardContent className="text-2xl font-semibold">{arrivedList.filter((r) => r.grnNumber !== "-").length}</CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Important Inbound Details</CardTitle>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="py-16 text-center text-muted-foreground">Loading arrived inbounds...</div>
                    ) : arrivedList.length === 0 ? (
                        <div className="py-16 text-center text-muted-foreground">No arrived inbounds found.</div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>ASN</TableHead>
                                    <TableHead>Shipment</TableHead>
                                    <TableHead>Supplier</TableHead>
                                    <TableHead>Warehouse</TableHead>
                                    <TableHead>Arrived At</TableHead>
                                    <TableHead>GRN</TableHead>
                                    <TableHead>Status</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {arrivedList.map((record) => (
                                    <TableRow
                                        key={record.inboundId}
                                        className="cursor-pointer"
                                        onClick={() => openDetails(record)}
                                    >
                                        <TableCell className="font-medium text-primary">{record.asnNumber}</TableCell>
                                        <TableCell>{record.shipmentId}</TableCell>
                                        <TableCell>{record.supplierName}</TableCell>
                                        <TableCell>{record.warehouseName}</TableCell>
                                        <TableCell>{formatDateTime(record.actualArrivalDate)}</TableCell>
                                        <TableCell>{record.grnNumber}</TableCell>
                                        <TableCell>
                                            <Badge variant={statusVariant(record.grnStatus || record.status)}>
                                                {record.grnStatus !== "-" ? record.grnStatus : record.status}
                                            </Badge>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            <Dialog
                open={detailOpen}
                onOpenChange={(open) => {
                    setDetailOpen(open);
                    if (!open) setCreateGrnOpen(false);
                }}
            >
                <DialogContent className="w-[96vw] max-w-[1400px] max-h-[92vh] overflow-y-auto overflow-x-hidden">
                    <DialogHeader>
                        <DialogTitle>Inbound Important Details</DialogTitle>
                        <DialogDescription>
                            Key GRN information for selected inbound.
                        </DialogDescription>
                    </DialogHeader>

                    {selected && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                <Card>
                                    <CardHeader className="py-3"><CardTitle className="text-sm flex items-center gap-2"><ClipboardList className="w-4 h-4" /> Reference</CardTitle></CardHeader>
                                    <CardContent className="space-y-2">
                                        <p><span className="text-muted-foreground">ASN:</span> {selected.asnNumber}</p>
                                        <p><span className="text-muted-foreground">Shipment ID:</span> {selected.shipmentId}</p>
                                        <p><span className="text-muted-foreground">ASN Date:</span> {formatDateTime(selected.asnDate)}</p>
                                        <p><span className="text-muted-foreground">Expected:</span> {formatDateTime(selected.expectedDate)}</p>
                                        <p><span className="text-muted-foreground">Arrived:</span> {formatDateTime(selected.actualArrivalDate)}</p>
                                    </CardContent>
                                </Card>
                                <Card>
                                    <CardHeader className="py-3"><CardTitle className="text-sm flex items-center gap-2"><Building2 className="w-4 h-4" /> Supplier & Warehouse</CardTitle></CardHeader>
                                    <CardContent className="space-y-2">
                                        <p><span className="text-muted-foreground">Supplier:</span> {selected.supplierName}</p>
                                        <p><span className="text-muted-foreground">Supplier Code:</span> {selected.supplierCode}</p>
                                        <p><span className="text-muted-foreground">Supplier GST:</span> {selected.supplierGST}</p>
                                        <p><span className="text-muted-foreground">Warehouse:</span> {selected.warehouseName}</p>
                                        <p><span className="text-muted-foreground">Warehouse Code:</span> {selected.warehouseCode}</p>
                                        <p><span className="text-muted-foreground">Receiving Dock:</span> {selected.receivingDock}</p>
                                    </CardContent>
                                </Card>
                                <Card>
                                    <CardHeader className="py-3"><CardTitle className="text-sm flex items-center gap-2"><Truck className="w-4 h-4" /> Transport</CardTitle></CardHeader>
                                    <CardContent className="space-y-2">
                                        <p><span className="text-muted-foreground">Driver:</span> {selected.driverName}</p>
                                        <p><span className="text-muted-foreground">Phone:</span> {selected.driverPhone}</p>
                                        <p><span className="text-muted-foreground">Vehicle:</span> {selected.vehicleNumber}</p>
                                    </CardContent>
                                </Card>
                                <Card>
                                    <CardHeader className="py-3"><CardTitle className="text-sm flex items-center gap-2"><CalendarDays className="w-4 h-4" /> GRN & Quantities</CardTitle></CardHeader>
                                    <CardContent className="space-y-2">
                                        <p><span className="text-muted-foreground">GRN Number:</span> {selected.grnNumber}</p>
                                        <p><span className="text-muted-foreground">GRN Status:</span> {selected.grnStatus}</p>
                                        <p><span className="text-muted-foreground">Total Items:</span> {selected.total_items}</p>
                                        <p><span className="text-muted-foreground">Expected Qty:</span> {selected.totalExpectedQty}</p>
                                        <p><span className="text-muted-foreground">Received Qty:</span> {selected.totalReceivedQty}</p>
                                        <p><span className="text-muted-foreground">Accepted Qty:</span> {selected.totalAcceptedQty}</p>
                                        <p><span className="text-muted-foreground">Rejected Qty:</span> {selected.totalRejectedQty}</p>
                                    </CardContent>
                                </Card>
                            </div>

                            {selected.shipments.length > 0 && (
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="text-sm">Important Shipment Item Snapshot</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>PO</TableHead>
                                                    <TableHead>SKU</TableHead>
                                                    <TableHead>Description</TableHead>
                                                    <TableHead>Expected</TableHead>
                                                    <TableHead>Received</TableHead>
                                                    <TableHead>Unit</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {selected.shipments.flatMap((shipment) =>
                                                    shipment.items.slice(0, 5).map((item) => (
                                                        <TableRow key={item.asnShipmentItemId}>
                                                            <TableCell>{shipment.poNumber}</TableCell>
                                                            <TableCell className="font-medium">{item.sku}</TableCell>
                                                            <TableCell>{item.description}</TableCell>
                                                            <TableCell>{item.expectedQuantity}</TableCell>
                                                            <TableCell>{item.receivedQuantity}</TableCell>
                                                            <TableCell>{item.unit}</TableCell>
                                                        </TableRow>
                                                    )),
                                                )}
                                            </TableBody>
                                        </Table>
                                    </CardContent>
                                </Card>
                            )}

                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-sm">Create GRN</CardTitle>
                                </CardHeader>
                                <CardContent className="flex items-center justify-between gap-4">
                                    <div className="text-sm text-muted-foreground">
                                        Open Create GRN form in a dedicated popup.
                                    </div>
                                    <Button onClick={() => {
                                        setCurrentGrnStep(1);
                                        setCreateGrnOpen(true);
                                    }}>
                                        Create GRN
                                    </Button>
                                </CardContent>
                            </Card>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            <Dialog open={createGrnOpen} onOpenChange={(open) => {
                setCreateGrnOpen(open);
                if (!open) {
                    setCurrentGrnStep(1);
                    setCommonAcceptedPalletBarcode("");
                    setCommonRejectPalletBarcode("");
                    setInboundShipmentId("");
                }
            }}>
                <DialogContent 
                    className="w-[96vw] max-w-[1000px] max-h-[90vh] p-0 overflow-hidden"
                    onKeyDown={(e) => {
                        if (e.key === "Enter" && currentGrnStep === 4 && !isCreatingGrn) {
                            e.preventDefault();
                            void handleCreateGrn();
                        }
                    }}
                >
                    <div className="flex flex-col max-h-[90vh] bg-background">
                        <div className="px-6 pt-5 pb-4 border-b shrink-0">
                            <DialogHeader>
                                <DialogTitle className="text-2xl">Create GRN</DialogTitle>
                                <DialogDescription>
                                    Prepare quantities, pallet mapping and submit GRN.
                                </DialogDescription>
                            </DialogHeader>

                            <div className="mt-4 grid grid-cols-4 gap-2 text-sm">
                                <div className="flex items-center gap-2">
                                    <span className={`h-6 w-6 rounded-full text-white flex items-center justify-center text-xs ${currentGrnStep >= 1 ? "bg-emerald-600" : "bg-muted"}`}>1</span>
                                    <span className={currentGrnStep === 1 ? "font-semibold" : "text-muted-foreground"}>Enter quantities</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className={`h-6 w-6 rounded-full text-white flex items-center justify-center text-xs ${currentGrnStep >= 2 ? "bg-blue-600" : "bg-muted"}`}>2</span>
                                    <span className={currentGrnStep === 2 ? "font-semibold" : "text-muted-foreground"}>Pallet selection</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className={`h-6 w-6 rounded-full text-white flex items-center justify-center text-xs ${currentGrnStep >= 3 ? "bg-orange-500" : "bg-muted"}`}>3</span>
                                    <span className={currentGrnStep === 3 ? "font-semibold" : "text-muted-foreground"}>Handle rejection & shortage</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className={`h-6 w-6 rounded-full text-xs flex items-center justify-center ${currentGrnStep >= 4 ? "bg-primary text-primary-foreground" : "border text-muted-foreground"}`}>4</span>
                                    <span className={currentGrnStep === 4 ? "font-semibold" : "text-muted-foreground"}>Confirm & submit</span>
                                </div>
                            </div>

                            {selected && (
                                <div className="mt-4 text-sm rounded-lg border px-3 py-2 bg-muted/30">
                                    <span className="font-semibold">ASN {selected.asnNumber}</span>
                                    <span className="text-muted-foreground"> · Pallet source: {selected.warehouseName} · Accepted: standard type · Reject: rejected type</span>
                                </div>
                            )}
                        </div>

                        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 min-h-0">
                            {(currentGrnStep === 1 || currentGrnStep === 2) && grnRows.map((row, rowIndex) => {
                                const expected = toNumber(row.expected_quantity);
                                const received = Number(row.received_quantity) || 0;
                                const completion = expected > 0 ? Math.min(100, Math.round((received / expected) * 100)) : 0;
                                const errors = currentGrnStep === 1 ? (step1Errors[row.asn_shipment_item_id] || {}) : {};
                                const hasError = Object.keys(errors).length > 0;

                                return (
                                    <div key={row.asn_shipment_item_id} className={cn("rounded-xl border p-4 space-y-4 transition-all duration-300", hasError ? "border-destructive/50 ring-1 ring-destructive/10 bg-destructive/5 shadow-sm" : "bg-card hover:shadow-md")}>
                                        <div className="flex items-start justify-between gap-3">
                                            <div>
                                                <p className="text-2xl font-semibold leading-tight flex items-center gap-2">
                                                    {row.sku}
                                                    {currentGrnStep === 1 && (hasError ? <AlertTriangle className="h-4 w-4 text-destructive animate-pulse" /> : <Check className="h-4 w-4 text-emerald-500" />)}
                                                </p>
                                                <p className="text-sm text-muted-foreground">{row.description}</p>
                                            </div>
                                            <Badge variant={hasError ? "destructive" : "secondary"}>Item {rowIndex + 1} of {grnRows.length}</Badge>
                                        </div>

                                        <div>
                                            <div className="flex items-center justify-between text-sm mb-1">
                                                <span className="text-muted-foreground">Fulfillment</span>
                                                <span className="font-semibold">{completion}%</span>
                                            </div>
                                            <div className="h-2 rounded-full bg-muted overflow-hidden">
                                                <div className="h-full bg-primary transition-all" style={{ width: `${completion}%` }} />
                                            </div>
                                        </div>

                                        {currentGrnStep === 1 && (
                                            <div className="space-y-4">
                                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                                    <div className="space-y-1">
                                                        <p className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1">
                                                            <BarChart3 className="h-3 w-3" /> Expected
                                                        </p>
                                                        <Input value={toNumber(row.expected_quantity).toFixed(3)} disabled className="h-10 bg-muted/50 border-muted text-muted-foreground select-none" />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <p className={cn("text-[10px] uppercase font-bold flex items-center gap-1", errors.received ? "text-destructive" : "text-muted-foreground")}>
                                                            <Truck className="h-3 w-3" /> Received
                                                        </p>
                                                        <Input
                                                            type="number"
                                                            ref={(el) => (receivedRefs.current[row.asn_shipment_item_id] = el)}
                                                            min={0}
                                                            value={row.received_quantity}
                                                            onChange={(e) => updateGrnRow(row.asn_shipment_item_id, "received_quantity", Number(e.target.value || 0))}
                                                            onKeyDown={(e) => {
                                                                if (e.key === "Enter") {
                                                                    e.preventDefault();
                                                                    qtyRefs.current[row.asn_shipment_item_id]?.focus();
                                                                }
                                                            }}
                                                            className={cn("h-10 font-medium", errors.received ? "border-destructive focus-visible:ring-destructive" : "")}
                                                        />
                                                        {errors.received && <p className="text-[10px] text-destructive font-medium leading-tight">{errors.received}</p>}
                                                    </div>
                                                    <div className="space-y-1">
                                                        <p className={cn("text-[10px] uppercase font-bold flex items-center gap-1", errors.accepted ? "text-destructive" : "text-muted-foreground")}>
                                                            <Check className="h-3 w-3" /> Accepted
                                                        </p>
                                                        <Input
                                                            type="number"
                                                            ref={(el) => (qtyRefs.current[row.asn_shipment_item_id] = el)}
                                                            min={0}
                                                            value={row.accepted_quantity}
                                                            onChange={(e) => updateGrnRow(row.asn_shipment_item_id, "accepted_quantity", Number(e.target.value || 0))}
                                                            onKeyDown={(e) => {
                                                                if (e.key === "Enter") {
                                                                    e.preventDefault();
                                                                    const nextRow = grnRows[rowIndex + 1];
                                                                    if (nextRow) {
                                                                        receivedRefs.current[nextRow.asn_shipment_item_id]?.focus();
                                                                    } else {
                                                                        nextButtonRef.current?.focus();
                                                                    }
                                                                }
                                                            }}
                                                            className={cn("h-10 font-medium", errors.accepted ? "border-destructive focus-visible:ring-destructive" : "")}
                                                        />
                                                        {errors.accepted && <p className="text-[10px] text-destructive font-medium leading-tight">{errors.accepted}</p>}
                                                    </div>
                                                    <div className="space-y-1">
                                                        <p className={cn("text-[10px] uppercase font-bold flex items-center gap-1", errors.rejected ? "text-destructive" : "text-muted-foreground")}>
                                                            <AlertTriangle className="h-3 w-3" /> Rejected
                                                        </p>
                                                        <Input
                                                            type="number"
                                                            min={0}
                                                            value={row.rejected_quantity}
                                                            onChange={(e) => updateGrnRow(row.asn_shipment_item_id, "rejected_quantity", Number(e.target.value || 0))}
                                                            className={cn("h-10 font-medium", errors.rejected ? "border-destructive focus-visible:ring-destructive" : "")}
                                                        />
                                                    </div>
                                                </div>
                                                {errors.sum && (
                                                    <div className="bg-destructive/10 border border-destructive/20 p-2.5 rounded-lg flex items-center gap-2 animate-in fade-in slide-in-from-top-1 duration-200">
                                                        <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0" />
                                                        <p className="text-xs text-destructive font-bold">{errors.sum}</p>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {currentGrnStep === 2 && (
                                            <div className="mt-5 space-y-4 transition-all">
                                                {(() => {
                                                    const received = Number(row.received_quantity) || 0;
                                                    const accepted = Number(row.accepted_quantity) || 0;
                                                    const rejected = Number(row.rejected_quantity) || 0;
                                                    const computedAllocated = row.pallet_splits.reduce((sum, split) => sum + (Number(split.quantity) || 0), 0);
                                                    const isMatched = computedAllocated === accepted;
                                                    const isMore = computedAllocated > accepted;

                                                    return (
                                                        <>
                                                            <div className="flex flex-col gap-2 pb-3 border-b">
                                                                <div className="grid grid-cols-3 gap-2 text-sm text-muted-foreground bg-muted/20 p-2 rounded-lg">
                                                                    <div>Received: <span className="font-semibold text-foreground">{received}</span></div>
                                                                    <div>Accepted: <span className="font-semibold text-foreground">{accepted}</span></div>
                                                                    <div>Rejected: <span className="font-semibold text-foreground">{rejected}</span></div>
                                                                </div>
                                                                <div className={`text-sm font-semibold flex items-center justify-end gap-2 ${isMatched ? 'text-emerald-600' : (isMore ? 'text-destructive' : 'text-amber-500')}`}>
                                                                    {isMatched ? (
                                                                        <div className="h-5 w-5 rounded-full bg-emerald-100 flex items-center justify-center">
                                                                            <div className="h-2.5 w-2.5 rounded-full bg-emerald-600"></div>
                                                                        </div>
                                                                    ) : (
                                                                        <AlertTriangle className="h-4 w-4" />
                                                                    )}
                                                                    Allocated: {computedAllocated} / {accepted}
                                                                </div>
                                                            </div>

                                                            <div className={`p-4 rounded-xl border border-dashed bg-muted/30 space-y-4 relative ${accepted === 0 ? "opacity-50 pointer-events-none select-none" : ""}`}>
                                                                {accepted === 0 && (
                                                                    <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-background/5">
                                                                        <Badge variant="outline" className="bg-background/80 shadow-sm border-muted-foreground/30 text-muted-foreground font-bold uppercase tracking-wider text-[10px]">
                                                                            No accepted quantity to allocate
                                                                        </Badge>
                                                                    </div>
                                                                )}
                                                                <div className="flex items-center justify-between mb-2">
                                                                    <div className="flex items-center gap-2">
                                                                        <div className="h-7 w-7 rounded-md bg-background border flex items-center justify-center shadow-sm">
                                                                            <Truck className="h-3.5 w-3.5 text-muted-foreground" />
                                                                        </div>
                                                                        <div>
                                                                            <p className="text-sm font-semibold leading-none">Accepted Pallet splits</p>
                                                                            <p className="text-xs text-muted-foreground mt-1">You can distribute quantity across multiple pallets</p>
                                                                        </div>
                                                                    </div>
                                                                </div>

                                                                <div className="space-y-3">
                                                                    {row.pallet_splits.map((split, index) => (
                                                                        <div key={`${row.asn_shipment_item_id}-split-${index}`} className="grid grid-cols-[1fr_110px_auto] gap-3 items-center bg-background p-2 rounded-lg border shadow-sm group hover:border-primary/30 transition-all duration-200">
                                                                            <div className="relative">
                                                                                <Popover
                                                                                    open={openPalletDropdowns[`${row.asn_shipment_item_id}-${index}`] || false}
                                                                                    onOpenChange={(open) => setOpenPalletDropdowns(prev => ({ ...prev, [`${row.asn_shipment_item_id}-${index}`]: open }))}
                                                                                >
                                                                                    <PopoverAnchor asChild>
                                                                                        <div
                                                                                            className="relative w-full group cursor-pointer"
                                                                                            onClick={() => {
                                                                                                if (!openPalletDropdowns[`${row.asn_shipment_item_id}-${index}`]) {
                                                                                                    setOpenPalletDropdowns(prev => ({ ...prev, [`${row.asn_shipment_item_id}-${index}`]: true }));
                                                                                                }
                                                                                            }}
                                                                                        >
                                                                                            <Input
                                                                                                type="text"
                                                                                                ref={(el) => (palletInputRefs.current[`${row.asn_shipment_item_id}-${index}`] = el)}
                                                                                                placeholder="Scan or enter pallet code"
                                                                                                value={split.pallet_barcode}
                                                                                                disabled={accepted === 0}
                                                                                                onChange={(e) => {
                                                                                                    const value = normalizePalletBarcode(e.target.value);
                                                                                                    updatePalletSplit(row.asn_shipment_item_id, index, "pallet_barcode", value);
                                                                                                    if (value && !openPalletDropdowns[`${row.asn_shipment_item_id}-${index}`]) {
                                                                                                        setOpenPalletDropdowns(prev => ({ ...prev, [`${row.asn_shipment_item_id}-${index}`]: true }));
                                                                                                    }
                                                                                                }}
                                                                                                onFocus={() => {
                                                                                                    if (!openPalletDropdowns[`${row.asn_shipment_item_id}-${index}`]) {
                                                                                                        setOpenPalletDropdowns(prev => ({ ...prev, [`${row.asn_shipment_item_id}-${index}`]: true }));
                                                                                                    }
                                                                                                }}
                                                                                                onKeyDown={(e) => {
                                                                                                    if (e.key === "Escape") {
                                                                                                        setOpenPalletDropdowns(prev => ({ ...prev, [`${row.asn_shipment_item_id}-${index}`]: false }));
                                                                                                    }
                                                                                                }}
                                                                                                className="h-10 font-mono pr-10 bg-background border-muted-foreground/20 focus:border-primary/50 transition-all cursor-text"
                                                                                            />
                                                                                            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 pointer-events-none">
                                                                                                <ChevronsUpDown className="h-4 w-4 opacity-50 group-hover:opacity-80 transition-opacity" />
                                                                                            </div>
                                                                                        </div>
                                                                                    </PopoverAnchor>
                                                                                    <PopoverContent
                                                                                        className="p-0 border-primary/20 shadow-xl overflow-hidden"
                                                                                        style={{ width: 'var(--radix-popover-trigger-width)' }}
                                                                                        align="start"
                                                                                        sideOffset={4}
                                                                                    >
                                                                                        <Command className="bg-popover">
                                                                                            <CommandInput
                                                                                                placeholder="Search standard pallets..."
                                                                                                className="h-9 border-none focus:ring-0"
                                                                                            />
                                                                                            <CommandList>
                                                                                                <CommandEmpty className="py-4 text-sm text-muted-foreground text-center flex flex-col items-center gap-1">
                                                                                                    <p>No standard pallet found.</p>
                                                                                                    <p className="text-[10px] opacity-70">Try scanning a different barcode</p>
                                                                                                </CommandEmpty>
                                                                                                <CommandGroup className="max-h-64 overflow-y-auto p-1 custom-scrollbar">
                                                                                                    {standardPalletOptions.map((option) => {
                                                                                                        const isSelected = normalizePalletBarcode(split.pallet_barcode) === normalizePalletBarcode(toPalletOptionValue(option));
                                                                                                        return (
                                                                                                            <CommandItem
                                                                                                                key={toPalletOptionValue(option)}
                                                                                                                value={`${option.barcode} ${option.palletCode} ${toPalletOptionLabel(option)}`}
                                                                                                                onSelect={() => {
                                                                                                                    updatePalletSplit(row.asn_shipment_item_id, index, "pallet_barcode", toPalletOptionValue(option));
                                                                                                                    setOpenPalletDropdowns(prev => ({ ...prev, [`${row.asn_shipment_item_id}-${index}`]: false }));

                                                                                                                    // Move focus to quantity input
                                                                                                                    setTimeout(() => {
                                                                                                                        qtyRefs.current[`${row.asn_shipment_item_id}-${index}`]?.focus();
                                                                                                                        qtyRefs.current[`${row.asn_shipment_item_id}-${index}`]?.select();
                                                                                                                    }, 50);
                                                                                                                }}
                                                                                                                className={cn(
                                                                                                                    "flex items-center justify-between rounded-md px-3 py-2 cursor-pointer transition-colors mb-0.5",
                                                                                                                    isSelected ? "bg-primary/10 text-primary" : "hover:bg-primary/5"
                                                                                                                )}
                                                                                                            >
                                                                                                                <div className="flex flex-col gap-0.5 overflow-hidden">
                                                                                                                    <span className="font-semibold text-sm truncate">{option.palletCode || option.barcode}</span>
                                                                                                                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider truncate">
                                                                                                                        {option.palletCode ? `Barcode: ${option.barcode}` : "No barcode"}
                                                                                                                    </span>
                                                                                                                </div>
                                                                                                                {isSelected && (
                                                                                                                    <div className="bg-primary/20 p-1 rounded-full ml-2">
                                                                                                                        <Check className="h-3 w-3 text-primary" />
                                                                                                                    </div>
                                                                                                                )}
                                                                                                            </CommandItem>
                                                                                                        );
                                                                                                    })}
                                                                                                </CommandGroup>
                                                                                            </CommandList>
                                                                                        </Command>
                                                                                    </PopoverContent>
                                                                                </Popover>
                                                                            </div>
                                                                            <Input
                                                                                type="number"
                                                                                min={1}
                                                                                ref={(el) => (qtyRefs.current[`${row.asn_shipment_item_id}-${index}`] = el)}
                                                                                value={split.quantity}
                                                                                disabled={accepted === 0}
                                                                                onChange={(e) => updatePalletSplit(row.asn_shipment_item_id, index, "quantity", Number(e.target.value || 0))}
                                                                                onKeyDown={(e) => {
                                                                                    if (e.key === "Enter") {
                                                                                        e.preventDefault();
                                                                                        if (computedAllocated >= accepted) {
                                                                                            // This SKU is done, move to next SKU or next button
                                                                                            const currentIdx = grnRows.findIndex(r => r.asn_shipment_item_id === row.asn_shipment_item_id);
                                                                                            const nextAllocatableRow = grnRows.slice(currentIdx + 1).find(r => (Number(r.accepted_quantity) || 0) > 0);
                                                                                            if (nextAllocatableRow) {
                                                                                                palletInputRefs.current[`${nextAllocatableRow.asn_shipment_item_id}-0`]?.focus();
                                                                                            } else {
                                                                                                nextButtonRef.current?.focus();
                                                                                            }
                                                                                        } else {
                                                                                            // Need more splits for this SKU
                                                                                            addPalletButtonRefs.current[row.asn_shipment_item_id]?.focus();
                                                                                        }
                                                                                    }
                                                                                }}
                                                                                className="h-10 text-center font-medium bg-muted/30 border-muted-foreground/10"
                                                                                placeholder="Qty"
                                                                            />
                                                                            <Button
                                                                                type="button"
                                                                                variant="ghost"
                                                                                size="icon"
                                                                                disabled={row.pallet_splits.length === 1 || accepted === 0}
                                                                                onClick={() => removePalletSplit(row.asn_shipment_item_id, index)}
                                                                                className={cn(
                                                                                    "h-10 w-10 transition-colors",
                                                                                    (row.pallet_splits.length === 1 || accepted === 0)
                                                                                        ? "opacity-30 cursor-not-allowed"
                                                                                        : "text-destructive/60 hover:text-destructive hover:bg-destructive/10"
                                                                                )}
                                                                            >
                                                                                <Trash2 className="h-4 w-4" />
                                                                            </Button>
                                                                        </div>
                                                                    ))}

                                                                    <Button
                                                                        type="button"
                                                                        ref={(el) => (addPalletButtonRefs.current[row.asn_shipment_item_id] = el)}
                                                                        variant="ghost"
                                                                        className="w-full border border-dashed h-10 text-primary hover:bg-primary/5 hover:text-primary transition-all mt-2"
                                                                        onClick={() => addPalletSplit(row.asn_shipment_item_id)}
                                                                        disabled={accepted === 0}
                                                                    >
                                                                        <Plus className="h-4 w-4 mr-2" /> Add Pallet
                                                                    </Button>
                                                                </div>

                                                                {!isMatched && row.pallet_splits.length > 0 && (
                                                                    <p className={`text-xs flex items-center gap-1 mt-2 ${isMore ? 'text-destructive' : 'text-amber-500'}`}>
                                                                        <AlertTriangle className="h-3 w-3" /> Total must match accepted quantity
                                                                    </p>
                                                                )}
                                                                {row.pallet_splits.some(s => !s.pallet_barcode) && (
                                                                    <p className="text-xs text-destructive flex items-center gap-1 mt-1">
                                                                        <AlertTriangle className="h-3 w-3" /> Pallet barcode required
                                                                    </p>
                                                                )}
                                                                {row.pallet_splits.some(s => Number(s.quantity) <= 0) && (
                                                                    <p className="text-xs text-destructive flex items-center gap-1 mt-1">
                                                                        <AlertTriangle className="h-3 w-3" /> Quantity must be greater than 0
                                                                    </p>
                                                                )}
                                                            </div>
                                                        </>
                                                    );
                                                })()}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}

                            {currentGrnStep === 3 && (
                                <div className="rounded-xl border bg-card overflow-hidden">
                                    <div className="p-4 border-b bg-muted/30 flex justify-between items-center">
                                        <div>
                                            <h3 className="font-semibold text-lg">Handle rejection and shortage</h3>
                                            <p className="text-sm text-muted-foreground">Track discrepancies between expected and received items</p>
                                        </div>
                                    </div>
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead className="w-[280px]">Item</TableHead>
                                                <TableHead className="w-[120px]">Qty</TableHead>
                                                <TableHead className="w-[250px]">Reject Pallet</TableHead>
                                                <TableHead>Notes</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {grnRows.filter(row => Number(row.received_quantity) < toNumber(row.expected_quantity) || (Number(row.rejected_quantity) || 0) > 0).length === 0 ? (
                                                <TableRow>
                                                    <TableCell colSpan={4} className="text-center py-6 text-muted-foreground">
                                                        No shortages or rejections found.
                                                    </TableCell>
                                                </TableRow>
                                            ) : (
                                                grnRows.flatMap((row) => {
                                                    const rows = [];
                                                    const expected = toNumber(row.expected_quantity);
                                                    const received = Number(row.received_quantity) || 0;
                                                    const rejected = Number(row.rejected_quantity) || 0;

                                                    if (received < expected) {
                                                        rows.push(
                                                            <TableRow key={`${row.asn_shipment_item_id}-shortage`}>
                                                                <TableCell>
                                                                    <div className="font-medium">{row.sku}</div>
                                                                    <div className="text-xs text-muted-foreground truncate max-w-[220px]">{row.description}</div>
                                                                    <Badge variant="outline" className="mt-1 text-orange-600 border-orange-200 bg-orange-50">Shortage</Badge>
                                                                </TableCell>
                                                                <TableCell>
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="text-orange-600 font-medium">{expected - received}</span>
                                                                    </div>
                                                                </TableCell>
                                                                <TableCell className="bg-muted/10">—</TableCell>
                                                                <TableCell>
                                                                    <Input
                                                                        ref={(el) => (noteRefs.current[`${row.asn_shipment_item_id}-shortage`] = el)}
                                                                        value={row.shortage_note || ""}
                                                                        onChange={(e) => updateGrnRow(row.asn_shipment_item_id, "shortage_note", e.target.value)}
                                                                        onKeyDown={(e) => {
                                                                            if (e.key === "Enter") {
                                                                                e.preventDefault();
                                                                                if (rejected > 0) {
                                                                                    rejectionPalletRefs.current[row.asn_shipment_item_id]?.focus();
                                                                                } else {
                                                                                    // Move to next item in the list
                                                                                    const currentRows = grnRows.filter(r => Number(r.received_quantity) < toNumber(r.expected_quantity) || (Number(r.rejected_quantity) || 0) > 0);
                                                                                    const currentIdx = currentRows.findIndex(r => r.asn_shipment_item_id === row.asn_shipment_item_id);
                                                                                    const nextRow = currentRows[currentIdx + 1];

                                                                                    if (nextRow) {
                                                                                        const nextHasShortage = Number(nextRow.received_quantity) < toNumber(nextRow.expected_quantity);
                                                                                        if (nextHasShortage) {
                                                                                            noteRefs.current[`${nextRow.asn_shipment_item_id}-shortage`]?.focus();
                                                                                        } else {
                                                                                            rejectionPalletRefs.current[nextRow.asn_shipment_item_id]?.focus();
                                                                                        }
                                                                                    } else {
                                                                                        nextButtonRef.current?.focus();
                                                                                    }
                                                                                }
                                                                            }
                                                                        }}
                                                                        placeholder="Reason for shortage (Required)"
                                                                        className={!String(row.shortage_note ?? "").trim() ? "border-destructive/50" : ""}
                                                                    />
                                                                </TableCell>
                                                            </TableRow>
                                                        );
                                                    }

                                                    if (rejected > 0) {
                                                        rows.push(
                                                            <TableRow key={`${row.asn_shipment_item_id}-rejection`}>
                                                                <TableCell>
                                                                    <div className="font-medium">{row.sku}</div>
                                                                    <div className="text-xs text-muted-foreground truncate max-w-[220px]">{row.description}</div>
                                                                    <Badge variant="outline" className="mt-1 text-destructive border-destructive/30 bg-destructive/10">Rejection</Badge>
                                                                </TableCell>
                                                                <TableCell>
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="text-destructive font-medium">{rejected}</span>
                                                                    </div>
                                                                </TableCell>
                                                                <TableCell>
                                                                    <Select
                                                                        value={row.reject_pallet_barcode || commonRejectPalletBarcode}
                                                                        onValueChange={(val) => {
                                                                            updateGrnRow(row.asn_shipment_item_id, "reject_pallet_barcode", val);
                                                                            // Move focus to notes field after selection
                                                                            setTimeout(() => {
                                                                                noteRefs.current[`${row.asn_shipment_item_id}-rejection`]?.focus();
                                                                            }, 100);
                                                                        }}
                                                                    >
                                                                        <SelectTrigger
                                                                            ref={(el) => (rejectionPalletRefs.current[row.asn_shipment_item_id] = el)}
                                                                            className="h-10 border-destructive/30 focus:ring-destructive/30"
                                                                        >
                                                                            <SelectValue placeholder="Select pallet" />
                                                                        </SelectTrigger>
                                                                        <SelectContent>
                                                                            {rejectedPalletOptions.map((opt) => (
                                                                                <SelectItem key={opt.id} value={toPalletOptionValue(opt)}>
                                                                                    {toPalletOptionLabel(opt)}
                                                                                </SelectItem>
                                                                            ))}
                                                                        </SelectContent>
                                                                    </Select>
                                                                </TableCell>
                                                                <TableCell>
                                                                    <Input
                                                                        ref={(el) => (noteRefs.current[`${row.asn_shipment_item_id}-rejection`] = el)}
                                                                        value={row.rejection_note || ""}
                                                                        onChange={(e) => updateGrnRow(row.asn_shipment_item_id, "rejection_note", e.target.value)}
                                                                        onKeyDown={(e) => {
                                                                            if (e.key === "Enter") {
                                                                                e.preventDefault();
                                                                                // Find the next item in the rejection/shortage list
                                                                                const currentRows = grnRows.filter(r => Number(r.received_quantity) < toNumber(r.expected_quantity) || (Number(r.rejected_quantity) || 0) > 0);
                                                                                const currentIdx = currentRows.findIndex(r => r.asn_shipment_item_id === row.asn_shipment_item_id);
                                                                                const nextRow = currentRows[currentIdx + 1];

                                                                                if (nextRow) {
                                                                                    const nextHasShortage = Number(nextRow.received_quantity) < toNumber(nextRow.expected_quantity);
                                                                                    if (nextHasShortage) {
                                                                                        noteRefs.current[`${nextRow.asn_shipment_item_id}-shortage`]?.focus();
                                                                                    } else {
                                                                                        rejectionPalletRefs.current[nextRow.asn_shipment_item_id]?.focus();
                                                                                    }
                                                                                } else {
                                                                                    nextButtonRef.current?.focus();
                                                                                }
                                                                            }
                                                                        }}
                                                                        placeholder="Reason for rejection"
                                                                    />
                                                                </TableCell>
                                                            </TableRow>
                                                        );
                                                    }

                                                    return rows;
                                                })
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>
                            )}

                            {currentGrnStep === 4 && (
                                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                    {/* Section 1: Top Banner */}
                                    {selected && (
                                        <div className="bg-primary/5 border border-primary/20 rounded-xl p-5 flex flex-wrap gap-8 items-center justify-between shadow-sm">
                                            <div className="space-y-1">
                                                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">ASN Information</p>
                                                <h3 className="font-bold text-lg text-primary">{selected.asnNumber || "-"}</h3>
                                            </div>
                                            <div className="flex gap-8">
                                                <div className="space-y-1">
                                                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Pallet Source</p>
                                                    <p className="font-semibold text-sm">{selected.supplierName || "-"}</p>
                                                </div>
                                                <div className="space-y-1">
                                                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Accepted Type</p>
                                                    <Badge variant="outline" className="text-[10px] uppercase bg-green-50 text-green-700 border-green-200">standard type</Badge>
                                                </div>
                                                <div className="space-y-1">
                                                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Reject Type</p>
                                                    <Badge variant="outline" className="text-[10px] uppercase bg-red-50 text-red-700 border-red-200">rejected type</Badge>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Section 2 & 3: Item Details */}
                                    <div className="space-y-4">
                                        {grnRows.map((row, index) => {
                                            const expected = toNumber(row.expected_quantity);
                                            const received = Number(row.received_quantity) || 0;
                                            const accepted = Number(row.accepted_quantity) || 0;
                                            const rejected = Number(row.rejected_quantity) || 0;
                                            const progress = expected > 0 ? Math.min(100, Math.round((received / expected) * 100)) : 0;

                                            const acceptedPallets = row.pallet_splits
                                                .map(s => s.pallet_barcode)
                                                .filter(Boolean)
                                                .join(", ");

                                            const rejectPallet = row.reject_pallet_barcode || commonRejectPalletBarcode;

                                            return (
                                                <Card key={row.asn_shipment_item_id} className="overflow-hidden border-muted-foreground/10 shadow-md hover:shadow-lg transition-shadow duration-300">
                                                    <div className="bg-muted/30 px-6 py-3 border-b flex justify-between items-center">
                                                        <div className="flex items-center gap-3">
                                                            <div className="bg-background w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border shadow-sm">
                                                                {index + 1}
                                                            </div>
                                                            <div>
                                                                <h4 className="font-bold text-base">{row.sku}</h4>
                                                                <p className="text-xs text-muted-foreground">{row.description}</p>
                                                            </div>
                                                        </div>
                                                        <Badge variant="secondary" className="text-[10px] font-bold">
                                                            Item {index + 1} of {grnRows.length}
                                                        </Badge>
                                                    </div>

                                                    <CardContent className="p-6 space-y-8">
                                                        {/* Fulfillment Progress */}
                                                        <div className="space-y-2">
                                                            <div className="flex justify-between items-end">
                                                                <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Fulfillment Progress</p>
                                                                <p className="text-sm font-bold text-primary">{progress}%</p>
                                                            </div>
                                                            <div className="h-2.5 w-full bg-muted rounded-full overflow-hidden border">
                                                                <div
                                                                    className="h-full bg-primary transition-all duration-1000 ease-out rounded-full"
                                                                    style={{ width: `${progress}%` }}
                                                                />
                                                            </div>
                                                        </div>

                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                                            {/* Quantity Summary */}
                                                            <div className="space-y-4">
                                                                <div className="flex items-center gap-2 border-b pb-2">
                                                                    <div className="bg-blue-50 p-1.5 rounded-md">
                                                                        <BarChart3 className="w-3.5 h-3.5 text-blue-600" />
                                                                    </div>
                                                                    <h5 className="text-xs font-bold uppercase tracking-wider">Quantity Summary</h5>
                                                                </div>
                                                                <div className="grid grid-cols-2 gap-y-3 gap-x-4">
                                                                    <div className="space-y-0.5">
                                                                        <p className="text-[10px] text-muted-foreground font-semibold">Expected Quantity</p>
                                                                        <p className="font-bold text-sm">{expected.toFixed(3)}</p>
                                                                    </div>
                                                                    <div className="space-y-0.5">
                                                                        <p className="text-[10px] text-muted-foreground font-semibold">Received Quantity</p>
                                                                        <p className="font-bold text-sm">{received}</p>
                                                                    </div>
                                                                    <div className="space-y-0.5">
                                                                        <p className="text-[10px] text-muted-foreground font-semibold">Accepted Quantity</p>
                                                                        <p className="font-bold text-sm text-green-600">{accepted}</p>
                                                                    </div>
                                                                    <div className="space-y-0.5">
                                                                        <p className="text-[10px] text-muted-foreground font-semibold">Rejected Quantity</p>
                                                                        <p className="font-bold text-sm text-red-600">{rejected}</p>
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            {/* Pallet Allocation */}
                                                            <div className="space-y-4">
                                                                <div className="flex items-center gap-2 border-b pb-2">
                                                                    <div className="bg-amber-50 p-1.5 rounded-md">
                                                                        <Truck className="w-3.5 h-3.5 text-amber-600" />
                                                                    </div>
                                                                    <h5 className="text-xs font-bold uppercase tracking-wider">Pallet Allocation</h5>
                                                                </div>
                                                                <div className="space-y-3">
                                                                    <div className="flex justify-between items-start border-b border-dashed pb-2">
                                                                        <p className="text-[10px] text-muted-foreground font-semibold">Accepted Pallets</p>
                                                                        <p className="font-bold text-xs text-right max-w-[150px] truncate" title={acceptedPallets}>
                                                                            {acceptedPallets || "—"}
                                                                        </p>
                                                                    </div>
                                                                    <div className="flex justify-between items-center border-b border-dashed pb-2">
                                                                        <p className="text-[10px] text-muted-foreground font-semibold">Accepted Pallet Splits</p>
                                                                        <p className="font-bold text-xs">{row.pallet_splits.length}</p>
                                                                    </div>
                                                                    <div className="flex justify-between items-center">
                                                                        <p className="text-[10px] text-muted-foreground font-semibold">Reject Pallet</p>
                                                                        <p className="font-bold text-xs text-red-600">{rejectPallet || "—"}</p>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* Notes */}
                                                        {(row.shortage_note || row.rejection_note) && (
                                                            <div className="space-y-4 bg-muted/20 p-4 rounded-xl border border-dashed border-muted-foreground/20">
                                                                <div className="flex items-center gap-2">
                                                                    <MessageSquare className="w-3.5 h-3.5 text-muted-foreground" />
                                                                    <h5 className="text-xs font-bold uppercase tracking-wider">Additional Notes</h5>
                                                                </div>
                                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                                    {row.shortage_note && (
                                                                        <div className="space-y-1">
                                                                            <p className="text-[10px] text-muted-foreground font-semibold italic">Shortage Note:</p>
                                                                            <p className="text-sm bg-background p-2 rounded border">{row.shortage_note}</p>
                                                                        </div>
                                                                    )}
                                                                    {row.rejection_note && (
                                                                        <div className="space-y-1">
                                                                            <p className="text-[10px] text-muted-foreground font-semibold italic">Rejection Notes:</p>
                                                                            <p className="text-sm bg-background p-2 rounded border text-red-600">{row.rejection_note}</p>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </CardContent>
                                                </Card>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="px-6 py-4 border-t flex items-center justify-between gap-3 shrink-0">
                            <Button type="button" variant="outline" disabled>
                                Save draft
                            </Button>
                            <div className="flex items-center gap-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => setCurrentGrnStep((prev) => (prev > 1 ? ((prev - 1) as 1 | 2 | 3 | 4) : prev))}
                                    disabled={currentGrnStep === 1 || isCreatingGrn}
                                >
                                    Back
                                </Button>
                                {currentGrnStep < 4 ? (
                                    <Button
                                        type="button"
                                        ref={nextButtonRef}
                                        onClick={goToNextGrnStep}
                                        disabled={currentGrnStep === 1 && Object.keys(step1Errors).length > 0}
                                        className={cn(currentGrnStep === 1 && Object.keys(step1Errors).length > 0 ? "opacity-50 cursor-not-allowed" : "")}
                                        title={currentGrnStep === 1 && Object.keys(step1Errors).length > 0 ? "Please fix validation errors" : ""}
                                    >
                                        Next
                                    </Button>
                                ) : (
                                    <Button
                                        type="button"
                                        ref={nextButtonRef}
                                        onClick={() => void handleCreateGrn()}
                                        disabled={isCreatingGrn}
                                    >
                                        {isCreatingGrn ? "Creating GRN..." : "Create GRN"}
                                    </Button>
                                )}
                            </div>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default GrnManagerArrived;