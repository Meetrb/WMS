import { useState, useEffect, useCallback } from "react";
import { RefreshCw, AlertTriangle, Search, Package, Eye } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatDisplayDateTime } from "@/lib/date";
import { useAuth } from "@/components/auth-provider";
import { putawayService } from "@/services/putawayService";
import { pickingService } from "@/services/pickingService";
import { replenishmentService } from "@/services/replenishmentService";
import { packingService } from "@/services/packingService";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export interface UnifiedCompletedTask {
  id: string;
  task_number: string;
  item_sku: string;
  item_description: string;
  quantity_required: string;
  quantity_processed: string;
  status: string;
  completed_at: string | null;
  worker_type: string;
  rawTask: Record<string, unknown>;
}

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

function formatDate(iso: string | null): string {
  return formatDisplayDateTime(iso, "—");
}

function normalizeWorkerRole(rawRole: unknown): string {
  const base = String(rawRole ?? "").trim().toLowerCase().replace(/[_-]+/g, " ");
  const compact = base.replace(/\s+/g, "");

  if (compact === "putawayworker" || compact === "worker") return "putaway worker";
  if (compact === "replenishmentworker") return "replenishment worker";
  if (compact === "inspectionworker") return "inspection worker";
  if (compact === "picker") return "picker";
  if (compact === "packer") return "packer";

  return base;
}

function normalizeTask(task: any, role: string): UnifiedCompletedTask {
  const safeTask = task || {};
  
  // Extract fields robustly
  const id = String(safeTask.id || safeTask.task_id || safeTask.order_id || `temp-${Math.random()}`);
  const task_number = String(safeTask.task_number || safeTask.order_number || safeTask.number || id);
  const item_sku = String(safeTask.pallet_code || safeTask.item_sku || safeTask.sku || safeTask.product_sku || "N/A");
  const item_description = String(safeTask.pallet_barcode || safeTask.item_description || safeTask.description || safeTask.product_description || "");
  
  // Quantity logic depends on role/task type
  let required = safeTask.quantity_to_put || safeTask.quantity_required || safeTask.total_quantity || safeTask.target_quantity || safeTask.quantity || 0;
  let processed = safeTask.quantity_put || safeTask.quantity_picked || safeTask.quantity_moved || safeTask.packed_quantity || safeTask.completed_quantity || required;

  return {
    id,
    task_number,
    item_sku,
    item_description,
    quantity_required: String(required),
    quantity_processed: String(processed),
    status: String(safeTask.status || safeTask.task_status || safeTask.order_status || "completed"),
    completed_at: safeTask.completed_at ? String(safeTask.completed_at) : (safeTask.updated_at ? String(safeTask.updated_at) : null),
    worker_type: role,
    rawTask: safeTask
  };
}

export default function WorkerCompletedTasks() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [tasks, setTasks] = useState<UnifiedCompletedTask[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState<string>("");

  const role = normalizeWorkerRole(user?.role);
  const isPutawayCompletedRoute = location.pathname === "/dashboard/worker/completed";

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let data: any[] = [];
      
      if (isPutawayCompletedRoute) {
        data = await putawayService.getCompletedTasks();
      } else if (role === "putaway worker") {
        data = await putawayService.getCompletedTasks();
      } else if (role === "picker") {
        data = await pickingService.getCompletedTasks();
      } else if (role === "replenishment worker") {
        data = await replenishmentService.getCompletedTasks();
      } else if (role === "packer") {
        data = await packingService.getPackedOrders();
      } else {
        // Fallback or Admin view - maybe fetch from all? For now, empty.
        data = [];
      }

      const normalized = (data || []).map(t => normalizeTask(t, role));
      setTasks(normalized);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error occurred.";
      setError(message);
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }, [isPutawayCompletedRoute, role]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const filtered = tasks.filter((t) => {
    const q = search.toLowerCase();
    return (
      !q ||
      t.task_number.toLowerCase().includes(q) ||
      t.item_sku.toLowerCase().includes(q) ||
      t.item_description.toLowerCase().includes(q)
    );
  });

  const openTaskDetailPage = useCallback((task: UnifiedCompletedTask) => {
    // Navigate dynamically based on role
    if (task.worker_type === "putaway worker") {
      navigate(`/dashboard/worker/tasks/${task.id}`, {
        state: { from: "/dashboard/completed-tasks", seedTask: task.rawTask },
      });
    } else if (task.worker_type === "picker") {
      navigate(`/dashboard/picking/tasks/${task.id}`, {
        state: { from: "/dashboard/completed-tasks", seedTask: task.rawTask },
      });
    } else if (task.worker_type === "replenishment worker") {
      navigate(`/dashboard/replenishment-tasks/${task.id}`, {
        state: { from: "/dashboard/completed-tasks", seedTask: task.rawTask },
      });
    } else if (task.worker_type === "packer") {
      navigate(`/dashboard/packing/${task.id}`, {
        state: { from: "/dashboard/completed-tasks", seedTask: task.rawTask },
      });
    }
  }, [navigate]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <RefreshCw className="animate-spin h-8 w-8 text-primary" />
        <p className="text-muted-foreground text-sm">Loading completed tasks…</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-full overflow-x-hidden p-4 sm:p-6 space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Completed Work</h1>
          <p className="text-muted-foreground">
            View your completed {role.replace(" worker", "")} tasks
          </p>
        </div>
        <Button onClick={fetchTasks} disabled={loading} variant="default" size="sm">
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {error && (
        <div className="flex items-start gap-3 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>
            <strong>Error:</strong> {error}
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Completed</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-green-600 dark:text-green-500">{tasks.length}</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search task # or SKU…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 gap-3 text-center">
          <Package className="h-10 w-10 text-muted-foreground/30" />
          <p className="text-muted-foreground text-sm">No completed tasks found.</p>
        </div>
      )}

      {filtered.length > 0 && (
        <div className="hidden 2xl:block rounded-md border bg-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Task #</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Qty Required</TableHead>
                <TableHead className="text-right">Qty Processed</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Completed At</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
                {filtered.map((task) => (
                  <TableRow key={task.id}>
                    <TableCell className="font-medium">{task.task_number}</TableCell>
                    <TableCell className="font-mono text-xs">{task.item_sku}</TableCell>
                    <TableCell className="max-w-[200px] truncate" title={task.item_description}>
                      {task.item_description}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {cleanQuantity(task.quantity_required)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {cleanQuantity(task.quantity_processed)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800">
                        {task.status.replace(/_/g, " ").toUpperCase()}
                      </Badge>
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
                ))}
            </TableBody>
          </Table>
        </div>
      )}

      {filtered.length > 0 && (
        <div className="2xl:hidden space-y-3">
            {filtered.map((task) => (
              <Card key={task.id}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <p className="font-semibold text-base">{task.task_number}</p>
                      <p className="text-xs text-muted-foreground font-mono">{task.item_sku}</p>
                    </div>
                    <div className="flex gap-1.5 flex-wrap justify-end items-center">
                      <Badge variant="outline" className="bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800">
                        {task.status.replace(/_/g, " ").toUpperCase()}
                      </Badge>
                      <button
                        type="button"
                        onClick={() => openTaskDetailPage(task)}
                        className="inline-flex items-center justify-center rounded-md border border-border bg-background p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <p className="text-sm text-foreground">{task.item_description}</p>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="bg-muted rounded-md p-3">
                      <p className="text-xs text-muted-foreground">Qty Required</p>
                      <p className="font-bold text-lg tabular-nums">
                        {cleanQuantity(task.quantity_required)}
                      </p>
                    </div>
                    <div className="bg-muted rounded-md p-3">
                      <p className="text-xs text-muted-foreground">Qty Processed</p>
                      <p className="font-bold text-lg tabular-nums">
                        {cleanQuantity(task.quantity_processed)}
                      </p>
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground space-y-1 pt-2 border-t border-border">
                    <div className="flex justify-between">
                      <span>Completed At</span>
                      <span>{formatDate(task.completed_at)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
        </div>
      )}
    </div>
  );
}
