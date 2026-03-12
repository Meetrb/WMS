import { useState, useEffect, useMemo } from "react";
import {
    Package, Search, Eye, Edit2, Loader2, ChevronLeft, ChevronRight,
    Filter, ToggleLeft, ToggleRight, Info, Ruler, Box, ShieldAlert,
    Settings2, X, RefreshCw,
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

// ─── Types ──────────────────────────────────────────────────────────────────

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

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmt = (d?: string | null) => {
    if (!d) return "—";
    try { return new Date(d).toLocaleDateString(); } catch { return d; }
};

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
                            <Badge className={`ml-2 text-[9px] font-black uppercase border-none px-2 py-0.5 ${sku.active ? "bg-green-500 text-white" : "bg-destructive text-white"}`}>
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

    // Toggling active state
    const [togglingId, setTogglingId] = useState<string | number | null>(null);

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
                <Button variant="outline" size="sm" onClick={fetchItems} disabled={isLoading} className="gap-2 self-start">
                    <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
                    Refresh
                </Button>
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
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader className="bg-muted/40">
                                    <TableRow>
                                        <TableHead className="text-[10px] uppercase font-black tracking-wider whitespace-nowrap">SKU Code</TableHead>
                                        <TableHead className="text-[10px] uppercase font-black tracking-wider">Description</TableHead>
                                        <TableHead className="text-[10px] uppercase font-black tracking-wider whitespace-nowrap">Barcode</TableHead>
                                        <TableHead className="text-[10px] uppercase font-black tracking-wider whitespace-nowrap">Base UOM</TableHead>
                                        <TableHead className="text-[10px] uppercase font-black tracking-wider whitespace-nowrap">Item Type</TableHead>
                                        <TableHead className="text-[10px] uppercase font-black tracking-wider">Category</TableHead>
                                        <TableHead className="text-[10px] uppercase font-black tracking-wider whitespace-nowrap">Storage</TableHead>
                                        <TableHead className="text-[10px] uppercase font-black tracking-wider whitespace-nowrap">Velocity</TableHead>
                                        <TableHead className="text-[10px] uppercase font-black tracking-wider text-right">Weight</TableHead>
                                        <TableHead className="text-[10px] uppercase font-black tracking-wider whitespace-nowrap">Dimensions</TableHead>
                                        <TableHead className="text-[10px] uppercase font-black tracking-wider">Status</TableHead>
                                        <TableHead className="text-[10px] uppercase font-black tracking-wider whitespace-nowrap">Created</TableHead>
                                        <TableHead className="text-[10px] uppercase font-black tracking-wider text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {paginated.map(item => (
                                        <TableRow key={item.id} className="group hover:bg-muted/20 transition-colors">
                                            <TableCell className="font-mono font-bold text-xs text-primary whitespace-nowrap">
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
                                            <TableCell className="font-mono text-xs text-muted-foreground whitespace-nowrap">
                                                {item.primaryBarcode || "—"}
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className="text-[9px] font-bold uppercase">
                                                    {item.baseUom}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-xs whitespace-nowrap">{item.itemType || "—"}</TableCell>
                                            <TableCell className="text-xs">{item.itemCategory || "—"}</TableCell>
                                            <TableCell className="text-xs whitespace-nowrap">{item.storageCondition || "—"}</TableCell>
                                            <TableCell>
                                                {item.velocityClass ? (
                                                    <Badge
                                                        variant="outline"
                                                        className={`text-[9px] font-black uppercase border-none px-2 py-0.5 ${item.velocityClass === "A" ? "bg-green-500/20 text-green-700 dark:text-green-400" :
                                                            item.velocityClass === "B" ? "bg-amber-500/20 text-amber-700 dark:text-amber-400" :
                                                                "bg-muted text-muted-foreground"
                                                            }`}
                                                    >
                                                        {item.velocityClass}
                                                    </Badge>
                                                ) : "—"}
                                            </TableCell>
                                            <TableCell className="text-right text-xs font-medium whitespace-nowrap">
                                                {item.weightKg ? `${item.weightKg} kg` : "—"}
                                            </TableCell>
                                            <TableCell className="text-xs font-mono whitespace-nowrap text-muted-foreground">
                                                {(item.lengthCm || item.widthCm || item.heightCm)
                                                    ? `${item.lengthCm}×${item.widthCm}×${item.heightCm}`
                                                    : "—"}
                                            </TableCell>
                                            <TableCell>
                                                <Badge
                                                    className={`text-[9px] font-black uppercase border-none px-2 py-0.5 ${item.active ? "bg-green-500 text-white" : "bg-muted text-muted-foreground"
                                                        }`}
                                                >
                                                    {item.active ? "Active" : "Inactive"}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                                                {fmt(item.created_at)}
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center justify-end gap-1">
                                                    {/* View */}
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-7 w-7 hover:bg-primary/10 hover:text-primary"
                                                        onClick={() => setViewingSku(item)}
                                                        title="View Details"
                                                    >
                                                        <Eye className="h-3.5 w-3.5" />
                                                    </Button>

                                                    {/* Edit */}
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-7 w-7 hover:bg-amber-500/10 hover:text-amber-600"
                                                        title="Edit SKU"
                                                        onClick={() => toast.info(`Edit SKU: ${item.skuCode} — coming soon`)}
                                                    >
                                                        <Edit2 className="h-3.5 w-3.5" />
                                                    </Button>

                                                    {/* Toggle Active */}
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className={`h-7 w-7 ${item.active
                                                            ? "hover:bg-destructive/10 hover:text-destructive"
                                                            : "hover:bg-green-500/10 hover:text-green-600"
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
        </div>
    );
};

export default SkuManagement;
