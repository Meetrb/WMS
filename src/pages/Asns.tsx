import { useState, useEffect, useRef } from "react";
import { z } from "zod";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEnterNavigation } from "@/hooks/useEnterNavigation";
import { useDebounce } from "use-debounce";
import { cn } from "@/lib/utils";
import { vendorService } from "@/services/vendorService";
import { skuService } from "@/services/skuService";
import { warehouseService } from "@/services/warehouseService";
import { asnService } from "@/services/asnService";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { PhoneInput, COUNTRY_DATA, isPhoneValid } from "@/components/ui/PhoneInput";
import {
    Plus,
    Eye,
    Edit,
    FileText,
    Search,
    Package,
    Building2,
    Truck,
    UserCircle,
    Loader2,
    ChevronDown,
    Trash2,
    LayoutList,
    ArrowUpRight,
    Calendar,
    Settings2,
    StickyNote,
    Save,
    AlertCircle
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Link } from "react-router-dom";
import {
    Popover,
    PopoverAnchor,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { UomSelect } from "@/components/ui/uom-select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useAuth } from "@/components/auth-provider";
import { formatDisplayDate } from "@/lib/date";

// Safely format date strings
const formatDate = (dateStr?: string) => {
    if (!dateStr || dateStr === "N/A") return null;
    return formatDisplayDate(dateStr, "-");
};
// Removed mock data in favor of backend API data

const getStatusColor = (status: string) => {
    const normalized = String(status ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");

    if (normalized === "draft") {
        return "bg-slate-100 text-slate-700 dark:bg-slate-500/20 dark:text-slate-300";
    }

    if (normalized === "pending_arrival" || normalized === "pending") {
        return "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300";
    }

    if (normalized === "in_transit" || normalized === "transit") {
        return "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300";
    }

    if (normalized === "arrived") {
        return "bg-cyan-100 text-cyan-700 dark:bg-cyan-500/20 dark:text-cyan-300";
    }

    if (normalized === "receiving") {
        return "bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300";
    }

    if (normalized === "received") {
        return "bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300";
    }

    if (normalized === "completed" || normalized === "closed") {
        return "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300";
    }

    return "bg-gray-100 text-gray-700 dark:bg-gray-500/20 dark:text-gray-300";
};

const isDraftStatus = (status: unknown) => String(status ?? "").trim().toLowerCase() === "draft";

const shipmentItemSchema = z.object({
    sku: z.string().min(1, "Required"),
    description: z.string().min(1, "Required"),
    quantity: z.coerce.number().positive("Quantity must be greater than zero"),
    unit: z.string().min(1, "Required"),
    unit_price: z.coerce.number().min(0, "Price cannot be negative"),
    total_price: z.coerce.number().min(0),
    lot: z.string().optional().or(z.literal('')),
    expiry_date: z.string().optional().or(z.literal('')),
    hsn_code: z.string().optional().or(z.literal('')),
});

const shipmentSchema = z.object({
    po_number: z.string().min(1, "Required"),
    supplier_code: z.string().min(1, "Required"),
    notes: z.string().optional().or(z.literal('')),
    items: z.array(shipmentItemSchema).min(1, "At least one item is required"),
});

const editAsnSchema = z.object({
    asn_number: z.string().min(1, "Required").regex(/^[a-zA-Z0-9\-_]+$/, "Invalid format"),
    asn_date: z.string().min(1, "Required"),
    shipment_id: z.string().min(1, "Required").regex(/^[a-zA-Z0-9\-_]+$/, "Invalid format"),
    expected_date: z.string().min(1, "Required").refine((val) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return new Date(val) >= today;
    }, "Expected date cannot be in the past"),
    status: z.string().min(1, "Required"),
    notes: z.string().optional().or(z.literal('')),
    supplier_code: z.string().min(1, "Required"),
    warehouse_id: z.string().min(1, "Required"),
    warehouse_code: z.string().optional(),
    shipments: z.array(shipmentSchema).min(1, "At least one shipment is required"),
}).superRefine((data, ctx) => {
    const poNumbers = data.shipments.map(s => s.po_number);
    const duplicates = poNumbers.filter((po, index) => poNumbers.indexOf(po) !== index);

    if (duplicates.length > 0) {
        duplicates.forEach(dup => {
            const index = poNumbers.lastIndexOf(dup);
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: `Duplicate PO Number: ${dup}`,
                path: ['shipments', index, 'po_number'],
            });
        });
    }
});

interface SupplierCreateForm {
    code: string;
    name: string;
    gstin: string;
    contact_person: string;
    country_code: string;
    phone: string;
    email: string;
    address: string;
    payment_terms: string;
}

interface SupplierEditForm {
    name: string;
    gstin: string;
    contact_person: string;
    country_code: string;
    phone: string;
    email: string;
    address: string;
    payment_terms: string;
}

interface SkuCreateForm {
    sku_code: string;
    description: string;
    short_description: string;
    primary_barcode: string;
    alt_barcodes: string;
    base_uom: string;
}

const DEFAULT_SUPPLIER_FORM: SupplierCreateForm = {
    code: "",
    name: "",
    gstin: "",
    contact_person: "",
    country_code: "+91",
    phone: "",
    email: "",
    address: "",
    payment_terms: "",
};

const DEFAULT_SKU_CREATE_FORM: SkuCreateForm = {
    sku_code: "",
    description: "",
    short_description: "",
    primary_barcode: "",
    alt_barcodes: "",
    base_uom: "PCS",
};

const createDefaultItem = () => ({
    sku: "",
    description: "",
    quantity: 0,
    unit: "PCS",
    unit_price: 0,
    total_price: 0,
    lot: "",
    expiry_date: "",
    hsn_code: "",
});

const createDefaultShipment = () => ({
    po_number: "",
    supplier_code: "",
    notes: "",
    items: [createDefaultItem()],
});

type EditAsnFormValues = z.infer<typeof editAsnSchema>;

// Sort field type
type SortField = 'date' | 'asn_number' | 'expected_arrival' | 'status' | 'shipment_id';
type SortOrder = 'asc' | 'desc';

// Status sort order for Status field
const STATUS_SORT_ORDER: { [key: string]: number } = {
    'Pending Arrival': 0,
    'Draft': 1,
    'Arrived': 2,
    'Completed': 3,
    'Closed': 4,
    'In Transit': 5,
    'Receiving': 6,
    'Received': 7,
};

// Get order button label based on sort field and direction
const getOrderLabel = (field: SortField, order: SortOrder): string => {
    const arrow = order === 'desc' ? '↓' : '↑';

    if (field === 'date') {
        return order === 'desc' ? '↓ Newest' : '↑ Oldest';
    } else if (field === 'asn_number' || field === 'shipment_id') {
        return order === 'desc' ? '↓ Z→A' : '↑ A→Z';
    } else if (field === 'expected_arrival') {
        return order === 'desc' ? '↓ Latest' : '↑ Earliest';
    } else if (field === 'status') {
        return order === 'desc' ? '↓ Closed first' : '↑ Pending first';
    }
    return arrow;
};

const toNumber = (value: string): number => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
};

const csvToArray = (value: string): string[] =>
    value
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean);

const toJsonText = (value: unknown, fallback: string = "{}") => {
    if (!value || typeof value !== "object") return fallback;
    try {
        return JSON.stringify(value, null, 2);
    } catch {
        return fallback;
    }
};

interface SkuEditForm {
    description: string;
    short_description: string;
    primary_barcode: string;
    alt_barcodes: string;
    base_uom: string;
    alt_uom: string;
    uom_conversion: string;
    uom_hierarchy: string;
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
    compatibility_rules: string;
    is_hazardous: boolean;
    hazard_class: string;
    hazmat_code: string;
    requires_inspection: boolean;
    inspection_rule: string;
    sample_percentage: string;
    quarantine_on_failure: boolean;
    hsn_code: string;
    tax_rate: string;
    active: boolean;
}

const DEFAULT_SKU_EDIT_FORM: SkuEditForm = {
    description: "",
    short_description: "",
    primary_barcode: "",
    alt_barcodes: "",
    base_uom: "",
    alt_uom: "",
    uom_conversion: "0",
    uom_hierarchy: "{}",
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
    compatibility_rules: "{}",
    is_hazardous: false,
    hazard_class: "",
    hazmat_code: "",
    requires_inspection: false,
    inspection_rule: "",
    sample_percentage: "0",
    quarantine_on_failure: false,
    hsn_code: "",
    tax_rate: "0",
    active: true,
};

const buildSkuEditForm = (raw: any): SkuEditForm => ({
    description: String(raw?.description ?? ""),
    short_description: String(raw?.short_description ?? raw?.shortDescription ?? ""),
    primary_barcode: String(raw?.primary_barcode ?? raw?.primaryBarcode ?? ""),
    alt_barcodes: Array.isArray(raw?.alt_barcodes)
        ? raw.alt_barcodes.join(", ")
        : Array.isArray(raw?.altBarcodes)
            ? raw.altBarcodes.join(", ")
            : "",
    base_uom: String(raw?.base_uom ?? raw?.baseUom ?? ""),
    alt_uom: String(raw?.alt_uom ?? raw?.altUom ?? ""),
    uom_conversion: String(raw?.uom_conversion ?? raw?.uomConversion ?? 0),
    uom_hierarchy: toJsonText(raw?.uom_hierarchy ?? raw?.uomHierarchy, "{}"),
    length_cm: String(raw?.length_cm ?? raw?.lengthCm ?? 0),
    width_cm: String(raw?.width_cm ?? raw?.widthCm ?? 0),
    height_cm: String(raw?.height_cm ?? raw?.heightCm ?? 0),
    weight_kg: String(raw?.weight_kg ?? raw?.weightKg ?? 0),
    volume_cc: String(raw?.volume_cc ?? raw?.volumeCc ?? 0),
    pallet_quantity: String(raw?.pallet_quantity ?? raw?.palletQuantity ?? 0),
    case_quantity: String(raw?.case_quantity ?? raw?.caseQuantity ?? 0),
    inner_quantity: String(raw?.inner_quantity ?? raw?.innerQuantity ?? 0),
    item_type: String(raw?.item_type ?? raw?.itemType ?? ""),
    item_category: String(raw?.item_category ?? raw?.itemCategory ?? ""),
    storage_condition: String(raw?.storage_condition ?? raw?.storageCondition ?? ""),
    velocity_class: String(raw?.velocity_class ?? raw?.velocityClass ?? ""),
    fefo_enabled: Boolean(raw?.fefo_enabled ?? raw?.fefoEnabled),
    fifo_enabled: Boolean(raw?.fifo_enabled ?? raw?.fifoEnabled),
    shelf_life_days: String(raw?.shelf_life_days ?? raw?.shelfLifeDays ?? 0),
    batch_required: Boolean(raw?.batch_required ?? raw?.batchRequired),
    serial_required: Boolean(raw?.serial_required ?? raw?.serialRequired),
    pick_face_eligible: Boolean(raw?.pick_face_eligible ?? raw?.pickFaceEligible),
    pick_face_capacity: String(raw?.pick_face_capacity ?? raw?.pickFaceCapacity ?? 0),
    pick_face_replenishment_point: String(raw?.pick_face_replenishment_point ?? raw?.pickFaceReplenishmentPoint ?? 0),
    preferred_zones: Array.isArray(raw?.preferred_zones)
        ? raw.preferred_zones.join(", ")
        : Array.isArray(raw?.preferredZones)
            ? raw.preferredZones.join(", ")
            : "",
    preferred_bin_types: Array.isArray(raw?.preferred_bin_types)
        ? raw.preferred_bin_types.join(", ")
        : Array.isArray(raw?.preferredBinTypes)
            ? raw.preferredBinTypes.join(", ")
            : "",
    picking_strategy: String(raw?.picking_strategy ?? raw?.pickingStrategy ?? ""),
    max_stack_height: String(raw?.max_stack_height ?? raw?.maxStackHeight ?? 0),
    max_qty_per_bin: String(raw?.max_qty_per_bin ?? raw?.maxQtyPerBin ?? 0),
    compatibility_rules: toJsonText(raw?.compatibility_rules ?? raw?.compatibilityRules, "{}"),
    is_hazardous: Boolean(raw?.is_hazardous ?? raw?.isHazmat ?? raw?.isHazardous),
    hazard_class: String(raw?.hazard_class ?? raw?.hazardClass ?? ""),
    hazmat_code: String(raw?.hazmat_code ?? raw?.hazmatCode ?? ""),
    requires_inspection: Boolean(raw?.requires_inspection ?? raw?.requiresInspection),
    inspection_rule: String(raw?.inspection_rule ?? raw?.inspectionRule ?? ""),
    sample_percentage: String(raw?.sample_percentage ?? raw?.samplePercentage ?? 0),
    quarantine_on_failure: Boolean(raw?.quarantine_on_failure ?? raw?.quarantineOnFailure),
    hsn_code: String(raw?.hsn_code ?? raw?.hsnCode ?? ""),
    tax_rate: String(raw?.tax_rate ?? raw?.taxRate ?? 0),
    active: Boolean(raw?.active ?? true),
});

// Sort ASN array
const sortAsns = (asnList: any[], field: SortField, order: SortOrder): any[] => {
    const sorted = [...asnList].sort((a, b) => {
        let aVal: any;
        let bVal: any;

        if (field === 'date') {
            aVal = new Date(a.asn_date || 0).getTime();
            bVal = new Date(b.asn_date || 0).getTime();
        } else if (field === 'asn_number') {
            aVal = a.asn_number || '';
            bVal = b.asn_number || '';
        } else if (field === 'expected_arrival') {
            aVal = new Date(a.expected_date || 0).getTime();
            bVal = new Date(b.expected_date || 0).getTime();
        } else if (field === 'status') {
            const statusA = a.status || a.audit?.status || 'Pending Arrival';
            const statusB = b.status || b.audit?.status || 'Pending Arrival';
            aVal = STATUS_SORT_ORDER[statusA] ?? 999;
            bVal = STATUS_SORT_ORDER[statusB] ?? 999;
        } else if (field === 'shipment_id') {
            aVal = a.shipment_id || '';
            bVal = b.shipment_id || '';
        }

        if (typeof aVal === 'string') {
            aVal = aVal.toLowerCase();
            bVal = bVal.toLowerCase();
            return order === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
        } else {
            return order === 'asc' ? aVal - bVal : bVal - aVal;
        }
    });

    return sorted;
};

const Asns = () => {
    const [asns, setAsns] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isFetchingDetails, setIsFetchingDetails] = useState(false);
    const [selectedAsn, setSelectedAsn] = useState<any | null>(null);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [editingAsn, setEditingAsn] = useState<any | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [sortField, setSortField] = useState<SortField>('date');
    const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [warehouses, setWarehouses] = useState<any[]>([]);
    const [suppliers, setSuppliers] = useState<any[]>([]);
    const { user } = useAuth();
    const editFormRef = useRef<HTMLFormElement>(null);
    const [searchQuery, setSearchQuery] = useState("");

    useEnterNavigation(editFormRef, { submitOnLast: true });

    // Supplier Search States
    const [supplierSearch, setSupplierSearch] = useState("");
    const [debouncedSupplierSearch] = useDebounce(supplierSearch, 300);
    const [activeSupplierShipmentIndex, setActiveSupplierShipmentIndex] = useState<number | null>(null);
    const [allSuppliers, setAllSuppliers] = useState<any[]>([]);
    const [isSupplierDropdownOpen, setIsSupplierDropdownOpen] = useState(false);
    const [activeSupplierIndex, setActiveSupplierIndex] = useState(-1);
    const [isSearchingSuppliers, setIsSearchingSuppliers] = useState(false);

    // SKU Search States
    const [itemSearch, setItemSearch] = useState("");
    const [debouncedItemSearch] = useDebounce(itemSearch, 300);
    const [pendingItemRow, setPendingItemRow] = useState<{ sIdx: number, iIdx: number } | null>(null);
    const [allItems, setAllItems] = useState<any[]>([]);
    const [activeSkuIndex, setActiveSkuIndex] = useState(-1);
    const [isSearchingItems, setIsSearchingItems] = useState(false);

    // Creation States
    const [isCreateSupplierOpen, setIsCreateSupplierOpen] = useState(false);
    const [supplierCreateForm, setSupplierCreateForm] = useState<SupplierCreateForm>(DEFAULT_SUPPLIER_FORM);
    const [isCreatingSupplier, setIsCreatingSupplier] = useState(false);

    const [isCreateSkuOpen, setIsCreateSkuOpen] = useState(false);
    const [skuCreateForm, setSkuCreateForm] = useState<SkuCreateForm>(DEFAULT_SKU_CREATE_FORM);
    const [isCreatingSku, setIsCreatingSku] = useState(false);
    const [skuCreateSource, setSkuCreateSource] = useState<{ sIdx: number, iIdx: number } | null>(null);

    const [isEditSupplierOpen, setIsEditSupplierOpen] = useState(false);
    const [supplierEditForm, setSupplierEditForm] = useState<SupplierEditForm>({
        name: "",
        gstin: "",
        contact_person: "",
        country_code: "+91",
        phone: "",
        email: "",
        address: "",
        payment_terms: "",
    });
    const [isUpdatingSupplier, setIsUpdatingSupplier] = useState(false);
    const [editingSupplierId, setEditingSupplierId] = useState<string | number | null>(null);
    const [isEditSkuOpen, setIsEditSkuOpen] = useState(false);
    const [skuEditForm, setSkuEditForm] = useState<SkuEditForm>(DEFAULT_SKU_EDIT_FORM);

    const createSupplierButtonRef = useRef<HTMLButtonElement>(null);
    const createSkuButtonRef = useRef<HTMLButtonElement>(null);
    const expectedDateInputRef = useRef<HTMLInputElement>(null);
    const asnNumberInputRef = useRef<HTMLInputElement>(null);
    const shipmentIdInputRef = useRef<HTMLInputElement>(null);

    const editForm = useForm<EditAsnFormValues>({
        resolver: zodResolver(editAsnSchema),
        defaultValues: {
            asn_number: "",
            asn_date: "",
            shipment_id: "",
            expected_date: "",
            status: "",
            notes: "",
            supplier_code: "",
            warehouse_id: "",
            shipments: [createDefaultShipment()],
        },
    });

    useEffect(() => {
        const fetchAsns = async () => {
            try {
                const data = await asnService.getAll();
                // Ensure data is an array
                setAsns(Array.isArray(data) ? data : []);
            } catch (error) {
                console.error("Failed to fetch ASNs", error);
                toast.error("Failed to load ASNs from server.");
            } finally {
                setIsLoading(false);
            }
        };

        const fetchWarehouses = async () => {
            try {
                const data = await warehouseService.getActive();
                setWarehouses(Array.isArray(data) ? data : []);
            } catch (error) {
                console.error("Failed to fetch warehouses", error);
            }
        };

        const fetchSuppliers = async () => {
            try {
                const data = await vendorService.getAll();
                setSuppliers(Array.isArray(data) ? data : []);
            } catch (error) {
                console.error("Failed to fetch suppliers", error);
            }
        };

        fetchAsns();
        fetchWarehouses();
        fetchSuppliers();
    }, []);

    // Supplier Search Logic
    useEffect(() => {
        const searchVendors = async () => {
            if (!debouncedSupplierSearch.trim()) {
                setAllSuppliers([]);
                return;
            }
            setIsSearchingSuppliers(true);
            try {
                const data = await vendorService.search(debouncedSupplierSearch);
                setAllSuppliers(Array.isArray(data) ? data : []);
            } catch (error) {
                console.error("Vendor search failed", error);
            } finally {
                setIsSearchingSuppliers(false);
            }
        };
        searchVendors();
    }, [debouncedSupplierSearch]);

    // SKU Search Logic
    useEffect(() => {
        const searchItems = async () => {
            if (!debouncedItemSearch.trim()) {
                setAllItems([]);
                setActiveSkuIndex(-1);
                return;
            }
            setIsSearchingItems(true);
            try {
                const data = await skuService.search(debouncedItemSearch);
                const items = (Array.isArray(data) ? data : []).filter((item: any) => item.active !== false);
                setAllItems(items);
                setActiveSkuIndex(items.length > 0 ? 0 : -1);
            } catch (error) {
                console.error("SKU search failed", error);
            } finally {
                setIsSearchingItems(false);
            }
        };
        searchItems();
    }, [debouncedItemSearch]);

    const selectSupplier = (supplier: any, shipmentIndex: number) => {
        editForm.setValue(`shipments.${shipmentIndex}.supplier_code`, supplier.code);
        // Also update global supplier_code if it's the first shipment or if needed
        if (shipmentIndex === 0) {
            editForm.setValue('supplier_code', supplier.code);
        }
        setIsSupplierDropdownOpen(false);
        setSupplierSearch("");
    };

    const selectSku = (shipmentIdx: number, itemIdx: number, sku: any) => {
        editForm.setValue(`shipments.${shipmentIdx}.items.${itemIdx}.sku`, sku.skuCode || sku.sku_code || sku.code);
        editForm.setValue(`shipments.${shipmentIdx}.items.${itemIdx}.description`, sku.productName || sku.name || sku.description || "");
        editForm.setValue(`shipments.${shipmentIdx}.items.${itemIdx}.unit`, sku.baseUom || sku.base_uom || sku.uom || 'PCS');
        editForm.setValue(`shipments.${shipmentIdx}.items.${itemIdx}.hsn_code`, sku.hsnCode || sku.hsn_code || '');

        setPendingItemRow(null);
        setItemSearch("");
        setActiveSkuIndex(-1);
    };

    const handleSkuKeyDown = (e: React.KeyboardEvent, sIdx: number, iIdx: number) => {
        if (!allItems.length) return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActiveSkuIndex(prev => (prev < allItems.length - 1 ? prev + 1 : prev));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActiveSkuIndex(prev => (prev > 0 ? prev - 1 : 0));
        } else if (e.key === 'Enter') {
            if (activeSkuIndex >= 0 && activeSkuIndex < allItems.length) {
                e.preventDefault();
                selectSku(sIdx, iIdx, allItems[activeSkuIndex]);
            }
        } else if (e.key === 'Escape') {
            setPendingItemRow(null);
            setActiveSkuIndex(-1);
        }
    };

    const openCreateSupplierDialog = () => {
        setSupplierCreateForm({
            ...DEFAULT_SUPPLIER_FORM,
            name: supplierSearch.trim(),
        });
        setIsCreateSupplierOpen(true);
    };

    const openEditSupplierDialog = async (shipmentIndex: number) => {
        const supplierCode = editForm.getValues(`shipments.${shipmentIndex}.supplier_code`);
        if (!supplierCode) return;

        setIsUpdatingSupplier(true);
        try {
            const supplier = await vendorService.getByCode(supplierCode);
            if (supplier) {
                setEditingSupplierId(supplier.id);
                setSupplierEditForm({
                    name: supplier.name || "",
                    gstin: supplier.gstin || "",
                    contact_person: supplier.contact_person || "",
                    country_code: supplier.phone?.startsWith("+") ? supplier.phone.substring(0, 3) : "+91",
                    phone: supplier.phone?.startsWith("+") ? supplier.phone.substring(3) : (supplier.phone || ""),
                    email: supplier.email || "",
                    address: supplier.address || "",
                    payment_terms: supplier.payment_terms || "",
                });
                setIsEditSupplierOpen(true);
            }
        } catch (error) {
            console.error("Failed to load supplier for edit", error);
            toast.error("Failed to load supplier details");
        } finally {
            setIsUpdatingSupplier(false);
        }
    };

    const handleCreateSupplier = async () => {
        if (!isPhoneValid(supplierCreateForm.phone, supplierCreateForm.country_code)) {
            toast.error("Invalid phone number");
            return;
        }

        setIsCreatingSupplier(true);
        try {
            const fullPhone = `${supplierCreateForm.country_code}${supplierCreateForm.phone}`;
            const created = await vendorService.create({
                ...supplierCreateForm,
                phone: fullPhone,
            });

            const createdSupplier = {
                id: String(created?.id || created?.supplier_id || ""),
                code: String(created?.code || supplierCreateForm.code.trim()),
                name: String(created?.name || supplierCreateForm.name.trim()),
            };

            const targetShipmentIndex = activeSupplierShipmentIndex ?? 0;
            selectSupplier(createdSupplier, targetShipmentIndex);
            setIsCreateSupplierOpen(false);
            toast.success("Supplier created successfully");
        } catch (error) {
            console.error("Failed to create supplier", error);
            toast.error("Failed to create supplier");
        } finally {
            setIsCreatingSupplier(false);
        }
    };

    const handleUpdateSupplier = async () => {
        if (!editingSupplierId) return;
        if (!isPhoneValid(supplierEditForm.phone, supplierEditForm.country_code)) {
            toast.error("Invalid phone number");
            return;
        }

        setIsUpdatingSupplier(true);
        try {
            const fullPhone = `${supplierEditForm.country_code}${supplierEditForm.phone}`;
            await vendorService.update(editingSupplierId, {
                ...supplierEditForm,
                phone: fullPhone,
            });
            toast.success("Supplier updated successfully");
            setIsEditSupplierOpen(false);
        } catch (error) {
            console.error("Failed to update supplier", error);
            toast.error("Failed to update supplier");
        } finally {
            setIsUpdatingSupplier(false);
        }
    };

    const openCreateSkuDialog = (shipmentIdx: number, itemIdx: number, code: string) => {
        setSkuCreateForm({
            ...DEFAULT_SKU_CREATE_FORM,
            sku_code: code,
        });
        setSkuCreateSource({ sIdx: shipmentIdx, iIdx: itemIdx });
        setIsCreateSkuOpen(true);
    };

    const handleCreateSku = async () => {
        if (!skuCreateForm.sku_code.trim()) {
            toast.error("SKU code is required");
            return;
        }

        setIsCreatingSku(true);
        try {
            const created = await skuService.create(skuCreateForm);
            if (skuCreateSource) {
                selectSku(skuCreateSource.sIdx, skuCreateSource.iIdx, created);
            }
            setIsCreateSkuOpen(false);
            toast.success("SKU created successfully");
        } catch (error) {
            console.error("Failed to create SKU", error);
            toast.error("Failed to create SKU");
        } finally {
            setIsCreatingSku(false);
        }
    };

    const openSkuEditCard = async (sIdx: number, iIdx: number, sku: any) => {
        const skuId = sku.id || sku.item_id;
        if (!skuId) {
            toast.error("SKU not synced with system");
            return;
        }

        setIsSaving(true); // Reusing isSaving for loading state here
        try {
            const raw = await skuService.getRawById(skuId);
            setSkuEditForm(buildSkuEditForm(raw));
            setSkuCreateSource({ sIdx, iIdx }); // Reusing for source tracking
            setEditingSupplierId(skuId); // Reusing state for SKU ID
            setIsEditSkuOpen(true);
        } catch (error) {
            console.error("Failed to load SKU", error);
            toast.error("Failed to load SKU details");
        } finally {
            setIsSaving(false);
        }
    };

    const handleSaveSkuCard = async () => {
        if (!editingSupplierId || !skuCreateSource) return;

        setIsSaving(true);
        try {
            const payload = {
                ...skuEditForm,
                alt_barcodes: csvToArray(skuEditForm.alt_barcodes),
                uom_conversion: toNumber(skuEditForm.uom_conversion),
                uom_hierarchy: JSON.parse(skuEditForm.uom_hierarchy || "{}"),
                length_cm: toNumber(skuEditForm.length_cm),
                width_cm: toNumber(skuEditForm.width_cm),
                height_cm: toNumber(skuEditForm.height_cm),
                weight_kg: toNumber(skuEditForm.weight_kg),
                volume_cc: toNumber(skuEditForm.volume_cc),
                pallet_quantity: toNumber(skuEditForm.pallet_quantity),
                case_quantity: toNumber(skuEditForm.case_quantity),
                inner_quantity: toNumber(skuEditForm.inner_quantity),
                shelf_life_days: toNumber(skuEditForm.shelf_life_days),
                pick_face_capacity: toNumber(skuEditForm.pick_face_capacity),
                pick_face_replenishment_point: toNumber(skuEditForm.pick_face_replenishment_point),
                preferred_zones: csvToArray(skuEditForm.preferred_zones),
                preferred_bin_types: csvToArray(skuEditForm.preferred_bin_types),
                max_stack_height: toNumber(skuEditForm.max_stack_height),
                max_qty_per_bin: toNumber(skuEditForm.max_qty_per_bin),
                compatibility_rules: JSON.parse(skuEditForm.compatibility_rules || "{}"),
                sample_percentage: toNumber(skuEditForm.sample_percentage),
                tax_rate: toNumber(skuEditForm.tax_rate),
            };

            await skuService.update(editingSupplierId, payload);

            // Update the form values
            editForm.setValue(`shipments.${skuCreateSource.sIdx}.items.${skuCreateSource.iIdx}.description`, payload.description);
            editForm.setValue(`shipments.${skuCreateSource.sIdx}.items.${skuCreateSource.iIdx}.unit`, payload.base_uom);
            editForm.setValue(`shipments.${skuCreateSource.sIdx}.items.${skuCreateSource.iIdx}.hsn_code`, payload.hsn_code);

            toast.success("SKU updated successfully");
            setIsEditSkuOpen(false);
        } catch (error) {
            console.error("Failed to update SKU", error);
            toast.error("Failed to update SKU");
        } finally {
            setIsSaving(false);
        }
    };

    const handleEditClick = async (asn: any) => {
        const currentStatus = asn.status || asn.audit?.status;
        if (!isDraftStatus(currentStatus)) {
            toast.error("Only Draft ASNs can be updated.");
            return;
        }

        const id = asn.id || asn.asn_id;
        if (!id) {
            toast.error("Missing ASN ID");
            return;
        }

        setIsSaving(true); // Reuse isSaving for loading state or just handle inline
        try {
            const fullAsn = await asnService.getById(id);

            const normalizedShipments = Array.isArray(fullAsn.shipments) && fullAsn.shipments.length > 0
                ? fullAsn.shipments.map((shipment: any) => ({
                    po_number: shipment.po_number || shipment.poNumber || "",
                    supplier_code: shipment.supplier_code || fullAsn.supplier_code || "",
                    notes: shipment.notes || "",
                    items: Array.isArray(shipment.items) && shipment.items.length > 0
                        ? shipment.items.map((item: any) => ({
                            sku: item.sku || item.sku_code || item.item_master?.sku_code || "",
                            description: item.description || item.desc || item.item_master?.description || "",
                            quantity: Number(item.quantity ?? 0),
                            unit: item.unit || "",
                            unit_price: Number(item.unit_price ?? item.unitPrice ?? 0),
                            total_price: Number(item.total_price ?? item.totalPrice ?? 0),
                            lot: item.lot || item.batch_no || "",
                            expiry_date: item.expiry_date || item.expiryDate || item.expiry || "",
                            hsn_code: item.hsn_code || item.item_master?.hsn_code || "",
                        }))
                        : [createDefaultItem()],
                }))
                : [createDefaultShipment()];

            setEditingAsn(fullAsn);

            // Defensive mapping for all fields
            const asnNumber = fullAsn.asn_number || fullAsn.asnNumber || asn.asn_number || "";
            const shipmentId = fullAsn.shipment_id || fullAsn.shipmentId || asn.shipment_id || "";

            const rawAsnDate = fullAsn.asn_date || fullAsn.asnDate || asn.asn_date;
            const asnDate = rawAsnDate ? new Date(rawAsnDate).toISOString().slice(0, 16) : "";

            const rawExpectedDate = fullAsn.expected_date || fullAsn.expectedDate || asn.expected_date;
            const expectedDate = rawExpectedDate ? new Date(rawExpectedDate).toISOString().slice(0, 16) : "";

            const status = String(fullAsn.status || fullAsn.audit?.status || asn.status || "draft").trim().toLowerCase().replace(/[\s-]+/g, "_");
            const supplierCode = fullAsn.supplier_code || fullAsn.supplierCode || fullAsn.supplier?.code || fullAsn.shipments?.[0]?.supplier_code || asn.supplier_code || "";
            const warehouseId = fullAsn.warehouse_id || fullAsn.warehouseId || fullAsn.warehouse_code || fullAsn.warehouseCode || fullAsn.warehouse?.id || asn.warehouse_id || "";
            const warehouseCode = fullAsn.warehouse_code || fullAsn.warehouseCode || "";

            editForm.reset({
                asn_number: asnNumber,
                asn_date: asnDate,
                shipment_id: shipmentId,
                expected_date: expectedDate.slice(0, 10),
                status: status,
                notes: fullAsn.notes || asn.notes || "",
                supplier_code: supplierCode,
                warehouse_id: String(warehouseId),
                warehouse_code: String(warehouseCode),
                shipments: normalizedShipments,
            });
            setIsEditDialogOpen(true);
        } catch (error) {
            console.error("Failed to fetch full ASN for editing", error);
            toast.error("Failed to load ASN details for editing.");
        } finally {
            setIsSaving(false);
        }
    };


    const { fields: shipmentFields, append: appendShipment, remove: removeShipment } = useFieldArray({
        control: editForm.control,
        name: "shipments",
    });

    const onEditSubmit = async (values: EditAsnFormValues) => {
        if (!editingAsn) return;
        const currentStatus = editingAsn.status || editingAsn.audit?.status;
        if (!isDraftStatus(currentStatus)) {
            toast.error("Only Draft ASNs can be updated.");
            return;
        }

        setIsSaving(true);
        try {
            const formattedValues = {
                ...values,
                asn_date: new Date(values.asn_date).toISOString(),
                expected_date: values.expected_date, // Match YYYY-MM-DD format from CreateAsn
                shipments: values.shipments.map(s => ({
                    ...s,
                    items: s.items.map(item => ({
                        ...item,
                        quantity: Number(item.quantity || 0),
                        unit_price: Number(item.unit_price || 0),
                        total_price: Number(item.total_price || 0),
                        expiry_date: item.expiry_date && item.expiry_date.trim() !== "" ? item.expiry_date : null,
                    }))
                }))
            };

            const id = editingAsn.id || editingAsn.asn_id;
            await asnService.update(id, formattedValues);

            toast.success("ASN updated successfully");
            setIsEditDialogOpen(false);

            // Refresh list
            const data = await asnService.getAll();
            setAsns(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error("Failed to update ASN", error);
            toast.error("Failed to update ASN");
        } finally {
            setIsSaving(false);
        }
    };

    const handleViewDetails = async (asn: any) => {
        // Use ID for fetching complete details as per latest requirement
        const id = asn.id || asn.asn_id;

        if (!id) {
            console.error("No valid ID found for row", asn);
            setSelectedAsn(asn);
            setIsDialogOpen(true);
            return;
        }

        setSelectedAsn(asn); // Set initial partial data for instant feedback
        setIsDialogOpen(true);
        setIsFetchingDetails(true);
        try {
            // Fetch full data using getById (/asn/{asn_id})
            const fullData = await asnService.getById(id);
            setSelectedAsn(fullData);
        } catch (error) {
            console.error("Failed to fetch ASN details", error);
            toast.error("Failed to load full ASN details. Showing available info.");
        } finally {
            setIsFetchingDetails(false);
        }
    };

    return (
        <div className="p-4 md:p-8 space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="font-heading text-3xl font-bold">Advance Shipment Notices</h1>
                    <p className="text-muted-foreground">Manage incoming shipments from suppliers</p>
                </div>
                <div className="flex items-center gap-3">
                    <Link to="/dashboard/asns/create">
                        <Button className="gap-2">
                            <Plus className="w-4 h-4" />
                            Create new ASN
                        </Button>
                    </Link>
                </div>
            </div>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-4">
                    <div>
                        <CardTitle>ASN List</CardTitle>
                        <CardDescription>View all advance shipment notices</CardDescription>
                    </div>
                    <div className="flex items-center gap-3">
                        {/* Sort by dropdown */}
                        <DropdownMenu open={isDropdownOpen} onOpenChange={setIsDropdownOpen}>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" className="gap-2">
                                    <ChevronDown className="w-4 h-4" />
                                    Sort by
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-56">
                                <DropdownMenuItem onClick={() => { setSortField('date'); setIsDropdownOpen(false); }} className="flex items-center justify-between">
                                    <span>Date</span>
                                    {sortField === 'date' && <span className="text-primary">✓</span>}
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => { setSortField('asn_number'); setIsDropdownOpen(false); }} className="flex items-center justify-between">
                                    <span>ASN Number</span>
                                    {sortField === 'asn_number' && <span className="text-primary">✓</span>}
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => { setSortField('expected_arrival'); setIsDropdownOpen(false); }} className="flex items-center justify-between">
                                    <span>Expected Arrival</span>
                                    {sortField === 'expected_arrival' && <span className="text-primary">✓</span>}
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => { setSortField('status'); setIsDropdownOpen(false); }} className="flex items-center justify-between">
                                    <span>Status</span>
                                    {sortField === 'status' && <span className="text-primary">✓</span>}
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => { setSortField('shipment_id'); setIsDropdownOpen(false); }} className="flex items-center justify-between">
                                    <span>Shipment ID</span>
                                    {sortField === 'shipment_id' && <span className="text-primary">✓</span>}
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>

                        {/* Order toggle button */}
                        <Button
                            variant="outline"
                            className="gap-2"
                            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                        >
                            {getOrderLabel(sortField, sortOrder)}
                        </Button>

                        {/* Search bar */}
                        <div className="relative w-64">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                type="search"
                                placeholder="Search ASNs..."
                                className="pl-8"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>

                    </div>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>ASN Number</TableHead>
                                <TableHead>Shipment ID</TableHead>
                                <TableHead>Date</TableHead>
                                <TableHead>Expected Arrival</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Action</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-32 text-center">
                                        <Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" />
                                        <p className="mt-2 text-sm text-muted-foreground">Loading ASNs...</p>
                                    </TableCell>
                                </TableRow>
                            ) : asns.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                                        No ASNs found.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                sortAsns(
                                    asns.filter(asn => {
                                        const q = searchQuery.toLowerCase().trim();
                                        if (!q) return true;
                                        return (
                                            (asn.asn_number?.toLowerCase().includes(q)) ||
                                            (asn.shipment_id?.toLowerCase().includes(q)) ||
                                            (asn.status?.toLowerCase().includes(q)) ||
                                            (asn.audit?.status?.toLowerCase().includes(q))
                                        );
                                    }),
                                    sortField,
                                    sortOrder
                                ).map((asn) => (
                                    <TableRow key={asn.id || asn.asn_number}>
                                        <TableCell className="font-medium text-primary">
                                            {asn.asn_number || "N/A"}
                                        </TableCell>
                                        <TableCell>{asn.shipment_id || "N/A"}</TableCell>
                                        <TableCell>{formatDate(asn.asn_date)}</TableCell>
                                        <TableCell>{formatDate(asn.expected_date)}</TableCell>
                                        <TableCell>
                                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(asn.status || asn.audit?.status)}`}>
                                                {asn.status || asn.audit?.status || "Pending Arrival"}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            {(() => {
                                                const canEdit = isDraftStatus(asn.status || asn.audit?.status);
                                                return (
                                                    <>
                                                        <Button variant="ghost" size="icon" onClick={() => handleViewDetails(asn)}>
                                                            <Eye className="w-4 h-4" />
                                                        </Button>
                                                        <Button variant="ghost" size="icon" onClick={() => handleEditClick(asn)} disabled={!canEdit} title={canEdit ? "Edit ASN" : "Only Draft ASNs can be updated"}>
                                                            <Edit className="w-4 h-4" />
                                                        </Button>
                                                    </>
                                                );
                                            })()}
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="w-[calc(100vw-0.5rem)] sm:w-[96vw] md:w-[94vw] lg:w-[92vw] xl:w-[90vw] sm:max-w-6xl lg:max-w-7xl max-h-[92vh] overflow-y-auto overflow-x-hidden">
                    <DialogHeader>
                        <DialogTitle className="text-2xl flex items-center gap-2">
                            <FileText className="w-6 h-6 text-primary" />
                            ASN Details: {selectedAsn?.asn_number}
                        </DialogTitle>
                        <DialogDescription>
                            Complete information for this advance shipment notice.
                        </DialogDescription>
                    </DialogHeader>

                    {isFetchingDetails ? (
                        <div className="h-[400px] flex flex-col items-center justify-center space-y-4">
                            <Loader2 className="w-10 h-10 animate-spin text-primary" />
                            <p className="text-muted-foreground animate-pulse">Fetching complete ASN details...</p>
                        </div>
                    ) : selectedAsn ? (
                        <div className="space-y-6 mt-4">
                            {(() => {
                                const shipments = Array.isArray(selectedAsn.shipments) ? selectedAsn.shipments : [];
                                const totalShipmentItems = shipments.reduce((acc: number, shipment: any) => acc + (Array.isArray(shipment?.items) ? shipment.items.length : 0), 0);
                                const firstShipment = shipments[0];

                                let supplier = selectedAsn.supplier || selectedAsn.suppliers?.[0] || firstShipment?.suppliers?.[0];
                                if (!supplier) {
                                    const source = (firstShipment?.supplier_name || firstShipment?.vendor_name || firstShipment?.supplier_code)
                                        ? firstShipment
                                        : (selectedAsn.supplier_name || selectedAsn.vendor_name || selectedAsn.supplier_code)
                                            ? selectedAsn
                                            : null;

                                    if (source) {
                                        supplier = {
                                            name: source.supplier_name || source.vendor_name || source.name,
                                            code: source.supplier_code || source.vendor_code || source.code,
                                            gstin: source.supplier_gstin || source.tax_id || source.gstin,
                                        };
                                    }
                                }

                                const supplierName = supplier?.name || supplier?.vendor_name || "-";
                                const supplierCode = supplier?.code || supplier?.vendor_code || selectedAsn.supplier_code || "-";
                                const supplierGstin = supplier?.gstin || supplier?.tax_id || "-";

                                const shipmentId = selectedAsn.shipmentId || selectedAsn.shipment_id || firstShipment?.shipment_id || "-";
                                const poValue = selectedAsn.poNumber || selectedAsn.po_number || firstShipment?.po_number || firstShipment?.poNumber || "";
                                const poList = String(poValue || "").split(",").map((p: string) => p.trim()).filter(Boolean);

                                const statusText = selectedAsn.status || selectedAsn.audit?.status || "Pending Arrival";
                                const asnNumber = selectedAsn.asnNumber || selectedAsn.asn_number || selectedAsn.asn_no || "-";
                                const asnDate = formatDate(selectedAsn.asnDate || selectedAsn.asn_date) || "-";
                                const expectedDate = formatDate(selectedAsn.expectedDate || selectedAsn.expected_date) || "-";
                                const createdBy = selectedAsn.created_by || selectedAsn.audit?.created_by || user?.username || "Admin";
                                const notes = selectedAsn.notes || "No remarks";

                                return (
                                    <Card className="w-full overflow-hidden rounded-2xl border-border/70 bg-card/95 shadow-lg shadow-black/5">
                                        <CardContent className="p-0">
                                            <div className="border-b border-border/60 bg-muted/20 px-4 py-2.5 sm:px-5 sm:py-3">
                                                <div className="flex flex-wrap items-start justify-between gap-4">
                                                    <div>
                                                        <p className="text-lg font-semibold leading-tight sm:text-xl">{asnNumber}</p>
                                                        <p className="mt-1 text-xs text-muted-foreground sm:text-sm">ASN date: {asnDate}</p>
                                                    </div>
                                                    <Badge variant="outline" className={`${getStatusColor(statusText)} border-transparent px-3 py-1 text-xs font-semibold uppercase tracking-wide`}>
                                                        {statusText}
                                                    </Badge>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 gap-2.5 border-b border-border/60 px-4 py-2.5 sm:grid-cols-2 lg:grid-cols-4 sm:px-5 sm:py-3">
                                                <div className="min-h-[74px] h-full w-full rounded-xl border border-border/70 bg-background/70 p-2.5 shadow-sm sm:min-h-[82px] sm:p-3">
                                                    <p className="text-xs font-medium text-muted-foreground">Shipments</p>
                                                    <p className="mt-1 text-lg font-semibold sm:text-xl">{shipments.length}</p>
                                                </div>
                                                <div className="min-h-[74px] h-full w-full rounded-xl border border-border/70 bg-background/70 p-2.5 shadow-sm sm:min-h-[82px] sm:p-3">
                                                    <p className="text-xs font-medium text-muted-foreground">Items</p>
                                                    <p className="mt-1 text-lg font-semibold sm:text-xl">{totalShipmentItems}</p>
                                                </div>
                                                <div className="min-h-[74px] h-full w-full rounded-xl border border-border/70 bg-background/70 p-2.5 shadow-sm sm:min-h-[82px] sm:p-3">
                                                    <p className="text-xs font-medium text-muted-foreground">Expected arrival</p>
                                                    <p className="mt-1 text-base font-semibold break-words sm:text-lg">{expectedDate}</p>
                                                </div>
                                                <div className="min-h-[74px] h-full w-full rounded-xl border border-border/70 bg-background/70 p-2.5 shadow-sm sm:min-h-[82px] sm:p-3">
                                                    <p className="text-xs font-medium text-muted-foreground">Shipment ID</p>
                                                    <p className="mt-1 text-base font-semibold break-all sm:text-lg">{shipmentId}</p>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 gap-px bg-border/60 md:grid-cols-2 md:gap-px">
                                                <section className="bg-card px-4 py-3 sm:px-5 sm:py-4">
                                                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Supplier</p>
                                                    <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                                                        <div>
                                                            <p className="text-xs text-muted-foreground">Name</p>
                                                            <p className="mt-1 font-semibold leading-tight">{supplierName}</p>
                                                        </div>
                                                        <div>
                                                            <p className="text-xs text-muted-foreground">Code</p>
                                                            <p className="mt-1 font-semibold leading-tight">{supplierCode}</p>
                                                        </div>
                                                        <div className="sm:col-span-2">
                                                            <p className="text-xs text-muted-foreground">GSTIN</p>
                                                            <p className="mt-1 font-semibold leading-tight">{supplierGstin}</p>
                                                        </div>
                                                    </div>
                                                </section>

                                                <section className="bg-card px-4 py-3 sm:px-5 sm:py-4">
                                                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Logistics</p>
                                                    <div className="mt-3 space-y-3">
                                                        <div>
                                                            <p className="text-xs text-muted-foreground">PO Number(s)</p>
                                                            {poList.length > 0 ? (
                                                                <div className="mt-2 flex flex-wrap gap-1.5">
                                                                    {poList.map((po: string, idx: number) => (
                                                                        <Badge key={`${po}-${idx}`} variant="outline" className="text-[10px] font-mono whitespace-nowrap rounded-full px-2 py-0.5">
                                                                            {po}
                                                                        </Badge>
                                                                    ))}
                                                                </div>
                                                            ) : (
                                                                <p className="mt-1 font-semibold">-</p>
                                                            )}
                                                        </div>
                                                        {selectedAsn.carrier && selectedAsn.carrier !== "N/A" ? (
                                                            <div>
                                                                <p className="text-xs text-muted-foreground">Carrier</p>
                                                                <p className="mt-1 font-semibold leading-tight">{selectedAsn.carrier}</p>
                                                            </div>
                                                        ) : null}
                                                    </div>
                                                </section>
                                            </div>

                                            <div className="grid grid-cols-1 border-t border-border/60 md:grid-cols-3">
                                                <section className="px-4 py-3 sm:px-5 sm:py-4 md:col-span-2">
                                                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Remarks</p>
                                                    <p className="mt-2 text-sm italic leading-relaxed text-muted-foreground whitespace-pre-wrap break-words">{notes}</p>
                                                </section>
                                                <section className="border-t border-border/60 px-4 py-3 sm:px-5 sm:py-4 md:border-l md:border-t-0 md:text-right">
                                                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Created by</p>
                                                    <p className="mt-2 text-lg font-semibold leading-none sm:text-xl">{createdBy}</p>
                                                </section>
                                            </div>
                                        </CardContent>
                                    </Card>
                                );
                            })()}

                            {/* Items / Shipments */}
                            {selectedAsn.shipments?.map((shipment: any, sIdx: number) => (
                                <Card key={`shipment-view-${sIdx}`} className="overflow-hidden rounded-2xl border-border/70 bg-card/95 shadow-sm">
                                    <CardHeader className="border-b border-border/60 bg-muted/20 px-4 py-3">
                                        <CardTitle className="flex flex-wrap items-center justify-between gap-3 text-sm">
                                            <div className="flex flex-wrap items-center gap-3">
                                                <div className="flex items-center gap-2 font-semibold text-foreground">
                                                    <Package className="w-4 h-4 text-primary" />
                                                    Shipment #{sIdx + 1}
                                                </div>
                                                {(shipment.poNumber || shipment.po_number) && (
                                                    <div className="flex flex-wrap gap-1">
                                                        {(shipment.poNumber || shipment.po_number).toString().split(',').map((p: string, i: number) => (
                                                            <Badge key={i} variant="secondary" className="font-mono text-[10px] rounded-full px-2 py-0.5">
                                                                PO: {p.trim()}
                                                            </Badge>
                                                        ))}
                                                    </div>
                                                )}
                                                {shipment.shipmentId && (
                                                    <Badge variant="outline" className="font-mono text-[10px] rounded-full px-2 py-0.5">
                                                        ID: {shipment.shipmentId}
                                                    </Badge>
                                                )}
                                            </div>
                                            <div className="text-[10px] text-muted-foreground whitespace-nowrap">
                                                {shipment.items?.length || 0} Items
                                            </div>
                                        </CardTitle>
                                        {shipment.notes && (
                                            <div className="mt-2 text-xs text-muted-foreground italic px-0.5">
                                                Note: {shipment.notes}
                                            </div>
                                        )}
                                    </CardHeader>
                                    <CardContent className="p-0">
                                        <div className="overflow-x-auto">
                                            <Table className="min-w-[920px]">
                                                <TableHeader>
                                                    <TableRow className="hover:bg-transparent">
                                                        <TableHead className="py-2">SKU</TableHead>
                                                        <TableHead className="py-2">Description</TableHead>
                                                        <TableHead className="py-2">HSN</TableHead>
                                                        <TableHead className="py-2">Lot/Batch</TableHead>
                                                        <TableHead className="py-2">Expiry</TableHead>
                                                        <TableHead className="py-2 text-right">Price</TableHead>
                                                        <TableHead className="py-2 text-right">Qty</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {(shipment.items || []).map((item: any, idx: number) => {
                                                        const itemMaster = item.item_master || {};
                                                        const sku = itemMaster.sku_code || item.sku || item.sku_code || "—";
                                                        const desc = itemMaster.description || item.description || item.desc || "—";
                                                        const hsn = itemMaster.hsn_code || "—";

                                                        return (
                                                            <TableRow key={item.id || idx} className="text-sm hover:bg-transparent">
                                                                <TableCell className="py-2 font-medium">{sku}</TableCell>
                                                                <TableCell className="py-2 text-muted-foreground max-w-[260px] whitespace-normal break-words">{desc}</TableCell>
                                                                <TableCell className="py-2 font-mono text-xs">{hsn}</TableCell>
                                                                <TableCell className="py-2">{item.lot || item.batch_no || "N/A"}</TableCell>
                                                                <TableCell className="py-2">{formatDate(item.expiryDate || item.expiry) || "N/A"}</TableCell>
                                                                <TableCell className="py-2 text-right">
                                                                    {item.unitPrice ? (
                                                                        <div className="flex flex-col">
                                                                            <span className="text-[10px] text-muted-foreground">Unit: {item.unitPrice}</span>
                                                                            <span className="font-medium text-xs">Total: {item.totalPrice}</span>
                                                                        </div>
                                                                    ) : "—"}
                                                                </TableCell>
                                                                <TableCell className="py-2 text-right font-medium">{Number(item.quantity || 0)} {item.unit}</TableCell>
                                                            </TableRow>
                                                        );
                                                    })}
                                                    <TableRow className="bg-muted/10 hover:bg-muted/30">
                                                        <TableCell colSpan={6} className="text-right font-medium py-3 text-muted-foreground">
                                                            Total Shipment Quantity:
                                                        </TableCell>
                                                        <TableCell className="text-right font-bold py-3 text-lg">
                                                            {(shipment.items || []).reduce((acc: number, curr: any) => acc + Number(curr?.quantity || 0), 0)}
                                                        </TableCell>
                                                    </TableRow>
                                                </TableBody>
                                            </Table>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    ) : null}
                </DialogContent>
            </Dialog>

            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                <DialogContent className="w-[calc(100vw-0.5rem)] sm:w-[98vw] md:w-[96vw] lg:w-[94vw] max-w-[1400px] max-h-[95vh] overflow-y-auto p-0 border-none shadow-2xl">
                    <Form {...editForm}>
                        <form ref={editFormRef} onSubmit={editForm.handleSubmit(onEditSubmit)} className="flex flex-col h-full bg-background">
                            <div className="p-6 border-b bg-muted/20 flex items-center justify-between sticky top-0 z-20 backdrop-blur-sm">
                                <div>
                                    <DialogTitle className="text-2xl font-bold flex items-center gap-2">
                                        <Settings2 className="w-6 h-6 text-primary" />
                                        Edit ASN: {editingAsn?.asn_number}
                                    </DialogTitle>
                                    <DialogDescription className="mt-1">
                                        Modify the shipment details and line items for this record.
                                    </DialogDescription>
                                </div>
                                <div className="flex items-center gap-3">
                                    <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)} disabled={isSaving}>
                                        Cancel
                                    </Button>
                                    <Button type="submit" disabled={isSaving} className="gap-2 shadow-lg shadow-primary/20">
                                        {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                        Save Changes
                                    </Button>
                                </div>
                            </div>

                            <div className="p-6 space-y-8 max-w-[1300px] mx-auto w-full pb-12">
                                {/* 1️⃣ ASN Header Section */}
                                <Card className="border-none shadow-sm bg-muted/10">
                                    <CardHeader className="pb-4">
                                        <CardTitle className="text-lg font-semibold flex items-center gap-2">
                                            <FileText className="w-5 h-5 text-primary" />
                                            ASN Header
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                                            <FormField
                                                control={editForm.control}
                                                name="asn_number"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel className="text-xs font-bold uppercase tracking-wider text-muted-foreground">ASN Number *</FormLabel>
                                                        <FormControl>
                                                            <Input {...field} className="bg-background border-muted-foreground/20 focus:border-primary transition-colors" />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                            <FormField
                                                control={editForm.control}
                                                name="asn_date"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel className="text-xs font-bold uppercase tracking-wider text-muted-foreground">ASN Date *</FormLabel>
                                                        <FormControl>
                                                            <div className="relative">
                                                                <Input type="datetime-local" {...field} className="bg-background border-muted-foreground/20 pl-10" />
                                                                <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                                            </div>
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                            <FormField
                                                control={editForm.control}
                                                name="shipment_id"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Shipment ID</FormLabel>
                                                        <FormControl>
                                                            <div className="relative">
                                                                <Input {...field} className="bg-background border-muted-foreground/20 pl-10" />
                                                                <Truck className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                                            </div>
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                            <FormField
                                                control={editForm.control}
                                                name="expected_date"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Expected Date *</FormLabel>
                                                        <FormControl>
                                                            <div className="relative">
                                                                <Input type="date" {...field} className="bg-background border-muted-foreground/20 pl-10" />
                                                                <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                                            </div>
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                            <FormField
                                                control={editForm.control}
                                                name="warehouse_id"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Warehouse *</FormLabel>
                                                        <Select
                                                            onValueChange={(val) => {
                                                                field.onChange(val);
                                                                const selected = warehouses.find((w: any) => String(w.id || w.warehouse_id) === val);
                                                                if (selected) editForm.setValue('warehouse_code', selected.code || selected.warehouse_code);
                                                            }}
                                                            value={field.value}
                                                        >
                                                            <FormControl>
                                                                <SelectTrigger className="bg-background border-muted-foreground/20">
                                                                    <div className="flex items-center gap-2">
                                                                        <Building2 className="w-4 h-4 text-muted-foreground" />
                                                                        <SelectValue placeholder="Select warehouse" />
                                                                    </div>
                                                                </SelectTrigger>
                                                            </FormControl>
                                                            <SelectContent>
                                                                {warehouses.map((warehouse) => (
                                                                    <SelectItem key={warehouse.id || warehouse.warehouse_id} value={String(warehouse.id || warehouse.warehouse_id)}>
                                                                        {warehouse.code || warehouse.warehouse_code} - {warehouse.name}
                                                                    </SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                            <FormField
                                                control={editForm.control}
                                                name="status"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Status *</FormLabel>
                                                        <Select onValueChange={field.onChange} value={field.value}>
                                                            <FormControl>
                                                                <SelectTrigger className="bg-background border-muted-foreground/20 capitalize font-medium">
                                                                    <SelectValue placeholder="Select status" />
                                                                </SelectTrigger>
                                                            </FormControl>
                                                            <SelectContent>
                                                                <SelectItem value="draft">Draft</SelectItem>
                                                                <SelectItem value="pending_arrival">Pending Arrival</SelectItem>
                                                                <SelectItem value="in_transit">In Transit</SelectItem>
                                                                <SelectItem value="arrived">Arrived</SelectItem>
                                                                <SelectItem value="receiving">Receiving</SelectItem>
                                                                <SelectItem value="completed">Completed</SelectItem>
                                                                <SelectItem value="closed">Closed</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                            <FormField
                                                control={editForm.control}
                                                name="supplier_code"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Supplier Code *</FormLabel>
                                                        <FormControl>
                                                            <div className="relative">
                                                                <Input
                                                                    {...field}
                                                                    className="bg-background border-muted-foreground/20 pl-10"
                                                                    placeholder="Search supplier..."
                                                                    onChange={(e) => {
                                                                        field.onChange(e.target.value);
                                                                        setSupplierSearch(e.target.value);
                                                                        setIsSupplierDropdownOpen(true);
                                                                        setActiveSupplierShipmentIndex(null); // null for header
                                                                    }}
                                                                />
                                                                <UserCircle className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                                                {isSearchingSuppliers && (
                                                                    <div className="absolute right-3 top-2.5">
                                                                        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                                                                    </div>
                                                                )}
                                                                {isSupplierDropdownOpen && activeSupplierShipmentIndex === null && supplierSearch.trim() && (
                                                                    <div className="absolute z-50 mt-1 w-full rounded-md border border-border bg-popover shadow-md max-h-56 overflow-y-auto">
                                                                        {allSuppliers.length === 0 ? (
                                                                            <div className="px-3 py-3 space-y-3 text-sm text-muted-foreground">
                                                                                <p>No supplier found.</p>
                                                                                <Button type="button" variant="outline" size="sm" className="w-full" onClick={openCreateSupplierDialog}>Create New Supplier</Button>
                                                                            </div>
                                                                        ) : (
                                                                            allSuppliers.map((s, sIdx) => (
                                                                                <button
                                                                                    key={s.code}
                                                                                    type="button"
                                                                                    className="w-full px-3 py-2 text-left hover:bg-primary/10 transition-colors"
                                                                                    onClick={() => {
                                                                                        editForm.setValue('supplier_code', s.code);
                                                                                        setIsSupplierDropdownOpen(false);
                                                                                        setSupplierSearch("");
                                                                                    }}
                                                                                >
                                                                                    <div className="font-medium text-sm">{s.name}</div>
                                                                                    <div className="text-xs text-muted-foreground">{s.code}</div>
                                                                                </button>
                                                                            ))
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                            <FormField
                                                control={editForm.control}
                                                name="notes"
                                                render={({ field }) => (
                                                    <FormItem className="lg:col-span-1">
                                                        <FormLabel className="text-xs font-bold uppercase tracking-wider text-muted-foreground">ASN Notes</FormLabel>
                                                        <FormControl>
                                                            <div className="relative">
                                                                <Input {...field} className="bg-background border-muted-foreground/20 pl-10" placeholder="General remarks..." />
                                                                <StickyNote className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                                            </div>
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                        </div>
                                    </CardContent>
                                </Card>

                                {/* 2️⃣ Shipments Section */}
                                <div className="space-y-6">
                                    <div className="flex items-center justify-between border-b pb-4">
                                        <h2 className="text-xl font-bold flex items-center gap-2">
                                            <LayoutList className="w-5 h-5 text-primary" />
                                            Shipments
                                        </h2>
                                        <Button type="button" onClick={() => appendShipment(createDefaultShipment())} variant="secondary" size="sm" className="gap-2">
                                            <Plus className="w-4 h-4" /> Add Shipment
                                        </Button>
                                    </div>

                                    <div className="space-y-6">
                                        {shipmentFields.map((field, sIdx) => (
                                            <Card key={field.id} className="border-border shadow-md border-t-4 border-t-primary/60 overflow-hidden">
                                                <CardHeader className="pb-4 flex flex-row items-center justify-between bg-muted/30 px-6 py-4">
                                                    <CardTitle className="text-base font-bold text-primary flex items-center gap-2 uppercase tracking-tighter">
                                                        Shipment {sIdx + 1}
                                                    </CardTitle>
                                                    {shipmentFields.length > 1 && (
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => removeShipment(sIdx)}
                                                            className="h-8 text-destructive border-destructive/20 hover:bg-destructive/5 hover:text-destructive"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5 mr-2" /> Remove Shipment
                                                        </Button>
                                                    )}
                                                </CardHeader>
                                                <CardContent className="p-6 space-y-6 bg-card">
                                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-4 bg-muted/10 rounded-xl border">
                                                        <FormField
                                                            control={editForm.control}
                                                            name={`shipments.${sIdx}.po_number`}
                                                            render={({ field }) => (
                                                                <FormItem>
                                                                    <FormLabel className="text-[10px] font-black uppercase text-muted-foreground">PO Number *</FormLabel>
                                                                    <FormControl>
                                                                        <Input {...field} className="bg-background h-9 text-sm" />
                                                                    </FormControl>
                                                                    <FormMessage />
                                                                </FormItem>
                                                            )}
                                                        />
                                                        <FormField
                                                            control={editForm.control}
                                                            name={`shipments.${sIdx}.supplier_code`}
                                                            render={({ field }) => (
                                                                <FormItem>
                                                                    <FormLabel className="text-[10px] font-black uppercase text-muted-foreground">Shipment Supplier Code *</FormLabel>
                                                                    <FormControl>
                                                                        <div className="relative">
                                                                            <Input
                                                                                {...field}
                                                                                className="bg-background h-9 text-sm pr-8"
                                                                                onChange={(e) => {
                                                                                    field.onChange(e.target.value);
                                                                                    setSupplierSearch(e.target.value);
                                                                                    setIsSupplierDropdownOpen(true);
                                                                                    setActiveSupplierShipmentIndex(sIdx);
                                                                                }}
                                                                            />
                                                                            {field.value && (
                                                                                <button
                                                                                    type="button"
                                                                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary"
                                                                                    onClick={() => openEditSupplierDialog(sIdx)}
                                                                                >
                                                                                    <ArrowUpRight className="w-3.5 h-3.5" />
                                                                                </button>
                                                                            )}
                                                                            {isSupplierDropdownOpen && activeSupplierShipmentIndex === sIdx && supplierSearch.trim() && (
                                                                                <div className="absolute z-50 mt-1 w-full rounded-md border border-border bg-popover shadow-md max-h-56 overflow-y-auto">
                                                                                    {allSuppliers.length === 0 ? (
                                                                                        <div className="px-3 py-3 space-y-3 text-sm text-muted-foreground">
                                                                                            <p>No supplier found.</p>
                                                                                            <Button type="button" variant="outline" size="sm" className="w-full" onClick={openCreateSupplierDialog}>Create New Supplier</Button>
                                                                                        </div>
                                                                                    ) : (
                                                                                        allSuppliers.map((s) => (
                                                                                            <button
                                                                                                key={s.code}
                                                                                                type="button"
                                                                                                className="w-full px-3 py-2 text-left hover:bg-primary/10 transition-colors"
                                                                                                onClick={() => selectSupplier(s, sIdx)}
                                                                                            >
                                                                                                <div className="font-medium text-sm">{s.name}</div>
                                                                                                <div className="text-xs text-muted-foreground">{s.code}</div>
                                                                                            </button>
                                                                                        ))
                                                                                    )}
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    </FormControl>
                                                                    <FormMessage />
                                                                </FormItem>
                                                            )}
                                                        />
                                                        <FormField
                                                            control={editForm.control}
                                                            name={`shipments.${sIdx}.notes`}
                                                            render={({ field }) => (
                                                                <FormItem className="lg:col-span-1">
                                                                    <FormLabel className="text-[10px] font-black uppercase text-muted-foreground">Shipment Notes</FormLabel>
                                                                    <FormControl>
                                                                        <Input {...field} className="bg-background h-9 text-sm" placeholder="Optional notes for this PO..." />
                                                                    </FormControl>
                                                                    <FormMessage />
                                                                </FormItem>
                                                            )}
                                                        />
                                                    </div>

                                                    <div className="space-y-4">
                                                        <div className="flex items-center justify-between px-1">
                                                            <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                                                                <Package className="w-3.5 h-3.5" />
                                                                Line Items
                                                            </h3>
                                                            <Button
                                                                type="button"
                                                                variant="outline"
                                                                size="sm"
                                                                className="h-7 text-[10px] uppercase font-bold"
                                                                onClick={() => {
                                                                    const current = editForm.getValues(`shipments.${sIdx}.items`) || [];
                                                                    editForm.setValue(`shipments.${sIdx}.items`, [...current, createDefaultItem()]);
                                                                }}
                                                            >
                                                                <Plus className="w-3 h-3 mr-1" /> Add Item
                                                            </Button>
                                                        </div>

                                                        <div className="border rounded-xl overflow-hidden shadow-inner">
                                                            <div className="grid grid-cols-[140px_minmax(180px,1fr)_80px_100px_90px_90px_100px_100px_45px] gap-3 px-4 py-2 bg-muted/30 text-[10px] font-black uppercase tracking-tighter border-b">
                                                                <div>SKU *</div>
                                                                <div>Description *</div>
                                                                <div>Qty *</div>
                                                                <div>Unit *</div>
                                                                <div>Price *</div>
                                                                <div>Total</div>
                                                                <div>Lot</div>
                                                                <div>HSN</div>
                                                                <div className="text-center">#</div>
                                                            </div>
                                                            <div className="divide-y bg-card/50">
                                                                {field.items.map((item, itemIdx) => (
                                                                    <div key={`${field.id}-item-${itemIdx}`} className="grid grid-cols-[140px_minmax(180px,1fr)_80px_100px_90px_90px_100px_100px_45px] gap-3 px-4 py-2 items-center hover:bg-muted/5 transition-colors">
                                                                        <FormField
                                                                            control={editForm.control}
                                                                            name={`shipments.${sIdx}.items.${itemIdx}.sku`}
                                                                            render={({ field: subField }) => (
                                                                                <FormItem>
                                                                                    <FormControl>
                                                                                        <div className="relative">
                                                                                            <Input
                                                                                                {...subField}
                                                                                                className="h-8 text-xs bg-background pr-12"
                                                                                                placeholder="SKU"
                                                                                                onChange={(e) => {
                                                                                                    subField.onChange(e.target.value);
                                                                                                    setItemSearch(e.target.value);
                                                                                                    setPendingItemRow({ sIdx, iIdx });
                                                                                                }}
                                                                                                onKeyDown={(e) => handleSkuKeyDown(e, sIdx, itemIdx)}
                                                                                            />
                                                                                            {subField.value && (
                                                                                                <button
                                                                                                    type="button"
                                                                                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary"
                                                                                                    onClick={() => openSkuEditCard(sIdx, itemIdx, { id: editForm.getValues(`shipments.${sIdx}.items.${itemIdx}.sku_id`), sku_code: subField.value })}
                                                                                                >
                                                                                                    <ArrowUpRight className="w-3.5 h-3.5" />
                                                                                                </button>
                                                                                            )}
                                                                                            {pendingItemRow?.sIdx === sIdx && pendingItemRow?.iIdx === itemIdx && itemSearch.trim() && (
                                                                                                <div className="absolute z-50 mt-1 w-[250px] rounded-md border border-border bg-popover shadow-md max-h-56 overflow-y-auto">
                                                                                                    {isSearchingItems ? (
                                                                                                        <div className="px-3 py-2 text-xs text-muted-foreground flex items-center gap-2"><Loader2 className="w-3 h-3 animate-spin" /> Searching...</div>
                                                                                                    ) : allItems.length === 0 ? (
                                                                                                        <div className="px-3 py-3 space-y-3 text-xs text-muted-foreground">
                                                                                                            <p>No SKU found.</p>
                                                                                                            <Button type="button" variant="outline" size="xs" className="w-full text-[10px] h-7" onClick={() => openCreateSkuDialog(sIdx, itemIdx, itemSearch)}>Create New SKU</Button>
                                                                                                        </div>
                                                                                                    ) : (
                                                                                                        allItems.map((sku, idx) => (
                                                                                                            <button
                                                                                                                key={sku.id}
                                                                                                                type="button"
                                                                                                                className={cn(
                                                                                                                    "w-full px-3 py-2 text-left transition-colors border-b last:border-0",
                                                                                                                    activeSkuIndex === idx ? "bg-primary/20" : "hover:bg-primary/10"
                                                                                                                )}
                                                                                                                onClick={() => selectSku(sIdx, itemIdx, sku)}
                                                                                                                onMouseEnter={() => setActiveSkuIndex(idx)}
                                                                                                            >
                                                                                                                <div className="font-bold text-xs">{sku.skuCode || sku.sku_code}</div>
                                                                                                                <div className="text-[10px] text-muted-foreground truncate">{sku.productName || sku.name || sku.description}</div>
                                                                                                            </button>
                                                                                                        ))
                                                                                                    )}
                                                                                                </div>
                                                                                            )}
                                                                                        </div>
                                                                                    </FormControl>
                                                                                </FormItem>
                                                                            )}
                                                                        />
                                                                        <FormField
                                                                            control={editForm.control}
                                                                            name={`shipments.${sIdx}.items.${itemIdx}.description`}
                                                                            render={({ field: subField }) => (
                                                                                <FormItem>
                                                                                    <FormControl>
                                                                                        <Input {...subField} className="h-8 text-xs bg-background" placeholder="Item description" />
                                                                                    </FormControl>
                                                                                </FormItem>
                                                                            )}
                                                                        />
                                                                        <FormField
                                                                            control={editForm.control}
                                                                            name={`shipments.${sIdx}.items.${itemIdx}.quantity`}
                                                                            render={({ field: subField }) => (
                                                                                <FormItem>
                                                                                    <FormControl>
                                                                                        <Input
                                                                                            type="number"
                                                                                            {...subField}
                                                                                            className="h-8 text-xs bg-background"
                                                                                            onChange={e => {
                                                                                                const val = Number(e.target.value);
                                                                                                subField.onChange(val);
                                                                                                const up = editForm.getValues(`shipments.${sIdx}.items.${itemIdx}.unit_price`) || 0;
                                                                                                editForm.setValue(`shipments.${sIdx}.items.${itemIdx}.total_price`, val * up);
                                                                                            }}
                                                                                        />
                                                                                    </FormControl>
                                                                                </FormItem>
                                                                            )}
                                                                        />
                                                                        <FormField
                                                                            control={editForm.control}
                                                                            name={`shipments.${sIdx}.items.${itemIdx}.unit`}
                                                                            render={({ field: subField }) => (
                                                                                <FormItem>
                                                                                    <FormControl>
                                                                                        <UomSelect
                                                                                            value={subField.value}
                                                                                            onValueChange={subField.onChange}
                                                                                            triggerClassName="h-8 text-xs bg-background"
                                                                                            disabled
                                                                                        />
                                                                                    </FormControl>
                                                                                </FormItem>
                                                                            )}
                                                                        />
                                                                        <FormField
                                                                            control={editForm.control}
                                                                            name={`shipments.${sIdx}.items.${itemIdx}.unit_price`}
                                                                            render={({ field: subField }) => (
                                                                                <FormItem>
                                                                                    <FormControl>
                                                                                        <Input
                                                                                            type="number"
                                                                                            {...subField}
                                                                                            className="h-8 text-xs bg-background"
                                                                                            onChange={e => {
                                                                                                const val = Number(e.target.value);
                                                                                                subField.onChange(val);
                                                                                                const qty = editForm.getValues(`shipments.${sIdx}.items.${itemIdx}.quantity`) || 0;
                                                                                                editForm.setValue(`shipments.${sIdx}.items.${itemIdx}.total_price`, val * qty);
                                                                                            }}
                                                                                        />
                                                                                    </FormControl>
                                                                                </FormItem>
                                                                            )}
                                                                        />
                                                                        <FormField
                                                                            control={editForm.control}
                                                                            name={`shipments.${sIdx}.items.${itemIdx}.total_price`}
                                                                            render={({ field: subField }) => (
                                                                                <FormItem>
                                                                                    <FormControl>
                                                                                        <Input {...subField} disabled className="h-8 text-xs bg-muted/50 font-bold" />
                                                                                    </FormControl>
                                                                                </FormItem>
                                                                            )}
                                                                        />
                                                                        <FormField
                                                                            control={editForm.control}
                                                                            name={`shipments.${sIdx}.items.${itemIdx}.lot`}
                                                                            render={({ field: subField }) => (
                                                                                <FormItem>
                                                                                    <FormControl>
                                                                                        <Input {...subField} className="h-8 text-xs bg-background" placeholder="Batch" />
                                                                                    </FormControl>
                                                                                </FormItem>
                                                                            )}
                                                                        />
                                                                        <FormField
                                                                            control={editForm.control}
                                                                            name={`shipments.${sIdx}.items.${itemIdx}.hsn_code`}
                                                                            render={({ field: subField }) => (
                                                                                <FormItem>
                                                                                    <FormControl>
                                                                                        <Input {...subField} className="h-8 text-xs bg-background" placeholder="HSN" />
                                                                                    </FormControl>
                                                                                </FormItem>
                                                                            )}
                                                                        />
                                                                        <div className="flex justify-center">
                                                                            <Button
                                                                                type="button"
                                                                                variant="ghost"
                                                                                size="icon"
                                                                                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                                                                onClick={() => {
                                                                                    const current = editForm.getValues(`shipments.${sIdx}.items`) || [];
                                                                                    if (current.length <= 1) return;
                                                                                    editForm.setValue(`shipments.${sIdx}.items`, current.filter((_, idx) => idx !== itemIdx));
                                                                                }}
                                                                                disabled={field.items.length <= 1}
                                                                            >
                                                                                <Trash2 className="h-3.5 w-3.5" />
                                                                            </Button>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        ))}
                                    </div>

                                    <div className="flex justify-center py-6 border-t border-dashed">
                                        <Button
                                            type="button"
                                            onClick={() => appendShipment(createDefaultShipment())}
                                            variant="outline"
                                            className="border-primary/20 hover:bg-primary/5 hover:border-primary transition-all rounded-full px-8 h-12 gap-2"
                                        >
                                            <Plus className="w-5 h-5 text-primary" />
                                            Add Another Shipment (PO)
                                        </Button>
                                    </div>
                                </div>
                                <div className="mt-8 flex justify-end gap-3 pt-6 border-t sticky bottom-0 bg-background pb-2">
                                    <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)} disabled={isSaving}>
                                        Cancel
                                    </Button>
                                    <TooltipProvider>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <span>
                                                    <Button
                                                        type="submit"
                                                        disabled={isSaving || !editForm.formState.isValid}
                                                        className="gap-2 px-8 font-bold"
                                                    >
                                                        {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                                        Save Changes
                                                    </Button>
                                                </span>
                                            </TooltipTrigger>
                                            {!editForm.formState.isValid && (
                                                <TooltipContent side="top" className="bg-destructive text-destructive-foreground p-3 border-none shadow-xl max-w-xs">
                                                    <div className="flex gap-2 items-start">
                                                        <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                                                        <div>
                                                            <p className="font-bold text-xs uppercase tracking-wider mb-1">Validation Errors</p>
                                                            <ul className="text-[11px] space-y-1 list-disc pl-3">
                                                                {Object.entries(editForm.formState.errors).map(([key, err]: any) => (
                                                                    <li key={key}>{err.message || `${key} is invalid`}</li>
                                                                ))}
                                                                {editForm.getValues('shipments')?.some((s, sIdx) =>
                                                                    s.items?.some((i, iIdx) => {
                                                                        const itemErr = (editForm.formState.errors.shipments as any)?.[sIdx]?.items?.[iIdx];
                                                                        return !!itemErr;
                                                                    })
                                                                ) && <li>Check shipment line items for errors</li>}
                                                            </ul>
                                                        </div>
                                                    </div>
                                                </TooltipContent>
                                            )}
                                        </Tooltip>
                                    </TooltipProvider>
                                </div>
                            </div>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>

            {/* Create Supplier Dialog */}
            <Dialog open={isCreateSupplierOpen} onOpenChange={setIsCreateSupplierOpen}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Create New Supplier</DialogTitle>
                        <DialogDescription>Add a new supplier to the system.</DialogDescription>
                    </DialogHeader>
                    <div className="grid grid-cols-2 gap-4 py-4">
                        <div className="space-y-2">
                            <Label>Code *</Label>
                            <Input value={supplierCreateForm.code} onChange={e => setSupplierCreateForm(p => ({ ...p, code: e.target.value }))} placeholder="SUP001" />
                        </div>
                        <div className="space-y-2">
                            <Label>Name *</Label>
                            <Input value={supplierCreateForm.name} onChange={e => setSupplierCreateForm(p => ({ ...p, name: e.target.value }))} placeholder="Acme Corp" />
                        </div>
                        <div className="space-y-2">
                            <Label>GSTIN *</Label>
                            <Input value={supplierCreateForm.gstin} onChange={e => setSupplierCreateForm(p => ({ ...p, gstin: e.target.value }))} placeholder="27AAAC..." />
                        </div>
                        <div className="space-y-2">
                            <Label>Contact Person *</Label>
                            <Input value={supplierCreateForm.contact_person} onChange={e => setSupplierCreateForm(p => ({ ...p, contact_person: e.target.value }))} placeholder="John Doe" />
                        </div>
                        <div className="space-y-2 col-span-2">
                            <Label>Phone Number *</Label>
                            <PhoneInput
                                value={supplierCreateForm.phone}
                                countryCode={supplierCreateForm.country_code}
                                onPhoneChange={val => setSupplierCreateForm(p => ({ ...p, phone: val }))}
                                onCountryCodeChange={cc => setSupplierCreateForm(p => ({ ...p, country_code: cc }))}
                            />
                        </div>
                        <div className="space-y-2 col-span-2">
                            <Label>Email *</Label>
                            <Input type="email" value={supplierCreateForm.email} onChange={e => setSupplierCreateForm(p => ({ ...p, email: e.target.value }))} placeholder="supplier@example.com" />
                        </div>
                        <div className="space-y-2 col-span-2">
                            <Label>Address</Label>
                            <Textarea value={supplierCreateForm.address} onChange={e => setSupplierCreateForm(p => ({ ...p, address: e.target.value }))} placeholder="Full address..." />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsCreateSupplierOpen(false)}>Cancel</Button>
                        <Button onClick={handleCreateSupplier} disabled={isCreatingSupplier}>
                            {isCreatingSupplier && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Create Supplier
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Edit Supplier Dialog */}
            <Dialog open={isEditSupplierOpen} onOpenChange={setIsEditSupplierOpen}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Edit Supplier Details</DialogTitle>
                        <DialogDescription>Update contact information for this supplier.</DialogDescription>
                    </DialogHeader>
                    <div className="grid grid-cols-2 gap-4 py-4">
                        <div className="space-y-2">
                            <Label>Name *</Label>
                            <Input value={supplierEditForm.name} onChange={e => setSupplierEditForm(p => ({ ...p, name: e.target.value }))} />
                        </div>
                        <div className="space-y-2">
                            <Label>GSTIN *</Label>
                            <Input value={supplierEditForm.gstin} onChange={e => setSupplierEditForm(p => ({ ...p, gstin: e.target.value }))} />
                        </div>
                        <div className="space-y-2">
                            <Label>Contact Person *</Label>
                            <Input value={supplierEditForm.contact_person} onChange={e => setSupplierEditForm(p => ({ ...p, contact_person: e.target.value }))} />
                        </div>
                        <div className="space-y-2 col-span-2">
                            <Label>Phone Number *</Label>
                            <PhoneInput
                                value={supplierEditForm.phone}
                                countryCode={supplierEditForm.country_code}
                                onPhoneChange={val => setSupplierEditForm(p => ({ ...p, phone: val }))}
                                onCountryCodeChange={cc => setSupplierEditForm(p => ({ ...p, country_code: cc }))}
                            />
                        </div>
                        <div className="space-y-2 col-span-2">
                            <Label>Email *</Label>
                            <Input type="email" value={supplierEditForm.email} onChange={e => setSupplierEditForm(p => ({ ...p, email: e.target.value }))} />
                        </div>
                        <div className="space-y-2 col-span-2">
                            <Label>Address</Label>
                            <Textarea value={supplierEditForm.address} onChange={e => setSupplierEditForm(p => ({ ...p, address: e.target.value }))} />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsEditSupplierOpen(false)}>Cancel</Button>
                        <Button onClick={handleUpdateSupplier} disabled={isUpdatingSupplier}>
                            {isUpdatingSupplier && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Update Supplier
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Create SKU Dialog */}
            <Dialog open={isCreateSkuOpen} onOpenChange={setIsCreateSkuOpen}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Create New SKU</DialogTitle>
                        <DialogDescription>Register a new product in the master catalog.</DialogDescription>
                    </DialogHeader>
                    <div className="grid grid-cols-2 gap-4 py-4">
                        <div className="space-y-2">
                            <Label>SKU Code *</Label>
                            <Input value={skuCreateForm.sku_code} onChange={e => setSkuCreateForm(p => ({ ...p, sku_code: e.target.value }))} />
                        </div>
                        <div className="space-y-2">
                            <Label>Description *</Label>
                            <Input value={skuCreateForm.description} onChange={e => setSkuCreateForm(p => ({ ...p, description: e.target.value }))} />
                        </div>
                        <div className="space-y-2">
                            <Label>Barcode</Label>
                            <Input value={skuCreateForm.primary_barcode} onChange={e => setSkuCreateForm(p => ({ ...p, primary_barcode: e.target.value }))} />
                        </div>
                        <div className="space-y-2">
                            <Label>Base UOM</Label>
                            <UomSelect value={skuCreateForm.base_uom} onValueChange={val => setSkuCreateForm(p => ({ ...p, base_uom: val }))} />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsCreateSkuOpen(false)}>Cancel</Button>
                        <Button onClick={handleCreateSku} disabled={isCreatingSku}>
                            {isCreatingSku && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Create SKU
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* SKU Edit Card/Dialog - Reusing logic from CreateAsn */}
            <Dialog open={isEditSkuOpen} onOpenChange={setIsEditSkuOpen}>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>SKU Master Details</DialogTitle>
                        <DialogDescription>Update SKU specifications and warehouse rules.</DialogDescription>
                    </DialogHeader>
                    {/* Simplified view for brevity, but logically same as CreateAsn */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label>Description</Label>
                                <Input value={skuEditForm.description} onChange={e => setSkuEditForm(p => ({ ...p, description: e.target.value }))} />
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <div className="space-y-2">
                                    <Label>Primary Barcode</Label>
                                    <Input value={skuEditForm.primary_barcode} onChange={e => setSkuEditForm(p => ({ ...p, primary_barcode: e.target.value }))} />
                                </div>
                                <div className="space-y-2">
                                    <Label>HSN Code</Label>
                                    <Input value={skuEditForm.hsn_code} onChange={e => setSkuEditForm(p => ({ ...p, hsn_code: e.target.value }))} />
                                </div>
                            </div>
                        </div>
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label>UOM Hierarchy (JSON)</Label>
                                <Textarea value={skuEditForm.uom_hierarchy} onChange={e => setSkuEditForm(p => ({ ...p, uom_hierarchy: e.target.value }))} className="font-mono text-xs h-24" />
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsEditSkuOpen(false)}>Close</Button>
                        <Button onClick={handleSaveSkuCard} disabled={isSaving}>
                            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Update Master Records
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default Asns;
