import { useState, useEffect, useMemo, useRef } from "react";
import {
    Package, Search, Eye, Edit2, Loader2, ChevronLeft, ChevronRight,
    Filter, ToggleLeft, ToggleRight, Info, Ruler, Box, ShieldAlert,
    Settings2, X, RefreshCw, Plus, LayoutList,
} from "lucide-react";
import { toast } from "sonner";
import { skuService } from "@/services/skuService";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UomSelect } from "@/components/ui/uom-select";
import { ZoneTypeSelect } from "@/components/warehouse/ZoneTypeSelect";
import { BinTypeSelect } from "@/components/warehouse/BinTypeSelect";

// ─── Types ──────────────────────────────────────────────────────────────────

const ITEM_CATEGORIES = [
    { value: "PERISHABLE", label: "Perishable" },
    { value: "FROZEN_GOODS", label: "Frozen Goods" },
    { value: "DANGEROUS_GOODS", label: "Dangerous Goods" },
    { value: "BULK_GOODS", label: "Bulk Goods" },
    { value: "FAST_MOVING", label: "Fast Moving" },
    { value: "RETURNED", label: "Returned" },
    { value: "HIGH_VALUE_GOODS", label: "High Value Goods" },
    { value: "OVERSIZE_GOODS", label: "Oversize Goods" },
    { value: "GENERAL", label: "General" },
    { value: "INBOUND_OUTBOUND", label: "Inbound / Outbound" },
];

interface SkuItem {
    id: string | number;
    skuCode: string;
    description: string;
    shortDescription: string;
    primaryBarcode: string;
    baseUom: string;
    itemType: string;
    itemCategory: string;
    storageCondition: string;
    velocityClass: string;
    weightKg: number;
    lengthCm: number;
    widthCm: number;
    heightCm: number;
    volumeCc: number;
    palletQuantity: number;
    caseQuantity: number;
    innerQuantity: number;
    preferredZones: string[];
    preferredBinTypes: string[];
    pickingStrategy: string;
    hsnCode: string;
    taxRate: number;
    isHazardous: boolean;
    active: boolean;
    created_at?: string;
    updated_at?: string;
}

interface EditSkuForm {
    sku_code: string;
    description: string;
    short_description: string;
    primary_barcode: string;
    alt_barcodes: string;
    rfid_tag: string;
    base_uom: string;
    alt_uom: string;
    uom_conversion: string;
    uom_hierarchy_1: string;
    uom_hierarchy_2: string;
    uom_hierarchy_3: string;
    length_cm: string;
    width_cm: string;
    height_cm: string;
    weight_kg: string;
    volume_cc: string;
    pallet_quantity: string;
    case_quantity: string;
    inner_quantity: string;
    item_type: string;
    item_category: string;
    storage_condition: string;
    velocity_class: string;
    fefo_enabled: boolean;
    fifo_enabled: boolean;
    shelf_life_days: string;
    expiry_required: boolean;
    lot_required: boolean;
    batch_required: boolean;
    serial_required: boolean;
    pick_face_eligible: boolean;
    pick_face_capacity: string;
    pick_face_replenishment_point: string;
    preferred_zones: string;
    preferred_bin_types: string;
    picking_strategy: string;
    max_stack_height: string;
    max_qty_per_bin: string;
    compatibility_rules_keys: string;
    is_hazardous: boolean;
    hazard_class: string;
    hazmat_code: string;
    requires_inspection: boolean;
    inspection_rule: string;
    sample_percentage: string;
    quarantine_on_failure: boolean;
    hsn_code: string;
    tax_rate: string;
    velocity_score: string;
    pick_frequency: string;
    active: boolean;
    created_by: string;
    updated_by: string;
    created_at: string;
    updated_at: string;
}

interface CreateSkuForm {
    sku_code: string;
    description: string;
    short_description: string;
    primary_barcode: string;
    alt_barcodes: string;
    item_category: string;
    base_uom: string;
    alt_uom: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const val = (v: any, unit = "") =>
    v !== undefined && v !== null && v !== 0 && v !== ""
        ? `${v}${unit}`
        : "—";

// ─── Info row for detail modal ─────────────────────────────────────────────

const DRow = ({ label, value }: { label: string; value?: any }) => (
    <div className="flex flex-col gap-0.5 py-1">
        <span className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">{label}</span>
        <span className="text-sm font-medium">{value ?? "—"}</span>
    </div>
);

const DSep = ({ title, icon }: { title: string; icon: React.ReactNode }) => (
    <div className="flex items-center gap-2 pt-4 pb-1 border-b">
        <span className="text-primary">{icon}</span>
        <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{title}</span>
    </div>
);

// ─── View Modal ──────────────────────────────────────────────────────────────

const SkuViewModal = ({ sku, open, onClose }: { sku: SkuItem | null; open: boolean; onClose: () => void }) => {
    if (!sku) return null;
    return (
        <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
            <DialogContent className="max-w-3xl overflow-hidden p-0 flex flex-col max-h-[92vh]">
                <div className="p-6 pb-4 border-b shrink-0 bg-background">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-xl font-heading">
                            <Package className="h-5 w-5 text-primary" />
                            {sku.skuCode}
                            <Badge 
                                variant="outline"
                                className={`ml-2 text-[10px] font-bold uppercase gap-1.5 px-3 py-1 border-none ${
                                    sku.active 
                                        ? "bg-green-500/10 text-green-600" 
                                        : "bg-red-500/10 text-red-600"
                                }`}
                            >
                                <div className={`h-1.5 w-1.5 rounded-full ${sku.active ? "bg-green-600" : "bg-red-600"}`} />
                                {sku.active ? "Active" : "Inactive"}
                            </Badge>
                        </DialogTitle>
                        <DialogDescription className="text-sm text-muted-foreground">{sku.description}</DialogDescription>
                    </DialogHeader>
                </div>

                <div className="flex-1 overflow-y-auto px-6 pb-6 bg-background/50">
                    <Tabs defaultValue="basic" className="pt-4">
                        <TabsList className="grid grid-cols-4 mb-4">
                            <TabsTrigger value="basic" className="gap-1.5 text-xs"><Info className="h-3 w-3" />Basic</TabsTrigger>
                            <TabsTrigger value="dimensions" className="gap-1.5 text-xs"><Ruler className="h-3 w-3" />Dimensions</TabsTrigger>
                            <TabsTrigger value="storage" className="gap-1.5 text-xs"><Settings2 className="h-3 w-3" />Storage</TabsTrigger>
                            <TabsTrigger value="compliance" className="gap-1.5 text-xs"><ShieldAlert className="h-3 w-3" />Compliance</TabsTrigger>
                        </TabsList>

                        {/* Basic Info */}
                        <TabsContent value="basic" className="space-y-0">
                            <DSep title="Basic Information" icon={<Info className="h-4 w-4" />} />
                            <div className="grid grid-cols-2 gap-x-8 gap-y-1">
                                <DRow label="SKU Code" value={sku.skuCode} />
                                <DRow label="Primary Barcode" value={sku.primaryBarcode || "—"} />
                                <DRow label="Description" value={sku.description || "—"} />
                                <DRow label="Short Description" value={sku.shortDescription || "—"} />
                                <DRow label="Base UOM" value={sku.baseUom} />
                                <DRow label="Item Type" value={sku.itemType || "—"} />
                                <DRow label="Category" value={sku.itemCategory || "—"} />
                                <DRow label="Velocity Class" value={sku.velocityClass || "—"} />
                                <DRow label="Storage Condition" value={sku.storageCondition || "—"} />
                            </div>
                            <DSep title="Packaging" icon={<Box className="h-4 w-4" />} />
                            <div className="grid grid-cols-3 gap-x-8 gap-y-1">
                                <DRow label="Pallet Quantity" value={val(sku.palletQuantity)} />
                                <DRow label="Case Quantity" value={val(sku.caseQuantity)} />
                                <DRow label="Inner Quantity" value={val(sku.innerQuantity)} />
                            </div>
                        </TabsContent>

                        {/* Dimensions */}
                        <TabsContent value="dimensions" className="space-y-0">
                            <DSep title="Physical Dimensions" icon={<Ruler className="h-4 w-4" />} />
                            <div className="grid grid-cols-2 gap-x-8 gap-y-1">
                                <DRow label="Length" value={val(sku.lengthCm, " cm")} />
                                <DRow label="Width" value={val(sku.widthCm, " cm")} />
                                <DRow label="Height" value={val(sku.heightCm, " cm")} />
                                <DRow label="Weight" value={val(sku.weightKg, " kg")} />
                                <DRow label="Volume" value={val(sku.volumeCc, " cc")} />
                            </div>
                        </TabsContent>

                        {/* Storage Rules */}
                        <TabsContent value="storage" className="space-y-0">
                            <DSep title="Storage Rules" icon={<Settings2 className="h-4 w-4" />} />
                            <div className="grid grid-cols-2 gap-x-8 gap-y-1">
                                <DRow label="Storage Condition" value={sku.storageCondition || "—"} />
                                <DRow label="Picking Strategy" value={sku.pickingStrategy || "—"} />
                                <DRow label="Preferred Zones" value={sku.preferredZones?.join(", ") || "—"} />
                                <DRow label="Preferred Bin Types" value={sku.preferredBinTypes?.join(", ") || "—"} />
                            </div>
                        </TabsContent>

                        {/* Compliance */}
                        <TabsContent value="compliance" className="space-y-0">
                            <DSep title="Compliance & Tax" icon={<ShieldAlert className="h-4 w-4" />} />
                            <div className="grid grid-cols-2 gap-x-8 gap-y-1">
                                <DRow label="HSN Code" value={sku.hsnCode || "—"} />
                                <DRow label="Tax Rate" value={val(sku.taxRate, "%")} />
                                <DRow label="Hazardous" value={sku.isHazardous ? "Yes ⚠️" : "No"} />
                            </div>
                        </TabsContent>
                    </Tabs>
                </div>
            </DialogContent>
        </Dialog>
    );
};

// ─── Main Page ───────────────────────────────────────────────────────────────

const PAGE_SIZES = [10, 25, 50];

const DEFAULT_EDIT_FORM: EditSkuForm = {
    sku_code: "",
    description: "",
    short_description: "",
    primary_barcode: "",
    alt_barcodes: "",
    rfid_tag: "",
    base_uom: "",
    alt_uom: "",
    uom_conversion: "0",
    uom_hierarchy_1: "0",
    uom_hierarchy_2: "0",
    uom_hierarchy_3: "0",
    length_cm: "0",
    width_cm: "0",
    height_cm: "0",
    weight_kg: "0",
    volume_cc: "0",
    pallet_quantity: "0",
    case_quantity: "0",
    inner_quantity: "0",
    item_type: "",
    item_category: "",
    storage_condition: "",
    velocity_class: "",
    fefo_enabled: true,
    fifo_enabled: true,
    shelf_life_days: "0",
    expiry_required: false,
    lot_required: false,
    batch_required: true,
    serial_required: true,
    pick_face_eligible: true,
    pick_face_capacity: "0",
    pick_face_replenishment_point: "0",
    preferred_zones: "",
    preferred_bin_types: "",
    picking_strategy: "",
    max_stack_height: "0",
    max_qty_per_bin: "0",
    compatibility_rules_keys: "",
    is_hazardous: false,
    hazard_class: "",
    hazmat_code: "",
    requires_inspection: false,
    inspection_rule: "",
    sample_percentage: "0",
    quarantine_on_failure: false,
    hsn_code: "",
    tax_rate: "0",
    velocity_score: "0",
    pick_frequency: "0",
    active: true,
    created_by: "",
    updated_by: "",
    created_at: "",
    updated_at: "",
};

const DEFAULT_CREATE_FORM: CreateSkuForm = {
    sku_code: "",
    description: "",
    short_description: "",
    primary_barcode: "",
    alt_barcodes: "",
    item_category: "",
    base_uom: "",
    alt_uom: "",
};

const num = (value: string): number => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
};

const toCsv = (value: unknown): string =>
    Array.isArray(value) ? value.filter(Boolean).join(", ") : "";

const buildEditForm = (raw: any): EditSkuForm => {
    const hierarchy = raw?.uom_hierarchy || {};
    const compatibilityRules = raw?.compatibility_rules || {};
    return {
        sku_code: String(raw?.sku_code ?? ""),
        description: String(raw?.description ?? ""),
        short_description: String(raw?.short_description ?? ""),
        primary_barcode: String(raw?.primary_barcode ?? ""),
        alt_barcodes: toCsv(raw?.alt_barcodes),
        rfid_tag: String(raw?.rfid_tag ?? ""),
        base_uom: String(raw?.base_uom ?? ""),
        alt_uom: String(raw?.alt_uom ?? ""),
        uom_conversion: String(raw?.uom_conversion ?? 0),
        uom_hierarchy_1: String(hierarchy?.additionalProp1 ?? 0),
        uom_hierarchy_2: String(hierarchy?.additionalProp2 ?? 0),
        uom_hierarchy_3: String(hierarchy?.additionalProp3 ?? 0),
        length_cm: String(raw?.length_cm ?? 0),
        width_cm: String(raw?.width_cm ?? 0),
        height_cm: String(raw?.height_cm ?? 0),
        weight_kg: String(raw?.weight_kg ?? 0),
        volume_cc: String(raw?.volume_cc ?? 0),
        pallet_quantity: String(raw?.pallet_quantity ?? 0),
        case_quantity: String(raw?.case_quantity ?? 0),
        inner_quantity: String(raw?.inner_quantity ?? 0),
        item_type: String(raw?.item_type ?? ""),
        item_category: String(raw?.item_category ?? ""),
        storage_condition: String(raw?.storage_condition ?? ""),
        velocity_class: String(raw?.velocity_class ?? ""),
        fefo_enabled: Boolean(raw?.fefo_enabled),
        fifo_enabled: Boolean(raw?.fifo_enabled),
        shelf_life_days: String(raw?.shelf_life_days ?? 0),
        expiry_required: Boolean(raw?.expiry_required),
        lot_required: Boolean(raw?.lot_required),
        batch_required: Boolean(raw?.batch_required),
        serial_required: Boolean(raw?.serial_required),
        pick_face_eligible: Boolean(raw?.pick_face_eligible),
        pick_face_capacity: String(raw?.pick_face_capacity ?? 0),
        pick_face_replenishment_point: String(raw?.pick_face_replenishment_point ?? 0),
        preferred_zones: toCsv(raw?.preferred_zones),
        preferred_bin_types: toCsv(raw?.preferred_bin_types),
        picking_strategy: String(raw?.picking_strategy ?? ""),
        max_stack_height: String(raw?.max_stack_height ?? 0),
        max_qty_per_bin: String(raw?.max_qty_per_bin ?? 0),
        compatibility_rules_keys: Object.keys(compatibilityRules).join(", "),
        is_hazardous: Boolean(raw?.is_hazardous),
        hazard_class: String(raw?.hazard_class ?? ""),
        hazmat_code: String(raw?.hazmat_code ?? ""),
        requires_inspection: Boolean(raw?.requires_inspection),
        inspection_rule: String(raw?.inspection_rule ?? ""),
        sample_percentage: String(raw?.sample_percentage ?? 0),
        quarantine_on_failure: Boolean(raw?.quarantine_on_failure),
        hsn_code: String(raw?.hsn_code ?? ""),
        tax_rate: String(raw?.tax_rate ?? 0),
        velocity_score: String(raw?.velocity_score ?? 0),
        pick_frequency: String(raw?.pick_frequency ?? 0),
        active: raw?.active ?? true,
        created_by: String(raw?.created_by ?? ""),
        updated_by: String(raw?.updated_by ?? ""),
        created_at: String(raw?.created_at ?? ""),
        updated_at: String(raw?.updated_at ?? ""),
    };
};

const csvToArray = (value: string): string[] =>
    value
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean);

const buildCreatePayload = (form: CreateSkuForm) => ({
    sku_code: form.sku_code.trim(),
    description: form.description.trim(),
    short_description: form.short_description.trim() || null,
    primary_barcode: form.primary_barcode.trim() || null,
    alt_barcodes: csvToArray(form.alt_barcodes),
    item_category: form.item_category.trim() || null,
    base_uom: form.base_uom.trim(),
    alt_uom: form.alt_uom.trim() || null,
});

const keysToCompatibilityRules = (value: string): Record<string, object> => {
    const keys = csvToArray(value);
    return keys.reduce<Record<string, object>>((acc, key) => {
        acc[key] = {};
        return acc;
    }, {});
};

const SkuManagement = () => {
    const [items, setItems] = useState<SkuItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Filters
    const [search, setSearch] = useState("");
    const [categoryFilter, setCategoryFilter] = useState("all");
    const [velocityFilter, setVelocityFilter] = useState("all");
    const [activeFilter, setActiveFilter] = useState("all");

    // Pagination
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);

    // Modal
    const [viewingSku, setViewingSku] = useState<SkuItem | null>(null);
    const [editingSku, setEditingSku] = useState<SkuItem | null>(null);
    const [editForm, setEditForm] = useState<EditSkuForm>(DEFAULT_EDIT_FORM);
    const [isEditLoading, setIsEditLoading] = useState(false);
    const [isEditSaving, setIsEditSaving] = useState(false);
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [isCreateSaving, setIsCreateSaving] = useState(false);
    const [createForm, setCreateForm] = useState<CreateSkuForm>(DEFAULT_CREATE_FORM);
    const [isCreateFull, setIsCreateFull] = useState(false);

    // Toggling active state
    const [togglingId, setTogglingId] = useState<string | number | null>(null);

    // Refs for keyboard navigation
    const velocityTriggerRef = useRef<HTMLButtonElement>(null);

    const fetchItems = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const data = await skuService.getAll();
            setItems(data);
        } catch {
            setError("Failed to load SKU data. Please check your connection.");
            toast.error("Failed to load SKU data");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { fetchItems(); }, []);

    // ── Filter options derived from data ──
    const categories = useMemo(() => {
        const set = new Set(items.map(i => i.itemCategory).filter(Boolean));
        return Array.from(set).sort();
    }, [items]);

    const velocities = useMemo(() => {
        const set = new Set(items.map(i => i.velocityClass).filter(Boolean));
        return Array.from(set).sort();
    }, [items]);

    // ── Filtered + searched data ──
    const filtered = useMemo(() => {
        const s = search.toLowerCase();
        return items.filter(item => {
            const matchSearch = !s ||
                item.skuCode.toLowerCase().includes(s) ||
                item.description.toLowerCase().includes(s) ||
                item.primaryBarcode.toLowerCase().includes(s);
            const matchCategory = categoryFilter === "all" || item.itemCategory === categoryFilter;
            const matchVelocity = velocityFilter === "all" || item.velocityClass === velocityFilter;
            const matchActive =
                activeFilter === "all" ||
                (activeFilter === "active" && item.active) ||
                (activeFilter === "inactive" && !item.active);
            return matchSearch && matchCategory && matchVelocity && matchActive;
        });
    }, [items, search, categoryFilter, velocityFilter, activeFilter]);

    // ── Reset to page 1 on filter change ──
    useEffect(() => { setPage(1); }, [search, categoryFilter, velocityFilter, activeFilter, pageSize]);

    // ── Paginate ──
    const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
    const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

    // ── Toggle active ──
    const handleToggleActive = async (sku: SkuItem) => {
        setTogglingId(sku.id);
        try {
            await skuService.update(sku.id, { active: !sku.active });
            setItems(prev => prev.map(i => i.id === sku.id ? { ...i, active: !i.active } : i));
            toast.success(`SKU ${sku.skuCode} ${!sku.active ? "activated" : "deactivated"}`);
        } catch {
            toast.error("Failed to update SKU status");
        } finally {
            setTogglingId(null);
        }
    };

    // ── Clear filters ──
    const clearFilters = () => {
        setSearch("");
        setCategoryFilter("all");
        setVelocityFilter("all");
        setActiveFilter("all");
    };
    const hasFilters = search || categoryFilter !== "all" || velocityFilter !== "all" || activeFilter !== "all";

    const openEditModal = async (sku: SkuItem) => {
        setEditingSku(sku);
        setIsEditLoading(true);
        try {
            const raw = await skuService.getRawById(sku.id);
            setEditForm(buildEditForm(raw));
        } catch {
            setEditForm(DEFAULT_EDIT_FORM);
            toast.error("Failed to load item details");
        } finally {
            setIsEditLoading(false);
        }
    };

    const closeEditModal = () => {
        if (isEditSaving) return;
        setEditingSku(null);
        setEditForm(DEFAULT_EDIT_FORM);
        setIsEditLoading(false);
    };

    const setField = (field: keyof EditSkuForm, value: string | boolean) => {
        setEditForm((prev) => ({ ...prev, [field]: value }));
    };

    const setCreateField = (field: keyof CreateSkuForm, value: string) => {
        setCreateForm((prev) => ({ ...prev, [field]: value }));
    };

    const closeCreateModal = () => {
        if (isCreateSaving) return;
        setIsCreateOpen(false);
        setCreateForm(DEFAULT_CREATE_FORM);
    };

    const openCreateModal = () => {
        setCreateForm(DEFAULT_CREATE_FORM);
        setEditForm(DEFAULT_EDIT_FORM);
        setIsCreateOpen(true);
        setIsCreateFull(false);
    };

    const submitCreate = async () => {
        let payload;
        
        if (isCreateFull) {
            payload = {
                sku_code: editForm.sku_code,
                description: editForm.description,
                short_description: editForm.short_description,
                primary_barcode: editForm.primary_barcode,
                alt_barcodes: csvToArray(editForm.alt_barcodes),
                rfid_tag: editForm.rfid_tag,
                base_uom: editForm.base_uom,
                alt_uom: editForm.alt_uom,
                uom_conversion: num(editForm.uom_conversion),
                uom_hierarchy: {
                    additionalProp1: num(editForm.uom_hierarchy_1),
                    additionalProp2: num(editForm.uom_hierarchy_2),
                    additionalProp3: num(editForm.uom_hierarchy_3),
                },
                length_cm: num(editForm.length_cm),
                width_cm: num(editForm.width_cm),
                height_cm: num(editForm.height_cm),
                weight_kg: num(editForm.weight_kg),
                volume_cc: num(editForm.volume_cc),
                pallet_quantity: num(editForm.pallet_quantity),
                case_quantity: num(editForm.case_quantity),
                inner_quantity: num(editForm.inner_quantity),
                item_type: editForm.item_type,
                item_category: editForm.item_category,
                storage_condition: editForm.storage_condition,
                velocity_class: editForm.velocity_class,
                fefo_enabled: editForm.fefo_enabled,
                fifo_enabled: editForm.fifo_enabled,
                shelf_life_days: num(editForm.shelf_life_days),
                expiry_required: editForm.expiry_required,
                lot_required: editForm.lot_required,
                batch_required: editForm.batch_required,
                serial_required: editForm.serial_required,
                pick_face_eligible: editForm.pick_face_eligible,
                pick_face_capacity: num(editForm.pick_face_capacity),
                pick_face_replenishment_point: num(editForm.pick_face_replenishment_point),
                preferred_zones: csvToArray(editForm.preferred_zones),
                preferred_bin_types: csvToArray(editForm.preferred_bin_types),
                picking_strategy: editForm.picking_strategy,
                max_stack_height: num(editForm.max_stack_height),
                max_qty_per_bin: num(editForm.max_qty_per_bin),
                compatibility_rules: keysToCompatibilityRules(editForm.compatibility_rules_keys),
                is_hazardous: editForm.is_hazardous,
                hazard_class: editForm.hazard_class,
                hazmat_code: editForm.hazmat_code,
                requires_inspection: editForm.requires_inspection,
                inspection_rule: editForm.inspection_rule,
                sample_percentage: num(editForm.sample_percentage),
                quarantine_on_failure: editForm.quarantine_on_failure,
                hsn_code: editForm.hsn_code,
                tax_rate: num(editForm.tax_rate),
                velocity_score: num(editForm.velocity_score),
                pick_frequency: num(editForm.pick_frequency),
                active: editForm.active,
            };
        } else {
            payload = buildCreatePayload(createForm);
        }

        if (!payload.sku_code || !payload.description || !payload.base_uom) {
            toast.error("SKU Code, Description, and Base UOM are required.");
            return;
        }

        setIsCreateSaving(true);
        try {
            await skuService.create(payload);
            toast.success(`SKU ${payload.sku_code} created`);
            closeCreateModal();
            await fetchItems();
        } catch {
            toast.error("Failed to create SKU");
        } finally {
            setIsCreateSaving(false);
        }
    };

    const submitEdit = async () => {
        if (!editingSku) return;

        const payload = {
            sku_code: editForm.sku_code,
            description: editForm.description,
            short_description: editForm.short_description,
            primary_barcode: editForm.primary_barcode,
            alt_barcodes: csvToArray(editForm.alt_barcodes),
            rfid_tag: editForm.rfid_tag,
            base_uom: editForm.base_uom,
            alt_uom: editForm.alt_uom,
            uom_conversion: num(editForm.uom_conversion),
            uom_hierarchy: {
                additionalProp1: num(editForm.uom_hierarchy_1),
                additionalProp2: num(editForm.uom_hierarchy_2),
                additionalProp3: num(editForm.uom_hierarchy_3),
            },
            length_cm: num(editForm.length_cm),
            width_cm: num(editForm.width_cm),
            height_cm: num(editForm.height_cm),
            weight_kg: num(editForm.weight_kg),
            volume_cc: num(editForm.volume_cc),
            pallet_quantity: num(editForm.pallet_quantity),
            case_quantity: num(editForm.case_quantity),
            inner_quantity: num(editForm.inner_quantity),
            item_type: editForm.item_type,
            item_category: editForm.item_category,
            storage_condition: editForm.storage_condition,
            velocity_class: editForm.velocity_class,
            fefo_enabled: editForm.fefo_enabled,
            fifo_enabled: editForm.fifo_enabled,
            shelf_life_days: num(editForm.shelf_life_days),
            expiry_required: editForm.expiry_required,
            lot_required: editForm.lot_required,
            batch_required: editForm.batch_required,
            serial_required: editForm.serial_required,
            pick_face_eligible: editForm.pick_face_eligible,
            pick_face_capacity: num(editForm.pick_face_capacity),
            pick_face_replenishment_point: num(editForm.pick_face_replenishment_point),
            preferred_zones: csvToArray(editForm.preferred_zones),
            preferred_bin_types: csvToArray(editForm.preferred_bin_types),
            picking_strategy: editForm.picking_strategy,
            max_stack_height: num(editForm.max_stack_height),
            max_qty_per_bin: num(editForm.max_qty_per_bin),
            compatibility_rules: keysToCompatibilityRules(editForm.compatibility_rules_keys),
            is_hazardous: editForm.is_hazardous,
            hazard_class: editForm.hazard_class,
            hazmat_code: editForm.hazmat_code,
            requires_inspection: editForm.requires_inspection,
            inspection_rule: editForm.inspection_rule,
            sample_percentage: num(editForm.sample_percentage),
            quarantine_on_failure: editForm.quarantine_on_failure,
            hsn_code: editForm.hsn_code,
            tax_rate: num(editForm.tax_rate),
            velocity_score: num(editForm.velocity_score),
            pick_frequency: num(editForm.pick_frequency),
            active: editForm.active,
        };

        setIsEditSaving(true);
        try {
            await skuService.update(editingSku.id, payload);
            toast.success(`SKU ${editingSku.skuCode} updated`);
            closeEditModal();
            await fetchItems();
        } catch {
            toast.error("Failed to update SKU");
        } finally {
            setIsEditSaving(false);
        }
    };

    return (
        <div className="p-4 md:p-8 space-y-6">
            {/* Page Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="font-heading text-3xl font-bold">SKU Management</h1>
                    <p className="text-muted-foreground">
                        Manage your stock-keeping units and item master data
                        {!isLoading && (
                            <span className="ml-2 font-semibold text-primary">
                                ({filtered.length} of {items.length} items)
                            </span>
                        )}
                    </p>
                </div>
                <div className="flex items-center gap-2 self-start">
                    <Button variant="outline" size="sm" onClick={openCreateModal} className="gap-2">
                        <Plus className="h-4 w-4" />
                        Add SKU
                    </Button>
                    <Button variant="outline" size="sm" onClick={fetchItems} disabled={isLoading} className="gap-2">
                        <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
                        Refresh
                    </Button>
                </div>
            </div>

            {/* Search + Filters */}
            <Card className="border-muted/40">
                <CardContent className="pt-4 pb-4">
                    <div className="flex flex-wrap items-center gap-3">
                        {/* Search */}
                        <div className="relative flex-1 min-w-[220px]">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search SKU, barcode, description..."
                                className="pl-9 h-9"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                            />
                        </div>

                        {/* Category Filter */}
                        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                            <SelectTrigger className="w-[160px] h-9">
                                <Filter className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                                <SelectValue placeholder="Category" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Categories</SelectItem>
                                {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                            </SelectContent>
                        </Select>

                        {/* Velocity Filter */}
                        <Select value={velocityFilter} onValueChange={setVelocityFilter}>
                            <SelectTrigger className="w-[150px] h-9">
                                <SelectValue placeholder="Velocity" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Velocities</SelectItem>
                                {velocities.map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                            </SelectContent>
                        </Select>

                        {/* Active Filter */}
                        <Select value={activeFilter} onValueChange={setActiveFilter}>
                            <SelectTrigger className="w-[140px] h-9">
                                <SelectValue placeholder="Status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Status</SelectItem>
                                <SelectItem value="active">Active</SelectItem>
                                <SelectItem value="inactive">Inactive</SelectItem>
                            </SelectContent>
                        </Select>

                        {/* Clear */}
                        {hasFilters && (
                            <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1.5 h-9 text-muted-foreground">
                                <X className="h-3.5 w-3.5" />
                                Clear
                            </Button>
                        )}

                        {/* Page size */}
                        <div className="ml-auto flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">Rows:</span>
                            <Select value={String(pageSize)} onValueChange={v => setPageSize(Number(v))}>
                                <SelectTrigger className="w-[70px] h-9">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {PAGE_SIZES.map(s => <SelectItem key={s} value={String(s)}>{s}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Table */}
            <Card className="border-muted/40">
                <CardContent className="p-0">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-24 gap-3">
                            <Loader2 className="h-10 w-10 animate-spin text-primary" />
                            <p className="text-muted-foreground animate-pulse text-sm">Loading SKU data...</p>
                        </div>
                    ) : error ? (
                        <div className="flex flex-col items-center justify-center py-24 gap-3">
                            <Package className="h-10 w-10 text-muted-foreground opacity-20" />
                            <p className="text-muted-foreground text-sm">{error}</p>
                            <Button variant="outline" size="sm" onClick={fetchItems}>Retry</Button>
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-24 gap-3">
                            <Package className="h-10 w-10 text-muted-foreground opacity-20" />
                            <p className="text-muted-foreground text-sm">
                                {hasFilters ? "No SKUs match your search or filters." : "No SKUs found."}
                            </p>
                            {hasFilters && (
                                <Button variant="outline" size="sm" onClick={clearFilters}>Clear Filters</Button>
                            )}
                        </div>
                    ) : (
                        <div>
                            <Table>
                                <TableHeader className="bg-muted/40">
                                    <TableRow>
                                        <TableHead className="text-[10px] uppercase font-black tracking-wider whitespace-nowrap">SKU Code</TableHead>
                                        <TableHead className="text-[10px] uppercase font-black tracking-wider">Description</TableHead>
                                        <TableHead className="text-[10px] uppercase font-black tracking-wider whitespace-nowrap">Base UOM</TableHead>
                                        <TableHead className="text-[10px] uppercase font-black tracking-wider">Category</TableHead>
                                        <TableHead className="text-[10px] uppercase font-black tracking-wider whitespace-nowrap">Velocity</TableHead>
                                        <TableHead className="text-[10px] uppercase font-black tracking-wider">Status</TableHead>
                                        <TableHead className="text-[10px] uppercase font-black tracking-wider text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {paginated.map(item => (
                                        <TableRow key={item.id} className={`group border-b border-muted/50 last:border-none hover:bg-transparent ${item.active ? "" : "bg-muted/5 opacity-80"}`}>
                                            <TableCell className={`font-mono font-bold text-xs whitespace-nowrap ${item.active ? "text-primary" : "text-muted-foreground"}`}>
                                                {item.skuCode}
                                            </TableCell>
                                            <TableCell className="max-w-[200px]">
                                                <div className="flex flex-col">
                                                    <span className="text-xs font-medium truncate">{item.description || "—"}</span>
                                                    {item.shortDescription && (
                                                        <span className="text-[10px] text-muted-foreground truncate">{item.shortDescription}</span>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className="text-[9px] font-bold uppercase">
                                                    {item.baseUom}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-xs">{item.itemCategory || "—"}</TableCell>
                                            <TableCell>
                                                {item.velocityClass ? (
                                                    <Badge
                                                        variant="outline"
                                                        className={`text-[10px] font-bold uppercase gap-1.5 px-3 py-1 border-none ${
                                                            item.velocityClass === "A" ? "bg-green-500/10 text-green-600" :
                                                            item.velocityClass === "B" ? "bg-amber-500/10 text-amber-600" :
                                                            "bg-muted/30 text-muted-foreground"
                                                        }`}
                                                    >
                                                        {item.velocityClass}
                                                    </Badge>
                                                ) : "—"}
                                            </TableCell>
                                            <TableCell>
                                                <Badge
                                                    variant="outline"
                                                    className={`text-[10px] font-bold uppercase gap-1.5 px-3 py-1 border-none flex items-center w-fit ${
                                                        item.active 
                                                            ? "bg-green-500/10 text-green-600" 
                                                            : "bg-red-500/10 text-red-600"
                                                    }`}
                                                >
                                                    <div className={`h-1.5 w-1.5 rounded-full ${item.active ? "bg-green-600" : "bg-red-600"}`} />
                                                    {item.active ? "Active" : "Inactive"}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center justify-end gap-1">
                                                    {/* View */}
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-7 w-7 hover:bg-transparent hover:text-primary"
                                                        onClick={() => setViewingSku(item)}
                                                        title="View Details"
                                                    >
                                                        <Eye className="h-3.5 w-3.5" />
                                                    </Button>

                                                    {/* Edit */}
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-7 w-7 hover:bg-transparent hover:text-amber-600"
                                                        title="Edit SKU"
                                                        onClick={() => openEditModal(item)}
                                                    >
                                                        <Edit2 className="h-3.5 w-3.5" />
                                                    </Button>

                                                    {/* Toggle Active */}
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className={`h-7 w-7 hover:bg-transparent ${item.active
                                                            ? "text-muted-foreground hover:text-destructive"
                                                            : "text-muted-foreground hover:text-green-600"
                                                            }`}
                                                        disabled={togglingId === item.id}
                                                        onClick={() => handleToggleActive(item)}
                                                        title={item.active ? "Deactivate" : "Activate"}
                                                    >
                                                        {togglingId === item.id
                                                            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                            : item.active
                                                                ? <ToggleRight className="h-3.5 w-3.5" />
                                                                : <ToggleLeft className="h-3.5 w-3.5" />
                                                        }
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Pagination */}
            {!isLoading && !error && filtered.length > 0 && (
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>
                        Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, filtered.length)} of {filtered.length} results
                    </span>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            disabled={page === 1}
                        >
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <span className="font-mono text-xs px-3 py-1.5 bg-muted/30 rounded-md border">
                            {page} / {totalPages}
                        </span>
                        <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                            disabled={page === totalPages}
                        >
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            )}

            {/* View Modal */}
            <SkuViewModal
                sku={viewingSku}
                open={!!viewingSku}
                onClose={() => setViewingSku(null)}
            />

            <Dialog open={isCreateOpen} onOpenChange={(open) => (open ? setIsCreateOpen(true) : closeCreateModal())}>
                <DialogContent className={`${isCreateFull ? "max-w-6xl" : "max-w-4xl"} overflow-hidden p-0 flex flex-col max-h-[92vh]`}>
                    <div className="p-6 pb-4 border-b shrink-0 bg-background">
                        <DialogHeader>
                            <DialogTitle className="text-xl font-heading">Add SKU</DialogTitle>
                            <DialogDescription>
                                Create a new item master record using the required SKU details.
                            </DialogDescription>
                        </DialogHeader>
                    </div>

                    <div className={`flex-1 overflow-y-auto p-6 bg-background/50 space-y-6 ${isCreateFull ? "max-w-6xl w-full mx-auto" : ""}`}>
                        {isCreateFull ? (
                            <Tabs defaultValue="basic" className="space-y-4">
                                <TabsList className="grid grid-cols-2 md:grid-cols-6 gap-1 h-auto">
                                    <TabsTrigger value="basic" className="text-xs">Basic</TabsTrigger>
                                    <TabsTrigger value="uom" className="text-xs">UOM</TabsTrigger>
                                    <TabsTrigger value="dimensions" className="text-xs">Dimensions</TabsTrigger>
                                    <TabsTrigger value="storage" className="text-xs">Storage</TabsTrigger>
                                    <TabsTrigger value="compliance" className="text-xs">Compliance</TabsTrigger>
                                    <TabsTrigger value="rules" className="text-xs">Rules</TabsTrigger>
                                </TabsList>

                                <TabsContent value="basic" className="mt-0">
                                    <div className="rounded-lg border bg-card p-4 space-y-4">
                                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Basic Information</p>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="space-y-1"><label className="text-xs text-muted-foreground">SKU Code</label><Input value={editForm.sku_code} onChange={(e) => setField("sku_code", e.target.value)} /></div>
                                            <div className="space-y-1"><label className="text-xs text-muted-foreground">Description</label><Input value={editForm.description} onChange={(e) => setField("description", e.target.value)} /></div>
                                            <div className="space-y-1"><label className="text-xs text-muted-foreground">Short Description</label><Input value={editForm.short_description} onChange={(e) => setField("short_description", e.target.value)} /></div>
                                            <div className="space-y-1"><label className="text-xs text-muted-foreground">Primary Barcode</label><Input value={editForm.primary_barcode} onChange={(e) => setField("primary_barcode", e.target.value)} /></div>
                                            <div className="space-y-1"><label className="text-xs text-muted-foreground">Alt Barcodes (comma-separated)</label><Input value={editForm.alt_barcodes} onChange={(e) => setField("alt_barcodes", e.target.value)} /></div>
                                            <div className="space-y-1"><label className="text-xs text-muted-foreground">RFID Tag</label><Input value={editForm.rfid_tag} onChange={(e) => setField("rfid_tag", e.target.value)} /></div>
                                            <div className="space-y-1"><label className="text-xs text-muted-foreground">Item Type</label><Input value={editForm.item_type} onChange={(e) => setField("item_type", e.target.value)} /></div>
                                            <div className="space-y-1">
                                                <label className="text-xs text-muted-foreground">Item Category</label>
                                                <Select 
                                                    value={editForm.item_category} 
                                                    onValueChange={(val) => setField("item_category", val)}
                                                    onOpenChange={(open) => {
                                                        if (!open) {
                                                            setTimeout(() => {
                                                                velocityTriggerRef.current?.focus();
                                                            }, 150);
                                                        }
                                                    }}
                                                >
                                                    <SelectTrigger className="h-10">
                                                        <SelectValue placeholder="Select Category" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {ITEM_CATEGORIES.map((cat) => (
                                                            <SelectItem key={cat.value} value={cat.value}>
                                                                {cat.label}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-xs text-muted-foreground">Velocity Class</label>
                                                <Select value={editForm.velocity_class} onValueChange={(val) => setField("velocity_class", val)}>
                                                    <SelectTrigger ref={velocityTriggerRef}>
                                                        <SelectValue placeholder="Select velocity class" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="A">A - Fast Moving</SelectItem>
                                                        <SelectItem value="B">B - Mid Moving</SelectItem>
                                                        <SelectItem value="C">C - Slow moving</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="space-y-1"><label className="text-xs text-muted-foreground">Velocity Score</label><Input type="number" value={editForm.velocity_score} onChange={(e) => setField("velocity_score", e.target.value)} /></div>
                                            <div className="space-y-1"><label className="text-xs text-muted-foreground">Pick Frequency</label><Input type="number" value={editForm.pick_frequency} onChange={(e) => setField("pick_frequency", e.target.value)} /></div>
                                        </div>
                                    </div>
                                </TabsContent>

                                <TabsContent value="uom" className="mt-0">
                                    <div className="rounded-lg border bg-card p-4 space-y-4">
                                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Units and Conversion</p>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="space-y-1"><label className="text-xs text-muted-foreground">Base UOM</label><UomSelect value={editForm.base_uom} onValueChange={(value) => setField("base_uom", value)} triggerClassName="h-10" /></div>
                                            <div className="space-y-1"><label className="text-xs text-muted-foreground">Alt UOM</label><UomSelect value={editForm.alt_uom} onValueChange={(value) => setField("alt_uom", value)} triggerClassName="h-10" /></div>
                                            <div className="space-y-1"><label className="text-xs text-muted-foreground">UOM Conversion</label><Input type="number" value={editForm.uom_conversion} onChange={(e) => setField("uom_conversion", e.target.value)} /></div>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            <div className="space-y-1"><label className="text-xs text-muted-foreground">UOM Hierarchy additionalProp1</label><Input type="number" value={editForm.uom_hierarchy_1} onChange={(e) => setField("uom_hierarchy_1", e.target.value)} /></div>
                                            <div className="space-y-1"><label className="text-xs text-muted-foreground">UOM Hierarchy additionalProp2</label><Input type="number" value={editForm.uom_hierarchy_2} onChange={(e) => setField("uom_hierarchy_2", e.target.value)} /></div>
                                            <div className="space-y-1"><label className="text-xs text-muted-foreground">UOM Hierarchy additionalProp3</label><Input type="number" value={editForm.uom_hierarchy_3} onChange={(e) => setField("uom_hierarchy_3", e.target.value)} /></div>
                                        </div>
                                    </div>
                                </TabsContent>

                                <TabsContent value="dimensions" className="mt-0">
                                    <div className="rounded-lg border bg-card p-4 space-y-4">
                                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Dimensions and Packaging</p>
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                            <div className="space-y-1"><label className="text-xs text-muted-foreground">Length (cm)</label><Input type="number" value={editForm.length_cm} onChange={(e) => setField("length_cm", e.target.value)} /></div>
                                            <div className="space-y-1"><label className="text-xs text-muted-foreground">Width (cm)</label><Input type="number" value={editForm.width_cm} onChange={(e) => setField("width_cm", e.target.value)} /></div>
                                            <div className="space-y-1"><label className="text-xs text-muted-foreground">Height (cm)</label><Input type="number" value={editForm.height_cm} onChange={(e) => setField("height_cm", e.target.value)} /></div>
                                            <div className="space-y-1"><label className="text-xs text-muted-foreground">Weight (kg)</label><Input type="number" value={editForm.weight_kg} onChange={(e) => setField("weight_kg", e.target.value)} /></div>
                                            <div className="space-y-1"><label className="text-xs text-muted-foreground">Volume (cc)</label><Input type="number" value={editForm.volume_cc} onChange={(e) => setField("volume_cc", e.target.value)} /></div>
                                            <div className="space-y-1"><label className="text-xs text-muted-foreground">Pallet Quantity</label><Input type="number" value={editForm.pallet_quantity} onChange={(e) => setField("pallet_quantity", e.target.value)} /></div>
                                            <div className="space-y-1"><label className="text-xs text-muted-foreground">Case Quantity</label><Input type="number" value={editForm.case_quantity} onChange={(e) => setField("case_quantity", e.target.value)} /></div>
                                            <div className="space-y-1"><label className="text-xs text-muted-foreground">Inner Quantity</label><Input type="number" value={editForm.inner_quantity} onChange={(e) => setField("inner_quantity", e.target.value)} /></div>
                                        </div>
                                    </div>
                                </TabsContent>

                                <TabsContent value="storage" className="mt-0">
                                    <div className="rounded-lg border bg-card p-4 space-y-4">
                                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Storage and Picking</p>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="space-y-1"><label className="text-xs text-muted-foreground">Storage Condition</label><Input value={editForm.storage_condition} onChange={(e) => setField("storage_condition", e.target.value)} /></div>
                                            <div className="space-y-1"><label className="text-xs text-muted-foreground">Shelf Life Days</label><Input type="number" value={editForm.shelf_life_days} onChange={(e) => setField("shelf_life_days", e.target.value)} /></div>
                                            <div className="space-y-1"><label className="text-xs text-muted-foreground">Picking Strategy</label><Input value={editForm.picking_strategy} onChange={(e) => setField("picking_strategy", e.target.value)} /></div>
                                            <div className="space-y-1"><label className="text-xs text-muted-foreground">Pick Face Capacity</label><Input type="number" value={editForm.pick_face_capacity} onChange={(e) => setField("pick_face_capacity", e.target.value)} /></div>
                                            <div className="space-y-1"><label className="text-xs text-muted-foreground">Replenishment Point</label><Input type="number" value={editForm.pick_face_replenishment_point} onChange={(e) => setField("pick_face_replenishment_point", e.target.value)} /></div>
                                            <div className="space-y-1"><label className="text-xs text-muted-foreground">Max Stack Height</label><Input type="number" value={editForm.max_stack_height} onChange={(e) => setField("max_stack_height", e.target.value)} /></div>
                                            <div className="space-y-1"><label className="text-xs text-muted-foreground">Max Qty Per Bin</label><Input type="number" value={editForm.max_qty_per_bin} onChange={(e) => setField("max_qty_per_bin", e.target.value)} /></div>
                                            <div className="space-y-1"><label className="text-xs text-muted-foreground">Preferred Zones (Select to append)</label>
                                                <ZoneTypeSelect 
                                                    value="" 
                                                    onValueChange={(val) => {
                                                        if (!val) return;
                                                        const current = editForm.preferred_zones ? editForm.preferred_zones.split(',').map(s => s.trim()).filter(Boolean) : [];
                                                        if (!current.includes(val)) {
                                                            const newValue = [...current, val].join(', ');
                                                            setField("preferred_zones", newValue);
                                                        }
                                                    }} 
                                                />
                                                <Input value={editForm.preferred_zones} onChange={(e) => setField("preferred_zones", e.target.value)} placeholder="e.g. BULK, RACK" /></div>
                                            <div className="space-y-1"><label className="text-xs text-muted-foreground">Preferred Bin Types (Select to append)</label>
                                                <BinTypeSelect 
                                                    value="" 
                                                    onValueChange={(val) => {
                                                        if (!val) return;
                                                        const current = editForm.preferred_bin_types ? editForm.preferred_bin_types.split(',').map(s => s.trim()).filter(Boolean) : [];
                                                        if (!current.includes(val)) {
                                                            const newValue = [...current, val].join(', ');
                                                            setField("preferred_bin_types", newValue);
                                                        }
                                                    }} 
                                                />
                                                <Input value={editForm.preferred_bin_types} onChange={(e) => setField("preferred_bin_types", e.target.value)} placeholder="e.g. STANDARD, BULK_BIN" /></div>
                                        </div>
                                    </div>
                                </TabsContent>

                                <TabsContent value="compliance" className="mt-0">
                                    <div className="rounded-lg border bg-card p-4 space-y-4">
                                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Compliance and Tax</p>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="space-y-1"><label className="text-xs text-muted-foreground">Hazard Class</label><Input value={editForm.hazard_class} onChange={(e) => setField("hazard_class", e.target.value)} /></div>
                                            <div className="space-y-1"><label className="text-xs text-muted-foreground">Hazmat Code</label><Input value={editForm.hazmat_code} onChange={(e) => setField("hazmat_code", e.target.value)} /></div>
                                            <div className="space-y-1"><label className="text-xs text-muted-foreground">Inspection Rule</label><Input value={editForm.inspection_rule} onChange={(e) => setField("inspection_rule", e.target.value)} /></div>
                                            <div className="space-y-1"><label className="text-xs text-muted-foreground">Sample Percentage</label><Input type="number" value={editForm.sample_percentage} onChange={(e) => setField("sample_percentage", e.target.value)} /></div>
                                            <div className="space-y-1"><label className="text-xs text-muted-foreground">HSN Code</label><Input value={editForm.hsn_code} onChange={(e) => setField("hsn_code", e.target.value)} /></div>
                                            <div className="space-y-1"><label className="text-xs text-muted-foreground">Tax Rate</label><Input type="number" value={editForm.tax_rate} onChange={(e) => setField("tax_rate", e.target.value)} /></div>
                                            <div className="space-y-1 md:col-span-2">
                                                <label className="text-xs text-muted-foreground">Compatibility Rules Keys (comma-separated)</label>
                                                <Input
                                                    value={editForm.compatibility_rules_keys}
                                                    onChange={(e) => setField("compatibility_rules_keys", e.target.value)}
                                                    placeholder="additionalProp1"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </TabsContent>

                                <TabsContent value="rules" className="mt-0">
                                    <div className="rounded-lg border bg-card p-4 space-y-4">
                                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Boolean Rules and Status</p>
                                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={editForm.fefo_enabled} onChange={(e) => setField("fefo_enabled", e.target.checked)} /> FEFO Enabled</label>
                                            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={editForm.fifo_enabled} onChange={(e) => setField("fifo_enabled", e.target.checked)} /> FIFO Enabled</label>
                                            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={editForm.expiry_required} onChange={(e) => setField("expiry_required", e.target.checked)} /> Expiry Required</label>
                                            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={editForm.lot_required} onChange={(e) => setField("lot_required", e.target.checked)} /> Lot Required</label>
                                            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={editForm.batch_required} onChange={(e) => setField("batch_required", e.target.checked)} /> Batch Required</label>
                                            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={editForm.serial_required} onChange={(e) => setField("serial_required", e.target.checked)} /> Serial Required</label>
                                            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={editForm.pick_face_eligible} onChange={(e) => setField("pick_face_eligible", e.target.checked)} /> Pick Face Eligible</label>
                                            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={editForm.is_hazardous} onChange={(e) => setField("is_hazardous", e.target.checked)} /> Is Hazardous</label>
                                            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={editForm.requires_inspection} onChange={(e) => setField("requires_inspection", e.target.checked)} /> Requires Inspection</label>
                                            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={editForm.quarantine_on_failure} onChange={(e) => setField("quarantine_on_failure", e.target.checked)} /> Quarantine On Failure</label>
                                            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={editForm.active} onChange={(e) => setField("active", e.target.checked)} /> Active</label>
                                        </div>
                                    </div>
                                </TabsContent>
                            </Tabs>
                        ) : (
                            <div className="rounded-lg border bg-card p-4 space-y-4">
                                <div className="flex items-center justify-between">
                                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Basic Information</p>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-1"><label className="text-xs text-muted-foreground">SKU Code</label><Input value={createForm.sku_code} onChange={(e) => setCreateField("sku_code", e.target.value)} /></div>
                                    <div className="space-y-1"><label className="text-xs text-muted-foreground">Description</label><Input value={createForm.description} onChange={(e) => setCreateField("description", e.target.value)} /></div>
                                    <div className="space-y-1"><label className="text-xs text-muted-foreground">Short Description</label><Input value={createForm.short_description} onChange={(e) => setCreateField("short_description", e.target.value)} /></div>
                                    <div className="space-y-1"><label className="text-xs text-muted-foreground">Primary Barcode</label><Input value={createForm.primary_barcode} onChange={(e) => setCreateField("primary_barcode", e.target.value)} /></div>
                                    <div className="space-y-1"><label className="text-xs text-muted-foreground">Alt Barcodes (comma-separated)</label><Input value={createForm.alt_barcodes} onChange={(e) => setCreateField("alt_barcodes", e.target.value)} /></div>
                                    <div className="space-y-1">
                                        <label className="text-xs text-muted-foreground">Category</label>
                                        <Select value={createForm.item_category} onValueChange={(val) => setCreateField("item_category", val)}>
                                            <SelectTrigger className="h-10">
                                                <SelectValue placeholder="Select Category" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {ITEM_CATEGORIES.map((cat) => (
                                                    <SelectItem key={cat.value} value={cat.value}>
                                                        {cat.label}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-1"><label className="text-xs text-muted-foreground">Base UOM</label><UomSelect value={createForm.base_uom} onValueChange={(value) => setCreateField("base_uom", value)} triggerClassName="h-10" /></div>
                                    <div className="space-y-1"><label className="text-xs text-muted-foreground">Alt UOM</label><UomSelect value={createForm.alt_uom} onValueChange={(value) => setCreateField("alt_uom", value)} triggerClassName="h-10" /></div>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="px-6 pb-6 flex items-center justify-between">
                        <div>
                            {!isCreateFull && (
                                <Button
                                    onClick={() => {
                                        // Sync current values to editForm
                                        setEditForm(prev => ({
                                            ...prev,
                                            sku_code: createForm.sku_code,
                                            description: createForm.description,
                                            short_description: createForm.short_description,
                                            primary_barcode: createForm.primary_barcode,
                                            alt_barcodes: createForm.alt_barcodes,
                                            item_category: createForm.item_category,
                                            base_uom: createForm.base_uom,
                                            alt_uom: createForm.alt_uom,
                                        }));
                                        setIsCreateFull(true);
                                    }}
                                    className="flex items-center gap-2"
                                >
                                    <LayoutList className="h-4 w-4" />
                                    Edit full form
                                </Button>
                            )}
                        </div>
                        <div className="flex gap-2">
                            <Button variant="outline" onClick={closeCreateModal} disabled={isCreateSaving}>Cancel</Button>
                            <Button onClick={() => void submitCreate()} disabled={isCreateSaving}>
                                {isCreateSaving ? "Creating..." : "Create SKU"}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog open={!!editingSku} onOpenChange={(open) => !open && closeEditModal()}>
                <DialogContent className="max-w-6xl overflow-hidden p-0 flex flex-col max-h-[92vh]">
                    <div className="p-6 pb-4 border-b shrink-0 bg-background">
                        <DialogHeader>
                            <DialogTitle className="text-xl font-heading">Edit SKU</DialogTitle>
                            <DialogDescription>
                                Update fields and submit a PATCH request to /items/{editingSku?.id}
                            </DialogDescription>
                        </DialogHeader>
                    </div>

                    <div className="flex-1 overflow-y-auto p-6 bg-background/50 space-y-6">
                        {isEditLoading ? (
                            <div className="flex items-center justify-center py-14 gap-3">
                                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                                <span className="text-sm text-muted-foreground">Loading current item data...</span>
                            </div>
                        ) : (
                            <>
                                <Tabs defaultValue="basic" className="space-y-4">
                                    <TabsList className="grid grid-cols-2 md:grid-cols-6 gap-1 h-auto">
                                        <TabsTrigger value="basic" className="text-xs">Basic</TabsTrigger>
                                        <TabsTrigger value="uom" className="text-xs">UOM</TabsTrigger>
                                        <TabsTrigger value="dimensions" className="text-xs">Dimensions</TabsTrigger>
                                        <TabsTrigger value="storage" className="text-xs">Storage</TabsTrigger>
                                        <TabsTrigger value="compliance" className="text-xs">Compliance</TabsTrigger>
                                        <TabsTrigger value="rules" className="text-xs">Rules</TabsTrigger>
                                    </TabsList>

                                    <TabsContent value="basic" className="mt-0">
                                        <div className="rounded-lg border bg-card p-4 space-y-4">
                                            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Basic Information</p>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div className="space-y-1"><label className="text-xs text-muted-foreground">SKU Code</label><Input value={editForm.sku_code} onChange={(e) => setField("sku_code", e.target.value)} /></div>
                                                <div className="space-y-1"><label className="text-xs text-muted-foreground">Description</label><Input value={editForm.description} onChange={(e) => setField("description", e.target.value)} /></div>
                                                <div className="space-y-1"><label className="text-xs text-muted-foreground">Short Description</label><Input value={editForm.short_description} onChange={(e) => setField("short_description", e.target.value)} /></div>
                                                <div className="space-y-1"><label className="text-xs text-muted-foreground">Primary Barcode</label><Input value={editForm.primary_barcode} onChange={(e) => setField("primary_barcode", e.target.value)} /></div>
                                                <div className="space-y-1"><label className="text-xs text-muted-foreground">Alt Barcodes (comma-separated)</label><Input value={editForm.alt_barcodes} onChange={(e) => setField("alt_barcodes", e.target.value)} /></div>
                                                <div className="space-y-1"><label className="text-xs text-muted-foreground">RFID Tag</label><Input value={editForm.rfid_tag} onChange={(e) => setField("rfid_tag", e.target.value)} /></div>
                                                <div className="space-y-1"><label className="text-xs text-muted-foreground">Item Type</label><Input value={editForm.item_type} onChange={(e) => setField("item_type", e.target.value)} /></div>
                                                <div className="space-y-1">
                                                    <label className="text-xs text-muted-foreground">Item Category</label>
                                                    <Select 
                                                        value={editForm.item_category} 
                                                        onValueChange={(val) => setField("item_category", val)}
                                                        onOpenChange={(open) => {
                                                            if (!open) {
                                                                setTimeout(() => {
                                                                    velocityTriggerRef.current?.focus();
                                                                }, 150);
                                                            }
                                                        }}
                                                    >
                                                        <SelectTrigger className="h-10">
                                                            <SelectValue placeholder="Select Category" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {ITEM_CATEGORIES.map((cat) => (
                                                                <SelectItem key={cat.value} value={cat.value}>
                                                                    {cat.label}
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                                <div className="space-y-1">
                                                    <label className="text-xs text-muted-foreground">Velocity Class</label>
                                                    <Select value={editForm.velocity_class} onValueChange={(val) => setField("velocity_class", val)}>
                                                        <SelectTrigger ref={velocityTriggerRef}>
                                                            <SelectValue placeholder="Select velocity class" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="A">A - Fast Moving</SelectItem>
                                                            <SelectItem value="B">B - Mid Moving</SelectItem>
                                                            <SelectItem value="C">C - Slow moving</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                                <div className="space-y-1"><label className="text-xs text-muted-foreground">Velocity Score</label><Input type="number" value={editForm.velocity_score} onChange={(e) => setField("velocity_score", e.target.value)} /></div>
                                                <div className="space-y-1"><label className="text-xs text-muted-foreground">Pick Frequency</label><Input type="number" value={editForm.pick_frequency} onChange={(e) => setField("pick_frequency", e.target.value)} /></div>
                                            </div>
                                        </div>
                                    </TabsContent>

                                    <TabsContent value="uom" className="mt-0">
                                        <div className="rounded-lg border bg-card p-4 space-y-4">
                                            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Units and Conversion</p>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div className="space-y-1"><label className="text-xs text-muted-foreground">Base UOM</label><UomSelect value={editForm.base_uom} onValueChange={(value) => setField("base_uom", value)} triggerClassName="h-10" /></div>
                                                <div className="space-y-1"><label className="text-xs text-muted-foreground">Alt UOM</label><UomSelect value={editForm.alt_uom} onValueChange={(value) => setField("alt_uom", value)} triggerClassName="h-10" /></div>
                                                <div className="space-y-1"><label className="text-xs text-muted-foreground">UOM Conversion</label><Input type="number" value={editForm.uom_conversion} onChange={(e) => setField("uom_conversion", e.target.value)} /></div>
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                <div className="space-y-1"><label className="text-xs text-muted-foreground">UOM Hierarchy additionalProp1</label><Input type="number" value={editForm.uom_hierarchy_1} onChange={(e) => setField("uom_hierarchy_1", e.target.value)} /></div>
                                                <div className="space-y-1"><label className="text-xs text-muted-foreground">UOM Hierarchy additionalProp2</label><Input type="number" value={editForm.uom_hierarchy_2} onChange={(e) => setField("uom_hierarchy_2", e.target.value)} /></div>
                                                <div className="space-y-1"><label className="text-xs text-muted-foreground">UOM Hierarchy additionalProp3</label><Input type="number" value={editForm.uom_hierarchy_3} onChange={(e) => setField("uom_hierarchy_3", e.target.value)} /></div>
                                            </div>
                                        </div>
                                    </TabsContent>

                                    <TabsContent value="dimensions" className="mt-0">
                                        <div className="rounded-lg border bg-card p-4 space-y-4">
                                            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Dimensions and Packaging</p>
                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                                <div className="space-y-1"><label className="text-xs text-muted-foreground">Length (cm)</label><Input type="number" value={editForm.length_cm} onChange={(e) => setField("length_cm", e.target.value)} /></div>
                                                <div className="space-y-1"><label className="text-xs text-muted-foreground">Width (cm)</label><Input type="number" value={editForm.width_cm} onChange={(e) => setField("width_cm", e.target.value)} /></div>
                                                <div className="space-y-1"><label className="text-xs text-muted-foreground">Height (cm)</label><Input type="number" value={editForm.height_cm} onChange={(e) => setField("height_cm", e.target.value)} /></div>
                                                <div className="space-y-1"><label className="text-xs text-muted-foreground">Weight (kg)</label><Input type="number" value={editForm.weight_kg} onChange={(e) => setField("weight_kg", e.target.value)} /></div>
                                                <div className="space-y-1"><label className="text-xs text-muted-foreground">Volume (cc)</label><Input type="number" value={editForm.volume_cc} onChange={(e) => setField("volume_cc", e.target.value)} /></div>
                                                <div className="space-y-1"><label className="text-xs text-muted-foreground">Pallet Quantity</label><Input type="number" value={editForm.pallet_quantity} onChange={(e) => setField("pallet_quantity", e.target.value)} /></div>
                                                <div className="space-y-1"><label className="text-xs text-muted-foreground">Case Quantity</label><Input type="number" value={editForm.case_quantity} onChange={(e) => setField("case_quantity", e.target.value)} /></div>
                                                <div className="space-y-1"><label className="text-xs text-muted-foreground">Inner Quantity</label><Input type="number" value={editForm.inner_quantity} onChange={(e) => setField("inner_quantity", e.target.value)} /></div>
                                            </div>
                                        </div>
                                    </TabsContent>

                                    <TabsContent value="storage" className="mt-0">
                                        <div className="rounded-lg border bg-card p-4 space-y-4">
                                            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Storage and Picking</p>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div className="space-y-1"><label className="text-xs text-muted-foreground">Storage Condition</label><Input value={editForm.storage_condition} onChange={(e) => setField("storage_condition", e.target.value)} /></div>
                                                <div className="space-y-1"><label className="text-xs text-muted-foreground">Shelf Life Days</label><Input type="number" value={editForm.shelf_life_days} onChange={(e) => setField("shelf_life_days", e.target.value)} /></div>
                                                <div className="space-y-1"><label className="text-xs text-muted-foreground">Picking Strategy</label><Input value={editForm.picking_strategy} onChange={(e) => setField("picking_strategy", e.target.value)} /></div>
                                                <div className="space-y-1"><label className="text-xs text-muted-foreground">Pick Face Capacity</label><Input type="number" value={editForm.pick_face_capacity} onChange={(e) => setField("pick_face_capacity", e.target.value)} /></div>
                                                <div className="space-y-1"><label className="text-xs text-muted-foreground">Replenishment Point</label><Input type="number" value={editForm.pick_face_replenishment_point} onChange={(e) => setField("pick_face_replenishment_point", e.target.value)} /></div>
                                                <div className="space-y-1"><label className="text-xs text-muted-foreground">Max Stack Height</label><Input type="number" value={editForm.max_stack_height} onChange={(e) => setField("max_stack_height", e.target.value)} /></div>
                                                <div className="space-y-1"><label className="text-xs text-muted-foreground">Max Qty Per Bin</label><Input type="number" value={editForm.max_qty_per_bin} onChange={(e) => setField("max_qty_per_bin", e.target.value)} /></div>
                                                <div className="space-y-1">
                                                <label className="text-xs text-muted-foreground">Preferred Zones (Select to append)</label>
                                                <ZoneTypeSelect 
                                                    value="" 
                                                    onValueChange={(val) => {
                                                        if (!val) return;
                                                        const current = editForm.preferred_zones ? editForm.preferred_zones.split(',').map(s => s.trim()).filter(Boolean) : [];
                                                        if (!current.includes(val)) {
                                                            const newValue = [...current, val].join(', ');
                                                            setField("preferred_zones", newValue);
                                                        }
                                                    }} 
                                                />
                                                <Input value={editForm.preferred_zones} onChange={(e) => setField("preferred_zones", e.target.value)} placeholder="e.g. BULK, RACK" />
                                            </div>
                                                <div className="space-y-1">
                                                <label className="text-xs text-muted-foreground">Preferred Bin Types (Select to append)</label>
                                                <BinTypeSelect 
                                                    value="" 
                                                    onValueChange={(val) => {
                                                        if (!val) return;
                                                        const current = editForm.preferred_bin_types ? editForm.preferred_bin_types.split(',').map(s => s.trim()).filter(Boolean) : [];
                                                        if (!current.includes(val)) {
                                                            const newValue = [...current, val].join(', ');
                                                            setField("preferred_bin_types", newValue);
                                                        }
                                                    }} 
                                                />
                                                <Input value={editForm.preferred_bin_types} onChange={(e) => setField("preferred_bin_types", e.target.value)} placeholder="e.g. STANDARD, BULK_BIN" />
                                            </div>
                                            </div>
                                        </div>
                                    </TabsContent>

                                    <TabsContent value="compliance" className="mt-0">
                                        <div className="rounded-lg border bg-card p-4 space-y-4">
                                            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Compliance and Tax</p>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div className="space-y-1"><label className="text-xs text-muted-foreground">Hazard Class</label><Input value={editForm.hazard_class} onChange={(e) => setField("hazard_class", e.target.value)} /></div>
                                                <div className="space-y-1"><label className="text-xs text-muted-foreground">Hazmat Code</label><Input value={editForm.hazmat_code} onChange={(e) => setField("hazmat_code", e.target.value)} /></div>
                                                <div className="space-y-1"><label className="text-xs text-muted-foreground">Inspection Rule</label><Input value={editForm.inspection_rule} onChange={(e) => setField("inspection_rule", e.target.value)} /></div>
                                                <div className="space-y-1"><label className="text-xs text-muted-foreground">Sample Percentage</label><Input type="number" value={editForm.sample_percentage} onChange={(e) => setField("sample_percentage", e.target.value)} /></div>
                                                <div className="space-y-1"><label className="text-xs text-muted-foreground">HSN Code</label><Input value={editForm.hsn_code} onChange={(e) => setField("hsn_code", e.target.value)} /></div>
                                                <div className="space-y-1"><label className="text-xs text-muted-foreground">Tax Rate</label><Input type="number" value={editForm.tax_rate} onChange={(e) => setField("tax_rate", e.target.value)} /></div>
                                                <div className="space-y-1 md:col-span-2">
                                                    <label className="text-xs text-muted-foreground">Compatibility Rules Keys (comma-separated)</label>
                                                    <Input
                                                        value={editForm.compatibility_rules_keys}
                                                        onChange={(e) => setField("compatibility_rules_keys", e.target.value)}
                                                        placeholder="additionalProp1"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </TabsContent>

                                    <TabsContent value="rules" className="mt-0">
                                        <div className="rounded-lg border bg-card p-4 space-y-4">
                                            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Boolean Rules and Status</p>
                                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={editForm.fefo_enabled} onChange={(e) => setField("fefo_enabled", e.target.checked)} /> FEFO Enabled</label>
                                                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={editForm.fifo_enabled} onChange={(e) => setField("fifo_enabled", e.target.checked)} /> FIFO Enabled</label>
                                                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={editForm.expiry_required} onChange={(e) => setField("expiry_required", e.target.checked)} /> Expiry Required</label>
                                                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={editForm.lot_required} onChange={(e) => setField("lot_required", e.target.checked)} /> Lot Required</label>
                                                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={editForm.batch_required} onChange={(e) => setField("batch_required", e.target.checked)} /> Batch Required</label>
                                                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={editForm.serial_required} onChange={(e) => setField("serial_required", e.target.checked)} /> Serial Required</label>
                                                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={editForm.pick_face_eligible} onChange={(e) => setField("pick_face_eligible", e.target.checked)} /> Pick Face Eligible</label>
                                                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={editForm.is_hazardous} onChange={(e) => setField("is_hazardous", e.target.checked)} /> Is Hazardous</label>
                                                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={editForm.requires_inspection} onChange={(e) => setField("requires_inspection", e.target.checked)} /> Requires Inspection</label>
                                                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={editForm.quarantine_on_failure} onChange={(e) => setField("quarantine_on_failure", e.target.checked)} /> Quarantine On Failure</label>
                                                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={editForm.active} onChange={(e) => setField("active", e.target.checked)} /> Active</label>
                                            </div>

                                            <div className="rounded-md border bg-muted/20 p-3 space-y-3">
                                                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Audit Information (Read Only)</p>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                    <div className="space-y-1"><label className="text-xs text-muted-foreground">Created By</label><Input value={editForm.created_by} disabled /></div>
                                                    <div className="space-y-1"><label className="text-xs text-muted-foreground">Updated By</label><Input value={editForm.updated_by} disabled /></div>
                                                    <div className="space-y-1"><label className="text-xs text-muted-foreground">Created At</label><Input value={editForm.created_at} disabled /></div>
                                                    <div className="space-y-1"><label className="text-xs text-muted-foreground">Updated At</label><Input value={editForm.updated_at} disabled /></div>
                                                </div>
                                            </div>
                                        </div>
                                    </TabsContent>
                                </Tabs>
                            </>
                        )}
                    </div>

                    <div className="p-4 border-t shrink-0 bg-background flex items-center justify-end gap-2">
                        <Button variant="outline" onClick={closeEditModal} disabled={isEditSaving}>Cancel</Button>
                        <Button onClick={submitEdit} disabled={isEditLoading || isEditSaving || !editingSku}>
                            {isEditSaving ? "Saving..." : "Save Changes"}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default SkuManagement;
