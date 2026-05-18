import { useState, useEffect, useMemo, useRef } from "react";
import {
    Users, Search, Eye, Edit2, Loader2, ChevronLeft, ChevronRight,
    Filter, ToggleLeft, ToggleRight, Info, Settings2, X, RefreshCw, Plus, 
    LayoutList, Mail, Phone, MapPin, CreditCard, Building2, Trash2
} from "lucide-react";
import { toast } from "sonner";
import { vendorService } from "@/services/vendorService";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { PhoneInput, COUNTRY_DATA, isPhoneValid } from "@/components/ui/PhoneInput";

// ─── Types ──────────────────────────────────────────────────────────────────

interface Supplier {
    id: string | number;
    code: string;
    name: string;
    gstin: string;
    contact_person: string;
    phone: string;
    email: string;
    address: string;
    payment_terms: string;
    active: boolean;
    created_at?: string;
    updated_at?: string;
}

interface SupplierForm {
    code: string;
    name: string;
    gstin: string;
    contact_person: string;
    phone: string;
    country_code: string;
    email: string;
    address: string;
    payment_terms: string;
    active: boolean;
}

const DEFAULT_FORM: SupplierForm = {
    code: "",
    name: "",
    gstin: "",
    contact_person: "",
    phone: "",
    country_code: "+971",
    email: "",
    address: "",
    payment_terms: "",
    active: true,
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

const SupplierViewModal = ({ supplier, open, onClose }: { supplier: Supplier | null; open: boolean; onClose: () => void }) => {
    if (!supplier) return null;
    return (
        <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
            <DialogContent className="max-w-2xl overflow-hidden p-0 flex flex-col max-h-[92vh]">
                <div className="p-6 pb-4 border-b shrink-0 bg-background">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-xl font-heading">
                            <Building2 className="h-5 w-5 text-primary" />
                            {supplier.name}
                            <Badge className={`ml-2 text-[9px] font-black uppercase border-none px-2 py-0.5 flex items-center gap-1 ${supplier.active ? "bg-green-500 text-white" : "bg-destructive text-white"}`}>
                                <span className="h-1 w-1 rounded-full bg-white" />
                                {supplier.active ? "Active" : "Inactive"}
                            </Badge>
                        </DialogTitle>
                        <DialogDescription className="text-sm text-muted-foreground">Supplier Code: {supplier.code}</DialogDescription>
                    </DialogHeader>
                </div>

                <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-6 bg-background/50">
                    <div className="pt-4">
                        <DSep title="Basic Information" icon={<Info className="h-4 w-4" />} />
                        <div className="grid grid-cols-2 gap-x-8 gap-y-1 mt-2">
                            <DRow label="Supplier Code" value={supplier.code} />
                            <DRow label="GSTIN" value={supplier.gstin} />
                            <DRow label="Contact Person" value={supplier.contact_person} />
                            <DRow label="Payment Terms" value={supplier.payment_terms} />
                        </div>
                    </div>

                    <div>
                        <DSep title="Contact Details" icon={<Phone className="h-4 w-4" />} />
                        <div className="grid grid-cols-2 gap-x-8 gap-y-1 mt-2">
                            <DRow label="Email" value={supplier.email} />
                            <DRow label="Phone" value={supplier.phone} />
                        </div>
                    </div>

                    <div>
                        <DSep title="Address" icon={<MapPin className="h-4 w-4" />} />
                        <div className="mt-2">
                            <DRow label="Full Address" value={supplier.address} />
                        </div>
                    </div>

                    {supplier.created_at && (
                        <div className="text-[10px] text-muted-foreground pt-4 border-t italic">
                            Last Updated: {new Date(supplier.updated_at || supplier.created_at).toLocaleString()}
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
};

// ─── Main Component ──────────────────────────────────────────────────────────

const SupplierManagement = () => {
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage] = useState(10);

    // Modals
    const [viewSupplier, setViewSupplier] = useState<Supplier | null>(null);
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
    const [form, setForm] = useState<SupplierForm>(DEFAULT_FORM);
    const [isSaving, setIsSaving] = useState(false);
    const saveButtonRef = useRef<HTMLButtonElement>(null);

    const handlePaymentTermsKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter") {
            e.preventDefault();
            saveButtonRef.current?.focus();
        }
    };

    const fetchSuppliers = async () => {
        setLoading(true);
        try {
            const data = await vendorService.getAll();
            setSuppliers(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error("Failed to fetch suppliers", error);
            toast.error("Failed to load suppliers");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSuppliers();
    }, []);

    // Filtered data
    const filteredSuppliers = useMemo(() => {
        const query = (searchQuery || "").toLowerCase();
        return suppliers.filter(s =>
            (s.name || "").toLowerCase().includes(query) ||
            (s.code || "").toLowerCase().includes(query) ||
            (s.gstin || "").toLowerCase().includes(query) ||
            (s.contact_person || "").toLowerCase().includes(query)
        );
    }, [suppliers, searchQuery]);

    // Pagination
    const totalPages = Math.ceil(filteredSuppliers.length / itemsPerPage);
    const paginatedSuppliers = filteredSuppliers.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    const handleCreate = async () => {
        if (
            !form.code.trim() ||
            !form.name.trim() ||
            !form.gstin.trim() ||
            !form.contact_person.trim() ||
            !form.email.trim() ||
            !form.phone.trim()
        ) {
            toast.error("Supplier code, name, GSTIN, contact person, email, and phone no are required");
            return;
        }

        if (!isPhoneValid(form.phone, form.country_code)) {
            const country = COUNTRY_DATA.find(c => c.code === form.country_code) || COUNTRY_DATA[0];
            toast.error(`Invalid phone length for ${country.country}. Exactly ${country.digits} digits required.`);
            return;
        }

        setIsSaving(true);
        try {
            const payload = {
                ...form,
                phone: `${form.country_code}${form.phone}`
            };
            await vendorService.create(payload);
            toast.success("Supplier created successfully");
            setIsCreateOpen(false);
            setForm(DEFAULT_FORM);
            fetchSuppliers();
        } catch (error: any) {
            const detail = error.response?.data?.detail;
            const errorMsg = typeof detail === 'string' ? detail : (Array.isArray(detail) && detail[0]?.msg ? detail[0].msg : "Failed to create supplier");
            toast.error(errorMsg);
        } finally {
            setIsSaving(false);
        }
    };

    const handleUpdate = async () => {
        if (!editingSupplier) return;
        if (
            !form.code.trim() ||
            !form.name.trim() ||
            !form.gstin.trim() ||
            !form.contact_person.trim() ||
            !form.email.trim() ||
            !form.phone.trim()
        ) {
            toast.error("Supplier code, name, GSTIN, contact person, email, and phone no are required");
            return;
        }

        if (!isPhoneValid(form.phone, form.country_code)) {
            const country = COUNTRY_DATA.find(c => c.code === form.country_code) || COUNTRY_DATA[0];
            toast.error(`Invalid phone length for ${country.country}. Exactly ${country.digits} digits required.`);
            return;
        }

        setIsSaving(true);
        try {
            const payload = {
                ...form,
                phone: `${form.country_code}${form.phone}`
            };
            await vendorService.patch(editingSupplier.id, payload);
            toast.success("Supplier updated successfully");
            setIsEditOpen(false);
            setEditingSupplier(null);
            fetchSuppliers();
        } catch (error: any) {
            const detail = error.response?.data?.detail;
            const errorMsg = typeof detail === 'string' ? detail : (Array.isArray(detail) && detail[0]?.msg ? detail[0].msg : "Failed to update supplier");
            toast.error(errorMsg);
        } finally {
            setIsSaving(false);
        }
    };

    const toggleStatus = async (supplier: Supplier) => {
        try {
            await vendorService.patch(supplier.id, { active: !supplier.active });
            toast.success(`Supplier ${!supplier.active ? "activated" : "deactivated"}`);
            fetchSuppliers();
        } catch (error) {
            toast.error("Failed to update status");
        }
    };

    const openEdit = (supplier: Supplier) => {
        setEditingSupplier(supplier);
        
        // Split phone into country code and number
        let country_code = "+971";
        let phone = supplier.phone || "";
        for (const country of COUNTRY_DATA) {
            if (phone.startsWith(country.code)) {
                country_code = country.code;
                phone = phone.substring(country.code.length);
                break;
            }
        }

        setForm({
            code: supplier.code,
            name: supplier.name,
            gstin: supplier.gstin,
            contact_person: supplier.contact_person,
            phone,
            country_code,
            email: supplier.email,
            address: supplier.address,
            payment_terms: supplier.payment_terms,
            active: supplier.active,
        });
        setIsEditOpen(true);
    };

    return (
        <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
            {/* Header section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card p-6 rounded-xl border shadow-sm">
                <div>
                    <h1 className="font-heading text-3xl font-bold">Supplier Management</h1>
                    <p className="text-muted-foreground mt-1 text-sm tracking-wide">Manage your vendors, contacts, and trade terms.</p>
                </div>
                <div className="flex items-center gap-3">
                    <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={fetchSuppliers} 
                        className="h-10 px-4"
                    >
                        <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
                        Refresh
                    </Button>
                    <Button 
                        size="sm" 
                        onClick={() => { setForm(DEFAULT_FORM); setIsCreateOpen(true); }}
                        className="h-10 px-6 shadow-lg shadow-primary/20"
                    >
                        <Plus className="h-4 w-4 mr-2" />
                        Add Supplier
                    </Button>
                </div>
            </div>

            {/* Controls Section */}
            <Card className="border-none shadow-none bg-transparent">
                <CardContent className="p-0 flex flex-col md:flex-row gap-4 items-center justify-between">
                    <div className="relative w-full md:w-96 group">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search by name, code, or GSTIN..."
                            className="pl-10 h-11 bg-card border-muted-foreground/20"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground bg-muted/30 px-3 py-1.5 rounded-full border">
                        <Info className="h-3.5 w-3.5 text-primary" />
                        Total: {filteredSuppliers.length} Suppliers
                    </div>
                </CardContent>
            </Card>

            {/* Table Section */}
            <div className="bg-card rounded-xl border shadow-sm overflow-hidden min-h-[400px]">
                <Table>
                    <TableHeader className="bg-muted/30">
                        <TableRow className="border-b border-muted">
                            <TableHead className="w-[120px] font-bold text-xs uppercase tracking-widest py-4">Code</TableHead>
                            <TableHead className="font-bold text-xs uppercase tracking-widest py-4">Name</TableHead>
                            <TableHead className="font-bold text-xs uppercase tracking-widest py-4">Contact</TableHead>
                            <TableHead className="font-bold text-xs uppercase tracking-widest py-4">GSTIN</TableHead>
                            <TableHead className="font-bold text-xs uppercase tracking-widest py-4">Phone</TableHead>
                            <TableHead className="w-[100px] text-center font-bold text-xs uppercase tracking-widest py-4">Status</TableHead>
                            <TableHead className="w-[120px] text-right font-bold text-xs uppercase tracking-widest py-4 pr-6">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={7} className="h-64 text-center">
                                    <div className="flex flex-col items-center justify-center gap-3">
                                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                        <p className="text-sm text-muted-foreground font-medium animate-pulse">Fetching supplier data...</p>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : paginatedSuppliers.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={7} className="h-64 text-center">
                                    <div className="flex flex-col items-center justify-center gap-2 opacity-60">
                                        <Search className="h-10 w-10 text-muted-foreground mb-2" />
                                        <p className="text-lg font-semibold text-foreground">No suppliers found</p>
                                        <p className="text-sm text-muted-foreground">Try adjusting your search query.</p>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : (
                            paginatedSuppliers.map((supplier) => (
                                <TableRow key={supplier.id} className="border-b border-muted/50 last:border-none hover:bg-transparent">
                                    <TableCell className="py-4 font-mono text-[13px] font-bold text-primary/80">{supplier.code}</TableCell>
                                    <TableCell className="py-4">
                                        <div className="flex flex-col">
                                            <span className="font-bold text-sm text-foreground tracking-tight">{supplier.name}</span>
                                            <span className="text-[11px] text-muted-foreground truncate max-w-[200px]">{supplier.email || "No email"}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="py-4 text-sm font-medium">{supplier.contact_person}</TableCell>
                                    <TableCell className="py-4 text-xs font-mono text-muted-foreground">{supplier.gstin}</TableCell>
                                    <TableCell className="py-4 text-[13px] font-medium">{supplier.phone}</TableCell>
                                    <TableCell className="py-4 text-center">
                                        <Badge 
                                            variant="outline"
                                            className={`text-[10px] font-black uppercase tracking-tighter px-2 py-0.5 border flex items-center gap-1 mx-auto w-fit ${
                                                supplier.active 
                                                    ? "bg-green-500/5 text-green-600 border-green-500/20" 
                                                    : "bg-destructive/5 text-destructive border-destructive/20"
                                            }`}
                                        >
                                            <span className={`h-1.5 w-1.5 rounded-full ${supplier.active ? "bg-green-500" : "bg-destructive"}`} />
                                            {supplier.active ? "Active" : "Inactive"}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="py-4 text-right pr-6">
                                        <div className="flex items-center justify-end gap-1">
                                            <Button 
                                                variant="ghost" 
                                                size="icon" 
                                                className="h-8 w-8 text-muted-foreground hover:bg-transparent hover:text-primary" 
                                                onClick={() => setViewSupplier(supplier)}
                                                title="View Details"
                                            >
                                                <Eye className="h-4 w-4" />
                                            </Button>
                                            <Button 
                                                variant="ghost" 
                                                size="icon" 
                                                className="h-8 w-8 text-muted-foreground hover:bg-transparent hover:text-amber-600" 
                                                onClick={() => openEdit(supplier)}
                                                title="Edit Supplier"
                                            >
                                                <Edit2 className="h-4 w-4" />
                                            </Button>
                                            <Button 
                                                variant="ghost" 
                                                size="icon" 
                                                className={`h-8 w-8 hover:bg-transparent ${
                                                    supplier.active 
                                                        ? "text-destructive hover:text-destructive" 
                                                        : "text-green-600 hover:text-green-600"
                                                }`}
                                                onClick={() => toggleStatus(supplier)}
                                                title={supplier.active ? "Deactivate" : "Activate"}
                                            >
                                                {supplier.active ? (
                                                    <ToggleRight className="h-4 w-4" />
                                                ) : (
                                                    <ToggleLeft className="h-4 w-4" />
                                                )}
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Pagination */}
            {!loading && totalPages > 1 && (
                <div className="flex items-center justify-between px-2 pt-2">
                    <p className="text-xs text-muted-foreground font-medium">
                        Showing <span className="text-foreground">{(currentPage - 1) * itemsPerPage + 1}</span> to <span className="text-foreground">{Math.min(currentPage * itemsPerPage, filteredSuppliers.length)}</span> of <span className="text-foreground">{filteredSuppliers.length}</span> suppliers
                    </p>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8 disabled:opacity-30"
                            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                            disabled={currentPage === 1}
                        >
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <div className="flex items-center gap-1">
                            {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                                <Button
                                    key={page}
                                    variant={currentPage === page ? "default" : "outline"}
                                    size="icon"
                                    className={`h-8 w-8 text-xs font-bold ${currentPage === page ? "shadow-md" : ""}`}
                                    onClick={() => setCurrentPage(page)}
                                >
                                    {page}
                                </Button>
                            ))}
                        </div>
                        <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8 disabled:opacity-30"
                            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                            disabled={currentPage === totalPages}
                        >
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            )}

            {/* Modals */}
            <SupplierViewModal supplier={viewSupplier} open={!!viewSupplier} onClose={() => setViewSupplier(null)} />

            {/* Create/Edit Modal */}
            <Dialog open={isCreateOpen || isEditOpen} onOpenChange={(v) => { if(!v) { setIsCreateOpen(false); setIsEditOpen(false); setEditingSupplier(null); } }}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>{isEditOpen ? "Edit Supplier" : "Add New Supplier"}</DialogTitle>
                        <DialogDescription>
                            Fill in the details below to {isEditOpen ? "update" : "create"} the supplier.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="code">Supplier Code <span className="text-destructive">*</span></Label>
                            <Input 
                                id="code" 
                                value={form.code} 
                                onChange={(e) => setForm(prev => ({ ...prev, code: e.target.value }))}
                                placeholder="SUP-001"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="name">Supplier Name <span className="text-destructive">*</span></Label>
                            <Input 
                                id="name" 
                                value={form.name} 
                                onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
                                placeholder="Acme Corp"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="gstin">GSTIN <span className="text-destructive">*</span></Label>
                            <Input 
                                id="gstin" 
                                value={form.gstin} 
                                onChange={(e) => setForm(prev => ({ ...prev, gstin: e.target.value }))}
                                placeholder="GSTIN Number"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="contact_person">Contact Person <span className="text-destructive">*</span></Label>
                            <Input 
                                id="contact_person" 
                                value={form.contact_person} 
                                onChange={(e) => setForm(prev => ({ ...prev, contact_person: e.target.value }))}
                                placeholder="John Doe"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="phone">Phone Number <span className="text-destructive">*</span></Label>
                            <PhoneInput 
                                id="phone"
                                value={form.phone}
                                countryCode={form.country_code}
                                onPhoneChange={(v) => setForm(prev => ({ ...prev, phone: v }))}
                                onCountryCodeChange={(v) => setForm(prev => ({ ...prev, country_code: v }))}
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="email">Email <span className="text-destructive">*</span></Label>
                            <Input 
                                id="email" 
                                type="email"
                                value={form.email} 
                                onChange={(e) => setForm(prev => ({ ...prev, email: e.target.value }))}
                                placeholder="vendor@example.com"
                            />
                        </div>
                        <div className="space-y-2 md:col-span-2">
                            <Label htmlFor="address">Full Address</Label>
                            <Input 
                                id="address" 
                                value={form.address} 
                                onChange={(e) => setForm(prev => ({ ...prev, address: e.target.value }))}
                                placeholder="123 Street Name, City, Country"
                            />
                        </div>
                        <div className="space-y-2 md:col-span-2">
                            <Label htmlFor="payment_terms">Payment Terms</Label>
                            <Input 
                                id="payment_terms" 
                                value={form.payment_terms} 
                                onChange={(e) => setForm(prev => ({ ...prev, payment_terms: e.target.value }))}
                                onKeyDown={handlePaymentTermsKeyDown}
                                placeholder="Net 30, COD, etc."
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => { setIsCreateOpen(false); setIsEditOpen(false); }}>Cancel</Button>
                        <Button 
                            ref={saveButtonRef}
                            onClick={isEditOpen ? handleUpdate : handleCreate} 
                            disabled={isSaving}
                        >
                            {isSaving ? (
                                <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Saving...
                                </>
                            ) : (
                                "Save Supplier"
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default SupplierManagement;
