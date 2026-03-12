import { useState, useEffect, useCallback } from "react";
import { RefreshCw, AlertTriangle, Search, Package, Eye, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
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

function buildMockTaskDetail(taskId: string, seedTask?: PutawayTask): PutawayTaskDetail {
  const now = new Date().toISOString();
  return {
    id: taskId,
    task_number: seedTask?.task_number || `PUT-${taskId.slice(0, 8).toUpperCase()}`,
    inbound_shipment_id: "inbound-shipment-id",
    grn_id: "grn-id",
    asn_shipment_item_id: "asn-shipment-item-id",
    item_id: "item-id",
    item_sku: seedTask?.item_sku || "SKU-000",
    item_description: seedTask?.item_description || "Demo item description",
    quantity_to_put: seedTask?.quantity_to_put || "0",
    quantity_put: seedTask?.quantity_put || "0",
    source_location: "SRC-A1",
    suggested_bin_id: "bin-id",
    suggested_bin_code: "BIN-A-01",
    actual_bin_code: "BIN-A-01",
    lot_number: "LOT-001",
    batch_number: "BATCH-001",
    expiry_date: null,
    priority: seedTask?.priority || 0,
    notes: "Mock detail shown because detail API request failed.",
    task_data: {},
    assigned_to_id: "assigned-user-id",
    assigned_to_name: seedTask?.assigned_to_name || "Unassigned",
    assigned_at: now,
    started_at: null,
    completed_at: seedTask?.completed_at || null,
    status: seedTask?.status || "pending",
    queue_position: 0,
    created_by_id: "creator-id",
    created_by_name: "System",
    created_at: seedTask?.created_at || now,
    updated_at: now,
    inbound_shipment_number: "INB-0001",
    grn_number: "GRN-0001",
  };
}

const sectionTitleClass = "text-[11px] font-semibold uppercase tracking-wider text-muted-foreground";
const sectionCardClass = "rounded-lg border border-border bg-card p-3";

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-sm font-medium break-all">{value || "—"}</p>
    </div>
  );
}

function getTaskDataValue(taskData: Record<string, object>, key: string): unknown {
  const value = (taskData as Record<string, unknown>)[key];
  return value === undefined || value === null ? "—" : value;
}

function formatTaskDataValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (Array.isArray(value)) return value.length ? value.map((v) => String(v)).join(", ") : "—";
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return "—";
    }
  }
  return String(value);
}

function TaskDataField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-muted/30 p-3">
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium break-all">{value}</p>
    </div>
  );
}

// ── main component ─────────────────────────────────────────────────────────

type FilterStatus = "all" | "pending" | "in_progress" | "completed";
type FilterPriority = "all" | "1" | "2" | "3" | "0";

export default function PutawayTasks() {
  const [tasks, setTasks] = useState<PutawayTask[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");
  const [filterPriority, setFilterPriority] = useState<FilterPriority>("all");
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [taskDetail, setTaskDetail] = useState<PutawayTaskDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState<boolean>(false);
  const [detailError, setDetailError] = useState<string | null>(null);

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

  // ── filtered data ──────────────────────────────────────────────────────

  const filtered = tasks.filter((t) => {
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      t.task_number.toLowerCase().includes(q) ||
      t.item_sku.toLowerCase().includes(q);

    const matchStatus =
      filterStatus === "all" || t.status === filterStatus;

    const matchPriority =
      filterPriority === "all" || t.priority === Number(filterPriority);

    return matchSearch && matchStatus && matchPriority;
  });

  const closeTaskDetailModal = () => {
    setSelectedTaskId(null);
    setTaskDetail(null);
    setDetailError(null);
    setDetailLoading(false);
  };

  const loadTaskDetail = useCallback(async (taskId: string) => {
    setSelectedTaskId(taskId);
    setTaskDetail(null);
    setDetailError(null);
    setDetailLoading(true);

    try {
      const detail = await fetchTaskDetail(taskId);
      setTaskDetail(detail);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to fetch task details.";
      setDetailError(message);
      const seedTask = tasks.find((t) => t.id === taskId);
      setTaskDetail(buildMockTaskDetail(taskId, seedTask));
    } finally {
      setDetailLoading(false);
    }
  }, [tasks]);

  const hasTaskData = !!taskDetail && Object.keys(taskDetail.task_data).length > 0;

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
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Tasks</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{total}</p>
          </CardContent>
        </Card>
        <Card className="border-blue-200 dark:border-blue-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-blue-700 dark:text-blue-400">Pending</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-blue-700 dark:text-blue-400">{pendingCount}</p>
          </CardContent>
        </Card>
        <Card className="border-orange-200 dark:border-orange-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-orange-700 dark:text-orange-400">In Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-orange-700 dark:text-orange-400">{inProgressCount}</p>
          </CardContent>
        </Card>
        <Card className="border-green-200 dark:border-green-800">
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
              {filtered.map((task) => {
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
                        onClick={() => loadTaskDetail(task.id)}
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
          {filtered.map((task) => {
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
                        onClick={() => loadTaskDetail(task.id)}
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

      {/* Task Detail Modal */}
      {selectedTaskId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-0 sm:p-4 transition-opacity duration-200"
          onClick={closeTaskDetailModal}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="h-full w-full max-w-[calc(100vw-1rem)] sm:h-auto sm:max-h-[88vh] sm:max-w-5xl lg:max-w-6xl rounded-none sm:rounded-xl border border-border bg-background shadow-2xl overflow-hidden transform transition-all duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div>
                <h2 className="text-lg font-semibold">Task Detail</h2>
                <p className="text-xs text-muted-foreground">Task ID: {selectedTaskId}</p>
              </div>
              <button
                type="button"
                onClick={closeTaskDetailModal}
                className="inline-flex items-center justify-center rounded-md border border-border p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label="Close task detail"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="max-h-[calc(100vh-76px)] sm:max-h-[calc(88vh-76px)] overflow-y-auto px-4 sm:px-5 py-4 space-y-4">
              {detailLoading && (
                <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Loading task detail...
                </div>
              )}

              {detailError && (
                <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3">
                  <p className="text-sm text-destructive">
                    <strong>Error:</strong> {detailError}
                  </p>
                  <div className="mt-3">
                    <button
                      type="button"
                      onClick={() => selectedTaskId && loadTaskDetail(selectedTaskId)}
                      className="inline-flex items-center rounded-md border border-border px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                    >
                      Retry
                    </button>
                  </div>
                </div>
              )}

              {taskDetail && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <section className={sectionCardClass}>
                    <p className={sectionTitleClass}>Section 1 — Task Overview</p>
                    <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <DetailField label="Task Number" value={taskDetail.task_number} />
                      <div className="space-y-1">
                        <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Status</p>
                        <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${statusMeta(taskDetail.status).className}`}>
                          {statusMeta(taskDetail.status).label}
                        </span>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Priority</p>
                        <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${priorityMeta(taskDetail.priority).className}`}>
                          {priorityMeta(taskDetail.priority).label}
                        </span>
                      </div>
                      <DetailField label="Queue Position" value={String(taskDetail.queue_position)} />
                    </div>
                  </section>

                  <section className={sectionCardClass}>
                    <p className={sectionTitleClass}>Section 4 — Shipment & GRN</p>
                    <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <DetailField label="Inbound Shipment Number" value={taskDetail.inbound_shipment_number || "—"} />
                      <DetailField label="GRN Number" value={taskDetail.grn_number || "—"} />
                    </div>
                  </section>

                  <section className={`${sectionCardClass} lg:col-span-2`}>
                    <p className={sectionTitleClass}>Section 2 — Item Details</p>
                    <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                      <DetailField label="SKU" value={taskDetail.item_sku} />
                      <DetailField label="Description" value={taskDetail.item_description} />
                      <DetailField label="Qty To Put" value={cleanQuantity(taskDetail.quantity_to_put)} />
                      <DetailField label="Qty Put" value={cleanQuantity(taskDetail.quantity_put)} />
                      <DetailField label="Lot Number" value={taskDetail.lot_number || "—"} />
                      <DetailField label="Batch Number" value={taskDetail.batch_number || "—"} />
                      <DetailField label="Expiry Date" value={formatDate(taskDetail.expiry_date)} />
                    </div>
                  </section>

                  <section className={`${sectionCardClass} lg:col-span-2`}>
                    <p className={sectionTitleClass}>Section 3 — Location Info</p>
                    <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <DetailField label="Source Location" value={taskDetail.source_location || "—"} />
                      <DetailField label="Suggested Bin Code" value={taskDetail.suggested_bin_code || "—"} />
                      <DetailField label="Actual Bin Code" value={taskDetail.actual_bin_code || "—"} />
                    </div>
                  </section>

                  <section className={`${sectionCardClass} lg:col-span-2`}>
                    <p className={sectionTitleClass}>Section 5 — Assignment & Timeline</p>
                    <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                      <DetailField label="Assigned To" value={taskDetail.assigned_to_name || "—"} />
                      <DetailField label="Assigned At" value={formatDate(taskDetail.assigned_at)} />
                      <DetailField label="Started At" value={formatDate(taskDetail.started_at)} />
                      <DetailField label="Completed At" value={formatDate(taskDetail.completed_at)} />
                      <DetailField label="Created By" value={taskDetail.created_by_name || "—"} />
                      <DetailField label="Created At" value={formatDate(taskDetail.created_at)} />
                      <DetailField label="Updated At" value={formatDate(taskDetail.updated_at)} />
                    </div>
                  </section>

                  <section className={sectionCardClass}>
                    <p className={sectionTitleClass}>Section 6 — Notes</p>
                    <p className="mt-2 text-sm">{taskDetail.notes?.trim() ? taskDetail.notes : "—"}</p>
                  </section>

                  {hasTaskData && (
                    <section className={`${sectionCardClass} lg:col-span-1`}>
                      <p className={sectionTitleClass}>Task Data Insights</p>
                      <div className="mt-2 space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <TaskDataField
                            label="Strategy"
                            value={formatTaskDataValue(getTaskDataValue(taskDetail.task_data, "strategy"))}
                          />
                          <TaskDataField
                            label="Items Count"
                            value={formatTaskDataValue(getTaskDataValue(taskDetail.task_data, "items_count"))}
                          />
                          <div className="sm:col-span-2">
                            <TaskDataField
                              label="Reason"
                              value={formatTaskDataValue(getTaskDataValue(taskDetail.task_data, "reason"))}
                            />
                          </div>
                          <TaskDataField
                            label="Pallet ID"
                            value={formatTaskDataValue(getTaskDataValue(taskDetail.task_data, "pallet_id"))}
                          />
                          <TaskDataField
                            label="Zone"
                            value={formatTaskDataValue(getTaskDataValue(taskDetail.task_data, "zone"))}
                          />
                        </div>

                        {Array.isArray((taskDetail.task_data as Record<string, unknown>).group_items) && (
                          <div>
                            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Group Items</p>
                            <div className="mt-2 flex flex-wrap gap-2">
                              {((taskDetail.task_data as Record<string, unknown>).group_items as unknown[]).map((item, index) => (
                                <span
                                  key={`${String(item)}-${index}`}
                                  className="inline-flex max-w-full rounded-full border border-border bg-background px-2.5 py-1 text-xs font-mono text-foreground break-all whitespace-normal"
                                >
                                  {String(item)}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </section>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
