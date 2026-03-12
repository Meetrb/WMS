import { useState, useEffect } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
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
import { Plus, Eye, Edit, FileText, Search, Package, Building2, Truck, UserCircle, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Link } from "react-router-dom";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
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
import { Badge } from "@/components/ui/badge";
import { asnService } from "@/services/asnService";
import { inboundService } from "@/services/inboundService";
import { toast } from "sonner";
import { useAuth } from "@/components/auth-provider";

// Safely format date strings
const formatDate = (dateStr?: string) => {
    if (!dateStr || dateStr === "N/A") return null;
    return dateStr.split("T")[0];
};
// Removed mock data in favor of backend API data

const getStatusColor = (status: string) => {
    switch (status) {
        case 'Draft':
            return 'bg-slate-100 text-slate-700 dark:bg-slate-500/10 dark:text-slate-400';
        case 'Pending Arrival':
            return 'bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-500';
        case 'In Transit':
            return 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-500';
        case 'Arrived':
            return 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-500';
        case 'Receiving':
            return 'bg-purple-100 text-purple-700 dark:bg-purple-500/10 dark:text-purple-500';
        case 'Received':
            return 'bg-green-100 text-green-700 dark:bg-green-500/10 dark:text-green-500';
        case 'Closed':
            return 'bg-zinc-100 text-zinc-700 dark:bg-zinc-500/10 dark:text-zinc-500';
        default:
            return 'bg-gray-100 text-gray-700 dark:bg-gray-500/10 dark:text-gray-500';
    }
};

const editAsnSchema = z.object({
    asn_number: z.string().min(1, "Required"),
    asn_date: z.string().min(1, "Required"),
    shipment_id: z.string().optional().or(z.literal('')),
    expected_date: z.string().min(1, "Required"),
    status: z.string().min(1, "Required"),
    notes: z.string().optional().or(z.literal('')),
    supplier_code: z.string().min(1, "Required"),
});

type EditAsnFormValues = z.infer<typeof editAsnSchema>;

const Asns = () => {
    const [asns, setAsns] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isFetchingDetails, setIsFetchingDetails] = useState(false);
    const [selectedAsn, setSelectedAsn] = useState<any | null>(null);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [editingAsn, setEditingAsn] = useState<any | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const { user } = useAuth();

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
        fetchAsns();
    }, []);

    const handleEditClick = (asn: any) => {
        setEditingAsn(asn);
        editForm.reset({
            asn_number: asn.asn_number || "",
            asn_date: asn.asn_date ? new Date(asn.asn_date).toISOString().slice(0, 16) : "",
            shipment_id: asn.shipment_id || "",
            expected_date: asn.expected_date ? new Date(asn.expected_date).toISOString().slice(0, 10) : "",
            status: asn.status || asn.audit?.status || "Draft",
            notes: asn.notes || "",
            supplier_code: asn.supplier_code || "",
        });
        setIsEditDialogOpen(true);
    };

    const onEditSubmit = async (values: EditAsnFormValues) => {
        if (!editingAsn) return;
        setIsSaving(true);
        try {
            const formattedValues = {
                ...values,
                asn_date: new Date(values.asn_date).toISOString(),
                expected_date: new Date(values.expected_date).toISOString(),
            };

            const id = editingAsn.id || editingAsn.asn_id;
            await inboundService.updateASN(id, formattedValues);

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
                    <Button variant="outline" className="gap-2">
                        <FileText className="w-4 h-4" />
                        Export
                    </Button>
                    <Link to="/dashboard/asns/create">
                        <Button className="gap-2">
                            <Plus className="w-4 h-4" />
                            Create new ASN
                        </Button>
                    </Link>
                </div>
            </div>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle>ASN List</CardTitle>
                        <CardDescription>View all advance shipment notices</CardDescription>
                    </div>
                    <div className="relative w-64">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            type="search"
                            placeholder="Search ASNs..."
                            className="pl-8"
                        />
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
                                asns.map((asn) => (
                                    <TableRow key={asn.id || asn.asn_number}>
                                        <TableCell className="font-medium text-primary">
                                            {asn.asn_number || "N/A"}
                                        </TableCell>
                                        <TableCell>{asn.shipment_id || "N/A"}</TableCell>
                                        <TableCell>{formatDate(asn.asn_date)}</TableCell>
                                        <TableCell>{formatDate(asn.expected_date)}</TableCell>
                                        <TableCell>
                                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(asn.audit?.status)}`}>
                                                {asn.audit?.status || "Pending Arrival"}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button variant="ghost" size="icon" onClick={() => handleViewDetails(asn)}>
                                                <Eye className="w-4 h-4" />
                                            </Button>
                                            <Button variant="ghost" size="icon" onClick={() => handleEditClick(asn)}>
                                                <Edit className="w-4 h-4" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
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
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* Core Info */}
                                <Card>
                                    <CardHeader className="py-3 px-4 bg-muted/40 border-b">
                                        <CardTitle className="text-sm flex items-center gap-2">
                                            <FileText className="w-4 h-4 text-primary" />
                                            Reference Information
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="p-4 grid gap-2 text-sm">
                                        {(selectedAsn.asnNumber || selectedAsn.asn_number || selectedAsn.asn_no) && (
                                            <div className="flex justify-between border-b pb-1">
                                                <span className="text-muted-foreground">ASN Number</span>
                                                <span className="font-medium">{selectedAsn.asnNumber || selectedAsn.asn_number || selectedAsn.asn_no}</span>
                                            </div>
                                        )}
                                        {formatDate(selectedAsn.asnDate || selectedAsn.asn_date) && (
                                            <div className="flex justify-between border-b pb-1">
                                                <span className="text-muted-foreground">ASN Date</span>
                                                <span className="font-medium">{formatDate(selectedAsn.asnDate || selectedAsn.asn_date)}</span>
                                            </div>
                                        )}
                                        {formatDate(selectedAsn.expectedDate || selectedAsn.expected_date) && (
                                            <div className="flex justify-between border-b pb-1">
                                                <span className="text-muted-foreground">Expected Arrival</span>
                                                <span className="font-medium">{formatDate(selectedAsn.expectedDate || selectedAsn.expected_date)}</span>
                                            </div>
                                        )}
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">Status</span>
                                            <span>
                                                <Badge variant="outline" className={`${getStatusColor(selectedAsn.status || selectedAsn.audit?.status)} border-transparent`}>
                                                    {selectedAsn.status || selectedAsn.audit?.status || "Pending Arrival"}
                                                </Badge>
                                            </span>
                                        </div>
                                    </CardContent>
                                </Card>

                                {/* Supplier Info - Only if present */}
                                {(() => {
                                    // Try to find supplier in the requested object structure first
                                    let supplier = selectedAsn.supplier;

                                    // Fallback to existing search logic if top-level supplier is not present
                                    if (!supplier) {
                                        const firstShipment = selectedAsn.shipments?.[0];
                                        supplier = selectedAsn.shipments?.[0]?.suppliers?.[0] ||
                                            selectedAsn.suppliers?.[0] ||
                                            selectedAsn.supplier; // Redundant but safe

                                        if (!supplier) {
                                            const source = (firstShipment?.supplier_name || firstShipment?.vendor_name || firstShipment?.supplier_code) ? firstShipment :
                                                (selectedAsn.supplier_name || selectedAsn.vendor_name || selectedAsn.supplier_code) ? selectedAsn : null;

                                            if (source) {
                                                supplier = {
                                                    name: source.supplier_name || source.vendor_name || source.name,
                                                    code: source.supplier_code || source.vendor_code || source.code,
                                                    gstin: source.supplier_gstin || source.tax_id || source.gstin
                                                };
                                            }
                                        }
                                    }

                                    // Final check: if we have an object but all fields are empty, treat as null
                                    if (!supplier || (!supplier.name && !supplier.code && !supplier.gstin &&
                                        !supplier.vendor_name && !supplier.vendor_code && !supplier.tax_id)) return null;

                                    const sName = supplier.name || supplier.vendor_name || "—";
                                    const sCode = supplier.code || supplier.vendor_code || "—";
                                    const sGstin = supplier.gstin || supplier.tax_id || "—";

                                    if (sName === "—" && sCode === "—" && sGstin === "—") return null;

                                    return (
                                        <Card>
                                            <CardHeader className="py-3 px-4 bg-muted/40 border-b">
                                                <CardTitle className="text-sm flex items-center gap-2">
                                                    <Building2 className="w-4 h-4 text-primary" />
                                                    Supplier Details
                                                </CardTitle>
                                            </CardHeader>
                                            <CardContent className="p-4 grid gap-2 text-sm">
                                                {sName !== "—" && (
                                                    <div className="flex justify-between border-b pb-1">
                                                        <span className="text-muted-foreground">Supplier Name</span>
                                                        <span className="font-medium">{sName}</span>
                                                    </div>
                                                )}
                                                {sCode !== "—" && (
                                                    <div className="flex justify-between border-b pb-1">
                                                        <span className="text-muted-foreground">Supplier Code</span>
                                                        <span className="font-medium">{sCode}</span>
                                                    </div>
                                                )}
                                                {sGstin !== "—" && (
                                                    <div className="flex justify-between border-b pb-1">
                                                        <span className="text-muted-foreground">GSTIN</span>
                                                        <span className="font-medium">{sGstin}</span>
                                                    </div>
                                                )}
                                                {supplier.contact_person && (
                                                    <div className="flex justify-between border-b pb-1">
                                                        <span className="text-muted-foreground">Contact Person</span>
                                                        <span className="font-medium">{supplier.contact_person}</span>
                                                    </div>
                                                )}
                                                {(supplier.phone || supplier.email) && (
                                                    <div className="flex justify-between border-b pb-1">
                                                        <span className="text-muted-foreground">Contact Info</span>
                                                        <span className="font-medium">{supplier.phone} {supplier.email ? `(${supplier.email})` : ''}</span>
                                                    </div>
                                                )}
                                                {supplier.address && (
                                                    <div className="flex justify-between border-b pb-1">
                                                        <span className="text-muted-foreground">Address</span>
                                                        <span className="font-medium text-right max-w-[200px]">{supplier.address}</span>
                                                    </div>
                                                )}
                                                {supplier.payment_terms && (
                                                    <div className="flex justify-between">
                                                        <span className="text-muted-foreground">Payment Terms</span>
                                                        <span className="font-medium">{supplier.payment_terms}</span>
                                                    </div>
                                                )}
                                            </CardContent>
                                        </Card>
                                    );
                                })()}

                                {/* Logistics */}
                                <Card>
                                    <CardHeader className="py-3 px-4 bg-muted/40 border-b">
                                        <CardTitle className="text-sm flex items-center gap-2">
                                            <Truck className="w-4 h-4 text-primary" />
                                            Logistics
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="p-4 grid gap-2 text-sm">
                                        {(selectedAsn.shipmentId || selectedAsn.shipment_id || selectedAsn.shipments?.[0]?.shipment_id) && (
                                            <div className="flex justify-between border-b pb-1">
                                                <span className="text-muted-foreground">Shipment ID</span>
                                                <span className="font-medium">{selectedAsn.shipmentId || selectedAsn.shipment_id || selectedAsn.shipments?.[0]?.shipment_id}</span>
                                            </div>
                                        )}
                                        {(selectedAsn.poNumber || selectedAsn.po_number || selectedAsn.shipments?.[0]?.po_number || selectedAsn.shipments?.[0]?.poNumber) && (
                                            <div className="flex justify-between border-b pb-1">
                                                <span className="text-muted-foreground">PO Number(s)</span>
                                                <div className="flex flex-wrap gap-1 justify-end">
                                                    {(selectedAsn.poNumber || selectedAsn.po_number || selectedAsn.shipments?.[0]?.po_number || selectedAsn.shipments?.[0]?.poNumber)?.toString().split(',').map((p: string, i: number) => (
                                                        <Badge key={i} variant="outline" className="text-[10px] font-mono whitespace-nowrap">
                                                            {p.trim()}
                                                        </Badge>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                        {selectedAsn.carrier && selectedAsn.carrier !== "N/A" && (
                                            <div className="flex justify-between border-b pb-1">
                                                <span className="text-muted-foreground">Carrier</span>
                                                <span className="font-medium">{selectedAsn.carrier}</span>
                                            </div>
                                        )}
                                        {selectedAsn.tracking_number && selectedAsn.tracking_number !== "N/A" && (
                                            <div className="flex justify-between border-b pb-1">
                                                <span className="text-muted-foreground">Tracking #</span>
                                                <span className="font-medium">{selectedAsn.tracking_number}</span>
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>

                                {/* Metadata */}
                                <Card>
                                    <CardHeader className="py-3 px-4 bg-muted/40 border-b">
                                        <CardTitle className="text-sm flex items-center gap-2">
                                            <UserCircle className="w-4 h-4 text-primary" />
                                            Metadata
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="p-4 grid gap-2 text-sm">
                                        <div className="flex justify-between border-b pb-1">
                                            <span className="text-muted-foreground">Created By</span>
                                            <span className="font-medium">{selectedAsn.created_by || selectedAsn.audit?.created_by || user?.username || "Admin"}</span>
                                        </div>
                                        {formatDate(selectedAsn.created_at) && (
                                            <div className="flex justify-between border-b pb-1">
                                                <span className="text-muted-foreground">Created At</span>
                                                <span className="font-medium">{formatDate(selectedAsn.created_at)}</span>
                                            </div>
                                        )}
                                        {selectedAsn.updated_by && (
                                            <div className="flex justify-between border-b pb-1">
                                                <span className="text-muted-foreground">Updated By</span>
                                                <span className="font-medium">{selectedAsn.updated_by}</span>
                                            </div>
                                        )}
                                        {formatDate(selectedAsn.updated_at) && (
                                            <div className="flex justify-between border-b pb-1">
                                                <span className="text-muted-foreground">Updated At</span>
                                                <span className="font-medium">{formatDate(selectedAsn.updated_at)}</span>
                                            </div>
                                        )}
                                        {selectedAsn.notes && (
                                            <div className="flex justify-between">
                                                <span className="text-muted-foreground">Remarks</span>
                                                <span className="font-medium italic">{selectedAsn.notes}</span>
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            </div>

                            {/* Items / Shipments */}
                            {selectedAsn.shipments?.map((shipment: any, sIdx: number) => (
                                <Card key={`shipment-view-${sIdx}`}>
                                    <CardHeader className="py-3 px-4 bg-muted/40 border-b">
                                        <CardTitle className="text-sm flex items-center justify-between">
                                            <div className="flex items-center gap-4">
                                                <div className="flex items-center gap-2">
                                                    <Package className="w-4 h-4 text-primary" />
                                                    Shipment #{sIdx + 1}
                                                </div>
                                                {(shipment.poNumber || shipment.po_number) && (
                                                    <div className="flex flex-wrap gap-1">
                                                        {(shipment.poNumber || shipment.po_number).toString().split(',').map((p: string, i: number) => (
                                                            <Badge key={i} variant="secondary" className="font-mono text-[10px]">
                                                                PO: {p.trim()}
                                                            </Badge>
                                                        ))}
                                                    </div>
                                                )}
                                                {shipment.shipmentId && (
                                                    <Badge variant="outline" className="font-mono text-[10px]">
                                                        ID: {shipment.shipmentId}
                                                    </Badge>
                                                )}
                                            </div>
                                            <div className="text-muted-foreground text-[10px]">
                                                {shipment.items?.length || 0} Items
                                            </div>
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="p-0">
                                        <Table>
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
                                                            <TableCell className="py-2 text-muted-foreground max-w-[150px] truncate">{desc}</TableCell>
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
                                                <TableRow className="bg-muted/10 hover:bg-muted/10">
                                                    <TableCell colSpan={6} className="text-right font-medium py-3 text-muted-foreground">
                                                        Total Shipment Quantity:
                                                    </TableCell>
                                                    <TableCell className="text-right font-bold py-3 text-lg">
                                                        {(shipment.items || []).reduce((acc: number, curr: any) => acc + Number(curr?.quantity || 0), 0)}
                                                    </TableCell>
                                                </TableRow>
                                            </TableBody>
                                        </Table>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    ) : null}
                </DialogContent>
            </Dialog>

            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto w-[90vw]">
                    <DialogHeader>
                        <DialogTitle className="text-xl">Edit Advance Shipment Notice</DialogTitle>
                        <DialogDescription>Update the details for this ASN below.</DialogDescription>
                    </DialogHeader>
                    <Form {...editForm}>
                        <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <FormField
                                    control={editForm.control}
                                    name="asn_number"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>ASN Number <span className="text-destructive">*</span></FormLabel>
                                            <FormControl>
                                                <Input {...field} />
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
                                            <FormLabel>ASN Date <span className="text-destructive">*</span></FormLabel>
                                            <FormControl>
                                                <Input type="datetime-local" {...field} />
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
                                            <FormLabel>Shipment ID</FormLabel>
                                            <FormControl>
                                                <Input {...field} />
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
                                            <FormLabel>Expected Date <span className="text-destructive">*</span></FormLabel>
                                            <FormControl>
                                                <Input type="date" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={editForm.control}
                                    name="status"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Status <span className="text-destructive">*</span></FormLabel>
                                            <Select onValueChange={field.onChange} value={field.value}>
                                                <FormControl>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Select status" />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    <SelectItem value="Draft">Draft</SelectItem>
                                                    <SelectItem value="Pending Arrival">Pending Arrival</SelectItem>
                                                    <SelectItem value="In Transit">In Transit</SelectItem>
                                                    <SelectItem value="Arrived">Arrived</SelectItem>
                                                    <SelectItem value="Receiving">Receiving</SelectItem>
                                                    <SelectItem value="Completed">Completed</SelectItem>
                                                    <SelectItem value="Closed">Closed</SelectItem>
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
                                            <FormLabel>Supplier Code <span className="text-destructive">*</span></FormLabel>
                                            <FormControl>
                                                <Input {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={editForm.control}
                                    name="notes"
                                    render={({ field }) => (
                                        <FormItem className="md:col-span-2">
                                            <FormLabel>Notes</FormLabel>
                                            <FormControl>
                                                <Textarea {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>
                            <div className="flex justify-end gap-3 pt-4 border-t">
                                <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)} disabled={isSaving}>
                                    Cancel
                                </Button>
                                <Button type="submit" disabled={isSaving}>
                                    {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Save Changes
                                </Button>
                            </div>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default Asns;
