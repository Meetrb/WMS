import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AxiosError } from "axios";
import { ChevronDown, Eye, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import TrolleyFormModal from "@/components/warehouse/TrolleyFormModal";
import { trolleyService, type Trolley, type TrolleyStatus, type WarehouseOption } from "@/services/trolleyService";

type CardStatusFilter = "all" | TrolleyStatus;
type SortField = "trolley_barcode" | "capacity_kg" | "capacity_units" | "status" | "current_location";
type SortOrder = "asc" | "desc";

const STATUS_ORDER: Record<TrolleyStatus, number> = {
  ACTIVE: 0,
  "IN-PACKING": 1,
  INACTIVE: 2,
};

const getOrderLabel = (field: SortField, order: SortOrder): string => {
  if (field === "trolley_barcode" || field === "current_location") {
    return order === "desc" ? "↓ Z→A" : "↑ A→Z";
  }
  if (field === "capacity_kg" || field === "capacity_units") {
    return order === "desc" ? "↓ High→Low" : "↑ Low→High";
  }
  if (field === "status") {
    return order === "desc" ? "↓ Inactive first" : "↑ Active first";
  }
  return order === "desc" ? "↓" : "↑";
};

const sortTrolleys = (rows: Trolley[], field: SortField, order: SortOrder): Trolley[] => {
  const sorted = [...rows].sort((a, b) => {
    let aValue: string | number = "";
    let bValue: string | number = "";

    if (field === "trolley_barcode") {
      aValue = a.trolley_barcode || "";
      bValue = b.trolley_barcode || "";
    } else if (field === "capacity_kg") {
      aValue = a.capacity_kg;
      bValue = b.capacity_kg;
    } else if (field === "capacity_units") {
      aValue = a.capacity_units;
      bValue = b.capacity_units;
    } else if (field === "status") {
      aValue = STATUS_ORDER[a.status];
      bValue = STATUS_ORDER[b.status];
    } else if (field === "current_location") {
      aValue = a.current_location || "";
      bValue = b.current_location || "";
    }

    if (typeof aValue === "string") {
      const left = aValue.toLowerCase();
      const right = String(bValue).toLowerCase();
      return order === "asc" ? left.localeCompare(right) : right.localeCompare(left);
    }

    const left = Number(aValue);
    const right = Number(bValue);
    return order === "asc" ? left - right : right - left;
  });

  return sorted;
};

const statusBadgeClass = (status: TrolleyStatus): string => {
  if (status === "ACTIVE") return "bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800";
  if (status === "IN-PACKING") return "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800";
  return "bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-900/30 dark:text-zinc-400 dark:border-zinc-800";
};

export default function TrolleyManagement() {
  const [loading, setLoading] = useState(true);
  const [trolleys, setTrolleys] = useState<Trolley[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseOption[]>([]);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | TrolleyStatus>("all");
  const [warehouseFilter, setWarehouseFilter] = useState("all");
  const [cardStatusFilter, setCardStatusFilter] = useState<CardStatusFilter>("all");

  const [sortField, setSortField] = useState<SortField>("trolley_barcode");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const [formOpen, setFormOpen] = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [trolleyRows, warehouseRows] = await Promise.all([
        trolleyService.getAll(),
        trolleyService.getWarehouses(),
      ]);
      setTrolleys(trolleyRows);
      setWarehouses(warehouseRows);
    } catch (error) {
      const axiosError = error as AxiosError<{ detail?: string; message?: string }>;
      const detail = axiosError.response?.data?.detail || axiosError.response?.data?.message;
      toast.error(detail || "Failed to load trolley data.");
      setTrolleys([]);
      setWarehouses([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const warehouseMap = useMemo(() => {
    return new Map(warehouses.map((warehouse) => [warehouse.warehouse_id, warehouse]));
  }, [warehouses]);

  const stats = useMemo(() => {
    return {
      total: trolleys.length,
      active: trolleys.filter((t) => t.status === "ACTIVE").length,
      inPacking: trolleys.filter((t) => t.status === "IN-PACKING").length,
      inactive: trolleys.filter((t) => t.status === "INACTIVE").length,
    };
  }, [trolleys]);

  const toggleCardFilter = useCallback((target: CardStatusFilter) => {
    setCardStatusFilter((current) => (current === target ? "all" : target));
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();

    return trolleys.filter((trolley) => {
      const matchSearch =
        !q ||
        trolley.trolley_barcode.toLowerCase().includes(q) ||
        trolley.current_location.toLowerCase().includes(q);

      const matchStatusDropdown = statusFilter === "all" || trolley.status === statusFilter;
      const matchStatusCard = cardStatusFilter === "all" || trolley.status === cardStatusFilter;
      const matchWarehouse = warehouseFilter === "all" || trolley.warehouse_id === warehouseFilter;

      return matchSearch && matchStatusDropdown && matchStatusCard && matchWarehouse;
    });
  }, [trolleys, search, statusFilter, cardStatusFilter, warehouseFilter]);

  const sorted = useMemo(() => {
    return sortTrolleys(filtered, sortField, sortOrder);
  }, [filtered, sortField, sortOrder]);

  return (
    <div className="p-4 md:p-8 space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Trolley Management</h1>
          <p className="text-sm text-muted-foreground">Manage trolley allocation and capacity across warehouses.</p>
        </div>
        <Button className="gap-2" onClick={() => setFormOpen(true)}>
          <Plus className="h-4 w-4" />
          Add Trolley
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card
          role="button"
          tabIndex={0}
          onClick={() => toggleCardFilter("all")}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              toggleCardFilter("all");
            }
          }}
          className={`cursor-pointer transition-colors ${cardStatusFilter === "all" ? "border-slate-400 bg-slate-50 dark:bg-slate-900/30" : ""}`}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Trolleys</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{stats.total}</p>
          </CardContent>
        </Card>

        <Card
          role="button"
          tabIndex={0}
          onClick={() => toggleCardFilter("ACTIVE")}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              toggleCardFilter("ACTIVE");
            }
          }}
          className={`cursor-pointer transition-colors border-green-200 dark:border-green-800 ${cardStatusFilter === "ACTIVE" ? "bg-green-50 border-green-400 dark:bg-green-900/30" : ""}`}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-green-700 dark:text-green-400">Active</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-green-700 dark:text-green-400">{stats.active}</p>
          </CardContent>
        </Card>

        <Card
          role="button"
          tabIndex={0}
          onClick={() => toggleCardFilter("IN-PACKING")}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              toggleCardFilter("IN-PACKING");
            }
          }}
          className={`cursor-pointer transition-colors border-blue-200 dark:border-blue-800 ${cardStatusFilter === "IN-PACKING" ? "bg-blue-50 border-blue-400 dark:bg-blue-900/30" : ""}`}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-blue-700 dark:text-blue-400">In-Packing</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-blue-700 dark:text-blue-400">{stats.inPacking}</p>
          </CardContent>
        </Card>

        <Card
          role="button"
          tabIndex={0}
          onClick={() => toggleCardFilter("INACTIVE")}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              toggleCardFilter("INACTIVE");
            }
          }}
          className={`cursor-pointer transition-colors border-zinc-200 dark:border-zinc-800 ${cardStatusFilter === "INACTIVE" ? "bg-zinc-50 border-zinc-400 dark:bg-zinc-900/30" : ""}`}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-zinc-700 dark:text-zinc-400">Inactive</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-zinc-700 dark:text-zinc-400">{stats.inactive}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col lg:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search barcode or current location..."
                className="pl-9"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as "all" | TrolleyStatus)}
              className="px-3 py-2 rounded-md border border-input bg-background text-sm"
            >
              <option value="all">All Status</option>
              <option value="ACTIVE">ACTIVE</option>
              <option value="INACTIVE">INACTIVE</option>
              <option value="IN-PACKING">IN-PACKING</option>
            </select>

            <select
              value={warehouseFilter}
              onChange={(e) => setWarehouseFilter(e.target.value)}
              className="px-3 py-2 rounded-md border border-input bg-background text-sm"
            >
              <option value="all">All Warehouses</option>
              {warehouses.map((warehouse) => (
                <option key={warehouse.warehouse_id} value={warehouse.warehouse_id}>
                  {warehouse.warehouse_name}
                </option>
              ))}
            </select>

            <DropdownMenu open={isDropdownOpen} onOpenChange={setIsDropdownOpen}>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <ChevronDown className="w-4 h-4" />
                  Sort by
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem onClick={() => { setSortField("trolley_barcode"); setIsDropdownOpen(false); }} className="flex items-center justify-between">
                  <span>Trolley Barcode</span>
                  {sortField === "trolley_barcode" && <span className="text-primary">✓</span>}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => { setSortField("capacity_kg"); setIsDropdownOpen(false); }} className="flex items-center justify-between">
                  <span>Capacity (kg)</span>
                  {sortField === "capacity_kg" && <span className="text-primary">✓</span>}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => { setSortField("capacity_units"); setIsDropdownOpen(false); }} className="flex items-center justify-between">
                  <span>Capacity (Units)</span>
                  {sortField === "capacity_units" && <span className="text-primary">✓</span>}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => { setSortField("status"); setIsDropdownOpen(false); }} className="flex items-center justify-between">
                  <span>Status</span>
                  {sortField === "status" && <span className="text-primary">✓</span>}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => { setSortField("current_location"); setIsDropdownOpen(false); }} className="flex items-center justify-between">
                  <span>Current Location</span>
                  {sortField === "current_location" && <span className="text-primary">✓</span>}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button variant="outline" onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}>
              {getOrderLabel(sortField, sortOrder)}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle>Trolleys</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Trolley Barcode</TableHead>
                  <TableHead>Warehouse</TableHead>
                  <TableHead>Capacity (kg)</TableHead>
                  <TableHead>Capacity (Units)</TableHead>
                  <TableHead>Current Location</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && (
                  <TableRow>
                    <TableCell colSpan={7} className="py-12 text-center text-muted-foreground">Loading trolleys...</TableCell>
                  </TableRow>
                )}

                {!loading && sorted.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="py-12 text-center text-muted-foreground">No trolleys found.</TableCell>
                  </TableRow>
                )}

                {!loading && sorted.map((trolley) => {
                  const warehouse = warehouseMap.get(trolley.warehouse_id);
                  const warehouseLabel = trolley.warehouse_name || warehouse?.warehouse_name || "-";

                  return (
                    <TableRow key={trolley.trolley_id}>
                      <TableCell className="font-medium">{trolley.trolley_barcode}</TableCell>
                      <TableCell>{warehouseLabel}</TableCell>
                      <TableCell>{trolley.capacity_kg}</TableCell>
                      <TableCell>{trolley.capacity_units}</TableCell>
                      <TableCell>{trolley.current_location || "-"}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={statusBadgeClass(trolley.status)}>{trolley.status}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Link to={`/dashboard/trolleys/${trolley.trolley_id}`}>
                          <Button variant="ghost" size="icon" aria-label="View trolley">
                            <Eye className="w-4 h-4" />
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <TrolleyFormModal
        open={formOpen}
        onOpenChange={setFormOpen}
        mode="create"
        onSuccess={async (savedTrolley) => {
          if (savedTrolley) {
            setTrolleys((prev) => {
              const next = [...prev];
              const index = next.findIndex((row) =>
                (savedTrolley.trolley_id && row.trolley_id === savedTrolley.trolley_id)
                || row.trolley_barcode === savedTrolley.trolley_barcode
              );
              if (index >= 0) {
                next[index] = savedTrolley;
              } else {
                next.unshift(savedTrolley);
              }
              return next;
            });

            // Keep local state in sync with server-enriched fields.
            void loadAll();
          } else {
            await loadAll();
          }
          toast.success("Trolley created successfully.");
        }}
      />
    </div>
  );
}
