import { useCallback, useEffect, useMemo, useState } from "react";
import { AxiosError } from "axios";
import { ArrowLeft, ChevronDown, Edit, Plus, Search } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import TrolleyFormModal from "@/components/warehouse/TrolleyFormModal";
import { trolleyService, type Rack, type RackCreatePayload, type Trolley, type TrolleyStatus, type WarehouseOption } from "@/services/trolleyService";

type RackSortField = "rack_barcode" | "position_on_trolley" | "status" | "total_items_to_pick" | "items_picked_count";
type SortOrder = "asc" | "desc";

const statusBadgeClass = (status: TrolleyStatus): string => {
  if (status === "ACTIVE") return "bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800";
  if (status === "IN-PACKING") return "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800";
  return "bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-900/30 dark:text-zinc-400 dark:border-zinc-800";
};

const rackStatusBadgeClass = (status: string): string => {
  const value = status.trim().toUpperCase();
  if (value === "PICKING") return "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800";
  if (value === "COMPLETED" || value === "PICKED") return "bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800";
  if (value === "PENDING") return "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800";
  return "bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-900/30 dark:text-zinc-400 dark:border-zinc-800";
};

const getRackOrderLabel = (field: RackSortField, order: SortOrder): string => {
  if (field === "rack_barcode" || field === "status") {
    return order === "desc" ? "↓ Z→A" : "↑ A→Z";
  }
  return order === "desc" ? "↓ High→Low" : "↑ Low→High";
};

export default function TrolleyDetail() {
  const navigate = useNavigate();
  const { trolley_id = "" } = useParams();

  const [loading, setLoading] = useState(true);
  const [trolley, setTrolley] = useState<Trolley | null>(null);
  const [warehouses, setWarehouses] = useState<WarehouseOption[]>([]);
  const [racks, setRacks] = useState<Rack[]>([]);
  const [editOpen, setEditOpen] = useState(false);
  const [createRackOpen, setCreateRackOpen] = useState(false);
  const [rackInlineError, setRackInlineError] = useState("");
  const [rackSaving, setRackSaving] = useState(false);
  const [rackSearch, setRackSearch] = useState("");
  const [rackStatusFilter, setRackStatusFilter] = useState("all");
  const [rackSortField, setRackSortField] = useState<RackSortField>("rack_barcode");
  const [rackSortOrder, setRackSortOrder] = useState<SortOrder>("asc");
  const [isRackSortOpen, setIsRackSortOpen] = useState(false);
  const [rackForm, setRackForm] = useState<RackCreatePayload>({
    rack_barcode: "",
    trolley_id: "",
    position_on_trolley: 0,
    status: "ACTIVE",
    total_items_to_pick: 0,
    items_picked_count: 0,
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [trolleyRow, warehouseRows, rackRows] = await Promise.all([
        trolleyService.getById(trolley_id),
        trolleyService.getWarehouses(),
        trolleyService.getRacksByTrolleyId(trolley_id),
      ]);
      setTrolley(trolleyRow);
      setWarehouses(warehouseRows);
      setRacks(rackRows);
    } catch (error) {
      const axiosError = error as AxiosError<{ detail?: string; message?: string }>;
      const detail = axiosError.response?.data?.detail || axiosError.response?.data?.message;
      toast.error(detail || "Failed to load trolley details.");
      setTrolley(null);
      setRacks([]);
    } finally {
      setLoading(false);
    }
  }, [trolley_id]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const warehouseName = useMemo(() => {
    if (!trolley) return "-";
    const byId = warehouses.find((w) => w.warehouse_id === trolley.warehouse_id);
    return trolley.warehouse_name || byId?.warehouse_name || "-";
  }, [trolley, warehouses]);

  const rackStatusOptions = useMemo(() => {
    return Array.from(new Set(racks.map((rack) => rack.status).filter(Boolean)));
  }, [racks]);

  const filteredRacks = useMemo(() => {
    const query = rackSearch.trim().toLowerCase();
    return racks.filter((rack) => {
      const matchesSearch =
        !query ||
        rack.rack_barcode.toLowerCase().includes(query) ||
        String(rack.position_on_trolley).includes(query) ||
        rack.status.toLowerCase().includes(query);

      const matchesStatus = rackStatusFilter === "all" || rack.status === rackStatusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [racks, rackSearch, rackStatusFilter]);

  const sortedRacks = useMemo(() => {
    return [...filteredRacks].sort((a, b) => {
      if (rackSortField === "rack_barcode") {
        return rackSortOrder === "asc"
          ? a.rack_barcode.localeCompare(b.rack_barcode)
          : b.rack_barcode.localeCompare(a.rack_barcode);
      }
      if (rackSortField === "status") {
        return rackSortOrder === "asc"
          ? a.status.localeCompare(b.status)
          : b.status.localeCompare(a.status);
      }
      if (rackSortField === "position_on_trolley") {
        return rackSortOrder === "asc"
          ? a.position_on_trolley - b.position_on_trolley
          : b.position_on_trolley - a.position_on_trolley;
      }
      if (rackSortField === "total_items_to_pick") {
        return rackSortOrder === "asc"
          ? a.total_items_to_pick - b.total_items_to_pick
          : b.total_items_to_pick - a.total_items_to_pick;
      }
      return rackSortOrder === "asc"
        ? a.items_picked_count - b.items_picked_count
        : b.items_picked_count - a.items_picked_count;
    });
  }, [filteredRacks, rackSortField, rackSortOrder]);

  const resetRackForm = useCallback((nextTrolleyId: string) => {
    setRackInlineError("");
    setRackForm({
      rack_barcode: "",
      trolley_id: nextTrolleyId,
      position_on_trolley: 0,
      status: "ACTIVE",
      total_items_to_pick: 0,
      items_picked_count: 0,
    });
  }, []);

  useEffect(() => {
    if (!trolley?.trolley_id) return;
    if (!createRackOpen) return;
    resetRackForm(trolley.trolley_id);
  }, [createRackOpen, trolley?.trolley_id, resetRackForm]);

  const readApiErrorMessage = (error: unknown): string => {
    const axiosError = error as AxiosError<{ detail?: unknown; message?: unknown }>;
    const detail = axiosError.response?.data?.detail;
    const message = axiosError.response?.data?.message;

    if (typeof detail === "string" && detail.trim()) return detail;
    if (Array.isArray(detail)) {
      const text = detail
        .map((item) => {
          if (typeof item === "string") return item;
          if (item && typeof item === "object") {
            const row = item as { msg?: unknown; loc?: unknown };
            const msg = String(row.msg ?? "").trim();
            const loc = Array.isArray(row.loc)
              ? String(row.loc[row.loc.length - 1] ?? "").trim()
              : "";
            if (loc && msg) return `${loc}: ${msg}`;
            if (msg) return msg;
          }
          return "";
        })
        .filter(Boolean)
        .join("; ");
      if (text) return text;
    }
    if (detail && typeof detail === "object") return JSON.stringify(detail);
    if (typeof message === "string" && message.trim()) return message;
    return "Failed to create rack.";
  };

  const submitRack = async () => {
    if (!rackForm.rack_barcode.trim()) {
      setRackInlineError("rack_barcode is required.");
      return;
    }
    if (!rackForm.trolley_id.trim()) {
      setRackInlineError("trolley_id is required.");
      return;
    }
    if (!Number.isFinite(rackForm.position_on_trolley)) {
      setRackInlineError("position_on_trolley is required.");
      return;
    }
    if (!rackForm.status) {
      setRackInlineError("status is required.");
      return;
    }
    if (!Number.isFinite(rackForm.total_items_to_pick)) {
      setRackInlineError("total_items_to_pick is required.");
      return;
    }
    if (!Number.isFinite(rackForm.items_picked_count)) {
      setRackInlineError("items_picked_count is required.");
      return;
    }

    setRackSaving(true);
    setRackInlineError("");
    try {
      await trolleyService.createRack({
        rack_barcode: rackForm.rack_barcode.trim(),
        trolley_id: rackForm.trolley_id,
        position_on_trolley: Number(rackForm.position_on_trolley),
        status: rackForm.status,
        total_items_to_pick: Number(rackForm.total_items_to_pick),
        items_picked_count: Number(rackForm.items_picked_count),
      });
      toast.success("Rack created successfully.");
      setCreateRackOpen(false);
    } catch (error) {
      setRackInlineError(readApiErrorMessage(error));
    } finally {
      setRackSaving(false);
    }
  };

  if (loading) {
    return <div className="p-4 md:p-8 text-sm text-muted-foreground">Loading trolley details...</div>;
  }

  if (!trolley) {
    return (
      <div className="p-4 md:p-8 space-y-4">
        <p className="text-sm text-muted-foreground">Trolley not found.</p>
        <Button variant="outline" onClick={() => navigate("/dashboard/trolleys")}>Back</Button>
      </div>
    );
  }

  const isEditLocked = trolley.status === "IN-PACKING";

  const handleEditClick = () => {
    if (isEditLocked) {
      toast.error("Trolley cannot be edited while status is IN-PACKING.");
      return;
    }
    setEditOpen(true);
  };

  return (
    <div className="p-4 md:p-8 space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Trolley Detail</h1>
          <p className="text-sm text-muted-foreground">View and manage trolley information.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="gap-2" onClick={() => navigate("/dashboard/trolleys")}>
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <Button className="gap-2" variant="outline" onClick={() => setCreateRackOpen(true)}>
            <Plus className="h-4 w-4" />
            Create Rack
          </Button>
          <Button
            className="gap-2"
            onClick={handleEditClick}
            disabled={isEditLocked}
            title={isEditLocked ? "Editing is disabled while trolley is IN-PACKING" : undefined}
          >
            <Edit className="h-4 w-4" />
            Edit
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{trolley.trolley_barcode}</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">Trolley Barcode</p>
            <p className="font-medium">{trolley.trolley_barcode}</p>
          </div>

          <div>
            <p className="text-muted-foreground">Warehouse Name</p>
            <p className="font-medium">{warehouseName}</p>
          </div>

          <div>
            <p className="text-muted-foreground">Capacity (kg)</p>
            <p className="font-medium">{trolley.capacity_kg}</p>
          </div>

          <div>
            <p className="text-muted-foreground">Capacity (Units)</p>
            <p className="font-medium">{trolley.capacity_units}</p>
          </div>

          <div>
            <p className="text-muted-foreground">Current Location</p>
            <p className="font-medium">{trolley.current_location || "-"}</p>
          </div>

          <div>
            <p className="text-muted-foreground">Status</p>
            <Badge variant="outline" className={statusBadgeClass(trolley.status)}>{trolley.status}</Badge>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Racks</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col lg:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={rackSearch}
                onChange={(e) => setRackSearch(e.target.value)}
                placeholder="Search rack barcode, position, status..."
                className="pl-9"
              />
            </div>

            <select
              value={rackStatusFilter}
              onChange={(e) => setRackStatusFilter(e.target.value)}
              className="px-3 py-2 rounded-md border border-input bg-background text-sm"
            >
              <option value="all">All Status</option>
              {rackStatusOptions.map((status) => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>

            <DropdownMenu open={isRackSortOpen} onOpenChange={setIsRackSortOpen}>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <ChevronDown className="w-4 h-4" />
                  Sort by
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem onClick={() => { setRackSortField("rack_barcode"); setIsRackSortOpen(false); }} className="flex items-center justify-between">
                  <span>Rack Barcode</span>
                  {rackSortField === "rack_barcode" && <span className="text-primary">✓</span>}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => { setRackSortField("position_on_trolley"); setIsRackSortOpen(false); }} className="flex items-center justify-between">
                  <span>Position</span>
                  {rackSortField === "position_on_trolley" && <span className="text-primary">✓</span>}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => { setRackSortField("status"); setIsRackSortOpen(false); }} className="flex items-center justify-between">
                  <span>Status</span>
                  {rackSortField === "status" && <span className="text-primary">✓</span>}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => { setRackSortField("total_items_to_pick"); setIsRackSortOpen(false); }} className="flex items-center justify-between">
                  <span>Total Items To Pick</span>
                  {rackSortField === "total_items_to_pick" && <span className="text-primary">✓</span>}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => { setRackSortField("items_picked_count"); setIsRackSortOpen(false); }} className="flex items-center justify-between">
                  <span>Items Picked Count</span>
                  {rackSortField === "items_picked_count" && <span className="text-primary">✓</span>}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button variant="outline" onClick={() => setRackSortOrder(rackSortOrder === "asc" ? "desc" : "asc")}>
              {getRackOrderLabel(rackSortField, rackSortOrder)}
            </Button>
          </div>

          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Rack Barcode</TableHead>
                  <TableHead>Position</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Total Items To Pick</TableHead>
                  <TableHead className="text-right">Items Picked Count</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedRacks.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                      No racks found.
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedRacks.map((rack) => (
                    <TableRow key={rack.rack_id || `${rack.rack_barcode}-${rack.position_on_trolley}`}>
                      <TableCell className="font-medium">{rack.rack_barcode || "-"}</TableCell>
                      <TableCell>{rack.position_on_trolley}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={rackStatusBadgeClass(rack.status)}>
                          {rack.status || "-"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">{rack.total_items_to_pick}</TableCell>
                      <TableCell className="text-right">{rack.items_picked_count}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <TrolleyFormModal
        open={editOpen}
        onOpenChange={setEditOpen}
        mode="edit"
        initialData={trolley}
        onSuccess={async () => {
          await loadData();
          toast.success("Trolley updated successfully.");
        }}
      />

      <Dialog open={createRackOpen} onOpenChange={setCreateRackOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create Rack</DialogTitle>
            <DialogDescription>Create a new rack for this trolley.</DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1.5 md:col-span-2">
              <label className="text-xs text-muted-foreground">Rack Barcode</label>
              <Input
                value={rackForm.rack_barcode}
                onChange={(e) => setRackForm((prev) => ({ ...prev, rack_barcode: e.target.value }))}
                placeholder="Required"
              />
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <label className="text-xs text-muted-foreground">Trolley ID</label>
              <Input value={rackForm.trolley_id} readOnly />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Position On Trolley</label>
              <Input
                type="number"
                value={String(rackForm.position_on_trolley)}
                onChange={(e) => setRackForm((prev) => ({ ...prev, position_on_trolley: Number(e.target.value) }))}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Status</label>
              <select
                value={rackForm.status}
                onChange={(e) => setRackForm((prev) => ({ ...prev, status: e.target.value as "ACTIVE" | "INACTIVE" }))}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="ACTIVE">ACTIVE</option>
                <option value="INACTIVE">INACTIVE</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Total Items To Pick</label>
              <Input
                type="number"
                value={String(rackForm.total_items_to_pick)}
                onChange={(e) => setRackForm((prev) => ({ ...prev, total_items_to_pick: Number(e.target.value) }))}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Items Picked Count</label>
              <Input
                type="number"
                value={String(rackForm.items_picked_count)}
                onChange={(e) => setRackForm((prev) => ({ ...prev, items_picked_count: Number(e.target.value) }))}
              />
            </div>
          </div>

          {rackInlineError && (
            <p className="text-sm text-destructive">{rackInlineError}</p>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setCreateRackOpen(false)} disabled={rackSaving}>
              Cancel
            </Button>
            <Button onClick={() => void submitRack()} disabled={rackSaving}>
              {rackSaving ? "Creating..." : "Create Rack"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
