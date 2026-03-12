import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { asnService } from "@/services/asnService";
import { inboundService } from "@/services/inboundService";
import { vendorService } from "@/services/vendorService";
import { skuService } from "@/services/skuService";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Plus, Trash2, FileText, LayoutList, Loader2, Eye, Save } from "lucide-react";
import { toast } from "sonner";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
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
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { useEffect } from "react";
import { useDebounce } from "use-debounce";


interface AsnItem {
    sku: string;
    description: string;
    quantity: number;
    unit: string;
    unit_price: number;
    total_price: number;
    lot: string;
    expiry_date: string;
    hsn_code: string;
}

interface Shipment {
    po_numbers: string[];
    supplier_code: string;
    items: AsnItem[];
}

interface AsnForm {
    asn_number: string;
    asn_date: string;
    shipment_id: string;
    expected_date: string;
    status: string;
    notes: string;
    supplier_code: string;
    shipments: Shipment[];
}

interface SupplierOption {
    code: string;
    name: string;
}

const CreateAsn = () => {
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(false);
    const [isStatusUpdating, setIsStatusUpdating] = useState(false);


    // Generate initial values
    const today = new Date().toISOString().split('T')[0];
    const initialAsnNumber = `ASN-${new Date().getFullYear()}-${Math.floor(Math.random() * 900) + 100}`;

    const [allSuppliers, setAllSuppliers] = useState<SupplierOption[]>([]);
    const [allItems, setAllItems] = useState<any[]>([]);
    const [pendingItemRow, setPendingItemRow] = useState<{ sIdx: number, iIdx: number } | null>(null);

    const [supplierSearch, setSupplierSearch] = useState("");
    const [supplierInput, setSupplierInput] = useState("");
    const [isSupplierDropdownOpen, setIsSupplierDropdownOpen] = useState(false);
    const [debouncedSupplierSearch] = useDebounce(supplierSearch, 500);
    const [itemSearch, setItemSearch] = useState("");
    const [debouncedItemSearch] = useDebounce(itemSearch, 500);

    const [isSearchingItems, setIsSearchingItems] = useState(false);


    const performSupplierSearch = async (query: string) => {
        try {
            const data = await vendorService.search(query);
            const normalized = (Array.isArray(data) ? data : []).map((s: Record<string, unknown>) => ({
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
            setAllItems(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error("Failed to search items", error);
        } finally {
            setIsSearchingItems(false);
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

    const handleStatusUpdate = async (newStatus: "draft" | "completed") => {
        setIsStatusUpdating(true);
        try {
            await inboundService.updateASN(form.asn_number, { status: newStatus });
            setForm(prev => ({ ...prev, status: newStatus }));
            toast.success(`ASN status updated to ${newStatus}`);
        } catch (error) {
            console.error("Failed to update status", error);
            toast.error("Failed to update status");
        } finally {
            setIsStatusUpdating(false);
        }
    };





    const [form, setForm] = useState<AsnForm>({
        asn_number: initialAsnNumber,
        asn_date: new Date().toISOString(),
        shipment_id: "",
        expected_date: "",
        status: "draft",
        notes: "",
        supplier_code: "",
        shipments: [
            {
                po_numbers: [""],
                supplier_code: "",
                items: [{
                    sku: "",
                    description: "",
                    quantity: 0,
                    unit: "PCS",
                    unit_price: 0,
                    total_price: 0,
                    lot: "",
                    expiry_date: today,
                    hsn_code: ""
                }]
            }
        ]
    });

    // Top-level handlers
    const updateForm = (field: keyof AsnForm, value: string) => {
        setForm(prev => ({ ...prev, [field]: value }));
    };

    // Shipment Handlers
    const addShipment = () => {
        setForm(prev => ({
            ...prev,
            shipments: [
                ...prev.shipments,
                {
                    po_numbers: [""],
                    supplier_code: prev.supplier_code,
                    items: [{
                        sku: "",
                        description: "",
                        quantity: 0,
                        unit: "PCS",
                        unit_price: 0,
                        total_price: 0,
                        lot: "",
                        expiry_date: today,
                        hsn_code: ""
                    }]
                }
            ]
        }));
    };

    const removeShipment = (shipmentIndex: number) => {
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

    const addPoNumber = (shipmentIdx: number) => {
        setForm(prev => {
            const newShipments = [...prev.shipments];
            newShipments[shipmentIdx].po_numbers.push("");
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
                sku: "",
                description: "",
                quantity: 0,
                unit: "PCS",
                unit_price: 0,
                total_price: 0,
                lot: "",
                expiry_date: today,
                hsn_code: ""
            });
            return { ...prev, shipments: newShipments };
        });
    };

    const removeItem = (shipmentIndex: number, itemIndex: number) => {
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
            status: form.status,
            notes: form.notes,
            supplier_code: form.supplier_code,
            shipments: form.shipments.map(s => ({
                po_number: s.po_numbers.filter(po => po.trim() !== "").join(", "),
                supplier_code: s.supplier_code,
                items: s.items.map(item => ({
                    sku: item.sku,
                    description: item.description || "",
                    quantity: Number(item.quantity) || 0,
                    unit: item.unit,
                    unit_price: Number(item.unit_price) || 0,
                    total_price: Number(item.total_price) || 0,
                    lot: item.lot || "",
                    expiry_date: item.expiry_date, // Simple YYYY-MM-DD from input[type="date"]
                    hsn_code: item.hsn_code
                }))
            }))
        };
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

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
                <div>
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button
                                variant="outline"
                                className="bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 hover:text-blue-800"
                                disabled={isStatusUpdating}
                            >
                                {isStatusUpdating ? (
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                ) : null}
                                {form.status === 'draft' ? "📝 Draft" : "✅ Completed"}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-40 p-1" align="end">
                            <Button
                                variant="ghost"
                                className="w-full justify-start text-sm"
                                onClick={() => handleStatusUpdate('draft')}
                            >
                                📝 Draft
                            </Button>
                            <Button
                                variant="ghost"
                                className="w-full justify-start text-sm"
                                onClick={() => handleStatusUpdate('completed')}
                            >
                                ✅ Completed
                            </Button>
                        </PopoverContent>
                    </Popover>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-8">


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
                                id="expectedDate"
                                type="date"
                                value={form.expected_date}
                                onChange={(e) => updateForm('expected_date', e.target.value)}
                                required
                            />
                        </div>
                        <div className="space-y-2 lg:col-span-2 relative">
                            <Label htmlFor="supplierLookup">Supplier <span className="text-destructive">*</span></Label>
                            <div className="relative">
                                <Input
                                    id="supplierLookup"
                                    placeholder="Type supplier name..."
                                    value={supplierInput}
                                    onFocus={() => setIsSupplierDropdownOpen(true)}
                                    onBlur={() => setTimeout(() => setIsSupplierDropdownOpen(false), 150)}
                                    onChange={(e) => {
                                        const value = e.target.value;
                                        setSupplierInput(value);
                                        setSupplierSearch(value);
                                        setIsSupplierDropdownOpen(true);
                                        if (!value.trim()) {
                                            updateForm('supplier_code', '');
                                        }
                                    }}
                                    required
                                />

                                {isSupplierDropdownOpen && supplierInput.trim() && (
                                    <div className="absolute z-30 mt-1 w-full rounded-md border border-border bg-popover shadow-md max-h-56 overflow-y-auto">
                                        {allSuppliers.length === 0 ? (
                                            <div className="px-3 py-2 text-sm text-muted-foreground">No supplier found.</div>
                                        ) : (
                                            allSuppliers.map((s) => (
                                                <button
                                                    key={`${s.code}-${s.name}`}
                                                    type="button"
                                                    className="w-full px-3 py-2 text-left hover:bg-muted transition-colors"
                                                    onMouseDown={(evt) => evt.preventDefault()}
                                                    onClick={() => {
                                                        updateForm('supplier_code', s.code);
                                                        setForm(prev => ({
                                                            ...prev,
                                                            supplier_code: s.code,
                                                            shipments: prev.shipments.map(sh => ({
                                                                ...sh,
                                                                supplier_code: sh.supplier_code || s.code,
                                                            })),
                                                        }));
                                                        setSupplierInput(s.name);
                                                        setSupplierSearch(s.name);
                                                        setIsSupplierDropdownOpen(false);
                                                    }}
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
                            {form.supplier_code && (
                                <p className="text-xs text-muted-foreground">
                                    Selected supplier code: <span className="font-medium text-foreground">{form.supplier_code}</span>
                                </p>
                            )}
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

                {/* 2️⃣ Shipments Section */}
                <div className="space-y-6">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xl font-bold flex items-center gap-2">
                            <LayoutList className="w-5 h-5" />
                            Shipments
                        </h2>
                        <Button type="button" onClick={addShipment} variant="secondary" className="gap-2">
                            <Plus className="w-4 h-4" /> Add Shipment
                        </Button>
                    </div>

                    {form.shipments.map((shipment, sIdx) => (
                        <Card key={`shipment-${sIdx}`} className="border-border shadow-md border-t-4 border-t-primary/60">
                            <CardHeader className="pb-4 flex flex-row items-center justify-between bg-muted/20">
                                <div>
                                    <CardTitle className="text-base text-primary flex items-center gap-2">
                                        Shipment #{sIdx + 1}
                                    </CardTitle>
                                </div>
                                {form.shipments.length > 1 && (
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => removeShipment(sIdx)}
                                        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                                    >
                                        <Trash2 className="w-4 h-4 mr-2" /> Remove Shipment
                                    </Button>
                                )}
                            </CardHeader>
                            <CardContent className="pt-6 space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 bg-muted/30 rounded-lg border border-border/50">
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between">
                                            <Label className="text-sm font-semibold">Purchase Order Numbers <span className="text-destructive">*</span></Label>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={() => addPoNumber(sIdx)}
                                                className="h-7 text-[10px] gap-1"
                                            >
                                                <Plus className="w-3 h-3" /> Add PO
                                            </Button>
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
                                                            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </button>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Supplier Code <span className="text-destructive">*</span></Label>
                                        <Input
                                            placeholder="Supplier code for this shipment"
                                            value={shipment.supplier_code || ""}
                                            onChange={(e) => updateShipment(sIdx, 'supplier_code', e.target.value)}
                                            required
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
                                    <div className="border rounded-md overflow-x-auto min-w-full">
                                        <div className="min-w-[1050px]">
                                            <div className="grid grid-cols-[180px_minmax(150px,1fr)_80px_70px_100px_100px_100px_100px_130px_40px] gap-3 py-3 bg-muted/50 font-medium text-sm text-muted-foreground border-b text-left items-center">
                                                <div>SKU *</div>
                                                <div>Desc</div>
                                                <div>Qty *</div>
                                                <div>Unit</div>
                                                <div>Price</div>
                                                <div>Total</div>
                                                <div>Lot</div>
                                                <div>HSN</div>
                                                <div>Expiry *</div>
                                                <div></div>
                                            </div>
                                            <div className="divide-y">
                                                {shipment.items.map((item, iIdx) => (
                                                    <div key={`item-${sIdx}-${iIdx}`} className="grid grid-cols-[180px_minmax(150px,1fr)_80px_70px_100px_100px_100px_100px_130px_40px] gap-3 py-2 items-center hover:bg-muted/10">
                                                        <div className="min-w-0">
                                                            <Popover open={pendingItemRow?.sIdx === sIdx && pendingItemRow?.iIdx === iIdx}>
                                                                <PopoverTrigger asChild>
                                                                    <div className="relative">
                                                                        <Input
                                                                            placeholder="Search SKU..."
                                                                            value={itemSearch || item.sku || ""}
                                                                            onChange={(e) => {
                                                                                setItemSearch(e.target.value);
                                                                                setPendingItemRow({ sIdx, iIdx });
                                                                                updateItem(sIdx, iIdx, 'sku', e.target.value);
                                                                            }}
                                                                            className="h-9 pr-10 text-xs"
                                                                        />
                                                                        {isSearchingItems && (
                                                                            <div className="absolute right-2 top-2">
                                                                                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </PopoverTrigger>
                                                                <PopoverContent className="p-0 w-[400px]" align="start">
                                                                    <Command shouldFilter={false}>
                                                                        <CommandList>
                                                                            {isSearchingItems && (
                                                                                <div className="p-4 text-xs text-muted-foreground flex items-center justify-center">
                                                                                    <Loader2 className="mr-2 h-3 w-3 animate-spin" /> Searching...
                                                                                </div>
                                                                            )}
                                                                            {!isSearchingItems && allItems.length === 0 && (
                                                                                <CommandEmpty className="p-4 text-xs">
                                                                                    No items found.
                                                                                </CommandEmpty>
                                                                            )}
                                                                            {allItems.length > 0 && (
                                                                                <CommandGroup>
                                                                                    {allItems.map((sku) => (
                                                                                        <CommandItem
                                                                                            key={sku.skuCode}
                                                                                            onSelect={() => {
                                                                                                updateItem(sIdx, iIdx, 'sku', sku.skuCode);
                                                                                                updateItem(sIdx, iIdx, 'description', sku.productName || sku.description || "");
                                                                                                updateItem(sIdx, iIdx, 'unit', sku.baseUom || 'PCS');
                                                                                                updateItem(sIdx, iIdx, 'hsn_code', sku.hsnCode || '');
                                                                                                setItemSearch("");
                                                                                                setPendingItemRow(null);
                                                                                            }}
                                                                                            className="data-[selected='true']:bg-primary data-[selected='true']:text-primary-foreground"
                                                                                        >
                                                                                            <div className="flex flex-col">
                                                                                                <span className="font-medium">{sku.skuCode}</span>
                                                                                                <span className="text-xs text-muted-foreground">{sku.productName || sku.description}</span>
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
                                                                value={item.description || ""}
                                                                onChange={(e) => updateItem(sIdx, iIdx, 'description', e.target.value)}
                                                                className="h-9 text-xs"
                                                            />
                                                        </div>
                                                        <div className="min-w-0">
                                                            <Input
                                                                type="number"
                                                                value={item.quantity || 0}
                                                                onChange={(e) => updateItem(sIdx, iIdx, 'quantity', e.target.value)}
                                                                className="h-9 text-xs"
                                                                required
                                                            />
                                                        </div>
                                                        <div className="min-w-0">
                                                            <Input
                                                                value={item.unit || ""}
                                                                onChange={(e) => updateItem(sIdx, iIdx, 'unit', e.target.value)}
                                                                className="h-9 text-center text-xs"
                                                            />
                                                        </div>
                                                        <div className="min-w-0">
                                                            <Input
                                                                type="number"
                                                                value={item.unit_price || 0}
                                                                onChange={(e) => updateItem(sIdx, iIdx, 'unit_price', e.target.value)}
                                                                className="h-9 text-xs"
                                                            />
                                                        </div>
                                                        <div className="min-w-0">
                                                            <Input
                                                                type="number"
                                                                value={item.total_price || 0}
                                                                readOnly
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
                                                        <div className="min-w-0">
                                                            <Input
                                                                type="date"
                                                                value={item.expiry_date || ""}
                                                                onChange={(e) => updateItem(sIdx, iIdx, 'expiry_date', e.target.value)}
                                                                className="h-9 text-[10px] px-1"
                                                                required
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
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>

                <div className="flex justify-end items-center gap-4 pt-4 pb-12">
                    <Button type="button" variant="outline" className="px-8" onClick={() => navigate('/dashboard/asns')} disabled={isLoading}>
                        Cancel
                    </Button>

                    <Button type="submit" className="gap-2 px-10" disabled={isLoading}>
                        {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        {isLoading ? "Saving..." : "Create ASNRecord"}
                    </Button>
                </div>
            </form>
        </div>
    );
};

export default CreateAsn;
