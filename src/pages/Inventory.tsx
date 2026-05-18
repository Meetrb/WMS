import { useCallback, useEffect, useMemo, useState } from "react";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Search, MapPin, RefreshCw, PackageSearch, AlertTriangle, Package, Boxes, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { inventoryService } from "@/services/inventoryService";
import type { InventoryDashboard, InventoryItem, InventoryItemDetail } from "@/services/inventoryService";
import { InventoryBinDetailsModal } from "@/components/warehouse/InventoryBinDetailsModal";

// ─── Types ────────────────────────────────────────────────────────────────────

// ─── Helpers ──────────────────────────────────────────────────────────────────

const str = (v: unknown): string => {
    if (v === null || v === undefined || v === "") return "-";
    return String(v);
};

const num = (v: unknown): string => {
    if (v === null || v === undefined) return "-";
    const n = Number(v);
    if (Number.isNaN(n)) return String(v);
    return n.toLocaleString();
};

const resolveField = (item: InventoryItem, ...keys: (keyof InventoryItem | string)[]): unknown => {
    for (const key of keys) {
        const val = (item as Record<string, unknown>)[key];
        if (val !== null && val !== undefined && val !== "") return val;
    }
    return undefined;
};

const resolveDeepField = (source: unknown, keys: string[]): unknown => {
    if (!source || typeof source !== "object") return undefined;

    const targetKeys = new Set(keys.map((k) => k.toLowerCase()));
    const queue: unknown[] = [source];
    const visited = new Set<object>();

    while (queue.length > 0) {
        const current = queue.shift();
        if (!current || typeof current !== "object") continue;
        if (visited.has(current as object)) continue;
        visited.add(current as object);

        if (Array.isArray(current)) {
            for (const entry of current) queue.push(entry);
            continue;
        }

        const record = current as Record<string, unknown>;
        for (const [key, value] of Object.entries(record)) {
            if (
                targetKeys.has(key.toLowerCase()) &&
                value !== null &&
                value !== undefined &&
                value !== ""
            ) {
                return value;
            }

            if (value && typeof value === "object") {
                queue.push(value);
            }
        }
    }

    return undefined;
};

const resolveSku = (item: InventoryItem): string =>
    str(resolveField(item, "sku_code", "sku", "item_sku"));

const resolveDescription = (item: InventoryItem): string =>
    str(resolveField(item, "description", "item_description", "name"));

const resolveQuantity = (item: InventoryItem): string => {
    const value = resolveField(item, "current_quantity", "quantity", "available_quantity", "stock", "qty", "on_hand", "total_on_hand");
    if (value === undefined) {
        console.warn('No quantity field found in item:', item);
    }
    return num(value);
};

const formatLocationValue = (value: unknown): string => {
    if (value === null || value === undefined || value === "") return "";

    if (typeof value === "string" || typeof value === "number") {
        return String(value);
    }

    if (typeof value === "object") {
        const location = value as Record<string, unknown>;
        const preferredKeys = ["warehouse_code", "zone_name", "zone_code", "bin_code", "location"];
        const preferredParts = preferredKeys
            .map((key) => location[key])
            .filter((part) => part !== null && part !== undefined && String(part).trim() !== "")
            .map((part) => String(part));

        if (preferredParts.length > 0) {
            return preferredParts.join(" › ");
        }

        const nonIdParts = Object.entries(location)
            .filter(([key, part]) => !key.toLowerCase().includes("id") && part !== null && part !== undefined && String(part).trim() !== "")
            .map(([key, part]) => `${key.replace(/_/g, " ")}: ${String(part)}`);

        if (nonIdParts.length > 0) {
            return nonIdParts.join(" | ");
        }
    }

    return String(value);
};

const resolveLocation = (item: InventoryItem): string => {
    const parts: string[] = [];
    const zone = resolveField(item, "zone_name", "zone", "warehouse_zone");
    const bin = resolveField(item, "bin_code", "current_bin", "bin", "location", "location_code");
    const zoneText = formatLocationValue(zone);
    const binText = formatLocationValue(bin);

    if (zoneText && zoneText !== "-") parts.push(zoneText);
    if (binText && binText !== "-") parts.push(binText);
    if (parts.length) return parts.join(" › ");

    const deepLocation = resolveDeepField(item, [
        "location",
        "location_code",
        "location_name",
        "bin_code",
        "bin_name",
        "zone_name",
        "zone_code",
        "warehouse_code",
        "warehouse_name",
        "aisle",
        "rack",
        "shelf",
    ]);

    const deepLocationText = formatLocationValue(deepLocation);
    if (deepLocationText && deepLocationText !== "-") return deepLocationText;

    const warehouseText = formatLocationValue(resolveField(item, "warehouse_code", "warehouse"));
    const result = warehouseText || "-";

    if (result === "-") {
        console.warn('No location field found in item:', item);
    }

    return result;
};

const resolveStatus = (item: InventoryItem): string => {
    const value = resolveField(item, "stock_status", "status", "inventory_status", "state");
    const deepValue = value ?? resolveDeepField(item, ["stock_status", "status", "inventory_status", "state", "item_status", "availability"]);
    const result = str(deepValue) || "unknown";

    if (result !== "-" && result.toLowerCase() !== "unknown") {
        return result;
    }

    const qtyRaw = resolveField(item, "current_quantity", "quantity", "available_quantity", "stock", "qty", "on_hand", "total_on_hand");
    const qty = Number(qtyRaw ?? 0);
    if (Number.isFinite(qty)) {
        if (qty <= 0) return "out_of_stock";

        const reorderRaw = resolveField(item, "reorder_level", "reorder_point", "min_quantity", "minimum_quantity");
        const reorder = Number(reorderRaw ?? Number.NaN);
        if (Number.isFinite(reorder) && reorder > 0 && qty <= reorder) return "low_stock";

        return "in_stock";
    }

    if (result === "-" || result === "unknown") {
        console.warn('No status field found in item:', item);
    }

    return result;
};

const resolveItemId = (item: InventoryItem): string =>
    str(resolveField(item, "item_id", "id", "item_master_id"));

const formatNestedValue = (value: unknown): string => {
    if (value === null || value === undefined || value === "") return "";
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
        return String(value);
    }

    if (Array.isArray(value)) {
        const parts = value
            .map((entry) => formatNestedValue(entry))
            .filter((entry) => entry.trim() !== "");
        return parts.join(", ");
    }

    if (typeof value === "object") {
        const objectValue = value as Record<string, unknown>;
        const parts = Object.entries(objectValue)
            .filter(([key]) => !key.toLowerCase().includes("id"))
            .map(([key, entry]) => {
                const formatted = formatNestedValue(entry);
                if (!formatted) return "";
                return `${key.replace(/_/g, " ")}: ${formatted}`;
            })
            .filter((entry) => entry.trim() !== "");

        return parts.join(" | ");
    }

    return String(value);
};

const renderLocation = (location: Record<string, unknown> | string): string => {
    if (typeof location === "string") return location;

    const preferredKeys = ["warehouse_code", "zone_name", "zone_code", "bin_code", "location"];
    const preferredParts = preferredKeys
        .map((key) => location[key])
        .map((value) => formatNestedValue(value))
        .filter((value) => value.trim() !== "");

    if (preferredParts.length > 0) {
        return preferredParts.join(" › ");
    }

    const nonIdParts = Object.entries(location)
        .filter(([key]) => !key.toLowerCase().includes("id"))
        .map(([key, value]) => {
            const formatted = formatNestedValue(value);
            if (!formatted) return "";
            return `${key.replace(/_/g, " ")}: ${formatted}`;
        })
        .filter((value) => value.trim() !== "");

    return nonIdParts.length > 0 ? nonIdParts.join(" | ") : "Location available";
};

interface DetailLocationRow {
    warehouseCode: string;
    warehouseName: string;
    binCode: string;
    zoneName: string;
    aisle: string;
    rack: string;
    shelf: string;
    position: string;
    quantity: string;
    fallbackText: string;
    binId?: string | null;
}

const extractLabeledValue = (text: string, labels: string[]): string => {
    if (!text) return "";
    const lowered = text.toLowerCase();

    for (const label of labels) {
        const key = `${label.toLowerCase()}:`;
        const start = lowered.indexOf(key);
        if (start < 0) continue;

        const valueStart = start + key.length;
        const nextPipe = text.indexOf("|", valueStart);
        const raw = (nextPipe >= 0 ? text.slice(valueStart, nextPipe) : text.slice(valueStart)).trim();
        if (raw) return raw;
    }

    return "";
};

const pickRecordValue = (record: Record<string, unknown>, keys: string[]): string => {
    for (const key of keys) {
        const value = record[key];
        if (value === null || value === undefined) continue;

        if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
            const text = String(value).trim();
            if (text !== "") return text;
            continue;
        }

        if (typeof value === "object") {
            const nested = value as Record<string, unknown>;
            const nestedPreferred = [
                nested.code,
                nested.name,
                nested.label,
                nested.title,
                nested.value,
                nested.number,
                nested.id,
            ];

            for (const nestedValue of nestedPreferred) {
                if (nestedValue === null || nestedValue === undefined) continue;
                const nestedText = String(nestedValue).trim();
                if (nestedText !== "") return nestedText;
            }

            const nestedFormatted = formatNestedValue(nested).trim();
            if (nestedFormatted !== "") return nestedFormatted;
        }
    }
    return "";
};

const toDetailLocationRow = (location: Record<string, unknown> | string): DetailLocationRow => {
    if (typeof location === "string") {
        return {
            warehouseCode: "-",
            warehouseName: "Unknown Warehouse",
            binCode: "-",
            zoneName: "",
            aisle: "",
            rack: "",
            shelf: "",
            position: "",
            quantity: "-",
            fallbackText: location,
        };
    }

    const fallbackText = renderLocation(location);

    const warehouseCode = pickRecordValue(location, ["warehouse_code", "warehouseCode", "warehouse_id"]) ||
        extractLabeledValue(fallbackText, ["warehouse code"]);
    const warehouseName = pickRecordValue(location, ["warehouse_name", "warehouseName", "warehouse_display_name"]) ||
        extractLabeledValue(fallbackText, ["warehouse name"]);
        
    let binId = pickRecordValue(location, ["bin_id", "binId"]);
    if (!binId && typeof location === "object" && location !== null) {
        const loc = location as any;
        binId = loc.bin?.id || loc.bin?.bin_id || loc.location?.bin_id || null;
    }

    const binCode = pickRecordValue(location, ["bin_code", "binCode", "bin", "location_code"]) ||
        extractLabeledValue(fallbackText, ["bin code"]);
    const zoneName = pickRecordValue(location, ["zone_name", "zoneName", "zone", "zone_code", "zoneCode"]);
    const aisle = pickRecordValue(location, ["aisle", "aisle_code", "aisleCode"]) ||
        extractLabeledValue(fallbackText, ["aisle"]);
    const rack = pickRecordValue(location, ["rack", "rack_code", "rackCode"]) ||
        extractLabeledValue(fallbackText, ["rack"]);
    const shelf = pickRecordValue(location, ["shelf", "shelf_code", "shelfCode"]) ||
        extractLabeledValue(fallbackText, ["shelf"]);
    const position = pickRecordValue(location, ["position", "position_code", "positionCode", "slot", "slot_code", "bin_position"]) ||
        extractLabeledValue(fallbackText, ["bin position", "position", "pos"]);
    const quantity = pickRecordValue(location, [
        "quantity",
        "qty",
        "current_quantity",
        "available_quantity",
        "on_hand",
        "total_on_hand",
        "bin_barcode",
        "barcode",
    ]) || extractLabeledValue(fallbackText, ["bin barcode", "quantity", "qty"]);

    return {
        warehouseCode: warehouseCode || "-",
        warehouseName: warehouseName || "Warehouse",
        binCode: binCode || "-",
        zoneName: zoneName || extractLabeledValue(fallbackText, ["zone name", "zone code"]),
        aisle,
        rack,
        shelf,
        position,
        quantity: quantity ? num(quantity) : "-",
        fallbackText,
        binId: binId || null,
    };
};

const normalizeStatus = (raw: string): { label: string; variant: "default" | "secondary" | "destructive" | "outline" } => {
    const s = raw.toLowerCase().replace(/[_\s]+/g, "_");
    if (s === "in_stock" || s === "active" || s === "available") return { label: "In Stock", variant: "default" };
    if (s === "low_stock" || s === "low") return { label: "Low Stock", variant: "secondary" };
    if (s === "out_of_stock" || s === "out" || s === "empty") return { label: "Out of Stock", variant: "destructive" };
    const readable = raw.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    return { label: readable, variant: "outline" };
};

// ─── Dashboard stat card ───────────────────────────────────────────────────────

interface StatCardProps {
    icon: React.ReactNode;
    label: string;
    value: string;
    sub?: string;
}

const StatCard = ({ icon, label, value, sub }: StatCardProps) => (
    <article className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3">
            <div className="rounded-lg bg-primary/10 p-2 text-primary">{icon}</div>
        </div>
        <p className="mt-3 text-2xl font-bold text-card-foreground">{value}</p>
        <p className="mt-0.5 text-sm font-medium text-foreground">{label}</p>
        {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
    </article>
);

// ─── Main component ───────────────────────────────────────────────────────────

const Inventory = () => {
    const [dashboard, setDashboard] = useState<InventoryDashboard | null>(null);
    const [items, setItems] = useState<InventoryItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [detailOpen, setDetailOpen] = useState(false);
    const [detailLoading, setDetailLoading] = useState(false);
    const [detailError, setDetailError] = useState<string | null>(null);
    const [selectedItemDetail, setSelectedItemDetail] = useState<InventoryItemDetail | null>(null);

    const [inventoryBinDetailOpen, setInventoryBinDetailOpen] = useState(false);
    const [selectedBinId, setSelectedBinId] = useState<string | null>(null);

    const groupedDetailLocations = useMemo(() => {
        if (!selectedItemDetail) return [] as Array<{ warehouseKey: string; warehouseLabel: string; rows: DetailLocationRow[] }>;

        const grouped = new Map<string, { warehouseLabel: string; rows: DetailLocationRow[] }>();

        // Support newest API flat bins format
        if (selectedItemDetail.bins && Array.isArray(selectedItemDetail.bins)) {
            selectedItemDetail.bins.forEach((bin: any) => {
                const warehouseCode = bin.location?.warehouse_code || "-";
                // We don't have warehouse_name in the new location object, so we just use the code
                const warehouseName = warehouseCode !== "-" ? `Warehouse ${warehouseCode}` : "Warehouse";
                
                const warehouseKey = `${warehouseCode}__${warehouseName}`;
                const warehouseLabel = warehouseCode !== "-" ? warehouseCode : warehouseName;
                
                const existing = grouped.get(warehouseKey);
                
                const row: DetailLocationRow = {
                    warehouseCode: warehouseCode,
                    warehouseName: warehouseName,
                    binId: bin.bin_id || null, // Keeping this for the click functionality (not displayed to user)
                    binCode: bin.bin_code || "-",
                    zoneName: bin.location?.zone_code || "-",
                    aisle: bin.location?.aisle || "",
                    rack: bin.location?.rack || "",
                    shelf: bin.location?.shelf || "",
                    position: bin.location?.position || "",
                    quantity: bin.quantities?.on_hand ? num(bin.quantities.on_hand) : "-",
                    fallbackText: ""
                };
                
                if (existing) {
                    existing.rows.push(row);
                } else {
                    grouped.set(warehouseKey, {
                        warehouseLabel,
                        rows: [row]
                    });
                }
            });
        }
        // Support older API nested format: warehouses > zones > bins
        else if (selectedItemDetail.warehouses && Array.isArray(selectedItemDetail.warehouses)) {
            selectedItemDetail.warehouses.forEach((warehouse: any) => {
                const warehouseKey = `${warehouse.warehouse_code}__${warehouse.warehouse_name}`;
                const warehouseLabel = warehouse.warehouse_code && warehouse.warehouse_code !== "-"
                    ? `${warehouse.warehouse_code} - ${warehouse.warehouse_name}`
                    : warehouse.warehouse_name;
                
                const rows: DetailLocationRow[] = [];
                
                if (warehouse.zones && Array.isArray(warehouse.zones)) {
                    warehouse.zones.forEach((zone: any) => {
                        if (zone.bins && Array.isArray(zone.bins)) {
                            zone.bins.forEach((bin: any) => {
                                rows.push({
                                    warehouseCode: warehouse.warehouse_code || "-",
                                    warehouseName: warehouse.warehouse_name || "Warehouse",
                                    binId: bin.bin_id || null,
                                    binCode: bin.bin_code || "-",
                                    zoneName: zone.zone_name || zone.zone_code || "-",
                                    aisle: bin.location?.aisle || "",
                                    rack: bin.location?.rack || "",
                                    shelf: bin.location?.shelf || "",
                                    position: bin.location?.position || "",
                                    quantity: bin.total_quantity?.on_hand ? num(bin.total_quantity.on_hand) : "-",
                                    fallbackText: bin.location?.location_path || ""
                                });
                            });
                        }
                    });
                }
                
                if (rows.length > 0) {
                    grouped.set(warehouseKey, {
                        warehouseLabel,
                        rows
                    });
                }
            });
        }
        // Fallback to old flat locations format
        else if (selectedItemDetail.locations && Array.isArray(selectedItemDetail.locations)) {
            const rows = selectedItemDetail.locations.map((location: any) => toDetailLocationRow(location));

            rows.forEach((row) => {
                const key = `${row.warehouseCode}__${row.warehouseName}`;
                const existing = grouped.get(key);
                if (existing) {
                    existing.rows.push(row);
                } else {
                    const warehouseLabel = row.warehouseCode && row.warehouseCode !== "-"
                        ? `${row.warehouseCode} - ${row.warehouseName}`
                        : row.warehouseName;
                    grouped.set(key, {
                        warehouseLabel,
                        rows: [row],
                    });
                }
            });
        }

        return Array.from(grouped.entries()).map(([warehouseKey, data]) => ({
            warehouseKey,
            warehouseLabel: data.warehouseLabel,
            rows: data.rows,
        }));
    }, [selectedItemDetail]);

    const fetchData = useCallback(async (isRefresh = false) => {
        if (isRefresh) setRefreshing(true);
        else setLoading(true);
        setError(null);

        const results = await Promise.allSettled([
            inventoryService.getDashboard(),
            inventoryService.getItems(),
        ]);

        // Dashboard
        if (results[0].status === "fulfilled") {
            setDashboard(results[0].value);
        }

        // Item list
        if (results[1].status === "fulfilled") {
            const fetchedItems = results[1].value;
            setItems(fetchedItems);

            // Debug: log what we received
            if (fetchedItems.length > 0) {
                console.log('Inventory items received:', fetchedItems);
                console.log('First item keys:', Object.keys(fetchedItems[0]));
            }
        }

        const bothFailed =
            results[0].status === "rejected" && results[1].status === "rejected";
        if (bothFailed) {
            const msg =
                results[1].status === "rejected"
                    ? (results[1].reason instanceof Error ? results[1].reason.message : "Failed to load inventory")
                    : "Failed to load inventory";
            setError(msg);
        }

        setLoading(false);
        setRefreshing(false);
    }, []);

    useEffect(() => {
        void fetchData(false);
    }, [fetchData]);

    const openItemDetail = useCallback(async (item: InventoryItem) => {
        const itemId = resolveItemId(item);
        if (itemId === "-") {
            setDetailError("This row has no item identifier, so item detail cannot be loaded.");
            setSelectedItemDetail(null);
            setDetailOpen(true);
            return;
        }

        setDetailOpen(true);
        setDetailLoading(true);
        setDetailError(null);

        try {
            const detail = await inventoryService.getItemDetail(itemId);
            console.log('============= ITEM DETAIL PAYLOAD =============');
            console.log(JSON.stringify(detail, null, 2));
            console.log('================================================');
            setSelectedItemDetail(detail);
        } catch (err) {
            const message = err instanceof Error ? err.message : "Failed to load item detail";
            setSelectedItemDetail(null);
            setDetailError(message);
        } finally {
            setDetailLoading(false);
        }
    }, []);

    // ── derived dashboard stats (exact backend fields requested) ────────────
    const totalSkus = num(dashboard?.total_skus ?? 0);
    const totalQuantityOnHand = num(dashboard?.total_quantity_on_hand ?? 0);
    const totalLocationsUsed = num(dashboard?.total_locations_used ?? 0);
    const itemsNearExpiry = num(dashboard?.items_near_expiry ?? 0);
    const lowStockItems = num(dashboard?.low_stock_items ?? 0);
    const recentPutaways = num(dashboard?.recent_putaways ?? 0);
    const recentPicks = num(dashboard?.recent_picks ?? 0);

    // ── filtered items ───────────────────────────────────────────────────────
    const filteredItems = useMemo(() => {
        if (!searchTerm.trim()) return items;
        const q = searchTerm.toLowerCase();
        return items.filter((item) => {
            return (
                resolveSku(item).toLowerCase().includes(q) ||
                resolveDescription(item).toLowerCase().includes(q) ||
                resolveLocation(item).toLowerCase().includes(q)
            );
        });
    }, [items, searchTerm]);

    // ── Loading state ─────────────────────────────────────────────────────────
    if (loading) {
        return (
            <div className="p-6 space-y-6 animate-in fade-in duration-500">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <h2 className="text-3xl font-heading font-bold tracking-tight">Inventory</h2>
                        <p className="text-muted-foreground">Manage stock levels, locations, and movements.</p>
                    </div>
                </div>
                <div className="flex items-center justify-center py-20">
                    <div className="flex items-center gap-3 rounded-xl bg-card px-6 py-4 border border-border shadow-sm">
                        <span className="h-5 w-5 rounded-full border-2 border-border border-t-primary animate-spin" />
                        <p className="text-foreground font-medium">Loading inventory...</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="p-6 space-y-6 animate-in fade-in duration-500">
            {/* ── Header ── */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-heading font-bold tracking-tight">Inventory</h2>
                    <p className="text-muted-foreground">Stock levels, locations, and movements.</p>
                </div>
                <Button
                    variant="outline"
                    onClick={() => void fetchData(true)}
                    disabled={refreshing}
                    className="gap-2"
                >
                    <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
                    {refreshing ? "Refreshing…" : "Refresh"}
                </Button>
            </div>

            {/* ── Error banner ── */}
            {error && (
                <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    {error}
                </div>
            )}

            {/* ── Dashboard KPI cards ── */}
            {dashboard && (
                <section className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
                    <StatCard
                        icon={<Boxes className="w-5 h-5" />}
                        label="Total SKUs"
                        value={totalSkus}
                    />
                    <StatCard
                        icon={<Package className="w-5 h-5" />}
                        label="Total Quantity On Hand"
                        value={totalQuantityOnHand}
                    />
                    <StatCard
                        icon={<MapPin className="w-5 h-5" />}
                        label="Total Locations Used"
                        value={totalLocationsUsed}
                    />
                    <StatCard
                        icon={<AlertTriangle className="w-5 h-5" />}
                        label="Items Near Expiry"
                        value={itemsNearExpiry}
                    />
                    <StatCard
                        icon={<PackageSearch className="w-5 h-5" />}
                        label="Low Stock Items"
                        value={lowStockItems}
                    />
                    <StatCard
                        icon={<BarChart3 className="w-5 h-5" />}
                        label="Recent Putaways"
                        value={recentPutaways}
                    />
                    <StatCard
                        icon={<RefreshCw className="w-5 h-5" />}
                        label="Recent Picks"
                        value={recentPicks}
                    />
                </section>
            )}

            {/* ── Item list ── */}
            <Card>
                <CardHeader className="pb-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <CardTitle className="flex items-center gap-2">
                            <PackageSearch className="w-5 h-5 text-primary" />
                            Current Stock
                            {items.length > 0 && (
                                <span className="ml-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                                    {filteredItems.length}{filteredItems.length !== items.length && ` / ${items.length}`}
                                </span>
                            )}
                        </CardTitle>
                        <div className="relative w-full max-w-sm">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                type="search"
                                placeholder="Search SKU, description, or location…"
                                className="pl-8"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    {filteredItems.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-center">
                            <PackageSearch className="w-12 h-12 text-muted-foreground/40 mb-3" />
                            <p className="font-medium text-foreground">
                                {items.length === 0 ? "No inventory data found" : "No items match your search"}
                            </p>
                            <p className="text-sm text-muted-foreground mt-1">
                                {items.length === 0
                                    ? "The API returned an empty list."
                                    : "Try a different search term."}
                            </p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>SKU</TableHead>
                                        <TableHead>Description</TableHead>
                                        <TableHead>Location</TableHead>
                                        <TableHead className="text-right">Quantity</TableHead>
                                        <TableHead>Status</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredItems.map((item, idx) => {
                                        const itemId = resolveItemId(item);
                                        const sku = resolveSku(item);
                                        const description = resolveDescription(item);
                                        const quantity = resolveQuantity(item);
                                        const location = resolveLocation(item);
                                        const rawStatus = resolveStatus(item);
                                        const { label: statusLabel, variant: statusVariant } = rawStatus !== "-"
                                            ? normalizeStatus(rawStatus)
                                            : { label: "-", variant: "outline" as const };
                                        const rowKey = str(item.id) !== "-" ? str(item.id) : `${sku}-${idx}`;

                                        return (
                                            <TableRow
                                                key={rowKey}
                                                className="cursor-pointer"
                                                tabIndex={0}
                                                role="button"
                                                onClick={() => void openItemDetail(item)}
                                                onKeyDown={(event) => {
                                                    if (event.key === "Enter" || event.key === " ") {
                                                        event.preventDefault();
                                                        void openItemDetail(item);
                                                    }
                                                }}
                                            >
                                                <TableCell className="font-mono text-sm font-medium">{sku}</TableCell>
                                                <TableCell>
                                                    <div className="flex flex-col gap-0.5">
                                                        <span className="font-medium">{description}</span>
                                                        {itemId === "-" ? (
                                                            <span className="text-xs text-amber-600 dark:text-amber-400">Missing item ID in list row</span>
                                                        ) : null}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    {location !== "-" ? (
                                                        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                                                            <MapPin className="w-3 h-3 shrink-0" />
                                                            {location}
                                                        </div>
                                                    ) : (
                                                        <span className="text-muted-foreground">-</span>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-right font-medium tabular-nums">
                                                    {quantity}
                                                </TableCell>
                                                <TableCell>
                                                    {rawStatus !== "-" ? (
                                                        <Badge variant={statusVariant}>{statusLabel}</Badge>
                                                    ) : (
                                                        <span className="text-muted-foreground text-sm">-</span>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>

            <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
                <DialogContent className="w-[96vw] sm:max-w-6xl p-0 gap-0 overflow-hidden">
                    <DialogHeader className="px-5 py-4 border-b border-border/70 bg-muted/10">
                        <DialogTitle>Item Detail</DialogTitle>
                    </DialogHeader>

                    {detailLoading ? (
                        <div className="m-5 flex items-center gap-3 rounded-xl bg-card px-4 py-3 border border-border">
                            <span className="h-4 w-4 rounded-full border-2 border-border border-t-primary animate-spin" />
                            <p className="text-sm text-foreground">Loading item details...</p>
                        </div>
                    ) : detailError ? (
                        <div className="m-5 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                            {detailError}
                        </div>
                    ) : selectedItemDetail ? (
                        <div className="px-5 py-4 space-y-4">
                            <div className="rounded-xl border border-border bg-card/60 px-4 py-3">
                                <div className="flex flex-wrap items-center gap-3">
                                    <span className="rounded-lg border border-border bg-muted/30 px-3 py-1.5 text-sm font-semibold">
                                        {selectedItemDetail.item?.item_sku || selectedItemDetail.item_sku}
                                    </span>
                                    {selectedItemDetail.item?.category && (
                                        <Badge variant="outline" className="text-xs">{selectedItemDetail.item.category}</Badge>
                                    )}
                                    <div className="min-w-0 flex-1">
                                        <p className="text-xl font-semibold leading-tight truncate">{selectedItemDetail.item?.item_description || selectedItemDetail.item_description}</p>
                                        <p className="text-sm text-muted-foreground">
                                            {selectedItemDetail.item?.uom ? `UOM: ${selectedItemDetail.item.uom}` : "Item detail"}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                <div className="rounded-lg border border-border bg-card p-3">
                                    <p className="text-sm font-medium text-muted-foreground">On hand</p>
                                    <p className="mt-1 text-4xl font-semibold leading-none text-foreground">{num(selectedItemDetail.summary?.on_hand ?? selectedItemDetail.summary?.total_on_hand ?? selectedItemDetail.total_on_hand)}</p>
                                </div>
                                <div className="rounded-lg border border-border bg-card p-3">
                                    <p className="text-sm font-medium text-muted-foreground">Reserved / Allocated</p>
                                    <p className="mt-1 text-4xl font-semibold leading-none text-foreground">
                                        {num(selectedItemDetail.summary?.reserved ?? selectedItemDetail.summary?.total_reserved ?? selectedItemDetail.total_reserved)}
                                        {selectedItemDetail.summary?.allocated ? <span className="text-xl text-muted-foreground ml-1">/ {num(selectedItemDetail.summary.allocated)}</span> : null}
                                    </p>
                                </div>
                                <div className="rounded-lg border border-border bg-card p-3">
                                    <p className="text-sm font-medium text-muted-foreground">Available</p>
                                    <p className="mt-1 text-4xl font-semibold leading-none text-foreground">{num(selectedItemDetail.summary?.available ?? selectedItemDetail.summary?.total_available ?? selectedItemDetail.total_available)}</p>
                                </div>
                                <div className="rounded-lg border border-border bg-card p-3">
                                    <p className="text-sm font-medium text-muted-foreground">In transit</p>
                                    <p className="mt-1 text-4xl font-semibold leading-none text-foreground">{num(selectedItemDetail.summary?.in_transit ?? selectedItemDetail.summary?.total_in_transit ?? selectedItemDetail.total_in_transit)}</p>
                                </div>
                            </div>

                            <div className="rounded-xl border border-border bg-card/40 overflow-hidden">
                                <div className="flex items-center justify-between px-4 py-3 border-b border-border/70">
                                    <p className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Locations</p>
                                    <p className="text-sm font-semibold text-muted-foreground">
                                        {num(selectedItemDetail.summary?.total_bins ?? selectedItemDetail.location_count)} bins · {groupedDetailLocations.length} warehouses
                                    </p>
                                </div>

                                {groupedDetailLocations.length === 0 ? (
                                    <p className="px-4 py-3 text-sm text-muted-foreground">No locations returned.</p>
                                ) : (
                                    <div className="max-h-[48vh] overflow-auto px-3 py-3 space-y-3">
                                        {groupedDetailLocations.map((group) => (
                                            <div key={group.warehouseKey} className="rounded-lg border border-border/70 bg-muted/10 p-3 space-y-2">
                                                <div className="flex items-center justify-between gap-2">
                                                    <p className="text-sm font-semibold">{group.warehouseLabel}</p>
                                                    <span className="rounded-full border border-border px-2 py-0.5 text-xs font-medium text-muted-foreground">
                                                        {group.rows.length} {group.rows.length === 1 ? "bin" : "bins"}
                                                    </span>
                                                </div>

                                                <div className="space-y-2">
                                                    {group.rows.map((row, idx) => (
                                                        <div
                                                            key={`${group.warehouseKey}-${idx}`}
                                                            className={`rounded-lg border border-border/80 bg-card/40 px-3 py-2 ${row.binId ? 'cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors group' : ''}`}
                                                            onClick={() => {
                                                                if (row.binId) {
                                                                    setSelectedBinId(row.binId);
                                                                    setInventoryBinDetailOpen(true);
                                                                }
                                                            }}
                                                        >
                                                            <div className="flex items-start justify-between gap-2">
                                                                <div className="min-w-0">
                                                                    {row.zoneName ? (
                                                                        <span className="inline-flex items-center rounded-full border border-border px-2 py-0.5 text-xs font-medium text-muted-foreground group-hover:border-primary/30">
                                                                            {row.zoneName}
                                                                        </span>
                                                                    ) : null}
                                                                    <p className={`mt-1 font-semibold truncate ${row.binId ? 'group-hover:text-primary transition-colors' : ''}`}>{row.binCode}</p>
                                                                </div>
                                                                <p className="text-sm font-semibold text-muted-foreground shrink-0">{row.quantity}</p>
                                                            </div>

                                                            {row.aisle || row.rack || row.shelf || row.position ? (
                                                                <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                                                                    {row.aisle ? <span>Aisle {row.aisle}</span> : null}
                                                                    {row.rack ? <span>Rack {row.rack}</span> : null}
                                                                    {row.shelf ? <span>Shelf {row.shelf}</span> : null}
                                                                    {row.position ? <span>Pos {row.position}</span> : null}
                                                                </div>
                                                            ) : (
                                                                <p className="mt-1 text-xs text-muted-foreground break-words">{row.fallbackText}</p>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <p className="px-5 py-4 text-sm text-muted-foreground">Select an item to view details.</p>
                    )}
                </DialogContent>
            </Dialog>

            <InventoryBinDetailsModal
                open={inventoryBinDetailOpen}
                setOpen={setInventoryBinDetailOpen}
                binId={selectedBinId}
            />
        </div>
    );
};

export default Inventory;
