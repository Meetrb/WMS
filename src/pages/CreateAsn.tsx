import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useEnterNavigation } from "@/hooks/useEnterNavigation";
import { cn } from "@/lib/utils";
import { asnService } from "@/services/asnService";
import { vendorService } from "@/services/vendorService";
import { skuService } from "@/services/skuService";
import { warehouseService } from "@/services/warehouseService";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PhoneInput, COUNTRY_DATA, isPhoneValid } from "@/components/ui/PhoneInput";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, FileText, LayoutList, Loader2, Save, ArrowUpRight, Package } from "lucide-react";
import { toast } from "sonner";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription,
} from "@/components/ui/dialog";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import {
    Popover,
    PopoverAnchor,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { UomSelect } from "@/components/ui/uom-select";
import { useDebounce } from "use-debounce";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

const SKU_CATEGORIES = [
    "PERISHABLE",
    "FROZEN_GOODS",
    "DANGEROUS_GOODS",
    "BULK_GOODS",
    "FAST_MOVING",
    "RETURNED",
    "HIGH_VALUE_GOODS",
    "OVERSIZE_GOODS",
    "GENERAL",
    "INBOUND / OUTBOUND"
];

interface AsnItem {
    sku_id?: string | number;
    sku: string;
    description: string;
    quantity: number;
    unit: string;
    unit_price: number;
    total_price: number;
    lot: string;
    hsn_code: string;
}

interface Shipment {
    po_numbers: string[];
    supplier_id?: string;
    supplier_code: string;
    supplier_name?: string; // For display purposes, not sent to backend
    notes: string;
    items: AsnItem[];
}

interface AsnForm {
    asn_number: string;
    asn_date: string;
    shipment_id: string;
    expected_date: string;
    warehouse_code: string;
    warehouse_id: string;
    status: string;
    notes: string;
    supplier_code: string;
    shipments: Shipment[];
}

interface SupplierOption {
    id?: string;
    code: string;
    name: string;
}

interface WarehouseOption {
    id: string;
    code: string;
    name: string;
}

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
    item_category: string;
    base_uom: string;
    alt_uom: string;
}

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

const DEFAULT_SUPPLIER_FORM: SupplierCreateForm = {
    code: "",
    name: "",
    gstin: "",
    contact_person: "",
    country_code: "+971",
    phone: "",
    email: "",
    address: "",
    payment_terms: "",
};


const DEFAULT_SUPPLIER_EDIT_FORM: SupplierEditForm = {
    name: "",
    gstin: "",
    contact_person: "",
    country_code: "+971",
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
    item_category: "GENERAL",
    base_uom: "",
    alt_uom: "",
};

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

const asnToNumber = (value: string): number => {
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
    is_hazardous: Boolean(raw?.is_hazardous ?? raw?.isHazardous),
    hazard_class: String(raw?.hazard_class ?? raw?.hazardClass ?? ""),
    hazmat_code: String(raw?.hazmat_code ?? raw?.hazmatCode ?? ""),
    requires_inspection: Boolean(raw?.requires_inspection ?? raw?.requiresInspection),
    inspection_rule: String(raw?.inspection_rule ?? raw?.inspectionRule ?? ""),
    sample_percentage: String(raw?.sample_percentage ?? raw?.samplePercentage ?? 0),
    quarantine_on_failure: Boolean(raw?.quarantine_on_failure ?? raw?.quarantineOnFailure),
    hsn_code: String(raw?.hsn_code ?? raw?.hsnCode ?? ""),
    tax_rate: String(raw?.tax_rate ?? raw?.taxRate ?? 0),
    active: raw?.active ?? true,
});

const CreateAsn = () => {
    const navigate = useNavigate();
    const asnFormRef = useRef<HTMLFormElement>(null);
    const asnNumberInputRef = useRef<HTMLInputElement>(null);
    const warehouseInputRef = useRef<HTMLInputElement>(null);
    const warehouseOptionRefs = useRef<(HTMLButtonElement | null)[]>([]);
    const expectedDateInputRef = useRef<HTMLInputElement>(null);
    const createSupplierButtonRef = useRef<HTMLButtonElement>(null);
    const createSkuButtonRef = useRef<HTMLButtonElement>(null);
    const [isLoading, setIsLoading] = useState(false);

    useEnterNavigation(asnFormRef, { submitOnLast: true });

    const today = new Date().toISOString().split('T')[0];
    const maxDate = new Date();
    maxDate.setFullYear(maxDate.getFullYear() + 2);
    const maxDateStr = maxDate.toISOString().split('T')[0];
    const [expectedDateError, setExpectedDateError] = useState("");


    // Generate initial values
    const initialAsnNumber = `ASN-${new Date().getFullYear()}-${Math.floor(Math.random() * 900) + 100}`;

    const [allSuppliers, setAllSuppliers] = useState<SupplierOption[]>([]);
    const [allItems, setAllItems] = useState<any[]>([]);
    const [pendingItemRow, setPendingItemRow] = useState<{ sIdx: number, iIdx: number } | null>(null);

    const [supplierSearch, setSupplierSearch] = useState("");
    const [supplierInput, setSupplierInput] = useState("");
    const [isSupplierDropdownOpen, setIsSupplierDropdownOpen] = useState(false);
    const [activeSupplierIndex, setActiveSupplierIndex] = useState(-1);
    const [activeSupplierShipmentIndex, setActiveSupplierShipmentIndex] = useState<number | null>(null);
    const [isCreateSupplierOpen, setIsCreateSupplierOpen] = useState(false);
    const [isCreatingSupplier, setIsCreatingSupplier] = useState(false);
    const [supplierCreateForm, setSupplierCreateForm] = useState<SupplierCreateForm>(DEFAULT_SUPPLIER_FORM);
    const [isEditSupplierOpen, setIsEditSupplierOpen] = useState(false);
    const [isUpdatingSupplier, setIsUpdatingSupplier] = useState(false);
    const [supplierEditForm, setSupplierEditForm] = useState<SupplierEditForm>(DEFAULT_SUPPLIER_EDIT_FORM);
    const [editingSupplierId, setEditingSupplierId] = useState<string>("");
    const [editingShipmentIndex, setEditingShipmentIndex] = useState<number | null>(null);
    const [debouncedSupplierSearch] = useDebounce(supplierSearch, 500);
    const [itemSearch, setItemSearch] = useState("");
    const [debouncedItemSearch] = useDebounce(itemSearch, 500);

    const [isSearchingItems, setIsSearchingItems] = useState(false);
    const [activeSkuIndex, setActiveSkuIndex] = useState(-1);
    const [allWarehouses, setAllWarehouses] = useState<WarehouseOption[]>([]);
    const [warehouseSearch, setWarehouseSearch] = useState("");
    const [isWarehouseDropdownOpen, setIsWarehouseDropdownOpen] = useState(false);
    const [activeWarehouseIndex, setActiveWarehouseIndex] = useState(-1);
    const [isWarehouseLoading, setIsWarehouseLoading] = useState(false);
    const [isCreateSkuOpen, setIsCreateSkuOpen] = useState(false);
    const [isCreatingSku, setIsCreatingSku] = useState(false);
    const [skuCreateForm, setSkuCreateForm] = useState<SkuCreateForm>(DEFAULT_SKU_CREATE_FORM);
    const [pendingSkuRow, setPendingSkuRow] = useState<{ sIdx: number, iIdx: number } | null>(null);
    const [selectedSkuRow, setSelectedSkuRow] = useState<{ sIdx: number, iIdx: number } | null>(null);
    const [selectedSkuId, setSelectedSkuId] = useState<string | number | null>(null);
    const [selectedSkuCode, setSelectedSkuCode] = useState("");
    const [skuEditForm, setSkuEditForm] = useState<SkuEditForm>(DEFAULT_SKU_EDIT_FORM);
    const [isSkuCardLoading, setIsSkuCardLoading] = useState(false);
    const [isSkuCardSaving, setIsSkuCardSaving] = useState(false);
    const [isSkuCardOpen, setIsSkuCardOpen] = useState(false);
    const [isCreateSkuFull, setIsCreateSkuFull] = useState(false);

    const selectSupplier = (supplier: SupplierOption, shipmentIndex: number) => {
        setForm(prev => ({
            ...prev,
            supplier_code: shipmentIndex === 0 ? supplier.code : (prev.shipments[0]?.supplier_code || prev.supplier_code || ""),
            shipments: prev.shipments.map(sh => ({
                ...sh,
                supplier_code: sh.supplier_code,
            })),
        }));
        updateShipment(shipmentIndex, 'supplier_id', supplier.id || "");
        updateShipment(shipmentIndex, 'supplier_code', supplier.code);
        updateShipment(shipmentIndex, 'supplier_name', supplier.name);
        setSupplierInput(supplier.name);
        setSupplierSearch(supplier.name);
        setIsSupplierDropdownOpen(false);
        setActiveSupplierShipmentIndex(null);
    };

    const openCreateSupplierDialog = () => {
        const val = supplierInput.trim();
        setSupplierCreateForm({
            ...DEFAULT_SUPPLIER_FORM,
            code: val,
            name: val,
        });
        setIsCreateSupplierOpen(true);
    };

    const updateSupplierCreateForm = (field: keyof SupplierCreateForm, value: string | boolean) => {
        setSupplierCreateForm(prev => ({ ...prev, [field]: value }));
    };

    const updateSupplierEditForm = (field: keyof SupplierEditForm, value: string | boolean) => {
        setSupplierEditForm(prev => ({ ...prev, [field]: value }));
    };

    const updateSkuCreateForm = (field: keyof SkuCreateForm, value: string) => {
        setSkuCreateForm(prev => ({ ...prev, [field]: value }));
    };

    const updateSkuEditForm = <K extends keyof SkuEditForm>(field: K, value: SkuEditForm[K]) => {
        setSkuEditForm(prev => ({ ...prev, [field]: value }));
    };

    const resetSkuEditCard = () => {
        setSelectedSkuRow(null);
        setSelectedSkuId(null);
        setSelectedSkuCode("");
        setSkuEditForm(DEFAULT_SKU_EDIT_FORM);
        setIsSkuCardOpen(false);
    };

    const openSkuEditCard = async (shipmentIndex: number, itemIndex: number, sku: any) => {
        setIsSkuCardOpen(true);
        setSelectedSkuRow({ sIdx: shipmentIndex, iIdx: itemIndex });
        setSelectedSkuCode(String(sku?.skuCode ?? sku?.sku_code ?? ""));
        setSelectedSkuId(sku?.id ?? null);

        if (!sku?.id) {
            setSkuEditForm(buildSkuEditForm(sku));
            return;
        }

        setIsSkuCardLoading(true);
        try {
            const raw = await skuService.getRawById(sku.id);
            setSkuEditForm(buildSkuEditForm(raw));
        } catch (error) {
            console.error("Failed to load SKU details", error);
            setSkuEditForm(buildSkuEditForm(sku));
            toast.error("Failed to load complete SKU details");
        } finally {
            setIsSkuCardLoading(false);
        }
    };

    const handleSaveSkuCard = async () => {
        if (!selectedSkuId || !selectedSkuRow) {
            toast.error("Select a synced SKU to update its details.");
            return;
        }

        let parsedUomHierarchy: Record<string, number> = {};
        let parsedCompatibilityRules: Record<string, unknown> = {};

        try {
            parsedUomHierarchy = JSON.parse(skuEditForm.uom_hierarchy || "{}");
        } catch {
            toast.error("UOM Hierarchy must be valid JSON.");
            return;
        }

        try {
            parsedCompatibilityRules = JSON.parse(skuEditForm.compatibility_rules || "{}");
        } catch {
            toast.error("Compatibility Rules must be valid JSON.");
            return;
        }

        const payload = {
            description: skuEditForm.description,
            short_description: skuEditForm.short_description,
            primary_barcode: skuEditForm.primary_barcode,
            alt_barcodes: csvToArray(skuEditForm.alt_barcodes),
            base_uom: skuEditForm.base_uom,
            alt_uom: skuEditForm.alt_uom,
            uom_conversion: asnToNumber(skuEditForm.uom_conversion),
            uom_hierarchy: parsedUomHierarchy,
            length_cm: asnToNumber(skuEditForm.length_cm),
            width_cm: asnToNumber(skuEditForm.width_cm),
            height_cm: asnToNumber(skuEditForm.height_cm),
            weight_kg: asnToNumber(skuEditForm.weight_kg),
            volume_cc: asnToNumber(skuEditForm.volume_cc),
            pallet_quantity: asnToNumber(skuEditForm.pallet_quantity),
            case_quantity: asnToNumber(skuEditForm.case_quantity),
            inner_quantity: asnToNumber(skuEditForm.inner_quantity),
            item_type: skuEditForm.item_type,
            item_category: skuEditForm.item_category,
            storage_condition: skuEditForm.storage_condition,
            velocity_class: skuEditForm.velocity_class,
            fefo_enabled: skuEditForm.fefo_enabled,
            fifo_enabled: skuEditForm.fifo_enabled,
            shelf_life_days: asnToNumber(skuEditForm.shelf_life_days),
            batch_required: skuEditForm.batch_required,
            serial_required: skuEditForm.serial_required,
            pick_face_eligible: skuEditForm.pick_face_eligible,
            pick_face_capacity: asnToNumber(skuEditForm.pick_face_capacity),
            pick_face_replenishment_point: asnToNumber(skuEditForm.pick_face_replenishment_point),
            preferred_zones: csvToArray(skuEditForm.preferred_zones),
            preferred_bin_types: csvToArray(skuEditForm.preferred_bin_types),
            picking_strategy: skuEditForm.picking_strategy,
            max_stack_height: asnToNumber(skuEditForm.max_stack_height),
            max_qty_per_bin: asnToNumber(skuEditForm.max_qty_per_bin),
            compatibility_rules: parsedCompatibilityRules,
            is_hazardous: skuEditForm.is_hazardous,
            hazard_class: skuEditForm.hazard_class,
            hazmat_code: skuEditForm.hazmat_code,
            requires_inspection: skuEditForm.requires_inspection,
            inspection_rule: skuEditForm.inspection_rule,
            sample_percentage: asnToNumber(skuEditForm.sample_percentage),
            quarantine_on_failure: skuEditForm.quarantine_on_failure,
            hsn_code: skuEditForm.hsn_code,
            tax_rate: asnToNumber(skuEditForm.tax_rate),
            active: skuEditForm.active,
        };

        setIsSkuCardSaving(true);
        try {
            await skuService.update(selectedSkuId, payload);
            updateItem(selectedSkuRow.sIdx, selectedSkuRow.iIdx, "description", payload.description);
            updateItem(selectedSkuRow.sIdx, selectedSkuRow.iIdx, "unit", payload.base_uom || "PCS");
            updateItem(selectedSkuRow.sIdx, selectedSkuRow.iIdx, "hsn_code", payload.hsn_code || "");
            toast.success("SKU updated successfully");
        } catch (error) {
            console.error("Failed to update SKU", error);
            toast.error("Failed to update SKU");
        } finally {
            setIsSkuCardSaving(false);
        }
    };

    const handleCreateSupplier = async () => {
        if (
            !supplierCreateForm.code.trim() ||
            !supplierCreateForm.name.trim() ||
            !supplierCreateForm.gstin.trim() ||
            !supplierCreateForm.contact_person.trim() ||
            !supplierCreateForm.email.trim() ||
            !supplierCreateForm.phone.trim()
        ) {
            toast.error("Supplier code, name, GSTIN, contact person, email, and phone no are required");
            return;
        }

        setIsCreatingSupplier(true);
        try {
            const fullPhone = `${supplierCreateForm.country_code}${supplierCreateForm.phone}`;
            const created = await vendorService.create({
                code: supplierCreateForm.code.trim(),
                name: supplierCreateForm.name.trim(),
                gstin: supplierCreateForm.gstin.trim(),
                contact_person: supplierCreateForm.contact_person.trim(),
                phone: fullPhone,
                email: supplierCreateForm.email.trim(),
                address: supplierCreateForm.address.trim(),
                payment_terms: supplierCreateForm.payment_terms.trim(),
            });

            const createdSupplier = {
                id: String(created?.id || created?.supplier_id || ""),
                code: String(created?.code || supplierCreateForm.code.trim()),
                name: String(created?.name || supplierCreateForm.name.trim()),
            };

            setAllSuppliers(prev => {
                const withoutDuplicate = prev.filter((supplier) => supplier.code !== createdSupplier.code);
                return [createdSupplier, ...withoutDuplicate];
            });
            const targetShipmentIndex = activeSupplierShipmentIndex ?? 0;
            selectSupplier(createdSupplier, targetShipmentIndex);
            setSupplierCreateForm(DEFAULT_SUPPLIER_FORM);
            setIsCreateSupplierOpen(false);
            toast.success("Supplier created successfully");
        } catch (error) {
            console.error("Failed to create supplier", error);
            toast.error("Failed to create supplier");
        } finally {
            setIsCreatingSupplier(false);
        }
    };

    const resolveSupplierId = (supplierData: Record<string, unknown>): string => {
        return String(
            supplierData.id ?? supplierData.supplier_id ?? supplierData.vendor_id ?? ""
        ).trim();
    };

    const openEditSupplierDialog = async (shipmentIndex: number) => {
        const shipment = form.shipments[shipmentIndex];
        if (!shipment?.supplier_code) {
            toast.error("Select a supplier first.");
            return;
        }

        try {
            let supplierData: Record<string, unknown> | null = null;
            const existingId = String(shipment.supplier_id || "").trim();

            if (existingId) {
                const data = await vendorService.getById(existingId);
                supplierData = (data ?? {}) as Record<string, unknown>;
            } else {
                const data = await vendorService.getByCode(shipment.supplier_code);
                supplierData = (data ?? {}) as Record<string, unknown>;
            }

            const supplierId = resolveSupplierId(supplierData);
            if (!supplierId) {
                toast.error("Unable to resolve supplier ID for editing.");
                return;
            }

            const rawPhone = String(supplierData.phone ?? "");
            let country_code = "+971";
            let phone = rawPhone;

            // Attempt to extract country code
            for (const country of COUNTRY_DATA) {
                if (rawPhone.startsWith(country.code)) {
                    country_code = country.code;
                    phone = rawPhone.substring(country.code.length);
                    break;
                }
            }

            setEditingSupplierId(supplierId);
            setEditingShipmentIndex(shipmentIndex);
            setSupplierEditForm({
                name: String(supplierData.name ?? shipment.supplier_name ?? ""),
                gstin: String(supplierData.gstin ?? ""),
                contact_person: String(supplierData.contact_person ?? ""),
                country_code,
                phone,
                email: String(supplierData.email ?? ""),
                address: String(supplierData.address ?? ""),
                payment_terms: String(supplierData.payment_terms ?? ""),
            });
            setIsEditSupplierOpen(true);
        } catch (error) {
            console.error("Failed to load supplier details", error);
            toast.error("Failed to load supplier details");
        }
    };

    const handleEditSupplier = async () => {
        if (!editingSupplierId) {
            toast.error("Supplier ID is missing.");
            return;
        }

        if (!supplierEditForm.name.trim()) {
            toast.error("Supplier name is required.");
            return;
        }

        if (!supplierEditForm.gstin.trim()) {
            toast.error("GSTIN is required.");
            return;
        }

        if (!supplierEditForm.contact_person.trim()) {
            toast.error("Contact person is required.");
            return;
        }

        if (!isPhoneValid(supplierEditForm.phone, supplierEditForm.country_code)) {
            const country = COUNTRY_DATA.find(c => c.code === supplierEditForm.country_code) || COUNTRY_DATA[0];
            toast.error(`Invalid phone length for ${country.country}. Exactly ${country.digits} digits required.`);
            return;
        }

        setIsUpdatingSupplier(true);
        try {
            const fullPhone = `${supplierEditForm.country_code}${supplierEditForm.phone}`;
            const updated = await vendorService.patch(editingSupplierId, {
                name: supplierEditForm.name.trim(),
                gstin: supplierEditForm.gstin.trim(),
                contact_person: supplierEditForm.contact_person.trim(),
                phone: fullPhone,
                email: supplierEditForm.email.trim(),
                address: supplierEditForm.address.trim(),
                payment_terms: supplierEditForm.payment_terms.trim(),
            });

            const updatedName = String(updated?.name || supplierEditForm.name.trim());

            if (editingShipmentIndex !== null) {
                updateShipment(editingShipmentIndex, "supplier_name", updatedName);
            }

            setAllSuppliers((prev) =>
                prev.map((s) =>
                    s.id === editingSupplierId
                        ? { ...s, name: updatedName }
                        : s
                )
            );

            setSupplierInput(updatedName);
            setSupplierSearch(updatedName);
            setIsEditSupplierOpen(false);
            setEditingSupplierId("");
            setEditingShipmentIndex(null);
            setSupplierEditForm(DEFAULT_SUPPLIER_EDIT_FORM);
            toast.success("Supplier updated successfully");
        } catch (error) {
            console.error("Failed to update supplier", error);
            toast.error("Failed to update supplier");
        } finally {
            setIsUpdatingSupplier(false);
        }
    };


    const performSupplierSearch = async (query: string) => {
        try {
            const data = await vendorService.search(query);
            const normalized = (Array.isArray(data) ? data : [])
                .filter((s: any) => s.active !== false)
                .map((s: Record<string, unknown>) => ({
                    id: String(s.id || s.supplier_id || ""),
                    code: String(s.code || s.supplier_code || ""),
                    name: String(s.name || s.supplier_name || s.vendor_name || s.code || ""),
                })).filter((s: SupplierOption) => s.code || s.name);
            setAllSuppliers(normalized);
        } catch (error) {
            console.error("Failed to search suppliers", error);
        }
    };

    const performItemSearch = async (query: string) => {
        setIsSearchingItems(true);
        try {
            const data = await skuService.search(query);
            const results = Array.isArray(data) ? data : [];
            // Filter only active SKUs
            setAllItems(results.filter((item: any) => item.active !== false));
        } catch (error) {
            console.error("Failed to search items", error);
        } finally {
            setIsSearchingItems(false);
        }
    };

    const openCreateSkuDialog = (shipmentIndex: number, itemIndex: number, initialCode: string = "") => {
        setPendingSkuRow({ sIdx: shipmentIndex, iIdx: itemIndex });
        const val = initialCode.trim();
        setSkuCreateForm({
            ...DEFAULT_SKU_CREATE_FORM,
            sku_code: val,
            description: val,
            short_description: val,
        });
        setIsCreateSkuOpen(true);
    };


    const handleCreateSku = async () => {
        if (!pendingSkuRow) {
            toast.error("Select an item row first.");
            return;
        }

        let payload: any;
        
        if (isCreateSkuFull) {
            payload = {
                sku_code: skuCreateForm.sku_code.trim(),
                description: skuEditForm.description,
                short_description: skuEditForm.short_description,
                primary_barcode: skuEditForm.primary_barcode,
                alt_barcodes: csvToArray(skuEditForm.alt_barcodes),
                base_uom: skuEditForm.base_uom,
                alt_uom: skuEditForm.alt_uom,
                uom_conversion: asnToNumber(skuEditForm.uom_conversion),
                uom_hierarchy: JSON.parse(skuEditForm.uom_hierarchy || "{}"),
                length_cm: asnToNumber(skuEditForm.length_cm),
                width_cm: asnToNumber(skuEditForm.width_cm),
                height_cm: asnToNumber(skuEditForm.height_cm),
                weight_kg: asnToNumber(skuEditForm.weight_kg),
                volume_cc: asnToNumber(skuEditForm.volume_cc),
                pallet_quantity: asnToNumber(skuEditForm.pallet_quantity),
                case_quantity: asnToNumber(skuEditForm.case_quantity),
                inner_quantity: asnToNumber(skuEditForm.inner_quantity),
                item_type: skuEditForm.item_type,
                item_category: skuEditForm.item_category,
                storage_condition: skuEditForm.storage_condition,
                velocity_class: skuEditForm.velocity_class,
                fefo_enabled: skuEditForm.fefo_enabled,
                fifo_enabled: skuEditForm.fifo_enabled,
                shelf_life_days: asnToNumber(skuEditForm.shelf_life_days),
                batch_required: skuEditForm.batch_required,
                serial_required: skuEditForm.serial_required,
                pick_face_eligible: skuEditForm.pick_face_eligible,
                pick_face_capacity: asnToNumber(skuEditForm.pick_face_capacity),
                pick_face_replenishment_point: asnToNumber(skuEditForm.pick_face_replenishment_point),
                preferred_zones: csvToArray(skuEditForm.preferred_zones),
                preferred_bin_types: csvToArray(skuEditForm.preferred_bin_types),
                picking_strategy: skuEditForm.picking_strategy,
                max_stack_height: asnToNumber(skuEditForm.max_stack_height),
                max_qty_per_bin: asnToNumber(skuEditForm.max_qty_per_bin),
                compatibility_rules: JSON.parse(skuEditForm.compatibility_rules || "{}"),
                is_hazardous: skuEditForm.is_hazardous,
                hazard_class: skuEditForm.hazard_class,
                hazmat_code: skuEditForm.hazmat_code,
                requires_inspection: skuEditForm.requires_inspection,
                inspection_rule: skuEditForm.inspection_rule,
                sample_percentage: asnToNumber(skuEditForm.sample_percentage),
                quarantine_on_failure: skuEditForm.quarantine_on_failure,
                hsn_code: skuEditForm.hsn_code,
                tax_rate: asnToNumber(skuEditForm.tax_rate),
                active: skuEditForm.active,
            };
        } else {
            if (!skuCreateForm.sku_code.trim()) {
                toast.error("SKU code is required.");
                return;
            }

            payload = {
                sku_code: skuCreateForm.sku_code.trim(),
                description: skuCreateForm.description.trim(),
                short_description: skuCreateForm.short_description.trim(),
                primary_barcode: skuCreateForm.primary_barcode.trim(),
                item_category: skuCreateForm.item_category,
                alt_barcodes: skuCreateForm.alt_barcodes
                    .split(",")
                    .map((barcode) => barcode.trim())
                    .filter(Boolean),
                base_uom: skuCreateForm.base_uom.trim() || "PCS",
            };
        }

        setIsCreatingSku(true);
        try {
            const created = await skuService.create(payload);

            const createdSku = {
                id: created?.id ?? created?.item_id ?? null,
                skuCode: String(created?.sku_code ?? created?.code ?? payload.sku_code),
                description: String(created?.description ?? payload.description),
                productName: String(created?.product_name ?? created?.name ?? created?.description ?? payload.description),
                baseUom: String(created?.base_uom ?? created?.uom ?? payload.base_uom),
                hsnCode: String(created?.hsn_code ?? ""),
            };

            selectSku(pendingSkuRow.sIdx, pendingSkuRow.iIdx, createdSku);
            setIsCreateSkuOpen(false);
            setIsCreateSkuFull(false);
            setSkuCreateForm(DEFAULT_SKU_CREATE_FORM);
            setSkuEditForm(DEFAULT_SKU_EDIT_FORM);
            setPendingSkuRow(null);
            toast.success("SKU created successfully");
        } catch (error) {
            console.error("Failed to create SKU", error);
            toast.error("Failed to create SKU");
        } finally {
            setIsCreatingSku(false);
        }
    };

    const loadActiveWarehouses = async () => {
        setIsWarehouseLoading(true);
        try {
            const response = await warehouseService.getAll();
            const rows = Array.isArray(response)
                ? response
                : response && typeof response === "object"
                    ? ((response as Record<string, unknown>).data ??
                        (response as Record<string, unknown>).items ??
                        (response as Record<string, unknown>).results ??
                        (response as Record<string, unknown>).warehouses)
                    : [];

            const normalized = (Array.isArray(rows) ? rows : [])
                .map((entry) => {
                    const warehouse = (entry ?? {}) as Record<string, unknown>;
                    const id = String(warehouse.id ?? warehouse.warehouse_id ?? "").trim();
                    const code = String(warehouse.code ?? warehouse.warehouse_code ?? "").trim();
                    const name = String(warehouse.name ?? warehouse.warehouse_name ?? "").trim();
                    const status = String(warehouse.status ?? "").trim().toLowerCase();
                    const isActive =
                        warehouse.is_active === true ||
                        warehouse.active === true ||
                        status === "active" ||
                        status === "enabled";

                    if (!id || !code || !isActive) return null;
                    return { id, code, name };
                })
                .filter((warehouse): warehouse is WarehouseOption => Boolean(warehouse));

            setAllWarehouses(normalized);
        } catch (error) {
            console.error("Failed to load warehouses", error);
            toast.error("Failed to load active warehouses");
            setAllWarehouses([]);
        } finally {
            setIsWarehouseLoading(false);
        }
    };


    // Fetch suppliers when debounced search changes
    useEffect(() => {
        if (debouncedSupplierSearch.trim()) {
            performSupplierSearch(debouncedSupplierSearch);
        } else {
            setAllSuppliers([]);
        }
    }, [debouncedSupplierSearch]);

    // Fetch items when debounced search changes
    useEffect(() => {
        if (debouncedItemSearch.trim()) {
            performItemSearch(debouncedItemSearch);
        } else {
            setAllItems([]);
        }
    }, [debouncedItemSearch]);

    useEffect(() => {
        if (isSupplierDropdownOpen) {
            setActiveSupplierIndex(allSuppliers.length > 0 ? 0 : -1);
        }
    }, [allSuppliers, isSupplierDropdownOpen]);

    useEffect(() => {
        if (pendingItemRow) {
            setActiveSkuIndex(allItems.length > 0 ? 0 : -1);
        } else {
            setActiveSkuIndex(-1);
        }
    }, [allItems, pendingItemRow]);

    useEffect(() => {
        void loadActiveWarehouses();
    }, []);

    const filteredWarehouses = allWarehouses.filter((warehouse) => {
        const q = warehouseSearch.trim().toLowerCase();
        if (!q) return true;
        return [warehouse.code, warehouse.name, warehouse.id].some((value) =>
            value.toLowerCase().includes(q)
        );
    });

    useEffect(() => {
        if (isWarehouseDropdownOpen) {
            setActiveWarehouseIndex(filteredWarehouses.length > 0 ? 0 : -1);
        } else {
            setActiveWarehouseIndex(-1);
        }
    }, [filteredWarehouses.length, isWarehouseDropdownOpen]);

    useEffect(() => {
        if (activeWarehouseIndex >= 0 && warehouseOptionRefs.current[activeWarehouseIndex]) {
            warehouseOptionRefs.current[activeWarehouseIndex]?.scrollIntoView({
                block: 'nearest',
            });
        }
    }, [activeWarehouseIndex]);

    // Keep keyboard flow fast: land on first editable field when page opens.
    useEffect(() => {
        asnNumberInputRef.current?.focus();
    }, []);

    const [form, setForm] = useState<AsnForm>({
        asn_number: initialAsnNumber,
        asn_date: new Date().toISOString(),
        shipment_id: "",
        expected_date: "",
        warehouse_code: "",
        warehouse_id: "",
        status: "draft",
        notes: "",
        supplier_code: "",
        shipments: [
            {
                po_numbers: [""],
                supplier_code: "",
                notes: "",
                items: [{
                    sku: "",
                    description: "",
                    quantity: 0,
                    unit: "PCS",
                    unit_price: 0,
                    total_price: 0,
                    lot: "",
                    hsn_code: "",
                    expiry_date: ""
                }]
            }
        ]
    });

    // Top-level handlers
    const updateForm = (field: keyof AsnForm, value: string) => {
        setForm(prev => ({ ...prev, [field]: value }));
    };

    const selectWarehouse = (warehouse: WarehouseOption) => {
        setWarehouseSearch(warehouse.code);
        setForm(prev => ({
            ...prev,
            warehouse_code: warehouse.code,
            warehouse_id: warehouse.id,
        }));
        setIsWarehouseDropdownOpen(false);
        warehouseInputRef.current?.focus();
    };


    // Shipment Handlers
    const addShipment = () => {
        setForm(prev => ({
            ...prev,
            shipments: [
                ...prev.shipments,
                {
                    po_numbers: [""],
                    supplier_id: "",
                    supplier_code: "",
                    notes: "",
                    items: [{
                        sku_id: "",
                        sku: "",
                        description: "",
                        quantity: 0,
                        unit: "PCS",
                        unit_price: 0,
                        total_price: 0,
                        lot: "",
                        hsn_code: "",
                        expiry_date: ""
                    }]
                }
            ]
        }));
    };

    const removeShipment = (shipmentIndex: number) => {
        if (selectedSkuRow?.sIdx === shipmentIndex) {
            resetSkuEditCard();
        }

        setForm(prev => ({
            ...prev,
            shipments: prev.shipments.filter((_, idx) => idx !== shipmentIndex)
        }));
    };

    const updateShipment = (idx: number, field: keyof Shipment, value: any) => {
        setForm(prev => {
            const newShipments = [...prev.shipments];
            newShipments[idx] = { ...newShipments[idx], [field]: value };
            return { ...prev, shipments: newShipments };
        });
    };

    const removePoNumber = (shipmentIdx: number, poIdx: number) => {
        setForm(prev => {
            const newShipments = [...prev.shipments];
            if (newShipments[shipmentIdx].po_numbers.length > 1) {
                newShipments[shipmentIdx].po_numbers = newShipments[shipmentIdx].po_numbers.filter((_, idx) => idx !== poIdx);
            }
            return { ...prev, shipments: newShipments };
        });
    };

    const updatePoNumber = (shipmentIdx: number, poIdx: number, value: string) => {
        setForm(prev => {
            const newShipments = [...prev.shipments];
            newShipments[shipmentIdx].po_numbers[poIdx] = value;
            return { ...prev, shipments: newShipments };
        });
    };

    // Item Handlers
    const addItem = (shipmentIndex: number) => {
        setForm(prev => {
            const newShipments = [...prev.shipments];
            newShipments[shipmentIndex].items.push({
                sku_id: "",
                sku: "",
                description: "",
                quantity: 0,
                unit: "PCS",
                unit_price: 0,
                total_price: 0,
                lot: "",
                hsn_code: "",
                expiry_date: ""
            });
            return { ...prev, shipments: newShipments };
        });
    };

    const selectSku = (shipmentIndex: number, itemIndex: number, sku: any) => {
        updateItem(shipmentIndex, itemIndex, 'sku_id', sku.id || "");
        updateItem(shipmentIndex, itemIndex, 'sku', sku.skuCode);
        updateItem(shipmentIndex, itemIndex, 'description', sku.productName || sku.description || "");
        updateItem(shipmentIndex, itemIndex, 'unit', sku.baseUom || 'PCS');
        updateItem(shipmentIndex, itemIndex, 'hsn_code', sku.hsnCode || '');
        setIsSkuCardOpen(false);
        setItemSearch("");
        setPendingItemRow(null);
        setActiveSkuIndex(-1);
    };

    const removeItem = (shipmentIndex: number, itemIndex: number) => {
        if (selectedSkuRow?.sIdx === shipmentIndex && selectedSkuRow?.iIdx === itemIndex) {
            resetSkuEditCard();
        }

        setForm(prev => {
            const newShipments = [...prev.shipments];
            newShipments[shipmentIndex].items = newShipments[shipmentIndex].items.filter((_, idx) => idx !== itemIndex);
            return { ...prev, shipments: newShipments };
        });
    };

    const updateItem = (shipmentIndex: number, itemIndex: number, field: keyof AsnItem, value: any) => {
        setForm(prev => {
            const newShipments = [...prev.shipments];
            const item = { ...newShipments[shipmentIndex].items[itemIndex], [field]: value };

            // Auto-calculate total price if quantity or unit_price changes
            if (field === 'quantity' || field === 'unit_price') {
                const qty = Number(field === 'quantity' ? value : item.quantity) || 0;
                const price = Number(field === 'unit_price' ? value : item.unit_price) || 0;
                item.quantity = qty;
                item.unit_price = price;
                item.total_price = qty * price;
            } else {
                (item as any)[field] = value;
            }

            newShipments[shipmentIndex].items[itemIndex] = item;
            return { ...prev, shipments: newShipments };
        });
    };

    const getSubmissionData = () => {
        // Explicitly construct the payload to match the strict schema
        return {
            asn_number: form.asn_number,
            asn_date: new Date(form.asn_date).toISOString(),
            shipment_id: form.shipment_id,
            expected_date: form.expected_date, // Simple YYYY-MM-DD from input[type="date"]
            warehouse_code: form.warehouse_code,
            warehouse_id: form.warehouse_id,
            status: form.status,
            notes: form.notes,
            supplier_code: form.shipments[0]?.supplier_code || "",
            shipments: form.shipments.map(s => ({
                po_number: s.po_numbers.filter(po => po.trim() !== "").join(", "),
                supplier_code: s.supplier_code,
                notes: s.notes,
                items: s.items.map(item => ({
                    sku: item.sku,
                    description: item.description || "",
                    quantity: Number(item.quantity) || 0,
                    unit: item.unit,
                    unit_price: Number(item.unit_price) || 0,
                    total_price: Number(item.total_price) || 0,
                    lot: item.lot || "",
                    hsn_code: item.hsn_code,
                    expiry_date: item.expiry_date && item.expiry_date.trim() !== "" ? item.expiry_date : null
                }))
            }))
        };
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Validate Expected Date is not in the past
        if (form.expected_date && form.expected_date < today) {
            toast.error("Expected Date cannot be in the past");
            expectedDateInputRef.current?.focus();
            return;
        }

        const submissionData = getSubmissionData();

        console.log("=== ASN FORM SUBMISSION ===");
        console.log(JSON.stringify(submissionData, null, 2));
        console.log("===========================");

        setIsLoading(true);
        try {
            await asnService.create(submissionData);
            toast.success('ASN created successfully');
            navigate('/dashboard/asns');
        } catch (error: any) {
            // Centralized error message from either standard Axios response or fallback string
            let errorMsg = error?.response?.data?.detail || error?.message || 'Failed to create ASN';

            // Fix: If backend returns validation array/object, stringify it so it doesn't crash React Error Boundary
            if (typeof errorMsg !== 'string') {
                errorMsg = JSON.stringify(errorMsg);
            }

            toast.error(errorMsg);
            console.error('Failed to save ASN:', errorMsg);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="font-heading text-3xl font-bold">Create New ASN</h1>
                    <p className="text-muted-foreground">Register an Advance Shipment Notice (Strict Schema)</p>
                </div>
            </div>

            <form ref={asnFormRef} onSubmit={handleSubmit} className="space-y-8">


                {/* 1️⃣ ASN Header Section */}
                <Card className="border-border shadow-sm">
                    <CardHeader className="border-b bg-muted/30 pb-4">
                        <CardTitle className="text-lg flex items-center gap-2">
                            <FileText className="w-5 h-5 text-primary" />
                            ASN Header Information
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        <div className="space-y-2">
                            <Label htmlFor="asnNumber">ASN Number <span className="text-destructive">*</span></Label>
                            <Input
                                ref={asnNumberInputRef}
                                id="asnNumber"
                                value={form.asn_number}
                                onChange={(e) => updateForm('asn_number', e.target.value)}
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="asnDate">ASN Date <span className="text-destructive">*</span></Label>
                            <Input
                                id="asnDate"
                                type="datetime-local"
                                value={form.asn_date.slice(0, 16)}
                                onChange={(e) => updateForm('asn_date', e.target.value)}
                                className="appearance-none [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-datetime-edit-inner-spin-button]:hidden [&::-webkit-datetime-edit-outer-spin-button]:hidden"
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="shipmentId">Shipment ID <span className="text-destructive">*</span></Label>
                            <Input
                                id="shipmentId"
                                placeholder="e.g. SHIP-001"
                                value={form.shipment_id}
                                onChange={(e) => updateForm('shipment_id', e.target.value)}
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="expectedDate">Expected Date <span className="text-destructive">*</span></Label>
                            <Input
                                ref={expectedDateInputRef}
                                id="expectedDate"
                                type="date"
                                value={form.expected_date}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    updateForm('expected_date', val);
                                    if (!val) {
                                        setExpectedDateError("");
                                    } else if (val < today) {
                                        setExpectedDateError("Expected date cannot be in the past.");
                                    } else if (val > maxDateStr) {
                                        setExpectedDateError("Expected date cannot be more than 2 years in the future.");
                                    } else {
                                        setExpectedDateError("");
                                    }
                                }}
                                required
                                min={today}
                                max={maxDateStr}
                                error={expectedDateError}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="warehouseCode">Warehouse Code <span className="text-destructive">*</span></Label>
                            <div className="relative">
                                <Input
                                    ref={warehouseInputRef}
                                    id="warehouseCode"
                                    role="combobox"
                                    aria-expanded={isWarehouseDropdownOpen}
                                    aria-haspopup="listbox"
                                    placeholder={isWarehouseLoading ? "Loading warehouses..." : "Search warehouse code..."}
                                    value={warehouseSearch}
                                    onFocus={() => setIsWarehouseDropdownOpen(true)}
                                    onBlur={() => window.setTimeout(() => setIsWarehouseDropdownOpen(false), 120)}
                                    onChange={(e) => {
                                        const value = e.target.value;
                                        setWarehouseSearch(value);
                                        setIsWarehouseDropdownOpen(true);
                                        setForm(prev => ({
                                            ...prev,
                                            warehouse_code: value,
                                            warehouse_id: "",
                                        }));
                                    }}
                                    onKeyDown={(e) => {
                                        if (!isWarehouseDropdownOpen && (e.key === 'ArrowDown' || e.key === 'Enter')) {
                                            setIsWarehouseDropdownOpen(true);
                                            e.preventDefault();
                                            return;
                                        }

                                        if (isWarehouseDropdownOpen) {
                                            switch (e.key) {
                                                case 'ArrowDown':
                                                    e.preventDefault();
                                                    setActiveWarehouseIndex(prev =>
                                                        prev < filteredWarehouses.length - 1 ? prev + 1 : prev
                                                    );
                                                    break;
                                                case 'ArrowUp':
                                                    e.preventDefault();
                                                    setActiveWarehouseIndex(prev =>
                                                        prev > 0 ? prev - 1 : prev
                                                    );
                                                    break;
                                                case 'Enter':
                                                    if (activeWarehouseIndex >= 0 && activeWarehouseIndex < filteredWarehouses.length) {
                                                        e.preventDefault();
                                                        selectWarehouse(filteredWarehouses[activeWarehouseIndex]);
                                                        // Auto-advance focus to the next field (Notes) after selection
                                                        window.setTimeout(() => {
                                                            const nextField = document.getElementById('notes');
                                                            if (nextField) {
                                                                nextField.focus();
                                                                if (nextField instanceof HTMLInputElement) nextField.select();
                                                            }
                                                        }, 150);
                                                    }
                                                    break;
                                                case 'Escape':
                                                    e.preventDefault();
                                                    setIsWarehouseDropdownOpen(false);
                                                    break;
                                            }
                                        }
                                    }}
                                    required
                                />
                                {isWarehouseDropdownOpen && (
                                    <div className="absolute z-50 mt-1 max-h-52 w-full overflow-auto rounded-md border bg-background shadow-md">
                                        {filteredWarehouses.length === 0 ? (
                                            <p className="px-3 py-2 text-sm text-muted-foreground">No active warehouse found.</p>
                                        ) : (
                                            filteredWarehouses.map((warehouse, index) => (
                                                <button
                                                    key={warehouse.id}
                                                    ref={el => { warehouseOptionRefs.current[index] = el; }}
                                                    type="button"
                                                    className={cn(
                                                        "w-full px-3 py-2 text-left text-sm hover:bg-primary/10 hover:text-foreground transition-colors",
                                                        index === activeWarehouseIndex && "bg-primary/10 text-foreground outline-none"
                                                    )}
                                                    onMouseDown={(e) => e.preventDefault()}
                                                    onClick={() => selectWarehouse(warehouse)}
                                                >
                                                    <div className="font-medium">{warehouse.code}</div>
                                                    <div className="text-xs text-muted-foreground">
                                                        {warehouse.name ? `${warehouse.name} • ` : ""}{warehouse.id}
                                                    </div>
                                                </button>
                                            ))
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="space-y-2 lg:col-span-2">
                            <Label htmlFor="notes">Notes</Label>
                            <Input
                                id="notes"
                                placeholder="General remarks..."
                                value={form.notes}
                                onChange={(e) => updateForm('notes', e.target.value)}
                            />
                        </div>
                    </CardContent>
                </Card>

                <Dialog open={isCreateSupplierOpen} onOpenChange={setIsCreateSupplierOpen}>
                    <DialogContent className="sm:max-w-2xl">
                        <DialogHeader>
                            <DialogTitle>Create New Supplier</DialogTitle>
                        </DialogHeader>

                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="newSupplierCode">Code <span className="text-destructive">*</span></Label>
                                <Input
                                    id="newSupplierCode"
                                    value={supplierCreateForm.code}
                                    onChange={(e) => updateSupplierCreateForm("code", e.target.value)}
                                    placeholder="Supplier code"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="newSupplierName">Name <span className="text-destructive">*</span></Label>
                                <Input
                                    id="newSupplierName"
                                    value={supplierCreateForm.name}
                                    onChange={(e) => updateSupplierCreateForm("name", e.target.value)}
                                    placeholder="Supplier name"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="newSupplierGstin">GSTIN <span className="text-destructive">*</span></Label>
                                <Input
                                    id="newSupplierGstin"
                                    value={supplierCreateForm.gstin}
                                    onChange={(e) => updateSupplierCreateForm("gstin", e.target.value)}
                                    placeholder="GSTIN"
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="newSupplierContactPerson">Contact Person <span className="text-destructive">*</span></Label>
                                <Input
                                    id="newSupplierContactPerson"
                                    value={supplierCreateForm.contact_person}
                                    onChange={(e) => updateSupplierCreateForm("contact_person", e.target.value)}
                                    placeholder="Contact person"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="newSupplierPhone">Phone No <span className="text-destructive">*</span></Label>
                                <PhoneInput
                                    id="newSupplierPhone"
                                    value={supplierCreateForm.phone}
                                    countryCode={supplierCreateForm.country_code}
                                    onPhoneChange={(val) => updateSupplierCreateForm("phone", val)}
                                    onCountryCodeChange={(code) => updateSupplierCreateForm("country_code", code)}
                                    placeholder="Phone"
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="newSupplierEmail">Email <span className="text-destructive">*</span></Label>
                                <Input
                                    id="newSupplierEmail"
                                    type="email"
                                    value={supplierCreateForm.email}
                                    onChange={(e) => updateSupplierCreateForm("email", e.target.value)}
                                    placeholder="user@example.com"
                                />
                            </div>
                            <div className="space-y-2 sm:col-span-2">
                                <Label htmlFor="newSupplierAddress">Address</Label>
                                <Input
                                    id="newSupplierAddress"
                                    value={supplierCreateForm.address}
                                    onChange={(e) => updateSupplierCreateForm("address", e.target.value)}
                                    placeholder="Address"
                                />
                            </div>
                            <div className="space-y-2 sm:col-span-2">
                                <Label htmlFor="newSupplierPaymentTerms">Payment Terms</Label>
                                <Input
                                    id="newSupplierPaymentTerms"
                                    value={supplierCreateForm.payment_terms}
                                    onChange={(e) => updateSupplierCreateForm("payment_terms", e.target.value)}
                                    placeholder="Payment terms"
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                            e.preventDefault();
                                            createSupplierButtonRef.current?.focus();
                                        }
                                    }}
                                />
                            </div>
                        </div>

                        <DialogFooter>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setIsCreateSupplierOpen(false)}
                                disabled={isCreatingSupplier}
                            >
                                Cancel
                            </Button>
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <div className="inline-block">
                                            <Button
                                                type="button"
                                                ref={createSupplierButtonRef}
                                                onClick={handleCreateSupplier}
                                                disabled={
                                                    isCreatingSupplier ||
                                                    !supplierCreateForm.code.trim() ||
                                                    !supplierCreateForm.name.trim() ||
                                                    !supplierCreateForm.gstin.trim() ||
                                                    !supplierCreateForm.contact_person.trim() ||
                                                    !supplierCreateForm.email.trim() ||
                                                    !isPhoneValid(supplierCreateForm.phone, supplierCreateForm.country_code)
                                                }
                                            >
                                                {isCreatingSupplier ? "Creating..." : "Create Supplier"}
                                            </Button>
                                        </div>
                                    </TooltipTrigger>
                                    {(!supplierCreateForm.code.trim() ||
                                        !supplierCreateForm.name.trim() ||
                                        !supplierCreateForm.gstin.trim() ||
                                        !supplierCreateForm.contact_person.trim() ||
                                        !supplierCreateForm.email.trim() ||
                                        !isPhoneValid(supplierCreateForm.phone, supplierCreateForm.country_code)) && (
                                            <TooltipContent side="top" className="max-w-[200px] text-xs">
                                                <p className="font-bold mb-1">Required to Create:</p>
                                                <ul className="list-disc list-inside space-y-1">
                                                    {!supplierCreateForm.code.trim() && <li>Supplier Code</li>}
                                                    {!supplierCreateForm.name.trim() && <li>Supplier Name</li>}
                                                    {!supplierCreateForm.gstin.trim() && <li>GSTIN Number</li>}
                                                    {!supplierCreateForm.contact_person.trim() && <li>Contact Person</li>}
                                                    {!supplierCreateForm.email.trim() && <li>Email Address</li>}
                                                    {!isPhoneValid(supplierCreateForm.phone, supplierCreateForm.country_code) && (
                                                        <li>Valid Phone ({COUNTRY_DATA.find(c => c.code === supplierCreateForm.country_code)?.digits} digits)</li>
                                                    )}
                                                </ul>
                                            </TooltipContent>
                                        )}
                                </Tooltip>
                            </TooltipProvider>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                <Dialog open={isEditSupplierOpen} onOpenChange={setIsEditSupplierOpen}>
                    <DialogContent className="sm:max-w-2xl">
                        <DialogHeader>
                            <DialogTitle>Edit Supplier</DialogTitle>
                        </DialogHeader>

                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="editSupplierName">Name</Label>
                                <Input
                                    id="editSupplierName"
                                    value={supplierEditForm.name}
                                    onChange={(e) => updateSupplierEditForm("name", e.target.value)}
                                    placeholder="Supplier name"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="editSupplierGstin">GSTIN <span className="text-destructive">*</span></Label>
                                <Input
                                    id="editSupplierGstin"
                                    value={supplierEditForm.gstin}
                                    onChange={(e) => updateSupplierEditForm("gstin", e.target.value)}
                                    placeholder="GSTIN"
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="editSupplierContactPerson">Contact Person <span className="text-destructive">*</span></Label>
                                <Input
                                    id="editSupplierContactPerson"
                                    value={supplierEditForm.contact_person}
                                    onChange={(e) => updateSupplierEditForm("contact_person", e.target.value)}
                                    placeholder="Contact person"
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="editSupplierPhone">Phone <span className="text-destructive">*</span></Label>
                                <PhoneInput
                                    id="editSupplierPhone"
                                    value={supplierEditForm.phone}
                                    countryCode={supplierEditForm.country_code}
                                    onPhoneChange={(val) => updateSupplierEditForm("phone", val)}
                                    onCountryCodeChange={(code) => updateSupplierEditForm("country_code", code)}
                                    placeholder="Phone"
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="editSupplierEmail">Email</Label>
                                <Input
                                    id="editSupplierEmail"
                                    type="email"
                                    value={supplierEditForm.email}
                                    onChange={(e) => updateSupplierEditForm("email", e.target.value)}
                                    placeholder="user@example.com"
                                />
                            </div>
                            <div className="space-y-2 sm:col-span-2">
                                <Label htmlFor="editSupplierAddress">Address</Label>
                                <Input
                                    id="editSupplierAddress"
                                    value={supplierEditForm.address}
                                    onChange={(e) => updateSupplierEditForm("address", e.target.value)}
                                    placeholder="Address"
                                />
                            </div>
                            <div className="space-y-2 sm:col-span-2">
                                <Label htmlFor="editSupplierPaymentTerms">Payment Terms</Label>
                                <Input
                                    id="editSupplierPaymentTerms"
                                    value={supplierEditForm.payment_terms}
                                    onChange={(e) => updateSupplierEditForm("payment_terms", e.target.value)}
                                    placeholder="Payment terms"
                                />
                            </div>
                        </div>

                        <DialogFooter>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setIsEditSupplierOpen(false)}
                                disabled={isUpdatingSupplier}
                            >
                                Cancel
                            </Button>
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <div className="inline-block">
                                            <Button
                                                type="button"
                                                onClick={handleEditSupplier}
                                                disabled={
                                                    isUpdatingSupplier ||
                                                    !supplierEditForm.name.trim() ||
                                                    !supplierEditForm.gstin.trim() ||
                                                    !supplierEditForm.contact_person.trim() ||
                                                    !isPhoneValid(supplierEditForm.phone, supplierEditForm.country_code)
                                                }
                                            >
                                                {isUpdatingSupplier ? "Saving..." : "Save Changes"}
                                            </Button>
                                        </div>
                                    </TooltipTrigger>
                                    {(!supplierEditForm.name.trim() ||
                                        !supplierEditForm.gstin.trim() ||
                                        !supplierEditForm.contact_person.trim() ||
                                        !isPhoneValid(supplierEditForm.phone, supplierEditForm.country_code)) && (
                                            <TooltipContent side="top" className="max-w-[200px] text-xs">
                                                <p className="font-bold mb-1">Required to Save:</p>
                                                <ul className="list-disc list-inside space-y-1">
                                                    {!supplierEditForm.name.trim() && <li>Supplier Name</li>}
                                                    {!supplierEditForm.gstin.trim() && <li>GSTIN Number</li>}
                                                    {!supplierEditForm.contact_person.trim() && <li>Contact Person</li>}
                                                    {!isPhoneValid(supplierEditForm.phone, supplierEditForm.country_code) && (
                                                        <li>Valid Phone ({COUNTRY_DATA.find(c => c.code === supplierEditForm.country_code)?.digits} digits)</li>
                                                    )}
                                                </ul>
                                            </TooltipContent>
                                        )}
                                </Tooltip>
                            </TooltipProvider>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                <Dialog open={isCreateSkuOpen} onOpenChange={(open) => {
                    setIsCreateSkuOpen(open);
                    if (!open) {
                        setIsCreateSkuFull(false);
                        setSkuCreateForm(DEFAULT_SKU_CREATE_FORM);
                        setSkuEditForm(DEFAULT_SKU_EDIT_FORM);
                    }
                }}>
                    <DialogContent className={`${isCreateSkuFull ? "sm:max-w-6xl" : "sm:max-w-2xl"} max-h-[92vh] flex flex-col p-0 overflow-hidden`}>
                        <div className="p-6 pb-4 border-b shrink-0 bg-background">
                            <DialogHeader>
                                <DialogTitle>Add New SKU</DialogTitle>
                                <DialogDescription>
                                    {isCreateSkuFull ? "Advanced configuration for the new item" : "Quickly add a new item to the system"}
                                </DialogDescription>
                            </DialogHeader>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 bg-background/50 space-y-6">
                            {isCreateSkuFull ? (
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
                                                <div className="space-y-1"><Label className="text-xs text-muted-foreground">SKU Code</Label><Input value={skuCreateForm.sku_code} disabled className="bg-muted" /></div>
                                                <div className="space-y-1">
                                                    <Label className="text-xs text-muted-foreground">Item Category</Label>
                                                    <Select value={skuEditForm.item_category} onValueChange={(val) => updateSkuEditForm("item_category", val)}>
                                                        <SelectTrigger className="h-10"><SelectValue placeholder="Select Category" /></SelectTrigger>
                                                        <SelectContent>
                                                            {SKU_CATEGORIES.map((cat) => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                                <div className="space-y-1 md:col-span-2"><Label className="text-xs text-muted-foreground">Description</Label><Input value={skuEditForm.description} onChange={(e) => updateSkuEditForm("description", e.target.value)} /></div>
                                                <div className="space-y-1 md:col-span-2"><Label className="text-xs text-muted-foreground">Short Description</Label><Input value={skuEditForm.short_description} onChange={(e) => updateSkuEditForm("short_description", e.target.value)} /></div>
                                                <div className="space-y-1"><Label className="text-xs text-muted-foreground">Primary Barcode</Label><Input value={skuEditForm.primary_barcode} onChange={(e) => updateSkuEditForm("primary_barcode", e.target.value)} /></div>
                                                <div className="space-y-1"><Label className="text-xs text-muted-foreground">Alt Barcodes (comma-separated)</Label><Input value={skuEditForm.alt_barcodes} onChange={(e) => updateSkuEditForm("alt_barcodes", e.target.value)} /></div>
                                            </div>
                                        </div>
                                    </TabsContent>

                                    <TabsContent value="uom" className="mt-0">
                                        <div className="rounded-lg border bg-card p-4 space-y-4">
                                            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Units and Conversion</p>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div className="space-y-1"><Label className="text-xs text-muted-foreground">Base UOM</Label><UomSelect value={skuEditForm.base_uom} onValueChange={(v) => updateSkuEditForm("base_uom", v)} triggerClassName="h-10" /></div>
                                                <div className="space-y-1"><Label className="text-xs text-muted-foreground">Alt UOM</Label><UomSelect value={skuEditForm.alt_uom} onValueChange={(v) => updateSkuEditForm("alt_uom", v)} triggerClassName="h-10" /></div>
                                                <div className="space-y-1"><Label className="text-xs text-muted-foreground">UOM Conversion</Label><Input type="number" value={skuEditForm.uom_conversion} onChange={(e) => updateSkuEditForm("uom_conversion", e.target.value)} /></div>
                                                <div className="space-y-1"><Label className="text-xs text-muted-foreground">UOM Hierarchy (JSON)</Label><Input value={skuEditForm.uom_hierarchy} onChange={(e) => updateSkuEditForm("uom_hierarchy", e.target.value)} /></div>
                                            </div>
                                        </div>
                                    </TabsContent>

                                    <TabsContent value="dimensions" className="mt-0">
                                        <div className="rounded-lg border bg-card p-4 space-y-4">
                                            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Dimensions and Packaging</p>
                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                                <div className="space-y-1"><Label className="text-xs text-muted-foreground">Length (cm)</Label><Input type="number" value={skuEditForm.length_cm} onChange={(e) => updateSkuEditForm("length_cm", e.target.value)} /></div>
                                                <div className="space-y-1"><Label className="text-xs text-muted-foreground">Width (cm)</Label><Input type="number" value={skuEditForm.width_cm} onChange={(e) => updateSkuEditForm("width_cm", e.target.value)} /></div>
                                                <div className="space-y-1"><Label className="text-xs text-muted-foreground">Height (cm)</Label><Input type="number" value={skuEditForm.height_cm} onChange={(e) => updateSkuEditForm("height_cm", e.target.value)} /></div>
                                                <div className="space-y-1"><Label className="text-xs text-muted-foreground">Weight (kg)</Label><Input type="number" value={skuEditForm.weight_kg} onChange={(e) => updateSkuEditForm("weight_kg", e.target.value)} /></div>
                                                <div className="space-y-1"><Label className="text-xs text-muted-foreground">Volume (cc)</Label><Input type="number" value={skuEditForm.volume_cc} onChange={(e) => updateSkuEditForm("volume_cc", e.target.value)} /></div>
                                                <div className="space-y-1"><Label className="text-xs text-muted-foreground">Pallet Quantity</Label><Input type="number" value={skuEditForm.pallet_quantity} onChange={(e) => updateSkuEditForm("pallet_quantity", e.target.value)} /></div>
                                                <div className="space-y-1"><Label className="text-xs text-muted-foreground">Case Quantity</Label><Input type="number" value={skuEditForm.case_quantity} onChange={(e) => updateSkuEditForm("case_quantity", e.target.value)} /></div>
                                                <div className="space-y-1"><Label className="text-xs text-muted-foreground">Inner Quantity</Label><Input type="number" value={skuEditForm.inner_quantity} onChange={(e) => updateSkuEditForm("inner_quantity", e.target.value)} /></div>
                                            </div>
                                        </div>
                                    </TabsContent>

                                    <TabsContent value="storage" className="mt-0">
                                        <div className="rounded-lg border bg-card p-4 space-y-4">
                                            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Storage and Picking</p>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div className="space-y-1"><Label className="text-xs text-muted-foreground">Storage Condition</Label><Input value={skuEditForm.storage_condition} onChange={(e) => updateSkuEditForm("storage_condition", e.target.value)} /></div>
                                                <div className="space-y-1"><Label className="text-xs text-muted-foreground">Shelf Life Days</Label><Input type="number" value={skuEditForm.shelf_life_days} onChange={(e) => updateSkuEditForm("shelf_life_days", e.target.value)} /></div>
                                                <div className="space-y-1"><Label className="text-xs text-muted-foreground">Picking Strategy</Label><Input value={skuEditForm.picking_strategy} onChange={(e) => updateSkuEditForm("picking_strategy", e.target.value)} /></div>
                                                <div className="space-y-1"><Label className="text-xs text-muted-foreground">Pick Face Capacity</Label><Input type="number" value={skuEditForm.pick_face_capacity} onChange={(e) => updateSkuEditForm("pick_face_capacity", e.target.value)} /></div>
                                                <div className="space-y-1"><Label className="text-xs text-muted-foreground">Replenishment Point</Label><Input type="number" value={skuEditForm.pick_face_replenishment_point} onChange={(e) => updateSkuEditForm("pick_face_replenishment_point", e.target.value)} /></div>
                                                <div className="space-y-1"><Label className="text-xs text-muted-foreground">Max Stack Height</Label><Input type="number" value={skuEditForm.max_stack_height} onChange={(e) => updateSkuEditForm("max_stack_height", e.target.value)} /></div>
                                                <div className="space-y-1"><Label className="text-xs text-muted-foreground">Max Qty Per Bin</Label><Input type="number" value={skuEditForm.max_qty_per_bin} onChange={(e) => updateSkuEditForm("max_qty_per_bin", e.target.value)} /></div>
                                                <div className="space-y-1"><Label className="text-xs text-muted-foreground">Preferred Zones (comma-separated)</Label><Input value={skuEditForm.preferred_zones} onChange={(e) => updateSkuEditForm("preferred_zones", e.target.value)} /></div>
                                                <div className="space-y-1"><Label className="text-xs text-muted-foreground">Preferred Bin Types (comma-separated)</Label><Input value={skuEditForm.preferred_bin_types} onChange={(e) => updateSkuEditForm("preferred_bin_types", e.target.value)} /></div>
                                            </div>
                                        </div>
                                    </TabsContent>

                                    <TabsContent value="compliance" className="mt-0">
                                        <div className="rounded-lg border bg-card p-4 space-y-4">
                                            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Compliance and Tax</p>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div className="space-y-1"><Label className="text-xs text-muted-foreground">Hazard Class</Label><Input value={skuEditForm.hazard_class} onChange={(e) => updateSkuEditForm("hazard_class", e.target.value)} /></div>
                                                <div className="space-y-1"><Label className="text-xs text-muted-foreground">Hazmat Code</Label><Input value={skuEditForm.hazmat_code} onChange={(e) => updateSkuEditForm("hazmat_code", e.target.value)} /></div>
                                                <div className="space-y-1"><Label className="text-xs text-muted-foreground">Inspection Rule</Label><Input value={skuEditForm.inspection_rule} onChange={(e) => updateSkuEditForm("inspection_rule", e.target.value)} /></div>
                                                <div className="space-y-1"><Label className="text-xs text-muted-foreground">Sample Percentage</Label><Input type="number" value={skuEditForm.sample_percentage} onChange={(e) => updateSkuEditForm("sample_percentage", e.target.value)} /></div>
                                                <div className="space-y-1"><Label className="text-xs text-muted-foreground">HSN Code</Label><Input value={skuEditForm.hsn_code} onChange={(e) => updateSkuEditForm("hsn_code", e.target.value)} /></div>
                                                <div className="space-y-1"><Label className="text-xs text-muted-foreground">Tax Rate</Label><Input type="number" value={skuEditForm.tax_rate} onChange={(e) => updateSkuEditForm("tax_rate", e.target.value)} /></div>
                                            </div>
                                        </div>
                                    </TabsContent>

                                    <TabsContent value="rules" className="mt-0">
                                        <div className="rounded-lg border bg-card p-4 space-y-4">
                                            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Rules and Status</p>
                                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={skuEditForm.fefo_enabled} onChange={(e) => updateSkuEditForm("fefo_enabled", e.target.checked)} /> FEFO Enabled</label>
                                                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={skuEditForm.fifo_enabled} onChange={(e) => updateSkuEditForm("fifo_enabled", e.target.checked)} /> FIFO Enabled</label>
                                                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={skuEditForm.batch_required} onChange={(e) => updateSkuEditForm("batch_required", e.target.checked)} /> Batch Required</label>
                                                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={skuEditForm.serial_required} onChange={(e) => updateSkuEditForm("serial_required", e.target.checked)} /> Serial Required</label>
                                                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={skuEditForm.pick_face_eligible} onChange={(e) => updateSkuEditForm("pick_face_eligible", e.target.checked)} /> Pick Face Eligible</label>
                                                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={skuEditForm.is_hazardous} onChange={(e) => updateSkuEditForm("is_hazardous", e.target.checked)} /> Is Hazardous</label>
                                                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={skuEditForm.requires_inspection} onChange={(e) => updateSkuEditForm("requires_inspection", e.target.checked)} /> Requires Inspection</label>
                                                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={skuEditForm.quarantine_on_failure} onChange={(e) => updateSkuEditForm("quarantine_on_failure", e.target.checked)} /> Quarantine On Failure</label>
                                                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={skuEditForm.active} onChange={(e) => updateSkuEditForm("active", e.target.checked)} /> Active</label>
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
                                        <div className="space-y-1">
                                            <Label className="text-xs text-muted-foreground">SKU Code</Label>
                                            <Input
                                                value={skuCreateForm.sku_code}
                                                onChange={(e) => updateSkuCreateForm("sku_code", e.target.value)}
                                                placeholder="SKU code"
                                                required
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-xs text-muted-foreground">Description</Label>
                                            <Input
                                                value={skuCreateForm.description}
                                                onChange={(e) => updateSkuCreateForm("description", e.target.value)}
                                                placeholder="Description"
                                                required
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-xs text-muted-foreground">Short Description</Label>
                                            <Input
                                                value={skuCreateForm.short_description}
                                                onChange={(e) => updateSkuCreateForm("short_description", e.target.value)}
                                                placeholder="Short description"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-xs text-muted-foreground">Primary Barcode</Label>
                                            <Input
                                                value={skuCreateForm.primary_barcode}
                                                onChange={(e) => updateSkuCreateForm("primary_barcode", e.target.value)}
                                                placeholder="Primary barcode"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-xs text-muted-foreground">Alt Barcodes (comma-separated)</Label>
                                            <Input
                                                value={skuCreateForm.alt_barcodes}
                                                onChange={(e) => updateSkuCreateForm("alt_barcodes", e.target.value)}
                                                placeholder="Alt barcodes"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-xs text-muted-foreground">Category</Label>
                                            <Select
                                                value={skuCreateForm.item_category}
                                                onValueChange={(value) => updateSkuCreateForm("item_category", value)}
                                            >
                                                <SelectTrigger className="h-10">
                                                    <SelectValue placeholder="Select category" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {SKU_CATEGORIES.map((cat) => (
                                                        <SelectItem key={cat} value={cat}>
                                                            {cat}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-xs text-muted-foreground">Base UOM</Label>
                                            <UomSelect
                                                value={skuCreateForm.base_uom}
                                                onValueChange={(value) => updateSkuCreateForm("base_uom", value)}
                                                triggerClassName="h-10"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-xs text-muted-foreground">Alt UOM</Label>
                                            <UomSelect
                                                value={skuCreateForm.alt_uom}
                                                onValueChange={(value) => updateSkuCreateForm("alt_uom", value)}
                                                triggerClassName="h-10"
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        <DialogFooter className="p-6 pt-2 flex items-center justify-between sm:justify-between w-full">
                            <div>
                                {!isCreateSkuFull && (
                                    <Button
                                        type="button"
                                        variant="default"
                                        onClick={() => {
                                            setSkuEditForm(prev => ({
                                                ...prev,
                                                description: skuCreateForm.description,
                                                short_description: skuCreateForm.short_description,
                                                primary_barcode: skuCreateForm.primary_barcode,
                                                alt_barcodes: skuCreateForm.alt_barcodes,
                                                base_uom: skuCreateForm.base_uom,
                                                item_category: skuCreateForm.item_category,
                                            }));
                                            setIsCreateSkuFull(true);
                                        }}
                                        className="flex items-center gap-2"
                                    >
                                        <LayoutList className="h-4 w-4" />
                                        Edit full form
                                    </Button>
                                )}
                            </div>
                            <div className="flex gap-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => setIsCreateSkuOpen(false)}
                                    disabled={isCreatingSku}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    type="button"
                                    ref={createSkuButtonRef}
                                    onClick={handleCreateSku}
                                    disabled={isCreatingSku}
                                >
                                    {isCreatingSku ? "Creating..." : "Create SKU"}
                                </Button>
                            </div>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* 2️⃣ Shipments Section */}
                <div className="space-y-6">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xl font-bold flex items-center gap-2">
                            <LayoutList className="w-5 h-5" />
                            PO
                        </h2>
                        <Button type="button" onClick={addShipment} variant="secondary" className="gap-2">
                            <Plus className="w-4 h-4" /> Add PO
                        </Button>
                    </div>

                    <div className="max-h-[700px] overflow-y-auto pr-1 space-y-4">
                        {form.shipments.map((shipment, sIdx) => (
                            <Card key={`shipment-${sIdx}`} className="border-border shadow-md border-t-4 border-t-primary/60">
                                <CardHeader className="pb-4 flex flex-row items-center justify-between bg-muted/20">
                                    <div>
                                        <CardTitle className="text-base text-primary flex items-center gap-2">
                                            PO {sIdx + 1}
                                        </CardTitle>
                                    </div>
                                    {form.shipments.length > 1 && (
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={() => removeShipment(sIdx)}
                                            className="text-destructive hover:bg-muted/30 hover:text-destructive"
                                        >
                                            <Trash2 className="w-4 h-4 mr-2" /> Remove PO
                                        </Button>
                                    )}
                                </CardHeader>
                                <CardContent className="pt-6 space-y-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 bg-muted/30 rounded-lg border border-border/50">
                                        <div className="space-y-4">
                                            <div className="flex items-center justify-between">
                                                <Label className="text-sm font-semibold">Purchase Order Numbers <span className="text-destructive">*</span></Label>
                                            </div>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                                                {shipment.po_numbers.map((po, poIdx) => (
                                                    <div key={`po-${sIdx}-${poIdx}`} className="relative group">
                                                        <Input
                                                            placeholder="e.g. PO-1001"
                                                            value={po}
                                                            onChange={(e) => updatePoNumber(sIdx, poIdx, e.target.value)}
                                                            required
                                                            className="h-9 pr-8"
                                                        />
                                                        {shipment.po_numbers.length > 1 && (
                                                            <button
                                                                type="button"
                                                                onClick={() => removePoNumber(sIdx, poIdx)}
                                                                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-destructive opacity-100 group-hover:opacity-100 transition-opacity"
                                                            >
                                                                <Trash2 className="w-3.5 h-3.5" />
                                                            </button>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Supplier <span className="text-destructive">*</span></Label>
                                            <div className="relative">
                                                <Input
                                                    placeholder="Type supplier name..."
                                                    role="combobox"
                                                    aria-expanded={isSupplierDropdownOpen && activeSupplierShipmentIndex === sIdx}
                                                    aria-haspopup="listbox"
                                                    value={activeSupplierShipmentIndex === sIdx ? supplierInput : (shipment.supplier_name || "")}
                                                    onFocus={() => {
                                                        setActiveSupplierShipmentIndex(sIdx);
                                                        setSupplierInput(shipment.supplier_name || "");
                                                        setSupplierSearch(shipment.supplier_name || "");
                                                        setIsSupplierDropdownOpen(true);
                                                        setActiveSupplierIndex(allSuppliers.length > 0 ? 0 : -1);
                                                    }}
                                                    onBlur={() => {
                                                        setTimeout(() => {
                                                            setIsSupplierDropdownOpen(false);
                                                            setActiveSupplierShipmentIndex(null);
                                                            setActiveSupplierIndex(-1);
                                                        }, 150);
                                                    }}
                                                    onChange={(e) => {
                                                        const value = e.target.value;
                                                        setActiveSupplierShipmentIndex(sIdx);
                                                        setSupplierInput(value);
                                                        setSupplierSearch(value);
                                                        setIsSupplierDropdownOpen(true);
                                                        if (!value.trim()) {
                                                            updateShipment(sIdx, 'supplier_code', '');
                                                        }
                                                    }}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') {
                                                            if (!isSupplierDropdownOpen || activeSupplierShipmentIndex !== sIdx) {
                                                                setIsSupplierDropdownOpen(true);
                                                                setActiveSupplierShipmentIndex(sIdx);
                                                                e.preventDefault();
                                                                return;
                                                            }

                                                            if (activeSupplierIndex >= 0 && activeSupplierIndex < allSuppliers.length) {
                                                                e.preventDefault();
                                                                selectSupplier(allSuppliers[activeSupplierIndex], sIdx);
                                                                // Auto-advance focus to the next field (Notes) after selection
                                                                window.setTimeout(() => {
                                                                    const nextField = document.getElementById(`notes-${sIdx}`);
                                                                    if (nextField) {
                                                                        nextField.focus();
                                                                        if (nextField instanceof HTMLInputElement) nextField.select();
                                                                    }
                                                                }, 150);
                                                            } else if (supplierInput.trim()) {
                                                                // If no selection and there is input, open the create dialog
                                                                e.preventDefault();
                                                                setIsSupplierDropdownOpen(false); // Close search dropdown when opening dialog
                                                                openCreateSupplierDialog();
                                                            }
                                                            return;
                                                        }

                                                        if (!isSupplierDropdownOpen && e.key === 'ArrowDown') {
                                                            setIsSupplierDropdownOpen(true);
                                                            setActiveSupplierShipmentIndex(sIdx);
                                                            e.preventDefault();
                                                            return;
                                                        }

                                                        if (!isSupplierDropdownOpen) return;

                                                        if (e.key === 'ArrowDown') {
                                                            e.preventDefault();
                                                            if (allSuppliers.length === 0) return;
                                                            setActiveSupplierIndex((prev) => (prev + 1) % allSuppliers.length);
                                                        }

                                                        if (e.key === 'ArrowUp') {
                                                            e.preventDefault();
                                                            if (allSuppliers.length === 0) return;
                                                            setActiveSupplierIndex((prev) => (prev <= 0 ? allSuppliers.length - 1 : prev - 1));
                                                        }

                                                        if (e.key === 'Escape') {
                                                            e.preventDefault();
                                                            setIsSupplierDropdownOpen(false);
                                                            setActiveSupplierIndex(-1);
                                                        }
                                                    }}
                                                    required
                                                    className="h-9 pr-10"
                                                />
                                                {shipment.supplier_code && (
                                                    <button
                                                        type="button"
                                                        aria-label="Open Supplier"
                                                        className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 rounded border border-border text-muted-foreground hover:text-foreground hover:bg-muted/30 flex items-center justify-center"
                                                        onMouseDown={(e) => {
                                                            e.preventDefault();
                                                            e.stopPropagation();
                                                        }}
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            e.stopPropagation();
                                                            void openEditSupplierDialog(sIdx);
                                                        }}
                                                    >
                                                        <ArrowUpRight className="h-3.5 w-3.5" />
                                                    </button>
                                                )}

                                                {isSupplierDropdownOpen && activeSupplierShipmentIndex === sIdx && supplierInput.trim() && (
                                                    <div className="absolute z-30 mt-1 w-full rounded-md border border-border bg-popover shadow-md max-h-56 overflow-y-auto">
                                                        {allSuppliers.length === 0 ? (
                                                            <div className="px-3 py-3 space-y-3 text-sm text-muted-foreground">
                                                                <p>No supplier found.</p>
                                                                <Button
                                                                    type="button"
                                                                    variant="outline"
                                                                    size="sm"
                                                                    className="w-full"
                                                                    onMouseDown={(evt) => evt.preventDefault()}
                                                                    onClick={openCreateSupplierDialog}
                                                                >
                                                                    Create New Supplier
                                                                </Button>
                                                            </div>
                                                        ) : (
                                                            allSuppliers.map((s, supplierIdx) => (
                                                                <button
                                                                    key={`${s.code}-${s.name}`}
                                                                    type="button"
                                                                    className={`w-full px-3 py-2 text-left transition-colors ${activeSupplierIndex === supplierIdx ? 'bg-primary/10 text-foreground' : ''}`}
                                                                    onMouseDown={(evt) => evt.preventDefault()}
                                                                    onMouseEnter={() => setActiveSupplierIndex(supplierIdx)}
                                                                    onClick={() => selectSupplier(s, sIdx)}
                                                                >
                                                                    <div className="flex flex-col">
                                                                        <span className="text-sm font-medium">{s.name}</span>
                                                                        <span className="text-xs text-muted-foreground">{s.code}</span>
                                                                    </div>
                                                                </button>
                                                            ))
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                            {shipment.supplier_code && (
                                                <div className="flex items-center gap-3">
                                                    <p className="text-xs text-muted-foreground">
                                                        Supplier Code: <span className="font-medium text-foreground font-mono">{shipment.supplier_code}</span>
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor={`notes-${sIdx}`}>Notes</Label>
                                            <Input
                                                id={`notes-${sIdx}`}
                                                placeholder="Any special notes for this shipment..."
                                                value={shipment.notes}
                                                onChange={(e) => updateShipment(sIdx, 'notes', e.target.value)}
                                                className="h-9"
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between">
                                            <h3 className="font-semibold text-sm">Items</h3>
                                            <Button type="button" onClick={() => addItem(sIdx)} variant="outline" size="sm" className="h-8">
                                                <Plus className="w-3 h-3 mr-1" /> Add Item
                                            </Button>
                                        </div>
                                        <div className="border rounded-md overflow-x-auto min-w-full [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                                            <div className="min-w-[1050px]">
                                                <div className="grid grid-cols-[160px_minmax(130px,1fr)_80px_70px_100px_100px_100px_100px_130px_40px] gap-3 px-3 py-3 bg-muted/50 font-medium text-sm text-muted-foreground border-b text-left items-center">
                                                    <div>SKU *</div>
                                                    <div>Desc</div>
                                                    <div>Qty *</div>
                                                    <div>Unit</div>
                                                    <div>Price *</div>
                                                    <div>Total</div>
                                                    <div>Lot</div>
                                                    <div>HSN</div>
                                                    <div>Expiry Date</div>
                                                    <div></div>
                                                </div>
                                                <div className="divide-y">
                                                    {shipment.items.map((item, iIdx) => (
                                                        <div key={`item-${sIdx}-${iIdx}`} className="grid grid-cols-[160px_minmax(130px,1fr)_80px_70px_100px_100px_100px_100px_130px_40px] gap-3 px-3 py-2 items-center hover:bg-muted/30">
                                                            <div className="min-w-0">
                                                                <Popover
                                                                    open={
                                                                        pendingItemRow?.sIdx === sIdx &&
                                                                        pendingItemRow?.iIdx === iIdx &&
                                                                        (itemSearch.trim().length > 0 || !item.sku)
                                                                    }
                                                                >
                                                                    <PopoverAnchor asChild>
                                                                        <div className="relative">
                                                                            <Input
                                                                                id={`sku-${sIdx}-${iIdx}`}
                                                                                role="combobox"
                                                                                aria-expanded={pendingItemRow?.sIdx === sIdx && pendingItemRow?.iIdx === iIdx && (itemSearch.trim().length > 0 || !item.sku)}
                                                                                aria-haspopup="listbox"
                                                                                placeholder="Search SKU..."
                                                                                value={item.sku || ""}
                                                                                onFocus={() => {
                                                                                    setPendingItemRow({ sIdx, iIdx });
                                                                                    setActiveSkuIndex(allItems.length > 0 ? 0 : -1);
                                                                                }}
                                                                                onBlur={(e) => {
                                                                                    const currentSku = e.target.value;
                                                                                    window.setTimeout(async () => {
                                                                                        const isSameRow = pendingItemRow?.sIdx === sIdx && pendingItemRow?.iIdx === iIdx;
                                                                                        if (isSameRow) {
                                                                                            setPendingItemRow(null);
                                                                                            setActiveSkuIndex(-1);
                                                                                            setItemSearch("");
                                                                                        }

                                                                                        if (!currentSku) return;

                                                                                        try {
                                                                                            const data = await skuService.search(currentSku);
                                                                                            const items = (Array.isArray(data) ? data : []).filter((s: any) => s.active !== false);
                                                                                            const exactMatch = items.find((s: any) =>
                                                                                                String(s.skuCode || s.sku_code || s.code).toLowerCase() === currentSku.toLowerCase()
                                                                                            );

                                                                                            setForm(prev => {
                                                                                                const currentFormItem = prev.shipments[sIdx]?.items[iIdx];
                                                                                                if (!currentFormItem || currentFormItem.sku !== currentSku) {
                                                                                                    return prev;
                                                                                                }

                                                                                                const newShipments = [...prev.shipments];
                                                                                                const newItem = { ...newShipments[sIdx].items[iIdx] };

                                                                                                if (!exactMatch) {
                                                                                                    newItem.sku = '';
                                                                                                } else if (!newItem.sku_id) {
                                                                                                    newItem.sku_id = exactMatch.id || exactMatch.item_id || "";
                                                                                                    newItem.sku = exactMatch.skuCode || exactMatch.sku_code || exactMatch.code;
                                                                                                    newItem.description = exactMatch.productName || exactMatch.name || exactMatch.description || "";
                                                                                                    newItem.unit = exactMatch.baseUom || exactMatch.base_uom || exactMatch.uom || 'PCS';
                                                                                                    newItem.hsn_code = exactMatch.hsnCode || exactMatch.hsn_code || '';
                                                                                                }

                                                                                                newShipments[sIdx].items[iIdx] = newItem;
                                                                                                return { ...prev, shipments: newShipments };
                                                                                            });
                                                                                        } catch (err) {
                                                                                            setForm(prev => {
                                                                                                const currentFormItem = prev.shipments[sIdx]?.items[iIdx];
                                                                                                if (!currentFormItem || currentFormItem.sku !== currentSku) return prev;

                                                                                                const newShipments = [...prev.shipments];
                                                                                                newShipments[sIdx].items[iIdx] = { ...newShipments[sIdx].items[iIdx], sku: '' };
                                                                                                return { ...prev, shipments: newShipments };
                                                                                            });
                                                                                        }
                                                                                    }, 120);
                                                                                }}
                                                                                onChange={(e) => {
                                                                                    setItemSearch(e.target.value);
                                                                                    setPendingItemRow({ sIdx, iIdx });
                                                                                    setActiveSkuIndex(0);
                                                                                    updateItem(sIdx, iIdx, 'sku', e.target.value);
                                                                                }}
                                                                                onKeyDown={(e) => {
                                                                                    const isDropdownOpen = pendingItemRow?.sIdx === sIdx && pendingItemRow?.iIdx === iIdx && (itemSearch.trim().length > 0 || !item.sku);

                                                                                    if (!isDropdownOpen && e.key === 'ArrowDown') {
                                                                                        setPendingItemRow({ sIdx, iIdx });
                                                                                        setItemSearch(item.sku || "");
                                                                                        e.preventDefault();
                                                                                        return;
                                                                                    }

                                                                                    if (e.key === 'Enter') {
                                                                                        if (!isDropdownOpen) {
                                                                                            setPendingItemRow({ sIdx, iIdx });
                                                                                            setItemSearch(item.sku || "");
                                                                                            e.preventDefault();
                                                                                            return;
                                                                                        }

                                                                                        if (activeSkuIndex >= 0 && activeSkuIndex < allItems.length) {
                                                                                            e.preventDefault();
                                                                                            selectSku(sIdx, iIdx, allItems[activeSkuIndex]);
                                                                                            // Auto-advance focus to Quantity field after selection
                                                                                            window.setTimeout(() => {
                                                                                                const nextField = document.getElementById(`qty-${sIdx}-${iIdx}`);
                                                                                                if (nextField) {
                                                                                                    nextField.focus();
                                                                                                    if (nextField instanceof HTMLInputElement) nextField.select();
                                                                                                }
                                                                                            }, 150);
                                                                                        } else if ((itemSearch || item.sku || "").trim()) {
                                                                                            e.preventDefault();
                                                                                            openCreateSkuDialog(sIdx, iIdx, (itemSearch || item.sku || "").trim());
                                                                                        }
                                                                                        return;
                                                                                    }

                                                                                    if (e.key === 'ArrowDown') {
                                                                                        e.preventDefault();
                                                                                        if (allItems.length === 0) return;
                                                                                        setActiveSkuIndex((prev) => (prev + 1) % allItems.length);
                                                                                    }

                                                                                    if (e.key === 'ArrowUp') {
                                                                                        e.preventDefault();
                                                                                        if (allItems.length === 0) return;
                                                                                        setActiveSkuIndex((prev) => (prev <= 0 ? allItems.length - 1 : prev - 1));
                                                                                    }

                                                                                    if (e.key === 'Escape') {
                                                                                        e.preventDefault();
                                                                                        setPendingItemRow(null);
                                                                                        setActiveSkuIndex(-1);
                                                                                    }
                                                                                }}
                                                                                className="h-9 pr-16 text-xs"
                                                                            />
                                                                            {isSearchingItems && (
                                                                                <div className="absolute right-8 top-2">
                                                                                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                                                                                </div>
                                                                            )}
                                                                            {item.sku && (
                                                                                <button
                                                                                    type="button"
                                                                                    aria-label="Open SKU"
                                                                                    className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 rounded border border-border text-muted-foreground hover:text-foreground hover:bg-muted/30 flex items-center justify-center"
                                                                                    onMouseDown={(e) => {
                                                                                        e.preventDefault();
                                                                                        e.stopPropagation();
                                                                                    }}
                                                                                    onClick={(e) => {
                                                                                        e.preventDefault();
                                                                                        e.stopPropagation();
                                                                                        void openSkuEditCard(sIdx, iIdx, {
                                                                                            id: item.sku_id,
                                                                                            skuCode: item.sku,
                                                                                            description: item.description,
                                                                                            baseUom: item.unit,
                                                                                            hsnCode: item.hsn_code,
                                                                                        });
                                                                                    }}
                                                                                >
                                                                                    <ArrowUpRight className="h-3.5 w-3.5" />
                                                                                </button>
                                                                            )}
                                                                        </div>
                                                                    </PopoverAnchor>
                                                                    <PopoverContent
                                                                        className="p-0 w-[400px]"
                                                                        align="start"
                                                                        onOpenAutoFocus={(event) => event.preventDefault()}
                                                                    >
                                                                        <Command shouldFilter={false}>
                                                                            <CommandList>
                                                                                {isSearchingItems && (
                                                                                    <div className="p-4 text-xs text-muted-foreground flex items-center justify-center">
                                                                                        <Loader2 className="mr-2 h-3 w-3 animate-spin" /> Searching...
                                                                                    </div>
                                                                                )}
                                                                                {!isSearchingItems && allItems.length === 0 && (
                                                                                    <CommandEmpty className="p-4 flex flex-col items-center justify-center text-center space-y-3">
                                                                                        <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center">
                                                                                            <Package className="h-6 w-6 text-muted-foreground/40" />
                                                                                        </div>
                                                                                        <div className="space-y-1">
                                                                                            <p className="text-sm font-medium">No items found</p>
                                                                                            <p className="text-xs text-muted-foreground">The SKU you searched for does not exist in the master record.</p>
                                                                                        </div>
                                                                                        <Button
                                                                                            type="button"
                                                                                            variant="default"
                                                                                            size="sm"
                                                                                            className="w-full mt-2"
                                                                                            onMouseDown={(evt) => evt.preventDefault()}
                                                                                            onClick={() => openCreateSkuDialog(sIdx, iIdx, itemSearch.trim())}
                                                                                        >
                                                                                            <Plus className="mr-2 h-4 w-4" />
                                                                                            Create New SKU
                                                                                        </Button>
                                                                                    </CommandEmpty>
                                                                                )}
                                                                                {allItems.length > 0 && (
                                                                                    <CommandGroup>
                                                                                        {allItems.map((sku, skuIdx) => (
                                                                                            <CommandItem
                                                                                                key={sku.skuCode}
                                                                                                onMouseDown={(e) => e.preventDefault()}
                                                                                                onMouseEnter={() => setActiveSkuIndex(skuIdx)}
                                                                                                onSelect={() => selectSku(sIdx, iIdx, sku)}
                                                                                                className={`group border border-transparent data-[selected=true]:bg-primary/10 data-[selected=true]:text-foreground data-[selected=true]:border-primary/50 [&[data-selected=true]_.sku-code]:text-foreground [&[data-selected=true]_.sku-desc]:text-foreground/80 ${activeSkuIndex === skuIdx ? 'bg-primary/10 text-foreground border-primary/50' : ''}`}
                                                                                            >
                                                                                                <div className="flex flex-col w-full">
                                                                                                    <div className="flex items-center justify-between w-full">
                                                                                                        <span className="sku-code font-medium text-foreground">{sku.skuCode}</span>
                                                                                                        <Badge className={`text-[9px] font-black uppercase border-none px-2 py-0.5 flex items-center gap-1 ${sku.active ? "bg-green-500 text-white" : "bg-destructive text-white"}`}>
                                                                                                            <span className={`h-1 w-1 rounded-full bg-white`} />
                                                                                                            {sku.active ? "Active" : "Inactive"}
                                                                                                        </Badge>
                                                                                                    </div>
                                                                                                    <span className="sku-desc text-xs text-muted-foreground group-hover:text-foreground/80">{sku.productName || sku.description}</span>
                                                                                                </div>
                                                                                            </CommandItem>
                                                                                        ))}
                                                                                    </CommandGroup>
                                                                                )}
                                                                            </CommandList>
                                                                        </Command>
                                                                    </PopoverContent>
                                                                </Popover>
                                                            </div>
                                                            <div className="min-w-0">
                                                                <Input
                                                                    id={`desc-${sIdx}-${iIdx}`}
                                                                    value={item.description || ""}
                                                                    onChange={(e) => updateItem(sIdx, iIdx, 'description', e.target.value)}
                                                                    className="h-9 text-xs"
                                                                />
                                                            </div>
                                                            <div className="min-w-0">
                                                                <Input
                                                                    id={`qty-${sIdx}-${iIdx}`}
                                                                    type="number"
                                                                    value={item.quantity || 0}
                                                                    onChange={(e) => updateItem(sIdx, iIdx, 'quantity', e.target.value)}
                                                                    className="h-9 text-xs"
                                                                    required
                                                                />
                                                            </div>
                                                            <div className="min-w-0">
                                                                <UomSelect
                                                                    value={item.unit || ""}
                                                                    onValueChange={(value) => updateItem(sIdx, iIdx, 'unit', value)}
                                                                    triggerClassName="h-9 text-xs"
                                                                    contentClassName="max-h-72"
                                                                    disabled
                                                                />
                                                            </div>
                                                            <div className="min-w-0">
                                                                <Input
                                                                    type="number"
                                                                    value={item.unit_price || 0}
                                                                    onChange={(e) => updateItem(sIdx, iIdx, 'unit_price', e.target.value)}
                                                                    className="h-9 text-xs"
                                                                    required
                                                                />
                                                            </div>
                                                            <div className="min-w-0">
                                                                <Input
                                                                    type="number"
                                                                    value={item.total_price || 0}
                                                                    disabled
                                                                    className="h-9 text-xs bg-muted/50 font-medium"
                                                                />
                                                            </div>
                                                            <div className="min-w-0">
                                                                <Input
                                                                    value={item.lot || ""}
                                                                    placeholder="Lot #"
                                                                    onChange={(e) => updateItem(sIdx, iIdx, 'lot', e.target.value)}
                                                                    className="h-9 text-xs"
                                                                />
                                                            </div>
                                                            <div className="min-w-0">
                                                                <Input
                                                                    value={item.hsn_code || ""}
                                                                    placeholder="HSN"
                                                                    onChange={(e) => updateItem(sIdx, iIdx, 'hsn_code', e.target.value)}
                                                                    className="h-9 text-xs"
                                                                />
                                                            </div>
                                                            <div className="flex justify-center min-w-0">
                                                                {shipment.items.length > 1 && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => removeItem(sIdx, iIdx)}
                                                                        className="text-muted-foreground hover:text-destructive flex items-center justify-center p-1"
                                                                    >
                                                                        <Trash2 className="h-4 w-4" />
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>

                                        {selectedSkuRow?.sIdx === sIdx && (
                                            <Dialog
                                                open={isSkuCardOpen}
                                                onOpenChange={(open) => {
                                                    if (!open) {
                                                        resetSkuEditCard();
                                                    }
                                                }}
                                            >
                                                <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
                                                    <DialogHeader>
                                                        <DialogTitle className="text-base flex items-center justify-between">
                                                            <div className="flex items-center gap-2">
                                                                <LayoutList className="h-4 w-4 text-primary" />
                                                                <span>Edit SKU Card {selectedSkuCode ? `- ${selectedSkuCode}` : ""}</span>
                                                                <Badge className={`ml-2 text-[9px] font-black uppercase border-none px-2 py-0.5 flex items-center gap-1 ${skuEditForm.active ? "bg-green-500 text-white" : "bg-destructive text-white"}`}>
                                                                    <span className={`h-1 w-1 rounded-full bg-white`} />
                                                                    {skuEditForm.active ? "Active" : "Inactive"}
                                                                </Badge>
                                                            </div>
                                                            {!selectedSkuId && (
                                                                <span className="text-xs text-muted-foreground font-normal">Save disabled for unsynced SKU</span>
                                                            )}
                                                        </DialogTitle>
                                                        <DialogDescription>Manage the item master record details.</DialogDescription>
                                                    </DialogHeader>
                                                    <div className="space-y-4">
                                                        {isSkuCardLoading ? (
                                                            <div className="text-sm text-muted-foreground flex items-center gap-2">
                                                                <Loader2 className="h-4 w-4 animate-spin" /> Loading SKU details...
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
                                                                                <div className="space-y-1">
                                                                                    <Label className="text-xs text-muted-foreground">SKU Code</Label>
                                                                                    <Input value={selectedSkuCode} disabled className="bg-muted" />
                                                                                </div>
                                                                                <div className="space-y-1">
                                                                                    <Label className="text-xs text-muted-foreground">Category</Label>
                                                                                    <Select value={skuEditForm.item_category} onValueChange={(v) => updateSkuEditForm("item_category", v)}>
                                                                                        <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                                                                                        <SelectContent>
                                                                                            {SKU_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                                                                                        </SelectContent>
                                                                                    </Select>
                                                                                </div>
                                                                                <div className="space-y-1 md:col-span-2">
                                                                                    <Label className="text-xs text-muted-foreground">Description</Label>
                                                                                    <Input value={skuEditForm.description} onChange={(e) => updateSkuEditForm("description", e.target.value)} />
                                                                                </div>
                                                                                <div className="space-y-1 md:col-span-2">
                                                                                    <Label className="text-xs text-muted-foreground">Short Description</Label>
                                                                                    <Input value={skuEditForm.short_description} onChange={(e) => updateSkuEditForm("short_description", e.target.value)} />
                                                                                </div>
                                                                                <div className="space-y-1">
                                                                                    <Label className="text-xs text-muted-foreground">Primary Barcode</Label>
                                                                                    <Input value={skuEditForm.primary_barcode} onChange={(e) => updateSkuEditForm("primary_barcode", e.target.value)} />
                                                                                </div>
                                                                                <div className="space-y-1">
                                                                                    <Label className="text-xs text-muted-foreground">Alt Barcodes (comma-separated)</Label>
                                                                                    <Input value={skuEditForm.alt_barcodes} onChange={(e) => updateSkuEditForm("alt_barcodes", e.target.value)} />
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    </TabsContent>

                                                                    <TabsContent value="uom" className="mt-0">
                                                                        <div className="rounded-lg border bg-card p-4 space-y-4">
                                                                            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Units and Conversion</p>
                                                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                                                <div className="space-y-1"><Label className="text-xs text-muted-foreground">Base UOM</Label><UomSelect value={skuEditForm.base_uom} onValueChange={(v) => updateSkuEditForm("base_uom", v)} triggerClassName="h-9" disabled /></div>
                                                                                <div className="space-y-1"><Label className="text-xs text-muted-foreground">Alt UOM</Label><UomSelect value={skuEditForm.alt_uom} onValueChange={(v) => updateSkuEditForm("alt_uom", v)} triggerClassName="h-9" /></div>
                                                                                <div className="space-y-1"><Label className="text-xs text-muted-foreground">Conversion Factor</Label><Input type="number" value={skuEditForm.uom_conversion} onChange={(e) => updateSkuEditForm("uom_conversion", e.target.value)} /></div>
                                                                                <div className="space-y-1"><Label className="text-xs text-muted-foreground">UOM Hierarchy (JSON)</Label><Input value={skuEditForm.uom_hierarchy} onChange={(e) => updateSkuEditForm("uom_hierarchy", e.target.value)} /></div>
                                                                            </div>
                                                                        </div>
                                                                    </TabsContent>

                                                                    <TabsContent value="dimensions" className="mt-0">
                                                                        <div className="rounded-lg border bg-card p-4 space-y-4">
                                                                            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Dimensions and Packaging</p>
                                                                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                                                                <div className="space-y-1"><Label className="text-xs text-muted-foreground">Length (cm)</Label><Input type="number" value={skuEditForm.length_cm} onChange={(e) => updateSkuEditForm("length_cm", e.target.value)} /></div>
                                                                                <div className="space-y-1"><Label className="text-xs text-muted-foreground">Width (cm)</Label><Input type="number" value={skuEditForm.width_cm} onChange={(e) => updateSkuEditForm("width_cm", e.target.value)} /></div>
                                                                                <div className="space-y-1"><Label className="text-xs text-muted-foreground">Height (cm)</Label><Input type="number" value={skuEditForm.height_cm} onChange={(e) => updateSkuEditForm("height_cm", e.target.value)} /></div>
                                                                                <div className="space-y-1"><Label className="text-xs text-muted-foreground">Weight (kg)</Label><Input type="number" value={skuEditForm.weight_kg} onChange={(e) => updateSkuEditForm("weight_kg", e.target.value)} /></div>
                                                                                <div className="space-y-1"><Label className="text-xs text-muted-foreground">Volume (cc)</Label><Input type="number" value={skuEditForm.volume_cc} onChange={(e) => updateSkuEditForm("volume_cc", e.target.value)} /></div>
                                                                                <div className="space-y-1"><Label className="text-xs text-muted-foreground">Pallet Qty</Label><Input type="number" value={skuEditForm.pallet_quantity} onChange={(e) => updateSkuEditForm("pallet_quantity", e.target.value)} /></div>
                                                                            </div>
                                                                        </div>
                                                                    </TabsContent>

                                                                    <TabsContent value="storage" className="mt-0">
                                                                        <div className="rounded-lg border bg-card p-4 space-y-4">
                                                                            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Storage and Picking</p>
                                                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                                                <div className="space-y-1"><Label className="text-xs text-muted-foreground">Storage Condition</Label><Input value={skuEditForm.storage_condition} onChange={(e) => updateSkuEditForm("storage_condition", e.target.value)} /></div>
                                                                                <div className="space-y-1"><Label className="text-xs text-muted-foreground">Shelf Life Days</Label><Input type="number" value={skuEditForm.shelf_life_days} onChange={(e) => updateSkuEditForm("shelf_life_days", e.target.value)} /></div>
                                                                                <div className="space-y-1"><Label className="text-xs text-muted-foreground">Picking Strategy</Label><Input value={skuEditForm.picking_strategy} onChange={(e) => updateSkuEditForm("picking_strategy", e.target.value)} /></div>
                                                                                <div className="space-y-1"><Label className="text-xs text-muted-foreground">Pick Face Capacity</Label><Input type="number" value={skuEditForm.pick_face_capacity} onChange={(e) => updateSkuEditForm("pick_face_capacity", e.target.value)} /></div>
                                                                                <div className="space-y-1"><Label className="text-xs text-muted-foreground">Replenishment Point</Label><Input type="number" value={skuEditForm.pick_face_replenishment_point} onChange={(e) => updateSkuEditForm("pick_face_replenishment_point", e.target.value)} /></div>
                                                                                <div className="space-y-1"><Label className="text-xs text-muted-foreground">Max Stack Height</Label><Input type="number" value={skuEditForm.max_stack_height} onChange={(e) => updateSkuEditForm("max_stack_height", e.target.value)} /></div>
                                                                                <div className="space-y-1"><Label className="text-xs text-muted-foreground">Max Qty Per Bin</Label><Input type="number" value={skuEditForm.max_qty_per_bin} onChange={(e) => updateSkuEditForm("max_qty_per_bin", e.target.value)} /></div>
                                                                                <div className="space-y-1"><Label className="text-xs text-muted-foreground">Preferred Zones (comma-separated)</Label><Input value={skuEditForm.preferred_zones} onChange={(e) => updateSkuEditForm("preferred_zones", e.target.value)} /></div>
                                                                                <div className="space-y-1"><Label className="text-xs text-muted-foreground">Preferred Bin Types (comma-separated)</Label><Input value={skuEditForm.preferred_bin_types} onChange={(e) => updateSkuEditForm("preferred_bin_types", e.target.value)} /></div>
                                                                            </div>
                                                                        </div>
                                                                    </TabsContent>

                                                                    <TabsContent value="compliance" className="mt-0">
                                                                        <div className="rounded-lg border bg-card p-4 space-y-4">
                                                                            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Compliance and Tax</p>
                                                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                                                <div className="space-y-1"><Label className="text-xs text-muted-foreground">Hazard Class</Label><Input value={skuEditForm.hazard_class} onChange={(e) => updateSkuEditForm("hazard_class", e.target.value)} /></div>
                                                                                <div className="space-y-1"><Label className="text-xs text-muted-foreground">Hazmat Code</Label><Input value={skuEditForm.hazmat_code} onChange={(e) => updateSkuEditForm("hazmat_code", e.target.value)} /></div>
                                                                                <div className="space-y-1"><Label className="text-xs text-muted-foreground">Inspection Rule</Label><Input value={skuEditForm.inspection_rule} onChange={(e) => updateSkuEditForm("inspection_rule", e.target.value)} /></div>
                                                                                <div className="space-y-1"><Label className="text-xs text-muted-foreground">Sample Percentage</Label><Input type="number" value={skuEditForm.sample_percentage} onChange={(e) => updateSkuEditForm("sample_percentage", e.target.value)} /></div>
                                                                                <div className="space-y-1"><Label className="text-xs text-muted-foreground">HSN Code</Label><Input value={skuEditForm.hsn_code} onChange={(e) => updateSkuEditForm("hsn_code", e.target.value)} /></div>
                                                                                <div className="space-y-1"><Label className="text-xs text-muted-foreground">Tax Rate</Label><Input type="number" value={skuEditForm.tax_rate} onChange={(e) => updateSkuEditForm("tax_rate", e.target.value)} /></div>
                                                                            </div>
                                                                        </div>
                                                                    </TabsContent>

                                                                    <TabsContent value="rules" className="mt-0">
                                                                        <div className="rounded-lg border bg-card p-4 space-y-4">
                                                                            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Rules and Status</p>
                                                                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                                                                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={skuEditForm.fefo_enabled} onChange={(e) => updateSkuEditForm("fefo_enabled", e.target.checked)} /> FEFO Enabled</label>
                                                                                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={skuEditForm.fifo_enabled} onChange={(e) => updateSkuEditForm("fifo_enabled", e.target.checked)} /> FIFO Enabled</label>
                                                                                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={skuEditForm.batch_required} onChange={(e) => updateSkuEditForm("batch_required", e.target.checked)} /> Batch Required</label>
                                                                                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={skuEditForm.serial_required} onChange={(e) => updateSkuEditForm("serial_required", e.target.checked)} /> Serial Required</label>
                                                                                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={skuEditForm.pick_face_eligible} onChange={(e) => updateSkuEditForm("pick_face_eligible", e.target.checked)} /> Pick Face Eligible</label>
                                                                                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={skuEditForm.is_hazardous} onChange={(e) => updateSkuEditForm("is_hazardous", e.target.checked)} /> Is Hazardous</label>
                                                                                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={skuEditForm.requires_inspection} onChange={(e) => updateSkuEditForm("requires_inspection", e.target.checked)} /> Requires Inspection</label>
                                                                                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={skuEditForm.quarantine_on_failure} onChange={(e) => updateSkuEditForm("quarantine_on_failure", e.target.checked)} /> Quarantine On Failure</label>
                                                                                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={skuEditForm.active} onChange={(e) => updateSkuEditForm("active", e.target.checked)} /> Active</label>
                                                                            </div>
                                                                        </div>
                                                                    </TabsContent>
                                                                </Tabs>

                                                                <div className="flex justify-end gap-2 border-t pt-4">
                                                                    <Button type="button" variant="outline" onClick={resetSkuEditCard} className="h-10 px-6">
                                                                        Close
                                                                    </Button>
                                                                    <Button
                                                                        type="button"
                                                                        onClick={handleSaveSkuCard}
                                                                        disabled={isSkuCardSaving || isSkuCardLoading || !selectedSkuId}
                                                                        className="h-10 px-8 shadow-lg shadow-primary/20"
                                                                    >
                                                                        {isSkuCardSaving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : "Save SKU Details"}
                                                                    </Button>
                                                                </div>
                                                            </>
                                                        )}
                                                    </div>
                                                </DialogContent>
                                            </Dialog>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </div>

                <div className="flex justify-end items-center gap-4 pt-4 pb-12">
                    <Button type="button" variant="outline" className="px-8 h-11" onClick={() => navigate('/dashboard/asns')} disabled={isLoading}>
                        Cancel
                    </Button>

                    <Button type="submit" className="gap-2 px-12 h-11 shadow-xl shadow-primary/25" disabled={isLoading}>
                        {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        {isLoading ? "Processing..." : "Create ASN"}
                    </Button>
                </div>
            </form>
        </div>
    );
};

export default CreateAsn;
