import { useState, useEffect, useCallback, useMemo } from "react";
import { RefreshCw, AlertTriangle, Search, Eye } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatDisplayDateTime } from "@/lib/date";
import { useAuth } from "@/components/auth-provider";
import { toast } from "sonner";
import { pickingService } from "@/services/pickingService";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface CompletedPickingTask {
  id: string;
  task_number: string;
  order_number: string;
  item_sku: string;
  item_description: string;
  quantity_to_pick: number | string;
  quantity_picked: number | string;
  status: string;
  assigned_to_name: string;
  completed_at: string | null;
  priority: number;
  notes: string;
  [key: string]: unknown;
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

const normalizeTask = (task: any): CompletedPickingTask => {
  const safeTask = task || {};
  return {
    id: String(safeTask.id || safeTask.task_id || ""),
    task_number: String(safeTask.task_number || safeTask.order_number || ""),
    order_number: String(safeTask.order_number || safeTask.sales_order_number || ""),
    item_sku: String(safeTask.item_sku || safeTask.sku || "N/A"),
    item_description: String(safeTask.item_description || safeTask.description || ""),
    quantity_to_pick: safeTask.quantity_to_pick || safeTask.quantity_required || 0,
    quantity_picked: safeTask.quantity_picked || safeTask.quantity_processed || 0,
    status: String(safeTask.status || "COMPLETED"),
    assigned_to_name: String(safeTask.assigned_to_name || safeTask.picker_name || ""),
    completed_at: safeTask.completed_at || null,
    priority: safeTask.priority || 0,
    notes: String(safeTask.notes || ""),
    ...safeTask,
  };
};

export default function CompletedPickingTasks() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [tasks, setTasks] = useState<CompletedPickingTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"date" | "priority">("date");

  const loadCompletedTasks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await pickingService.getCompletedNotMovedOrders();
      const tasksArray = Array.isArray(response) ? response : response?.data || [];
      const normalized = tasksArray.map(normalizeTask);
      setTasks(normalized);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load completed orders";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCompletedTasks();
  }, [loadCompletedTasks]);

  const filteredAndSorted = useMemo(() => {
    let filtered = tasks.filter((task) => {
      const query = searchQuery.toLowerCase();
      return (
        task.task_number.toLowerCase().includes(query) ||
        task.order_number.toLowerCase().includes(query) ||
        task.item_sku.toLowerCase().includes(query) ||
        task.item_description.toLowerCase().includes(query) ||
        task.assigned_to_name.toLowerCase().includes(query)
      );
    });

    if (sortBy === "date") {
      filtered.sort((a, b) => {
        const dateA = new Date(a.completed_at || 0).getTime();
        const dateB = new Date(b.completed_at || 0).getTime();
        return dateB - dateA;
      });
    } else {
      filtered.sort((a, b) => b.priority - a.priority);
    }

    return filtered;
  }, [tasks, searchQuery, sortBy]);

  return (
    <div className="w-full max-w-full overflow-x-hidden p-4 sm:p-6 space-y-6 animate-fade-in">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Completed Orders - Not Moved</h1>
          <p className="text-muted-foreground">Total: {filteredAndSorted.length} completed orders</p>
        </div>
        <Button onClick={loadCompletedTasks} disabled={loading} variant="outline" size="sm">
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {error && (
        <div className="flex items-start gap-3 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            <strong>Error:</strong> {error}
          </span>
        </div>
      )}

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle>Tasks</CardTitle>
            <div className="flex gap-2">
              <div className="flex-1 sm:flex-none">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search tasks..."
                    className="pl-10"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>
              <select
                className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as "date" | "priority")}
              >
                <option value="date">Sort by Date (Newest)</option>
                <option value="priority">Sort by Priority</option>
              </select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredAndSorted.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-lg font-semibold">No completed orders to move yet</p>
              <p className="text-sm text-muted-foreground">Completed orders will appear here.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Task Number</TableHead>
                    <TableHead>Order Number</TableHead>
                    <TableHead>Item SKU</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Qty Picked</TableHead>
                    <TableHead>Completed At</TableHead>
                    <TableHead>Assigned To</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead className="w-10">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAndSorted.map((task) => (
                    <TableRow key={task.id}>
                      <TableCell className="font-mono font-semibold">{task.task_number}</TableCell>
                      <TableCell className="font-mono">{task.order_number}</TableCell>
                      <TableCell className="font-mono">{task.item_sku}</TableCell>
                      <TableCell className="max-w-xs truncate">{task.item_description || "-"}</TableCell>
                      <TableCell className="text-right font-semibold">
                        {cleanQuantity(task.quantity_picked)}
                      </TableCell>
                      <TableCell className="text-sm">{formatDate(task.completed_at)}</TableCell>
                      <TableCell>{task.assigned_to_name || "-"}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            task.priority === 1
                              ? "bg-red-50 text-red-700 border-red-200"
                              : task.priority === 2
                              ? "bg-orange-50 text-orange-700 border-orange-200"
                              : "bg-blue-50 text-blue-700 border-blue-200"
                          }
                        >
                          {task.priority === 1 ? "High" : task.priority === 2 ? "Medium" : "Low"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigate(`/dashboard/picking-tasks/${task.id}`)}
                          title="View details"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
