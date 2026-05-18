import { useState, useEffect, useRef, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEnterNavigation } from "@/hooks/useEnterNavigation";
import * as z from "zod";
import {
    Building2,
    Save,
    Loader2,
    Plus,
    Search,
    Filter,
    Eye,
    MapPin,
    Mail,
    Phone,
    User,
    Ruler,
    Activity,
    Edit2,
    Settings2,
    Info,
    Truck,
    Box
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { warehouseService } from "@/services/warehouseService";
import { AddZoneModal } from "@/components/warehouse/AddZoneModal";
import { ZoneListModal } from "@/components/warehouse/ZoneListModal";
import { zoneService } from "@/services/zoneService";
import { palletService } from "@/services/palletService";
import { PalletListModal } from "@/components/warehouse/PalletListModal";
import { AddPalletModal } from "@/components/warehouse/AddPalletModal";
import { PhoneInput, COUNTRY_DATA, isPhoneValid } from "@/components/ui/PhoneInput";

import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import * as countryCityState from 'countrycitystatejson';
import { Country as CSC_Country } from 'country-state-city';

const warehouseSchema = z.object({
    code: z.string().min(2, "Code must be at least 2 characters"),
    name: z.string().min(1, "Name is required"),
    description: z.string().min(1, "Description is required"),
    address_line1: z.string().min(1, "Address Line 1 is required"),
    address_line2: z.string().optional(),
    city: z.string().min(1, "City is required"),
    state: z.string().min(1, "State is required"),
    country: z.string().min(1, "Country is required"),
    postal_code: z.string().min(1, "Postal code is required"),
    contact_person: z.string().min(1, "Contact person is required"),
    contact_email: z.string().email("Invalid email address").min(1, "Contact email is required"),
    contact_phone_country_code: z.string().min(1, "Phone country code is required"),
    contact_phone: z.string().min(1, "Phone number is required"),
    time_zone: z.string().min(1, "Time zone is required"),
    default_rules_profile: z.string().min(1, "Rules profile is required"),
    total_area_sqft: z.coerce.number().min(0, "Cannot be negative"),
    total_volume_cc: z.coerce.number().min(0, "Cannot be negative"),
    max_pallet_positions: z.coerce.number().min(0, "Cannot be negative"),
    is_active: z.boolean().default(true),
});

type WarehouseFormValues = z.input<typeof warehouseSchema>;

const POSTAL_CONFIGS: Record<string, { placeholder: string; regex: RegExp; helperText: string; formatter?: (v: string) => string }> = {
    "IN": {
        placeholder: "Example: 400001",
        regex: /^[0-9]{6}$/,
        helperText: "India: Exactly 6 digits required",
        formatter: (v) => v.replace(/[^0-9]/g, "").slice(0, 6)
    },
    "US": {
        placeholder: "Example: 90210",
        regex: /^[0-9]{5}(-[0-9]{4})?$/,
        helperText: "USA: 5 or 9 digits required (ZIP+4)",
        formatter: (v) => {
            let val = v.replace(/[^0-9]/g, "");
            if (val.length > 5) return val.slice(0, 5) + "-" + val.slice(5, 9);
            return val.slice(0, 5);
        }
    },
    "GB": {
        placeholder: "Example: SW1A 1AA",
        regex: /^[A-Z]{1,2}[0-9][A-Z0-9]?\s?[0-9][A-Z]{2}$/i,
        helperText: "UK: Valid alphanumeric postal code required",
        formatter: (v) => v.toUpperCase().slice(0, 8)
    },
    "DE": {
        placeholder: "Example: 10115",
        regex: /^[0-9]{5}$/,
        helperText: "Germany: Exactly 5 digits required",
        formatter: (v) => v.replace(/[^0-9]/g, "").slice(0, 5)
    },
    "AE": {
        placeholder: "Example: 00000",
        regex: /^[0-9]{5}$/,
        helperText: "UAE: 5 digits recommended (e.g. 00000)",
        formatter: (v) => v.replace(/[^0-9]/g, "").slice(0, 5)
    }
};

const WarehouseManagement = () => {
    const [loading, setLoading] = useState(false);
    const [open, setOpen] = useState(false);
    const [editOpen, setEditOpen] = useState(false);
    const [viewOpen, setViewOpen] = useState(false);
    const [editingWarehouse, setEditingWarehouse] = useState<any>(null);
    const [viewingWarehouse, setViewingWarehouse] = useState<any>(null);
    const [warehouses, setWarehouses] = useState<any[]>([]);
    const [searchTerm, setSearchTerm] = useState("");

    // Zone Modals State
    const [addZoneOpen, setAddZoneOpen] = useState(false);
    const [zoneListOpen, setZoneListOpen] = useState(false);
    const [addPalletOpen, setAddPalletOpen] = useState(false);
    const [countrySelectOpen, setCountrySelectOpen] = useState(false);
    const [stateSelectOpen, setStateSelectOpen] = useState(false);
    const [citySelectOpen, setCitySelectOpen] = useState(false);
    const [palletListOpen, setPalletListOpen] = useState(false);
    const [openCreatePalletOnLoad, setOpenCreatePalletOnLoad] = useState(false);

    // Live Metrics State
    const [liveZonesCount, setLiveZonesCount] = useState<number | null>(null);
    const [livePalletsCount, setLivePalletsCount] = useState<number | null>(null);
    const formRef = useRef<HTMLFormElement>(null);
    const editFormRef = useRef<HTMLFormElement>(null);

    useEnterNavigation(formRef, { submitOnLast: true, enabled: open });
    useEnterNavigation(editFormRef, { submitOnLast: true, enabled: editOpen });

    const form = useForm<WarehouseFormValues>({
        resolver: zodResolver(warehouseSchema),
        defaultValues: {
            code: "",
            name: "",
            description: "",
            address_line1: "",
            address_line2: "",
            city: "",
            state: "",
            country: "",
            postal_code: "",
            contact_person: "",
            contact_email: "",
            contact_phone_country_code: "+971",
            contact_phone: "",
            time_zone: "UTC",
            default_rules_profile: "STANDARD",
            total_area_sqft: 0,
            total_volume_cc: 0,
            max_pallet_positions: 0,
            is_active: true,
        },
    });

    const editForm = useForm<WarehouseFormValues>({
        resolver: zodResolver(warehouseSchema),
    });

    useEffect(() => {
        fetchWarehouses();
    }, []);

    // --- Cascading Dropdown Logic: Add Form ---
    const addCountry = form.watch("country");
    const addState = form.watch("state");

    const countries = useMemo(() => countryCityState.getCountries() || [], []);

    const filteredStatesAdd = useMemo(() =>
        addCountry ? (countryCityState.getStatesByShort(addCountry) || []) : [],
        [addCountry]);

    const filteredCitiesAdd = useMemo(() =>
        (addCountry && addState) ? (countryCityState.getCities(addCountry, addState) || []) : [],
        [addCountry, addState]);

    // Handle Country Change in Add Form
    useEffect(() => {
        if (addCountry) {
            const countryInfo = countryCityState.getCountryByShort(addCountry);
            if (countryInfo?.name) {
                const countryName = countryInfo.name.toLowerCase();
                const countryData = COUNTRY_DATA.find(c =>
                    c.country.toLowerCase().includes(countryName) ||
                    countryName.includes(c.country.toLowerCase())
                );
                if (countryData) {
                    form.setValue("contact_phone_country_code", countryData.code);
                }
            }

            // Set Timezone based on country
            const cscCountry = CSC_Country.getCountryByCode(addCountry);
            if (cscCountry?.timezones && cscCountry.timezones.length > 0) {
                form.setValue("time_zone", cscCountry.timezones[0].zoneName);
            }

            // Only reset if state doesn't belong to new country
            if (addState && !filteredStatesAdd.includes(addState)) {
                form.setValue("state", "");
                form.setValue("city", "");
            }
        }
    }, [addCountry, addState, filteredStatesAdd, form]);

    // Handle State Change in Add Form
    useEffect(() => {
        if (addState && addCountry) {
            const cities = countryCityState.getCities(addCountry, addState) || [];
            const currentCity = form.getValues("city");
            if (currentCity && !cities.includes(currentCity)) {
                form.setValue("city", "");
            }
        }
    }, [addState, addCountry, form]);

    const currentPostalConfig = POSTAL_CONFIGS[addCountry] || {
        placeholder: "e.g. 00000",
        regex: /.*/,
        helperText: ""
    };

    const postalValue = form.watch("postal_code") || "";
    const isPostalEmpty = !postalValue.trim();
    const isPostalValid = isPostalEmpty || currentPostalConfig.regex.test(postalValue);
    const showPostalSuccess = !isPostalEmpty && isPostalValid;
    const showPostalErr = !isPostalEmpty && !isPostalValid;

    // --- Cascading Dropdown Logic: Edit Form ---
    const editCountry = editForm.watch("country");
    const editState = editForm.watch("state");

    const filteredStatesEdit = useMemo(() =>
        editCountry ? (countryCityState.getStatesByShort(editCountry) || []) : [],
        [editCountry]);

    const filteredCitiesEdit = useMemo(() =>
        (editCountry && editState) ? (countryCityState.getCities(editCountry, editState) || []) : [],
        [editCountry, editState]);

    // Handle Country Change in Edit Form
    useEffect(() => {
        if (editCountry) {
            const countryInfo = countryCityState.getCountryByShort(editCountry);
            if (countryInfo?.name) {
                const countryName = countryInfo.name.toLowerCase();
                const countryData = COUNTRY_DATA.find(c =>
                    c.country.toLowerCase().includes(countryName) ||
                    countryName.includes(c.country.toLowerCase())
                );
                if (countryData) {
                    editForm.setValue("contact_phone_country_code", countryData.code);
                }
            }

            // Set Timezone based on country
            const cscCountry = CSC_Country.getCountryByCode(editCountry);
            if (cscCountry?.timezones && cscCountry.timezones.length > 0) {
                editForm.setValue("time_zone", cscCountry.timezones[0].zoneName);
            }

            if (editState && !filteredStatesEdit.includes(editState)) {
                editForm.setValue("state", "");
                editForm.setValue("city", "");
            }
        }
    }, [editCountry, editState, filteredStatesEdit, editForm]);

    // Handle State Change in Edit Form
    useEffect(() => {
        if (editState && editCountry) {
            const cities = countryCityState.getCities(editCountry, editState) || [];
            const currentCity = editForm.getValues("city");
            if (currentCity && !cities.includes(currentCity)) {
                editForm.setValue("city", "");
            }
        }
    }, [editState, editCountry, editForm]);

    const fetchWarehouses = async () => {
        setLoading(true);
        try {
            const data = await warehouseService.getAll();
            setWarehouses(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error("Failed to fetch warehouses", error);
            toast.error("Failed to load warehouses");
        } finally {
            setLoading(false);
        }
    };

    const extractCountFromResponse = (payload: any): number => {
        if (!payload) return 0;

        const arrayKeys = ["items", "data", "results", "zones", "bins", "records", "pallets"];
        const numericCountKeys = [
            "total",
            "count",
            "total_count",
            "total_items",
            "records_total",
            "zone_count",
            "zones_count",
            "total_zones",
            "totalZones",
            "bins_count",
            "active_bins_count",
            "pallets_count",
            "total_pallets",
        ];

        const getArrayCountDeep = (value: any, seen = new Set<any>()): number => {
            if (!value || typeof value !== "object") return 0;
            if (seen.has(value)) return 0;
            seen.add(value);

            if (Array.isArray(value)) {
                return value.length;
            }

            let best = 0;

            for (const key of arrayKeys) {
                const candidate = value?.[key];
                if (Array.isArray(candidate)) {
                    best = Math.max(best, candidate.length);
                } else if (candidate && typeof candidate === "object") {
                    best = Math.max(best, getArrayCountDeep(candidate, seen));
                }
            }

            for (const nested of Object.values(value)) {
                if (nested && typeof nested === "object") {
                    best = Math.max(best, getArrayCountDeep(nested, seen));
                }
            }

            return best;
        };

        const getNumericCountDeep = (value: any, seen = new Set<any>()): number => {
            if (!value || typeof value !== "object") return 0;
            if (seen.has(value)) return 0;
            seen.add(value);

            let best = 0;
            for (const key of numericCountKeys) {
                const parsed = Number(value?.[key]);
                if (Number.isFinite(parsed) && parsed > best) {
                    best = parsed;
                }
            }

            if (value?.pagination) {
                const paginationTotal = Number(value.pagination.total ?? value.pagination.count);
                if (Number.isFinite(paginationTotal) && paginationTotal > best) {
                    best = paginationTotal;
                }
            }

            for (const nested of Object.values(value)) {
                if (nested && typeof nested === "object") {
                    best = Math.max(best, getNumericCountDeep(nested, seen));
                }
            }

            return best;
        };

        if (Array.isArray(payload)) return payload.length;

        // Prefer concrete array length over scalar counts to avoid false 0 values.
        const arrayCount = getArrayCountDeep(payload);
        if (arrayCount > 0) return arrayCount;

        return getNumericCountDeep(payload);
    };

    const fetchLiveCounts = async (warehouseId: string, warehouseCode?: string) => {
        const normalizedWarehouseId = String(warehouseId || "").trim();
        const normalizedWarehouseCode = String(warehouseCode || "").trim();

        const fallbackZones = Number(
            viewingWarehouse?.zones_count ??
            viewingWarehouse?.zone_count ??
            viewingWarehouse?.total_zones ??
            viewingWarehouse?.totalZones ??
            (Array.isArray(viewingWarehouse?.zones) ? viewingWarehouse.zones.length : 0)
        ) || 0;
        const fallbackPallets = Number(
            viewingWarehouse?.pallets_count ??
            viewingWarehouse?.pallet_count ??
            viewingWarehouse?.total_pallets ??
            viewingWarehouse?.totalPallets ??
            (Array.isArray(viewingWarehouse?.pallets) ? viewingWarehouse.pallets.length : 0)
        ) || 0;

        const normalizeRecords = (payload: any): any[] => {
            if (!payload) return [];
            if (Array.isArray(payload)) return payload;
            if (Array.isArray(payload?.items)) return payload.items;
            if (Array.isArray(payload?.data)) return payload.data;
            if (Array.isArray(payload?.results)) return payload.results;
            if (Array.isArray(payload?.records)) return payload.records;
            if (Array.isArray(payload?.pallets)) return payload.pallets;
            if (Array.isArray(payload?.zones)) return payload.zones;
            if (Array.isArray(payload?.data?.items)) return payload.data.items;
            return [];
        };

        const palletBelongsToWarehouse = (row: any): boolean => {
            if (!row || typeof row !== "object") return false;

            const rowWarehouseId = String(
                row?.warehouse_id ??
                row?.warehouseId ??
                row?.warehouse?.id ??
                row?.warehouse ??
                ""
            ).trim();
            const rowWarehouseCode = String(
                row?.warehouse_code ??
                row?.warehouseCode ??
                row?.warehouse?.code ??
                row?.warehouse_name ??
                ""
            ).trim();

            const idMatches = normalizedWarehouseId && rowWarehouseId && rowWarehouseId === normalizedWarehouseId;
            const codeMatches = normalizedWarehouseCode && rowWarehouseCode && rowWarehouseCode === normalizedWarehouseCode;

            // Some APIs may return warehouse code in warehouse_id field.
            const crossFieldMatch =
                (normalizedWarehouseCode && rowWarehouseId && rowWarehouseId === normalizedWarehouseCode) ||
                (normalizedWarehouseId && rowWarehouseCode && rowWarehouseCode === normalizedWarehouseId);

            return Boolean(idMatches || codeMatches || crossFieldMatch);
        };

        const zoneBelongsToWarehouse = (row: any): boolean => {
            if (!row || typeof row !== "object") return false;

            const rowWarehouseId = String(
                row?.warehouse_id ??
                row?.warehouseId ??
                row?.warehouse?.id ??
                row?.warehouse ??
                ""
            ).trim();
            const rowWarehouseCode = String(
                row?.warehouse_code ??
                row?.warehouseCode ??
                row?.warehouse?.code ??
                row?.warehouse_name ??
                ""
            ).trim();

            const idMatches = normalizedWarehouseId && rowWarehouseId && rowWarehouseId === normalizedWarehouseId;
            const codeMatches = normalizedWarehouseCode && rowWarehouseCode && rowWarehouseCode === normalizedWarehouseCode;
            const crossFieldMatch =
                (normalizedWarehouseCode && rowWarehouseId && rowWarehouseId === normalizedWarehouseCode) ||
                (normalizedWarehouseId && rowWarehouseCode && rowWarehouseCode === normalizedWarehouseId);

            return Boolean(idMatches || codeMatches || crossFieldMatch);
        };

        const readStatCount = (payload: any, keys: string[]): number | null => {
            if (!payload || typeof payload !== "object") return null;

            for (const key of keys) {
                const parsed = Number(payload?.[key]);
                if (Number.isFinite(parsed)) {
                    return parsed;
                }
            }

            return null;
        };

        try {
            // Prefer backend per-warehouse statistics when available.
            if (normalizedWarehouseId) {
                try {
                    const stats = await warehouseService.getStatistics(normalizedWarehouseId);
                    const statsZones = readStatCount(stats, [
                        "zones_count",
                        "zone_count",
                        "total_zones",
                        "totalZones",
                        "zones",
                    ]);
                    const statsPallets = readStatCount(stats, [
                        "pallets_count",
                        "pallet_count",
                        "total_pallets",
                        "totalPallets",
                        "pallets",
                    ]);

                    if (statsZones !== null || statsPallets !== null) {
                        setLiveZonesCount(statsZones ?? fallbackZones);
                        setLivePalletsCount(statsPallets ?? fallbackPallets);
                        return;
                    }
                } catch {
                    // Continue with endpoint-based counting fallback.
                }
            }

            // Try warehouse id first, then warehouse code because some backends use code keys in path params.
            const zoneAttempts = Array.from(new Set([normalizedWarehouseId, normalizedWarehouseCode].filter(Boolean)));

            let resolvedZones = 0;
            let gotZoneData = false;
            for (const key of zoneAttempts) {
                try {
                    const zonesRes = await zoneService.getZonesByWarehouse(key);
                    const zoneRows = normalizeRecords(zonesRes);

                    if (zoneRows.length > 0) {
                        gotZoneData = true;
                        const hasWarehouseMarkers = zoneRows.some((row) => {
                            const rowWarehouseId = String(
                                row?.warehouse_id ??
                                row?.warehouseId ??
                                row?.warehouse?.id ??
                                row?.warehouse ??
                                ""
                            ).trim();
                            const rowWarehouseCode = String(
                                row?.warehouse_code ??
                                row?.warehouseCode ??
                                row?.warehouse?.code ??
                                row?.warehouse_name ??
                                ""
                            ).trim();
                            return Boolean(rowWarehouseId || rowWarehouseCode);
                        });

                        const zoneCount = hasWarehouseMarkers
                            ? zoneRows.filter(zoneBelongsToWarehouse).length
                            : zoneRows.length;

                        resolvedZones = Math.max(resolvedZones, zoneCount);

                        // Stop early only when we have a positive scoped count.
                        if (zoneCount > 0) {
                            break;
                        }
                    }
                } catch {
                    // Try next key variant.
                }
            }

            const palletsRes = await palletService.getAll(0, 500, {
                warehouse_id: normalizedWarehouseId || undefined,
                warehouse_code: normalizedWarehouseCode || undefined,
            });
            const palletRows = normalizeRecords(palletsRes);
            const hasPalletData = palletRows.length > 0;
            const palletRowsHaveWarehouseMarkers = palletRows.some((row) => {
                const rowWarehouseId = String(
                    row?.warehouse_id ??
                    row?.warehouseId ??
                    row?.warehouse?.id ??
                    row?.warehouse ??
                    ""
                ).trim();
                const rowWarehouseCode = String(
                    row?.warehouse_code ??
                    row?.warehouseCode ??
                    row?.warehouse?.code ??
                    row?.warehouse_name ??
                    ""
                ).trim();
                return Boolean(rowWarehouseId || rowWarehouseCode);
            });
            const matchedPallets = palletRows.filter(palletBelongsToWarehouse);
            const resolvedPallets = palletRowsHaveWarehouseMarkers ? matchedPallets.length : palletRows.length;

            setLiveZonesCount(gotZoneData ? resolvedZones : fallbackZones);
            setLivePalletsCount(hasPalletData ? resolvedPallets : fallbackPallets);
        } catch (error) {
            console.error("Failed to fetch live zone/pallet counts", error);
            setLiveZonesCount(fallbackZones);
            setLivePalletsCount(fallbackPallets);
        }
    };

    useEffect(() => {
        if (viewOpen && (viewingWarehouse?.id || viewingWarehouse?.code)) {
            // Reset counts for fresh modal
            setLiveZonesCount(null);
            setLivePalletsCount(null);
            fetchLiveCounts(viewingWarehouse?.id || viewingWarehouse?.code, viewingWarehouse?.code);
        }
    }, [viewOpen, viewingWarehouse?.id, viewingWarehouse?.code]);

    const onSubmit = async (values: WarehouseFormValues) => {
        setLoading(true);
        try {
            const payload = {
                ...values,
                contact_phone: values.contact_phone ? `${values.contact_phone_country_code || "+971"}${values.contact_phone}` : ""
            };
            await warehouseService.create(payload);
            toast.success("Warehouse created successfully");
            setOpen(false);
            form.reset();
            fetchWarehouses();
        } catch (error) {
            console.error("Failed to create warehouse", error);
            toast.error("Failed to create warehouse");
        } finally {
            setLoading(false);
        }
    };

    const onEditSubmit = async (values: WarehouseFormValues) => {
        if (!editingWarehouse) return;
        setLoading(true);
        try {
            const payload = {
                ...values,
                contact_phone: values.contact_phone ? `${values.contact_phone_country_code || "+971"}${values.contact_phone}` : ""
            };
            await warehouseService.update(editingWarehouse.id || editingWarehouse.code, payload);
            toast.success("Warehouse updated successfully");
            setEditOpen(false);
            fetchWarehouses();
        } catch (error) {
            console.error("Failed to update warehouse", error);
            toast.error("Failed to update warehouse");
        } finally {
            setLoading(false);
        }
    };

    const handleEdit = (warehouse: any) => {
        setEditingWarehouse(warehouse);

        const parsePhone = (raw: string) => {
            let country_code = "+971";
            let phone = raw;
            for (const country of COUNTRY_DATA) {
                if (raw.startsWith(country.code)) {
                    country_code = country.code;
                    phone = raw.substring(country.code.length);
                    break;
                }
            }
            return { country_code, phone };
        };

        const phoneInfo = parsePhone(String(warehouse.contact_phone || ""));

        editForm.reset({
            code: warehouse.code,
            name: warehouse.name,
            description: warehouse.description || "",
            address_line1: warehouse.address_line1 || "",
            address_line2: warehouse.address_line2 || "",
            city: warehouse.city || "",
            state: warehouse.state || "",
            country: warehouse.country || "",
            postal_code: warehouse.postal_code || "",
            contact_person: warehouse.contact_person || "",
            contact_email: warehouse.contact_email || "",
            contact_phone_country_code: phoneInfo.country_code,
            contact_phone: phoneInfo.phone,
            time_zone: warehouse.time_zone || "UTC",
            default_rules_profile: warehouse.default_rules_profile || "STANDARD",
            total_area_sqft: warehouse.total_area_sqft || 0,
            total_volume_cc: warehouse.total_volume_cc || 0,
            max_pallet_positions: warehouse.max_pallet_positions || 0,
            is_active: warehouse.is_active ?? true,
        });
        setEditOpen(true);
    };

    const handleView = async (warehouse: any) => {
        try {
            // Fetch full warehouse details to get zone/bin information
            let fullWarehouse: any = null;

            if (warehouse?.id) {
                fullWarehouse = await warehouseService.getById(warehouse.id);
            } else if (warehouse?.code) {
                fullWarehouse = await warehouseService.getByCode(warehouse.code);
            }

            setViewingWarehouse(fullWarehouse);
        } catch (error) {
            // Fallback to the provided warehouse data
            console.error("Failed to fetch full warehouse details", error);
            setViewingWarehouse(warehouse);
        }
        setViewOpen(true);
    };

    const handleTotalZonesClick = async () => {
        const warehouseId = String(viewingWarehouse?.id ?? "").trim();

        if (!warehouseId) {
            toast.error("Warehouse ID is missing. Unable to load zones.");
            return;
        }

        try {
            const zonesResponse = await zoneService.getZonesByWarehouse(warehouseId);
            const resolvedZones = extractCountFromResponse(zonesResponse);
            setLiveZonesCount(resolvedZones);
        } catch (error) {
            console.error("Failed to load zones by warehouse id", error);
            toast.error("Failed to load zones for this warehouse.");
        } finally {
            setZoneListOpen(true);
        }
    };

    const filteredWarehouses = warehouses.filter(w => {
        const search = searchTerm.toLowerCase();
        return (
            (w.name?.toLowerCase() || "").includes(search) ||
            (w.code?.toLowerCase() || "").includes(search) ||
            (w.city?.toLowerCase() || "").includes(search) ||
            (w.contact_person?.toLowerCase() || "").includes(search)
        );
    });

    return (
        <div className="p-6 space-y-6 animate-fade-in">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                        <Building2 className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Warehouse Management</h1>
                        <p className="text-muted-foreground">
                            Manage your storage facilities and distribution centers
                        </p>
                    </div>
                </div>

                <Dialog open={open} onOpenChange={setOpen}>
                    <DialogTrigger asChild>
                        <Button className="gap-2 shadow-lg hover:shadow-primary/20 transition-all active:scale-95">
                            <Plus className="w-4 h-4" />
                            Add Warehouse
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle className="text-xl font-heading font-bold">Register New Warehouse</DialogTitle>
                            <DialogDescription>
                                Set up a new warehouse facility in the system.
                            </DialogDescription>
                        </DialogHeader>

                        <Form {...form}>
                            <form ref={formRef} onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 pt-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <FormField
                                        control={form.control}
                                        name="code"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Warehouse Code <span className="text-destructive">*</span></FormLabel>
                                                <FormControl>
                                                    <Input placeholder="e.g. WH-DXB-01" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="name"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Facility Name <span className="text-destructive">*</span></FormLabel>
                                                <FormControl>
                                                    <Input placeholder="e.g. Al Quoz Logistics Center" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="description"
                                        render={({ field }) => (
                                            <FormItem className="md:col-span-2">
                                                <FormLabel>Facility Description <span className="text-destructive">*</span></FormLabel>
                                                <FormControl>
                                                    <Textarea
                                                        placeholder="General purpose distribution center..."
                                                        className="resize-none h-20"
                                                        {...field}
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    <div className="md:col-span-2">
                                        <Separator className="my-2" />
                                        <h3 className="text-sm font-semibold text-primary uppercase tracking-wider my-4">Location & Address</h3>
                                    </div>

                                    <FormField
                                        control={form.control}
                                        name="address_line1"
                                        render={({ field }) => (
                                            <FormItem className="md:col-span-2">
                                                <FormLabel>Address Line 1 <span className="text-destructive">*</span></FormLabel>
                                                <FormControl>
                                                    <Input placeholder="Building, Street, Area" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="address_line2"
                                        render={({ field }) => (
                                            <FormItem className="md:col-span-2">
                                                <FormLabel>Address Line 2</FormLabel>
                                                <FormControl>
                                                    <Input placeholder="Suite, Floor, Landmark (Optional)" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    <FormField
                                        control={form.control}
                                        name="country"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Country <span className="text-destructive">*</span></FormLabel>
                                                <Select
                                                    open={countrySelectOpen}
                                                    onOpenChange={setCountrySelectOpen}
                                                    onValueChange={(v) => {
                                                        field.onChange(v);
                                                        // After selecting country, move focus to the state field
                                                        setTimeout(() => {
                                                            document.getElementById('state-select-trigger')?.focus();
                                                        }, 100);
                                                    }}
                                                    value={field.value}
                                                >
                                                    <FormControl>
                                                        <SelectTrigger
                                                            id="country-select-trigger"
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter') {
                                                                    e.preventDefault();
                                                                    setCountrySelectOpen(true);
                                                                }
                                                            }}
                                                        >
                                                            <SelectValue placeholder="Select Country" />
                                                        </SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent>
                                                        {countries.map(c => (
                                                            <SelectItem key={c.shortName} value={c.shortName}>{c.name}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="state"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>State/Province <span className="text-destructive">*</span></FormLabel>
                                                <Select
                                                    open={stateSelectOpen}
                                                    onOpenChange={setStateSelectOpen}
                                                    onValueChange={(v) => {
                                                        field.onChange(v);
                                                        // After selecting state, move focus to the city field
                                                        setTimeout(() => {
                                                            document.getElementById('city-select-trigger')?.focus();
                                                        }, 100);
                                                    }}
                                                    value={field.value}
                                                    disabled={!addCountry}
                                                >
                                                    <FormControl>
                                                        <SelectTrigger
                                                            id="state-select-trigger"
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter') {
                                                                    e.preventDefault();
                                                                    setStateSelectOpen(true);
                                                                }
                                                            }}
                                                        >
                                                            <SelectValue placeholder={addCountry ? "Select State" : "Select Country First"} />
                                                        </SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent>
                                                        {filteredStatesAdd.map(s => (
                                                            <SelectItem key={s} value={s}>{s}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="city"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>City <span className="text-destructive">*</span></FormLabel>
                                                <Select
                                                    open={citySelectOpen}
                                                    onOpenChange={setCitySelectOpen}
                                                    onValueChange={(v) => {
                                                        field.onChange(v);
                                                        // After selecting city, move focus to the postal code field
                                                        setTimeout(() => {
                                                            document.getElementById('postal_code_input')?.focus();
                                                        }, 100);
                                                    }}
                                                    value={field.value}
                                                    disabled={!addState}
                                                >
                                                    <FormControl>
                                                        <SelectTrigger
                                                            id="city-select-trigger"
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter') {
                                                                    e.preventDefault();
                                                                    setCitySelectOpen(true);
                                                                }
                                                            }}
                                                        >
                                                            <SelectValue placeholder={addState ? "Select City" : "Select State First"} />
                                                        </SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent>
                                                        {filteredCitiesAdd.map(city => (
                                                            <SelectItem key={city} value={city}>{city}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="postal_code"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className={cn(showPostalErr && "text-destructive")}>Postal/Zip Code <span className="text-destructive">*</span></FormLabel>
                                                <FormControl>
                                                    <Input
                                                        id="postal_code_input"
                                                        placeholder={currentPostalConfig.placeholder}
                                                        {...field}
                                                        onChange={(e) => {
                                                            let val = e.target.value;
                                                            if (currentPostalConfig.formatter) {
                                                                val = currentPostalConfig.formatter(val);
                                                            }
                                                            field.onChange(val);
                                                        }}
                                                        className={cn(
                                                            showPostalErr && "border-destructive focus-visible:ring-destructive/30",
                                                            showPostalSuccess && "border-green-500 focus-visible:ring-green-500/30"
                                                        )}
                                                    />
                                                </FormControl>
                                                {showPostalErr && currentPostalConfig.helperText && (
                                                    <p className="text-[10px] text-destructive font-medium animate-in fade-in slide-in-from-top-1 duration-200">
                                                        {currentPostalConfig.helperText}
                                                    </p>
                                                )}
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    <div className="md:col-span-2">
                                        <Separator className="my-2" />
                                        <h3 className="text-sm font-semibold text-primary uppercase tracking-wider my-4">Contact Information</h3>
                                    </div>

                                    <FormField
                                        control={form.control}
                                        name="contact_person"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Contact Person <span className="text-destructive">*</span></FormLabel>
                                                <FormControl>
                                                    <Input placeholder="Manager Name" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="contact_email"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Contact Email <span className="text-destructive">*</span></FormLabel>
                                                <FormControl>
                                                    <Input type="email" placeholder="manager@warehouse.com" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="contact_phone"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Contact Phone <span className="text-destructive">*</span></FormLabel>
                                                <FormControl>
                                                    <PhoneInput
                                                        value={field.value || ""}
                                                        countryCode={form.watch("contact_phone_country_code") || "+971"}
                                                        onPhoneChange={field.onChange}
                                                        onCountryCodeChange={(v) => form.setValue("contact_phone_country_code", v)}
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <div className="md:col-span-2">
                                        <Separator className="my-2" />
                                        <h3 className="text-sm font-semibold text-primary uppercase tracking-wider my-4">Capacity & Protocol</h3>
                                    </div>

                                    <FormField
                                        control={form.control}
                                        name="total_area_sqft"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Total Area (sq ft)</FormLabel>
                                                <FormControl>
                                                    <Input type="number" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="total_volume_cc"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Total Volume (cc) <span className="text-destructive">*</span></FormLabel>
                                                <FormControl>
                                                    <Input type="number" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="max_pallet_positions"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Max Pallet Positions <span className="text-destructive">*</span></FormLabel>
                                                <FormControl>
                                                    <Input type="number" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="default_rules_profile"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Default Rules Profile <span className="text-destructive">*</span></FormLabel>
                                                <FormControl>
                                                    <Input placeholder="e.g. STANDARD" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    <div className="md:col-span-2">
                                        <Separator className="my-2" />
                                        <h3 className="text-sm font-semibold text-primary uppercase tracking-wider my-4">System Settings</h3>
                                    </div>

                                    <FormField
                                        control={form.control}
                                        name="time_zone"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Time Zone <span className="text-destructive">*</span></FormLabel>
                                                <FormControl>
                                                    <Input placeholder="e.g. UTC" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="is_active"
                                        render={({ field }) => (
                                            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                                                <div className="space-y-0.5">
                                                    <FormLabel>Active Status</FormLabel>
                                                    <div className="text-[10px] text-muted-foreground">Is this facility currently operational?</div>
                                                </div>
                                                <FormControl>
                                                    <Switch
                                                        checked={field.value}
                                                        onCheckedChange={field.onChange}
                                                    />
                                                </FormControl>
                                            </FormItem>
                                        )}
                                    />
                                </div>

                                <div className="flex justify-end gap-3 pb-2">
                                    <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                                        Cancel
                                    </Button>
                                    <Button type="submit" disabled={loading}>
                                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                                        Save Warehouse
                                    </Button>
                                </div>
                            </form>
                        </Form>
                    </DialogContent>
                </Dialog>
            </div>

            <Card className="border-border/50 shadow-sm overflow-hidden">
                <CardHeader className="bg-muted/30 pb-4">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <CardTitle className="text-lg font-heading">Warehouse List</CardTitle>
                            <CardDescription>Directory of all registered storage facilities</CardDescription>
                        </div>
                        <div className="flex items-center gap-2 max-w-sm w-full">
                            <div className="relative w-full">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search by name, code or location..."
                                    className="pl-9 bg-background/50 border-border/60 focus:bg-background transition-all"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                            <Button variant="outline" size="icon" className="shrink-0">
                                <Filter className="w-4 h-4 text-muted-foreground" />
                            </Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="relative overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-muted/20 hover:bg-muted/30">
                                    <TableHead className="w-[120px] font-bold py-4">Code</TableHead>
                                    <TableHead className="min-w-[200px] font-bold py-4">Facility Name</TableHead>
                                    <TableHead className="font-bold py-4">Location</TableHead>
                                    <TableHead className="font-bold py-4">Manager</TableHead>
                                    <TableHead className="font-bold py-4">Contact</TableHead>
                                    <TableHead className="font-bold py-4">Status</TableHead>
                                    <TableHead className="text-right font-bold py-4 pr-6">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading && warehouses.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="h-48 text-center">
                                            <div className="flex flex-col items-center justify-center gap-2">
                                                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                                                <p className="text-muted-foreground animate-pulse">Fetching warehouse data...</p>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : filteredWarehouses.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="h-48 text-center">
                                            <div className="flex flex-col items-center justify-center gap-3">
                                                <div className="p-3 bg-muted rounded-full">
                                                    <Building2 className="w-8 h-8 text-muted-foreground" />
                                                </div>
                                                <p className="text-lg font-medium text-foreground">No warehouses found</p>
                                                <p className="text-sm text-muted-foreground">Try adjusting your search filters or add a new facility.</p>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredWarehouses.map((warehouse) => (
                                        <TableRow key={warehouse.id || warehouse.code} className="group hover:bg-muted/30 transition-colors cursor-default">
                                            <TableCell className="font-mono text-sm font-semibold">{warehouse.code}</TableCell>
                                            <TableCell>
                                                <div className="font-medium text-foreground">{warehouse.name}</div>
                                                <div className="text-xs text-muted-foreground truncate max-w-[200px]">
                                                    {warehouse.description || 'No description provided'}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-1.5 text-sm">
                                                    <MapPin className="w-3.5 h-3.5 text-primary" />
                                                    <span>{warehouse.city}, {warehouse.country}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-1.5 text-sm">
                                                    <User className="w-3.5 h-3.5 text-muted-foreground" />
                                                    <span>{warehouse.contact_person}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-col gap-1">
                                                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                                        <Mail className="w-3 h-3" />
                                                        <span>{warehouse.contact_email}</span>
                                                    </div>
                                                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                                        <Phone className="w-3 h-3" />
                                                        <span>{warehouse.contact_phone}</span>
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge
                                                    variant={warehouse.is_active ? "default" : "secondary"}
                                                    className={warehouse.is_active ? "bg-primary/10 text-primary border-primary/20" : ""}
                                                >
                                                    {warehouse.is_active ? "Active" : "Inactive"}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right pr-6">
                                                <div className="flex justify-end gap-2 opacity-100 group-hover:opacity-100 transition-opacity">
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-primary hover:bg-muted/30" onClick={() => handleView(warehouse)}>
                                                        <Eye className="w-4 h-4" />
                                                    </Button>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-500 hover:bg-muted/30" onClick={() => handleEdit(warehouse)}>
                                                        <Edit2 className="w-4 h-4" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            {/* View Dialog */}
            <Dialog open={viewOpen} onOpenChange={setViewOpen}>
                <DialogContent className="max-w-6xl max-h-[95vh] overflow-y-auto p-0 gap-0">
                    <DialogHeader className="p-8 pb-4 border-b bg-muted/20">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-primary/10 rounded-xl border border-primary/20 shadow-sm">
                                    <Building2 className="w-6 h-6 text-primary" />
                                </div>
                                <div>
                                    <DialogTitle className="text-2xl font-bold tracking-tight">{viewingWarehouse?.name}</DialogTitle>
                                    <DialogDescription className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                                        Warehouse ID: <span className="font-mono text-xs">{viewingWarehouse?.id}</span>
                                    </DialogDescription>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <Badge variant={viewingWarehouse?.is_active ? "default" : "secondary"} className="px-3 py-1 text-xs font-bold uppercase tracking-wider">
                                    {viewingWarehouse?.is_active ? "Active" : "Inactive"}
                                </Badge>
                            </div>
                        </div>
                    </DialogHeader>

                    <div className="p-8 bg-background/50">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                            {/* 1. General Information */}
                            <div className="flex flex-col h-full space-y-4">
                                <h4 className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2 px-1">
                                    <Info className="w-3.5 h-3.5 text-primary" />
                                    General Information
                                </h4>
                                <div className="flex-1 space-y-4 rounded-2xl border p-5 bg-card/50 shadow-sm">
                                    <div className="space-y-1">
                                        <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Warehouse Code</span>
                                        <p className="text-sm font-black font-mono text-primary">{viewingWarehouse?.code}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Description</span>
                                        <p className="text-sm font-medium leading-relaxed">{viewingWarehouse?.description || "No description provided"}</p>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4 pt-2">
                                        <div className="space-y-1">
                                            <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Time Zone</span>
                                            <p className="text-xs font-bold">{viewingWarehouse?.time_zone || "UTC"}</p>
                                        </div>
                                        <div className="space-y-1">
                                            <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Status</span>
                                            <p className="text-xs font-bold">{viewingWarehouse?.is_active ? "Operational" : "Offline"}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* 2. Location Intelligence */}
                            <div className="flex flex-col h-full space-y-4">
                                <h4 className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2 px-1">
                                    <MapPin className="w-3.5 h-3.5 text-primary" />
                                    Location Intelligence
                                </h4>
                                <div className="flex-1 space-y-4 rounded-2xl border p-5 bg-card/50 shadow-sm">
                                    <div className="space-y-1">
                                        <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Address</span>
                                        <p className="text-sm font-medium">
                                            {viewingWarehouse?.address_line1}
                                            {viewingWarehouse?.address_line2 && <><br />{viewingWarehouse.address_line2}</>}
                                        </p>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1">
                                            <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">City / State</span>
                                            <p className="text-xs font-bold">{viewingWarehouse?.city}, {viewingWarehouse?.state}</p>
                                        </div>
                                        <div className="space-y-1">
                                            <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Country</span>
                                            <p className="text-xs font-bold">{viewingWarehouse?.country}</p>
                                        </div>
                                    </div>
                                    <div className="space-y-1 pt-2">
                                        <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Postal Code</span>
                                        <p className="text-sm font-mono font-black tracking-widest">{viewingWarehouse?.postal_code || "—"}</p>
                                    </div>
                                </div>
                            </div>

                            {/* 3. Contact & Liaison */}
                            <div className="flex flex-col h-full space-y-4">
                                <h4 className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2 px-1">
                                    <Phone className="w-3.5 h-3.5 text-primary" />
                                    Contact & Liaison
                                </h4>
                                <div className="flex-1 space-y-4 rounded-2xl border p-5 bg-card/50 shadow-sm">
                                    <div className="space-y-1">
                                        <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Primary Contact</span>
                                        <div className="flex items-center gap-2">
                                            <User className="w-4 h-4 text-primary" />
                                            <p className="text-sm font-bold">{viewingWarehouse?.contact_person}</p>
                                        </div>
                                    </div>
                                    <div className="space-y-4 pt-2">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-primary/5 rounded-lg border border-primary/10">
                                                <Mail className="w-4 h-4 text-primary" />
                                            </div>
                                            <div className="overflow-hidden">
                                                <p className="text-[9px] text-muted-foreground uppercase font-bold tracking-wider">Digital Node</p>
                                                <p className="text-xs font-mono font-bold truncate">{viewingWarehouse?.contact_email}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-primary/5 rounded-lg border border-primary/10">
                                                <Phone className="w-4 h-4 text-primary" />
                                            </div>
                                            <div>
                                                <p className="text-[9px] text-muted-foreground uppercase font-bold tracking-wider">Direct Line</p>
                                                <p className="text-xs font-mono font-bold">{viewingWarehouse?.contact_phone}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* 4. Specifications & Protocol */}
                            <div className="flex flex-col h-full space-y-4">
                                <h4 className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2 px-1">
                                    <Activity className="w-3.5 h-3.5 text-primary" />
                                    Specifications & Protocol
                                </h4>
                                <div className="flex-1 space-y-5 rounded-2xl border p-5 bg-card/50 shadow-sm flex flex-col justify-center">
                                    <div className="flex items-center justify-between p-3 bg-primary/5 rounded-xl border border-primary/10">
                                        <div className="space-y-1">
                                            <span className="text-[10px] text-primary/70 uppercase font-black tracking-wider">Total Area</span>
                                            <div className="text-2xl font-black text-primary tracking-tighter">
                                                {Number(viewingWarehouse?.total_area_sqft || 0).toLocaleString()} <span className="text-[10px] font-bold ml-1">SQFT</span>
                                            </div>
                                        </div>
                                        <div className="w-12 h-12 rounded-full border-2 border-primary/20 flex items-center justify-center bg-primary/5">
                                            <Ruler className="w-6 h-6 text-primary/60" />
                                        </div>
                                    </div>
                                    <div className="space-y-4 pt-2">
                                        <div className="flex justify-between items-center text-xs">
                                            <span className="text-muted-foreground font-semibold">Rules Profile</span>
                                            <Badge variant="outline" className="font-black border-primary/20 text-primary">{viewingWarehouse?.default_rules_profile || "STANDARD"}</Badge>
                                        </div>
                                        <div className="flex justify-between items-center text-xs">
                                            <span className="text-muted-foreground font-semibold">Max Pallet Positions</span>
                                            <span className="text-sm font-black font-mono">{viewingWarehouse?.max_pallet_positions || 0}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* 5. Capacity & Performance */}
                            <div className="flex flex-col h-full space-y-4">
                                <h4 className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2 px-1">
                                    <Truck className="w-3.5 h-3.5 text-primary" />
                                    Capacity & Performance
                                </h4>
                                <div className="flex-1 space-y-6 rounded-2xl border p-5 bg-card/50 shadow-sm flex flex-col justify-center">
                                    <div className="space-y-2">
                                        <span className="text-[10px] text-muted-foreground uppercase font-black tracking-wider text-center block w-full">Total Volume</span>
                                        <div className="p-3 bg-background rounded-lg border font-mono text-xl font-black tracking-tighter text-center shadow-sm">
                                            {viewingWarehouse?.total_volume_cc ? Number(viewingWarehouse.total_volume_cc).toLocaleString() : 0} <span className="text-[10px] text-muted-foreground uppercase ml-1">cc</span>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="flex flex-col items-center p-3 rounded-xl bg-muted/20 border text-center">
                                            <span className="text-[8px] text-muted-foreground uppercase font-black mb-1">Active Status</span>
                                            <div className="flex items-center gap-1.5">
                                                <div className={`w-2 h-2 rounded-full ${viewingWarehouse?.is_active ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" : "bg-red-500"}`} />
                                                <span className="text-[10px] font-black uppercase italic">{viewingWarehouse?.is_active ? "Operational" : "Offline"}</span>
                                            </div>
                                        </div>
                                        <div className="flex flex-col items-center p-3 rounded-xl bg-muted/20 border text-center">
                                            <span className="text-[8px] text-muted-foreground uppercase font-black mb-1">Registry Year</span>
                                            <span className="text-[10px] font-black text-white uppercase italic">{new Date(viewingWarehouse?.created_at || Date.now()).getFullYear()}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* 6. Metrics & Audit */}
                            <div className="flex flex-col h-full space-y-4">
                                <h4 className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2 px-1">
                                    <Box className="w-3.5 h-3.5 text-primary" />
                                    Metrics & Audit
                                </h4>
                                <div className="flex-1 space-y-6 rounded-2xl border p-6 bg-card shadow-inner border-primary/20 flex flex-col justify-center bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-primary/5 via-transparent to-transparent">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div
                                            className="p-3 bg-background/50 rounded-xl border border-primary/10 text-center cursor-pointer hover:bg-muted/30 transition-colors group relative"
                                            onClick={() => void handleTotalZonesClick()}
                                        >
                                            <p className="text-[8px] text-muted-foreground uppercase font-bold tracking-wider mb-1 group-hover:text-primary transition-colors">Total Zones</p>
                                            <p className="text-xl font-black text-primary">
                                                {liveZonesCount !== null
                                                    ? liveZonesCount
                                                    : (viewingWarehouse?.zones_count ??
                                                        viewingWarehouse?.zone_count ??
                                                        viewingWarehouse?.total_zones ??
                                                        viewingWarehouse?.totalZones ??
                                                        (Array.isArray(viewingWarehouse?.zones) ? viewingWarehouse.zones.length : 0) ??
                                                        0)}
                                            </p>
                                            <div className="absolute top-1 right-1 opacity-100 group-hover:opacity-100 transition-opacity">
                                                <Button size="icon" variant="ghost" className="h-5 w-5 rounded-full" onClick={(e) => { e.stopPropagation(); setAddZoneOpen(true); }}>
                                                    <Plus className="h-3 w-3" />
                                                </Button>
                                            </div>
                                        </div>
                                        <div
                                            className="p-3 bg-background/50 rounded-xl border border-primary/10 text-center cursor-pointer hover:bg-muted/30 transition-colors group relative"
                                            onClick={() => setPalletListOpen(true)}
                                        >
                                            <p className="text-[8px] text-muted-foreground uppercase font-bold tracking-wider mb-1 group-hover:text-primary transition-colors">Total Pallets</p>
                                            <p className="text-xl font-black text-primary">
                                                {livePalletsCount !== null
                                                    ? livePalletsCount
                                                    : (viewingWarehouse?.pallets_count ??
                                                        viewingWarehouse?.pallet_count ??
                                                        viewingWarehouse?.total_pallets ??
                                                        viewingWarehouse?.totalPallets ??
                                                        (Array.isArray(viewingWarehouse?.pallets) ? viewingWarehouse.pallets.length : 0) ??
                                                        0)}
                                            </p>
                                            <div className="absolute top-1 right-1 opacity-100 group-hover:opacity-100 transition-opacity">
                                                <Button size="icon" variant="ghost" className="h-5 w-5 rounded-full" onClick={(e) => { e.stopPropagation(); setAddPalletOpen(true); }}>
                                                    <Plus className="h-3 w-3" />
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Total Bin Inventory</span>
                                        </div>
                                        <div className="p-3 bg-primary/10 rounded-lg border border-primary/20 font-mono text-sm font-black tracking-wider text-center text-primary shadow-sm">
                                            {viewingWarehouse?.bins_count || 0} POSITIONS
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="p-6 border-t bg-muted/10 flex justify-end gap-3 px-8">
                        <Button
                            variant="outline"
                            size="lg"
                            className="rounded-xl px-8 font-bold text-xs uppercase tracking-wider h-12 shadow-sm"
                            onClick={() => setViewOpen(false)}
                        >
                            Close Details
                        </Button>
                        <Button
                            size="lg"
                            className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl px-8 font-bold text-xs uppercase tracking-wider h-12 shadow-md transition-all active:scale-[0.98]"
                            onClick={() => { setViewOpen(false); handleEdit(viewingWarehouse); }}
                        >
                            Edit Facility
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Zone Management Modals */}
            <AddZoneModal
                open={addZoneOpen}
                setOpen={setAddZoneOpen}
                warehouseId={viewingWarehouse?.id || viewingWarehouse?.code}
                onSuccess={() => {
                    // Refresh data after adding zone
                    fetchWarehouses();
                    if (viewingWarehouse) {
                        const currentZonesCount = Number(
                            viewingWarehouse.zones_count ??
                            viewingWarehouse.zone_count ??
                            viewingWarehouse.total_zones ??
                            viewingWarehouse.totalZones ??
                            0
                        ) || 0;

                        setViewingWarehouse({
                            ...viewingWarehouse,
                            zones_count: currentZonesCount + 1,
                            zone_count: currentZonesCount + 1,
                        });
                        fetchLiveCounts(viewingWarehouse.id);
                    }
                }}
            />

            <ZoneListModal
                open={zoneListOpen}
                setOpen={setZoneListOpen}
                warehouseId={viewingWarehouse?.id || viewingWarehouse?.code}
                warehouseName={viewingWarehouse?.name}
                onAddZone={() => setAddZoneOpen(true)}
            />

            <PalletListModal
                open={palletListOpen}
                setOpen={setPalletListOpen}
                warehouseId={viewingWarehouse?.id || null}
                warehouseName={viewingWarehouse?.name}
                openCreateOnLoad={openCreatePalletOnLoad}
                onCreateHandled={() => setOpenCreatePalletOnLoad(false)}
                onSuccess={() => {
                    fetchWarehouses();
                    if (viewingWarehouse) {
                        fetchLiveCounts(viewingWarehouse.id || viewingWarehouse.code, viewingWarehouse.code);
                    }
                }}
            />

            {/* Add Pallet Modal */}
            <AddPalletModal
                open={addPalletOpen}
                setOpen={setAddPalletOpen}
                warehouseId={viewingWarehouse?.id || null}
                warehouseName={viewingWarehouse?.name}
                onSuccess={() => {
                    fetchWarehouses();
                    if (viewingWarehouse) {
                        const currentPalletsCount = Number(
                            viewingWarehouse.pallets_count ??
                            viewingWarehouse.pallet_count ??
                            viewingWarehouse.total_pallets ??
                            viewingWarehouse.totalPallets ??
                            0
                        ) || 0;

                        setViewingWarehouse({
                            ...viewingWarehouse,
                            pallets_count: currentPalletsCount + 1,
                            pallet_count: currentPalletsCount + 1,
                        });
                        fetchLiveCounts(viewingWarehouse.id || viewingWarehouse.code, viewingWarehouse.code);
                    }
                }}
            />

            {/* Edit Sheet */}
            <Dialog open={editOpen} onOpenChange={setEditOpen}>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-heading font-bold">Edit Warehouse Facility</DialogTitle>
                        <DialogDescription>
                            Update the details for "{editingWarehouse?.name}"
                        </DialogDescription>
                    </DialogHeader>

                    <Form {...editForm}>
                        <form ref={editFormRef} onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-8 pt-4">

                            {/* Section 1: Basic Information */}
                            <div className="space-y-4">
                                <div>
                                    <h3 className="text-sm font-semibold text-primary uppercase tracking-wider flex items-center gap-2">
                                        <Info className="w-4 h-4" /> Basic Information
                                    </h3>
                                    <Separator className="mt-2" />
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <FormField
                                        control={editForm.control}
                                        name="name"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Warehouse Name *</FormLabel>
                                                <FormControl>
                                                    <Input {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={editForm.control}
                                        name="description"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Description *</FormLabel>
                                                <FormControl>
                                                    <Textarea className="resize-none" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>
                            </div>

                            {/* Section 2: Address Details */}
                            <div className="space-y-4">
                                <div>
                                    <h3 className="text-sm font-semibold text-primary uppercase tracking-wider flex items-center gap-2">
                                        <MapPin className="w-4 h-4" /> Address Details
                                    </h3>
                                    <Separator className="mt-2" />
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <FormField
                                        control={editForm.control}
                                        name="address_line1"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Address Line 1 <span className="text-destructive">*</span></FormLabel>
                                                <FormControl>
                                                    <Input {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={editForm.control}
                                        name="address_line2"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Address Line 2</FormLabel>
                                                <FormControl>
                                                    <Input {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={editForm.control}
                                        name="country"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Country *</FormLabel>
                                                <Select onValueChange={field.onChange} value={field.value}>
                                                    <FormControl>
                                                        <SelectTrigger>
                                                            <SelectValue placeholder="Select Country" />
                                                        </SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent>
                                                        {countries.map(c => (
                                                            <SelectItem key={c.shortName} value={c.shortName}>{c.name}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={editForm.control}
                                        name="state"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>State *</FormLabel>
                                                <Select
                                                    onValueChange={field.onChange}
                                                    value={field.value}
                                                    disabled={!editCountry}
                                                >
                                                    <FormControl>
                                                        <SelectTrigger>
                                                            <SelectValue placeholder={editCountry ? "Select State" : "Select Country First"} />
                                                        </SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent>
                                                        {filteredStatesEdit.map(s => (
                                                            <SelectItem key={s} value={s}>{s}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={editForm.control}
                                        name="city"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>City *</FormLabel>
                                                <Select
                                                    onValueChange={field.onChange}
                                                    value={field.value}
                                                    disabled={!editState}
                                                >
                                                    <FormControl>
                                                        <SelectTrigger>
                                                            <SelectValue placeholder={editState ? "Select City" : "Select State First"} />
                                                        </SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent>
                                                        {filteredCitiesEdit.map(city => (
                                                            <SelectItem key={city} value={city}>{city}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={editForm.control}
                                        name="postal_code"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Postal Code *</FormLabel>
                                                <FormControl>
                                                    <Input {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>
                            </div>

                            {/* Section 3: Contact Information */}
                            <div className="space-y-4">
                                <div>
                                    <h3 className="text-sm font-semibold text-primary uppercase tracking-wider flex items-center gap-2">
                                        <Phone className="w-4 h-4" /> Contact Information
                                    </h3>
                                    <Separator className="mt-2" />
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <FormField
                                        control={editForm.control}
                                        name="contact_person"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Contact Person <span className="text-destructive">*</span></FormLabel>
                                                <FormControl>
                                                    <Input {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={editForm.control}
                                        name="contact_email"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Contact Email <span className="text-destructive">*</span></FormLabel>
                                                <FormControl>
                                                    <Input type="email" placeholder="user@example.com" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={editForm.control}
                                        name="contact_phone"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Contact Phone <span className="text-destructive">*</span></FormLabel>
                                                <FormControl>
                                                    <PhoneInput
                                                        value={field.value || ""}
                                                        countryCode={editForm.watch("contact_phone_country_code") || "+971"}
                                                        onPhoneChange={field.onChange}
                                                        onCountryCodeChange={(v) => editForm.setValue("contact_phone_country_code", v)}
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>
                            </div>

                            {/* Section 4: Configuration */}
                            <div className="space-y-4">
                                <div>
                                    <h3 className="text-sm font-semibold text-primary uppercase tracking-wider flex items-center gap-2">
                                        <Settings2 className="w-4 h-4" /> Configuration
                                    </h3>
                                    <Separator className="mt-2" />
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <FormField
                                        control={editForm.control}
                                        name="time_zone"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Time Zone <span className="text-destructive">*</span></FormLabel>
                                                <FormControl>
                                                    <Input placeholder="e.g. Asia/Dubai" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={editForm.control}
                                        name="default_rules_profile"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Default Rules Profile <span className="text-destructive">*</span></FormLabel>
                                                <FormControl>
                                                    <Input placeholder="e.g. STANDARD" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>
                            </div>

                            {/* Section 5: Capacity Details */}
                            <div className="space-y-4">
                                <div>
                                    <h3 className="text-sm font-semibold text-primary uppercase tracking-wider flex items-center gap-2">
                                        <Truck className="w-4 h-4" /> Capacity Details
                                    </h3>
                                    <Separator className="mt-2" />
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <FormField
                                        control={editForm.control}
                                        name="total_area_sqft"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Total Area (sqft) <span className="text-destructive">*</span></FormLabel>
                                                <FormControl>
                                                    <Input type="number" min="0" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={editForm.control}
                                        name="total_volume_cc"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Total Volume (cc) <span className="text-destructive">*</span></FormLabel>
                                                <FormControl>
                                                    <Input type="number" min="0" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={editForm.control}
                                        name="max_pallet_positions"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Max Pallet Positions <span className="text-destructive">*</span></FormLabel>
                                                <FormControl>
                                                    <Input type="number" min="0" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>
                            </div>

                            {/* Section 6: Status */}
                            <div className="space-y-4">
                                <div>
                                    <h3 className="text-sm font-semibold text-primary uppercase tracking-wider flex items-center gap-2">
                                        <Activity className="w-4 h-4" /> Status
                                    </h3>
                                    <Separator className="mt-2" />
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <FormField
                                        control={editForm.control}
                                        name="is_active"
                                        render={({ field }) => (
                                            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                                                <div className="space-y-0.5">
                                                    <FormLabel className="text-base text-foreground">Active Facility</FormLabel>
                                                </div>
                                                <FormControl>
                                                    <Switch
                                                        checked={field.value}
                                                        onCheckedChange={field.onChange}
                                                    />
                                                </FormControl>
                                            </FormItem>
                                        )}
                                    />
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 pt-6 border-t">
                                <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>
                                    Cancel
                                </Button>
                                <Button type="submit" disabled={loading}>
                                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                                    Update Warehouse
                                </Button>
                            </div>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default WarehouseManagement;
