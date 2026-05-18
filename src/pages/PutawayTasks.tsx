import { useState, useEffect, useCallback } from "react";
import { RefreshCw, AlertTriangle, Search, Package, Eye, ChevronDown } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatDisplayDateTime } from "@/lib/date";
import api from "@/services/api";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface PutawayTask {
  id: string;
  task_number: string;
  item_sku: string;
  item_description: string;
  quantity_to_put: string;
  quantity_put: string;
  status: string;
  priority: number;
  assigned_to_name: string;
  created_at: string;
  completed_at: string | null;
}

interface PutawayTaskDetail {
  id: string;
  task_number: string;
  inbound_shipment_id: string;
  grn_id: string;
  asn_shipment_item_id: string;
  item_id: string;
  item_sku: string;
  item_description: string;
  quantity_to_put: string;
  quantity_put: string;
  source_location: string;
  suggested_bin_id: string;
  suggested_bin_code: string;
  actual_bin_code: string;
  lot_number: string;
  batch_number: string;
  expiry_date: string | null;
  priority: number;
  notes: string;
  task_data: Record<string, object>;
  assigned_to_id: string;
  assigned_to_name: string;
  assigned_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  status: string;
  queue_position: number;
  created_by_id: string;
  created_by_name: string;
  created_at: string;
  updated_at: string;
  inbound_shipment_number: string;
  grn_number: string;
}

const fetchTaskDetail = async (taskId: string): Promise<PutawayTaskDetail> => {
  try {
    const response = await api.get<PutawayTaskDetail>(`/putaway/tasks/${taskId}`);
    return response.data;
  } catch {
    // Some backends are mounted with trailing slash routes.
    const fallbackResponse = await api.get<PutawayTaskDetail>(`/putaway/tasks/${taskId}/`);
    return fallbackResponse.data;
  }
};

type PutawayTaskApi = Partial<PutawayTask> & Record<string, unknown>;

// ── helpers ────────────────────────────────────────────────────────────────

function cleanQuantity(raw: string | number | null | undefined): string {
  if (raw === null || raw === undefined) return "0";

  const source = String(raw).trim();
  if (!source) return "0";

  const normalized = source.replace(/^\+/, "");
  const integerPart = normalized.split(".")[0];

  try {
    const bigintValue = BigInt(integerPart || "0");
    const sign = bigintValue < 0n ? "-" : "";
    const digits = bigintValue < 0n ? (-bigintValue).toString() : bigintValue.toString();
    const withCommas = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return `${sign}${withCommas}`;
  } catch {
    return "0";
  }
}

function normalizeStatus(raw: unknown): string {
  const value = String(raw || "").trim().toLowerCase().replace(/[-\s]+/g, "_");

  if (["completed", "complete", "done", "closed", "finished"].includes(value)) {
    return "completed";
  }

  if (["in_progress", "inprocess", "started", "processing", "active", "wip"].includes(value)) {
    return "in_progress";
  }

  if (["pending", "assigned", "new", "open", "queued", "created"].includes(value)) {
    return "pending";
  }

  // Keep unknown values visible instead of hiding data.
  return value || "pending";
}

function normalizeAssignedName(task: PutawayTaskApi): string {
  const direct = task.assigned_to_name ?? task.assignedToName;
  if (typeof direct === "string" && direct.trim()) return direct.trim();
  return "";
}

function normalizeTask(task: PutawayTaskApi): PutawayTask {
  const status = normalizeStatus(task.status ?? task.task_status ?? task.current_status ?? task.state);

  return {
    id: String(task.id || ""),
    task_number: String(task.task_number || "—"),
    item_sku: String(task.item_sku || "—"),
    item_description: String(task.item_description || "—"),
    quantity_to_put: String(task.quantity_to_put ?? "0"),
    quantity_put: String(task.quantity_put ?? "0"),
    status,
    priority: Number.isFinite(Number(task.priority)) ? Number(task.priority) : 0,
    assigned_to_name: normalizeAssignedName(task),
    created_at: String(task.created_at || ""),
    completed_at: task.completed_at ? String(task.completed_at) : null,
  };
}

function formatDate(iso: string | null): string {
  return formatDisplayDateTime(iso, "—");
}

interface PriorityMeta {
  label: string;
  className: string;
}

function priorityMeta(p: number): PriorityMeta {
  switch (p) {
    case 1:
      return {
        label: "High",
        className:
          "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800",
      };
    case 2:
      return {
        label: "Medium",
        className:
          "bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800",
      };
    case 3:
      return {
        label: "Low",
        className:
          "bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800",
      };
    default:
      return {
        label: "Unknown",
        className:
          "bg-muted text-muted-foreground border-border",
      };
  }
}

interface StatusMeta {
  label: string;
  className: string;
}

function statusMeta(raw: string): StatusMeta {
  const label = raw
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

  switch (raw.toLowerCase()) {
    case "pending":
      return {
        label,
        className:
          "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800",
      };
    case "in_progress":
      return {
        label,
        className:
          "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800",
      };
    case "completed":
      return {
        label,
        className:
          "bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800",
      };
    default:
      return {
        label,
        className: "bg-muted text-muted-foreground border-border",
      };
  }
}

// ── main component ─────────────────────────────────────────────────────────

type FilterStatus = "all" | "pending" | "in_progress" | "completed";
type FilterPriority = "all" | "1" | "2" | "3" | "0";
type CardStatusFilter = "all" | "pending" | "in_progress" | "completed";

// Sort field types
type SortField = 'created_at' | 'completed_at' | 'task_number' | 'item_sku' | 'quantity_to_put' | 'priority' | 'status' | 'assigned_to';
type SortOrder = 'asc' | 'desc';

// Priority sort order (High=1 → Medium=2 → Low=3)
const PRIORITY_SORT_ORDER: { [key: number]: number } = {
  1: 0,
  2: 1,
  3: 2,
  0: 3,
};

// Status sort order
const STATUS_SORT_ORDER: { [key: string]: number } = {
  'pending': 0,
  'in_progress': 1,
  'completed': 2,
};

// Get order button label based on sort field and direction
const getOrderLabel = (field: SortField, order: SortOrder): string => {
  if (field === 'created_at' || field === 'completed_at') {
    return order === 'desc' ? '↓ Newest' : '↑ Oldest';
  } else if (field === 'task_number' || field === 'item_sku' || field === 'assigned_to') {
    return order === 'desc' ? '↓ Z→A' : '↑ A→Z';
  } else if (field === 'quantity_to_put') {
    return order === 'desc' ? '↓ High→Low' : '↑ Low→High';
  } else if (field === 'priority') {
    return order === 'desc' ? '↓ High first' : '↑ Low first';
  } else if (field === 'status') {
    return order === 'desc' ? '↓ Completed first' : '↑ Pending first';
  }
  return order === 'desc' ? '↓' : '↑';
};

// Sort putaway tasks array
const sortPutawayTasks = (taskList: PutawayTask[], field: SortField, order: SortOrder): PutawayTask[] => {
  const sorted = [...taskList].sort((a, b) => {
    let aVal: any;
    let bVal: any;

    if (field === 'created_at') {
      aVal = new Date(a.created_at || 0).getTime();
      bVal = new Date(b.created_at || 0).getTime();
    } else if (field === 'completed_at') {
      aVal = new Date(a.completed_at || 0).getTime();
      bVal = new Date(b.completed_at || 0).getTime();
    } else if (field === 'task_number') {
      aVal = a.task_number || '';
      bVal = b.task_number || '';
    } else if (field === 'item_sku') {
      aVal = a.item_sku || '';
      bVal = b.item_sku || '';
    } else if (field === 'quantity_to_put') {
      aVal = parseInt(a.quantity_to_put || '0', 10);
      bVal = parseInt(b.quantity_to_put || '0', 10);
    } else if (field === 'priority') {
      aVal = PRIORITY_SORT_ORDER[a.priority] ?? 999;
      bVal = PRIORITY_SORT_ORDER[b.priority] ?? 999;
    } else if (field === 'status') {
      aVal = STATUS_SORT_ORDER[a.status] ?? 999;
      bVal = STATUS_SORT_ORDER[b.status] ?? 999;
    } else if (field === 'assigned_to') {
      aVal = a.assigned_to_name || '';
      bVal = b.assigned_to_name || '';
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

export default function PutawayTasks() {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<PutawayTask[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");
  const [filterPriority, setFilterPriority] = useState<FilterPriority>("all");
  const [cardStatusFilter, setCardStatusFilter] = useState<CardStatusFilter>("all");
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await api.get<unknown>("/putaway/tasks", {
        timeout: 8000,
      });
      const data = response.data;

      if (!Array.isArray(data)) {
        throw new Error("Unexpected response format from server.");
      }

      const normalized = data.map((task) => normalizeTask(task as PutawayTaskApi));

      // Source of truth for assignee is assigned_to_name. If list response misses it,
      // backfill from task-detail GET so Assigned To column reflects backend assignment.
      const missingAssigned = normalized.filter((t) => !t.assigned_to_name && t.id);

      if (missingAssigned.length === 0) {
        setTasks(normalized);
      } else {
        const enrichedPairs = await Promise.all(
          missingAssigned.map(async (t) => {
            try {
              const detail = await fetchTaskDetail(t.id);
              const assigned = typeof detail.assigned_to_name === "string" ? detail.assigned_to_name.trim() : "";
              return [t.id, assigned] as const;
            } catch {
              return [t.id, ""] as const;
            }
          })
        );

        const assignedMap = new Map<string, string>(enrichedPairs);
        const enrichedTasks = normalized.map((t) => ({
          ...t,
          assigned_to_name: assignedMap.get(t.id) || t.assigned_to_name || "",
        }));

        setTasks(enrichedTasks);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error occurred.";
      setError(message);
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  // ── derived stats ──────────────────────────────────────────────────────

  const total = tasks.length;
  const pendingCount = tasks.filter((t) => t.status === "pending").length;
  const inProgressCount = tasks.filter((t) => t.status === "in_progress").length;
  const completedCount = tasks.filter((t) => t.status === "completed").length;

  const toggleCardFilter = useCallback((target: CardStatusFilter) => {
    setCardStatusFilter((current) => (current === target ? "all" : target));
  }, []);

  // ── filtered data ──────────────────────────────────────────────────────

  const filtered = tasks.filter((t) => {
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      t.task_number.toLowerCase().includes(q) ||
      t.item_sku.toLowerCase().includes(q);

    const matchStatus =
      filterStatus === "all" || t.status === filterStatus;

    const matchCardStatus =
      cardStatusFilter === "all" || t.status === cardStatusFilter;

    const matchPriority =
      filterPriority === "all" || t.priority === Number(filterPriority);

    return matchSearch && matchStatus && matchCardStatus && matchPriority;
  });

  const openTaskDetailPage = useCallback((task: PutawayTask) => {
    navigate(`/dashboard/putaway-tasks/${task.id}`, {
      state: {
        from: "/dashboard/putaway-tasks",
        seedTask: task,
      },
    });
  }, [navigate]);

  // ── loading state ──────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <RefreshCw className="animate-spin h-8 w-8 text-primary" />
        <p className="text-muted-foreground text-sm">Loading putaway tasks…</p>
      </div>
    );
  }

  // ── main render ────────────────────────────────────────────────────────

  return (
    <>
      <div className="w-full max-w-full overflow-x-hidden p-4 sm:p-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Putaway Tasks</h1>
          <p className="text-muted-foreground">
            Manage and track warehouse putaway operations
          </p>
        </div>
        <Button onClick={fetchTasks} disabled={loading} variant="default" size="sm">
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Error notice */}
      {error && (
        <div className="flex items-start gap-3 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>
            <strong>Error:</strong> {error}
          </span>
        </div>
      )}

      {/* Stats bar */}
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
          aria-pressed={cardStatusFilter === "all"}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Tasks</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{total}</p>
          </CardContent>
        </Card>
        <Card
          role="button"
          tabIndex={0}
          onClick={() => toggleCardFilter("pending")}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              toggleCardFilter("pending");
            }
          }}
          className={`cursor-pointer transition-colors border-blue-200 dark:border-blue-800 ${cardStatusFilter === "pending" ? "bg-blue-50 border-blue-400 dark:bg-blue-900/30" : ""}`}
          aria-pressed={cardStatusFilter === "pending"}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-blue-700 dark:text-blue-400">Pending</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-blue-700 dark:text-blue-400">{pendingCount}</p>
          </CardContent>
        </Card>
        <Card
          role="button"
          tabIndex={0}
          onClick={() => toggleCardFilter("in_progress")}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              toggleCardFilter("in_progress");
            }
          }}
          className={`cursor-pointer transition-colors border-orange-200 dark:border-orange-800 ${cardStatusFilter === "in_progress" ? "bg-orange-50 border-orange-400 dark:bg-orange-900/30" : ""}`}
          aria-pressed={cardStatusFilter === "in_progress"}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-orange-700 dark:text-orange-400">In Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-orange-700 dark:text-orange-400">{inProgressCount}</p>
          </CardContent>
        </Card>
        <Card
          role="button"
          tabIndex={0}
          onClick={() => toggleCardFilter("completed")}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              toggleCardFilter("completed");
            }
          }}
          className={`cursor-pointer transition-colors border-green-200 dark:border-green-800 ${cardStatusFilter === "completed" ? "bg-green-50 border-green-400 dark:bg-green-900/30" : ""}`}
          aria-pressed={cardStatusFilter === "completed"}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-green-700 dark:text-green-400">Completed</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-green-700 dark:text-green-400">{completedCount}</p>
          </CardContent>
        </Card>
      </div>

      {/* Search & filter bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search task # or SKU…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as FilterStatus)}
          className="px-3 py-2 rounded-md border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="all">Status</option>
          <option value="pending">Pending</option>
          <option value="in_progress">In Progress</option>
          <option value="completed">Completed</option>
        </select>

        <select
          value={filterPriority}
          onChange={(e) => setFilterPriority(e.target.value as FilterPriority)}
          className="px-3 py-2 rounded-md border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="all">Priorities</option>
          <option value="1">High</option>
          <option value="2">Medium</option>
          <option value="3">Low</option>
          <option value="0">Unknown</option>
        </select>

          {/* Sort by dropdown */}
          <DropdownMenu open={isDropdownOpen} onOpenChange={setIsDropdownOpen}>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <ChevronDown className="w-4 h-4" />
                Sort by
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onClick={() => { setSortField('created_at'); setIsDropdownOpen(false); }} className="flex items-center justify-between">
                <span>Created At</span>
                {sortField === 'created_at' && <span className="text-primary">✓</span>}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => { setSortField('completed_at'); setIsDropdownOpen(false); }} className="flex items-center justify-between">
                <span>Completed At</span>
                {sortField === 'completed_at' && <span className="text-primary">✓</span>}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => { setSortField('task_number'); setIsDropdownOpen(false); }} className="flex items-center justify-between">
                <span>Task #</span>
                {sortField === 'task_number' && <span className="text-primary">✓</span>}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => { setSortField('item_sku'); setIsDropdownOpen(false); }} className="flex items-center justify-between">
                <span>SKU</span>
                {sortField === 'item_sku' && <span className="text-primary">✓</span>}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => { setSortField('quantity_to_put'); setIsDropdownOpen(false); }} className="flex items-center justify-between">
                <span>Qty To Put</span>
                {sortField === 'quantity_to_put' && <span className="text-primary">✓</span>}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => { setSortField('priority'); setIsDropdownOpen(false); }} className="flex items-center justify-between">
                <span>Priority</span>
                {sortField === 'priority' && <span className="text-primary">✓</span>}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => { setSortField('status'); setIsDropdownOpen(false); }} className="flex items-center justify-between">
                <span>Status</span>
                {sortField === 'status' && <span className="text-primary">✓</span>}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => { setSortField('assigned_to'); setIsDropdownOpen(false); }} className="flex items-center justify-between">
                <span>Assigned To</span>
                {sortField === 'assigned_to' && <span className="text-primary">✓</span>}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Order toggle button */}
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
          >
            {getOrderLabel(sortField, sortOrder)}
          </Button>
      </div>

      {/* Empty state */}
      {filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 gap-3 text-center">
          <Package className="h-10 w-10 text-muted-foreground/30" />
          <p className="text-muted-foreground text-sm">No tasks match your filters.</p>
        </div>
      )}

      {/* Desktop table */}
      {filtered.length > 0 && (
        <div className="hidden 2xl:block rounded-md border bg-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Task #</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Qty To Put</TableHead>
                <TableHead className="text-right">Qty Put</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Assigned To</TableHead>
                <TableHead>Created At</TableHead>
                <TableHead>Completed At</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
                {sortPutawayTasks(filtered, sortField, sortOrder).map((task) => {
                const sm = statusMeta(task.status);
                const pm = priorityMeta(task.priority);
                return (
                  <TableRow key={task.id}>
                    <TableCell className="font-medium">
                      {task.task_number}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {task.item_sku}
                    </TableCell>
                    <TableCell className="max-w-[180px] truncate" title={task.item_description}>
                      {task.item_description}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {cleanQuantity(task.quantity_to_put)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {cleanQuantity(task.quantity_put)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={sm.className}
                      >
                        {sm.label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={pm.className}
                      >
                        {pm.label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {task.assigned_to_name || "Unassigned"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDate(task.created_at)}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDate(task.completed_at)}
                    </TableCell>
                    <TableCell className="text-right">
                      <button
                        type="button"
                        onClick={() => openTaskDetailPage(task)}
                        className="inline-flex items-center justify-center rounded-md border border-border bg-background p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        aria-label={`View details for task ${task.task_number}`}
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Mobile cards */}
      {filtered.length > 0 && (
        <div className="2xl:hidden space-y-3">
            {sortPutawayTasks(filtered, sortField, sortOrder).map((task) => {
            const sm = statusMeta(task.status);
            const pm = priorityMeta(task.priority);
            return (
              <Card key={task.id}>
                <CardContent className="p-4 space-y-3">
                  {/* Card header */}
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <p className="font-semibold text-base">{task.task_number}</p>
                      <p className="text-xs text-muted-foreground font-mono">{task.item_sku}</p>
                    </div>
                    <div className="flex gap-1.5 flex-wrap justify-end items-center">
                      <Badge variant="outline" className={sm.className}>{sm.label}</Badge>
                      <Badge variant="outline" className={pm.className}>{pm.label}</Badge>
                      <button
                        type="button"
                        onClick={() => openTaskDetailPage(task)}
                        className="inline-flex items-center justify-center rounded-md border border-border bg-background p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        aria-label={`View details for task ${task.task_number}`}
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {/* Description */}
                  <p className="text-sm text-foreground">{task.item_description}</p>

                  {/* Quantities */}
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="bg-muted rounded-md p-3">
                      <p className="text-xs text-muted-foreground">Qty To Put</p>
                      <p className="font-bold text-lg tabular-nums">
                        {cleanQuantity(task.quantity_to_put)}
                      </p>
                    </div>
                    <div className="bg-muted rounded-md p-3">
                      <p className="text-xs text-muted-foreground">Qty Put</p>
                      <p className="font-bold text-lg tabular-nums">
                        {cleanQuantity(task.quantity_put)}
                      </p>
                    </div>
                  </div>

                  {/* Metadata */}
                  <div className="text-xs text-muted-foreground space-y-1 pt-2 border-t border-border">
                    <div className="flex justify-between">
                      <span>Assigned to</span>
                      <span className="text-foreground font-medium">{task.assigned_to_name || "Unassigned"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Created</span>
                      <span>{formatDate(task.created_at)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Completed</span>
                      <span>{formatDate(task.completed_at)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Footer count */}
      {filtered.length > 0 && (
        <p className="text-xs text-muted-foreground text-right">
          Showing {filtered.length} of {total} task{total !== 1 ? "s" : ""}
        </p>
      )}

    </div>
    </>
  );
}
