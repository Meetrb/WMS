import { useCallback, useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatDisplayDateTime } from "@/lib/date";

type TaskStatus = "PENDING" | "ASSIGNED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED" | "ON_HOLD";

const TASK_STATUS_ORDER: TaskStatus[] = [
  "PENDING",
  "ASSIGNED",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
  "ON_HOLD",
];

const formatStatusLabel = (status: TaskStatus): string => status.replace(/_/g, " ");

interface NormalizedPickingTask {
  taskId: string;
  taskNumber: string;
  salesOrderNumber: string;
  salesOrderItemId: string;
  orderNumber: string;
  orderSalesId: string;
  itemId: string;
  assignedToName: string;
  assignedToId: string;
  sourceStatus: string;
  itemSku: string;
  itemDescription: string;
  quantityToPickRaw: string;
  quantityPickedRaw: string;
  quantityToPick: number;
  quantityPicked: number;
  sourceBinId: string;
  sourceBinCode: string;
  sourceZoneId: string;
  sourceZoneName: string;
  trolleyBarcode: string;
  rackBarcode: string;
  rackId: string;
  status: TaskStatus;
  priority: number;
  lotNumber: string;
  batchNumber: string;
  expiryDate: string;
  itemCount: number;
  itemsDisplay: string;
  notes: string;
  assignedAt: string;
  startedAt: string;
  completedAt: string;
  createdAt: string;
  createdByName: string;
}

interface TaskWorkflowProgress {
  started: boolean;
  rackScanned: boolean;
  completed: boolean;
  movedToPacker: boolean;
}

type ApiPickingTask = Record<string, unknown>;

const isTaskLikeRecord = (value: unknown): value is ApiPickingTask => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;

  const row = value as Record<string, unknown>;
  return (
    row.task_number !== undefined ||
    row.task_id !== undefined ||
    row.id !== undefined
  );
};

const extractTaskLikeRecords = (payload: unknown, depth = 0): ApiPickingTask[] => {
  if (depth > 5 || payload === null || payload === undefined) return [];

  if (Array.isArray(payload)) {
    return payload.flatMap((entry) => extractTaskLikeRecords(entry, depth + 1));
  }

  if (typeof payload !== "object") return [];

  const row = payload as Record<string, unknown>;
  const collected: ApiPickingTask[] = [];

  if (isTaskLikeRecord(row)) {
    collected.push(row);
  }

  for (const value of Object.values(row)) {
    if (value && (typeof value === "object" || Array.isArray(value))) {
      collected.push(...extractTaskLikeRecords(value, depth + 1));
    }
  }

  return collected;
};

const extractAdminDashboardTasks = (payload: unknown): ApiPickingTask[] => {
  const candidates = extractTaskLikeRecords(payload);
  const seen = new Set<string>();

  return candidates.filter((task, index) => {
    const key = String(task.id ?? task.task_id ?? task.task_number ?? `idx-${index}`);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const str = (v: unknown, fallback = "-"): string => {
  if (v === null || v === undefined) return fallback;
  const text = String(v).trim();
  return text ? text : fallback;
};

const num = (v: unknown, fallback = 0): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

const normalizeStatus = (raw: unknown): TaskStatus => {
  const value = String(raw ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (["pending", "open", "new"].includes(value)) return "PENDING";
  if (["assigned"].includes(value)) return "ASSIGNED";
  if (["in_progress", "inprocess", "started", "active"].includes(value)) return "IN_PROGRESS";
  if (["completed", "complete", "done", "closed"].includes(value)) return "COMPLETED";
  if (["cancelled", "canceled"].includes(value)) return "CANCELLED";
  if (["on_hold", "hold", "paused"].includes(value)) return "ON_HOLD";
  return "PENDING";
};

const normalizeTask = (task: ApiPickingTask, index: number): NormalizedPickingTask => {
  const items = (task.items ?? []) as unknown[];
  const firstItem = items[0] as Record<string, unknown> | undefined;
  const itemsDisplay = items
    .map((item) => {
      const row = item as Record<string, unknown>;
      return str(row.sku ?? row.item_sku ?? row.skuCode, "Unknown");
    })
    .join(", ");

  return {
    taskId: str(task.id ?? task.task_id ?? `PICK-${index + 1}`),
    taskNumber: str(task.task_number ?? task.id),
    salesOrderNumber: str(
      task.sales_order_number ??
      task.salesOrderNumber ??
      task.order_number ??
      task.orderNumber ??
      task.sales_order_id ??
      task.salesOrderId
    ),
    salesOrderItemId: str(task.sales_order_item_id),
    orderNumber: str(task.order_number ?? task.sales_order_id),
    orderSalesId: str(task.sales_order_id ?? task.order_id),
    itemId: str(task.item_id),
    assignedToName: str(task.assigned_to_name ?? task.picker_name ?? task.assigned_to ?? "Unassigned"),
    assignedToId: str(task.assigned_to_id ?? ""),
    sourceStatus: str(task.status ?? task.task_status),
    itemSku: str(task.item_sku ?? (Array.isArray(task.items) ? ((task.items[0] as Record<string, unknown>)?.sku ?? (task.items[0] as Record<string, unknown>)?.item_sku) : ""), "-"),
    itemDescription: str(task.item_description ?? ""),
    quantityToPickRaw: str(task.quantity_to_pick ?? task.quantity ?? 0),
    quantityPickedRaw: str(task.quantity_picked ?? 0),
    quantityToPick: num(task.quantity_to_pick ?? task.quantity ?? 0),
    quantityPicked: num(task.quantity_picked ?? 0),
    sourceBinId: str(task.source_bin_id ?? ""),
    sourceBinCode: str(task.source_bin_code ?? ""),
    sourceZoneId: str(task.source_zone_id ?? ""),
    sourceZoneName: str(task.source_zone_name ?? ""),
    trolleyBarcode: str(task.trolley_barcode ?? "", ""),
    rackBarcode: str(task.rack_barcode ?? "", ""),
    rackId: str(task.rack_id ?? "", ""),
    status: normalizeStatus(task.status ?? task.task_status),
    priority: num(task.priority ?? 3),
    lotNumber: str(task.lot_number ?? ""),
    batchNumber: str(task.batch_number ?? ""),
    expiryDate: str(
      task.expiry_date ??
      task.expiryDate ??
      task.expiration_date ??
      task.expirationDate ??
      firstItem?.expiry_date ??
      firstItem?.expiryDate ??
      firstItem?.expiration_date ??
      firstItem?.expirationDate ??
      ""
    ),
    itemCount: Array.isArray(task.items) ? task.items.length : 0,
    itemsDisplay: itemsDisplay || "No items",
    notes: str(task.notes ?? task.task_notes ?? ""),
    assignedAt: str(task.assigned_at ?? task.created_at),
    startedAt: str(task.started_at ?? ""),
    completedAt: str(task.completed_at ?? ""),
    createdAt: str(task.created_at ?? ""),
    createdByName: str(task.created_by_name ?? ""),
  };
};

// Transform completed order from /picking/orders/completed-not-moved endpoint into NormalizedPickingTask
const transformCompletedOrder = (order: Record<string, unknown>, index: number): NormalizedPickingTask => {
  const items = (order.items ?? []) as unknown[];
  const pickingTasks = (order.picking_tasks ?? []) as unknown[];
  const firstItem = items[0] as Record<string, unknown> | undefined;
  const firstPickingTask = pickingTasks[0] as Record<string, unknown> | undefined;
  
  const itemsDisplay = items
    .map((item) => {
      const row = item as Record<string, unknown>;
      return str(row.item_sku ?? row.sku ?? "Unknown");
    })
    .join(", ");

  return {
    taskId: str(firstPickingTask?.task_id ?? order.sales_order_id ?? `ORDER-${index + 1}`),
    taskNumber: str(firstPickingTask?.task_number ?? order.order_number ?? `ORDER-${index + 1}`),
    salesOrderNumber: str(
      order.sales_order_number ??
      order.salesOrderNumber ??
      order.order_number ??
      order.orderNumber ??
      order.sales_order_id ??
      order.salesOrderId ??
      ""
    ),
    salesOrderItemId: str(firstItem?.sales_order_item_id ?? ""),
    orderNumber: str(order.order_number ?? ""),
    orderSalesId: str(order.sales_order_id ?? ""),
    itemId: str(firstItem?.item_id ?? ""),
    assignedToName: str(order.picked_by_name ?? firstPickingTask?.assigned_to_name ?? "Completed"),
    assignedToId: str(firstPickingTask?.assigned_to_id ?? ""),
    sourceStatus: "COMPLETED",
    itemSku: str(firstItem?.item_sku ?? firstItem?.sku ?? "", "-"),
    itemDescription: str(firstItem?.item_description ?? ""),
    quantityToPickRaw: str(order.total_quantity ?? 0),
    quantityPickedRaw: str(order.total_quantity ?? 0),
    quantityToPick: num(order.total_quantity ?? 0),
    quantityPicked: num(order.total_quantity ?? 0),
    sourceBinId: str(""),
    sourceBinCode: str(""),
    sourceZoneId: str(""),
    sourceZoneName: str(""),
    trolleyBarcode: str(firstPickingTask?.trolley_barcode ?? "", ""),
    rackBarcode: str(firstPickingTask?.rack_barcode ?? "", ""),
    rackId: str(firstPickingTask?.rack_id ?? "", ""),
    status: "COMPLETED",
    priority: typeof firstPickingTask?.priority === 'number' ? firstPickingTask.priority : (order.priority === "MEDIUM" ? 2 : order.priority === "HIGH" ? 1 : 3),
    lotNumber: str(firstItem?.lot_number ?? ""),
    batchNumber: str(firstItem?.batch_number ?? ""),
    expiryDate: str(
      firstItem?.expiry_date ??
      firstItem?.expiryDate ??
      firstItem?.expiration_date ??
      firstItem?.expirationDate ??
      ""
    ),
    itemCount: Array.isArray(order.items) ? (order.items as unknown[]).length : 0,
    itemsDisplay: itemsDisplay || "No items",
    notes: str(order.customer_name ?? ""),
    assignedAt: str(order.order_date ?? ""),
    startedAt: str(""),
    completedAt: str(order.picked_at ?? ""),
    createdAt: str(order.created_at ?? ""),
    createdByName: str(order.picked_by_name ?? ""),
  };
};

const statusBadgeClass: Record<string, string> = {
  PENDING:
    "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800",
  ASSIGNED:
    "bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-400 dark:border-indigo-800",
  IN_PROGRESS:
    "bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800",
  COMPLETED:
    "bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800",
  CANCELLED:
    "bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-900/30 dark:text-rose-400 dark:border-rose-800",
  ON_HOLD:
    "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800",
};

const priorityBadgeClass: Record<number, string> = {
  1: "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800",
  2: "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800",
  3: "bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800",
};

const getPriorityLabel = (priority: number): string => {
  if (priority === 1) return "High";
  if (priority === 2) return "Medium";
  if (priority >= 3) return "Low";
  return "Low";
};

const formatTimelineTime = (value: string): string => {
  if (!value || value === "-") return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
};

export default function PickingTasks() {
  const { user } = useAuth();
  const normalizedRole = String(user?.role ?? "").toLowerCase();
  const isAdminView = normalizedRole === "admin" || normalizedRole === "general manager";
  const [tasks, setTasks] = useState<NormalizedPickingTask[]>([]);
  const [completedTasksFromApi, setCompletedTasksFromApi] = useState<NormalizedPickingTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"All" | TaskStatus>("All");
  const [orderSearch, setOrderSearch] = useState("");
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [actionSubmitting, setActionSubmitting] = useState<string | null>(null);
  const [selectedTaskDetails, setSelectedTaskDetails] = useState<NormalizedPickingTask | null>(null);
  const [selectedWorkflowTask, setSelectedWorkflowTask] = useState<NormalizedPickingTask | null>(null);
  const [taskWorkflowById, setTaskWorkflowById] = useState<Record<string, TaskWorkflowProgress>>({});
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [startOrderDialogOpen, setStartOrderDialogOpen] = useState(false);
  const [startOrderTask, setStartOrderTask] = useState<NormalizedPickingTask | null>(null);
  const [startOrderTrolleyBarcode, setStartOrderTrolleyBarcode] = useState("");
  const [startOrderError, setStartOrderError] = useState("");
  const [trolleyBarcodeByOrder, setTrolleyBarcodeByOrder] = useState<Record<string, string>>({});
  const [assignedRackBarcodeByOrder, setAssignedRackBarcodeByOrder] = useState<Record<string, string>>({});
  const [assignedRackIdByOrder, setAssignedRackIdByOrder] = useState<Record<string, string>>({});
  const [quantityPickedByTaskId, setQuantityPickedByTaskId] = useState<Record<string, number>>({});
  const [scanRackDialogOpen, setScanRackDialogOpen] = useState(false);
  const [scanRackTask, setScanRackTask] = useState<NormalizedPickingTask | null>(null);
  const [scanRackBarcode, setScanRackBarcode] = useState("");
  const [scanRackError, setScanRackError] = useState("");
  const [completeDialogOpen, setCompleteDialogOpen] = useState(false);
  const [completeTask, setCompleteTask] = useState<NormalizedPickingTask | null>(null);
  const [completeQuantity, setCompleteQuantity] = useState("");
  const [completeError, setCompleteError] = useState("");
  const [movingTrolleyBarcode, setMovingTrolleyBarcode] = useState<string | null>(null);
  const [movedTrolleyBarcodes, setMovedTrolleyBarcodes] = useState<Set<string>>(new Set());

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    setLoadError(null);

    try {
      const [taskPayload, completedOrderList] = await Promise.all([
        isAdminView
          ? await pickingService.getAdminDashboardPickerTasks()
          : normalizedRole === "picker"
            ? await pickingService.getAssignedTasks()
            : await pickingService.getPendingTasks(),
        pickingService.getCompletedNotMovedOrders(),
      ]);

      const taskList = isAdminView
        ? extractAdminDashboardTasks(taskPayload)
        : (taskPayload as unknown[]);

      const normalized = taskList.map((task, index) =>
        normalizeTask(task as ApiPickingTask, index)
      );
      const normalizedCompleted = (completedOrderList as unknown[]).map((order, index) =>
        transformCompletedOrder(order as Record<string, unknown>, index)
      );
      setTasks(normalized);
      setCompletedTasksFromApi(normalizedCompleted);
      setTrolleyBarcodeByOrder((prev) => {
        const next = { ...prev };
        for (const task of normalized) {
          if (task.trolleyBarcode) next[task.orderSalesId] = task.trolleyBarcode;
        }
        for (const task of normalizedCompleted) {
          if (task.trolleyBarcode) next[task.orderSalesId] = task.trolleyBarcode;
        }
        return next;
      });
      setAssignedRackBarcodeByOrder((prev) => {
        const next = { ...prev };
        for (const task of normalized) {
          if (task.rackBarcode) next[task.orderSalesId] = task.rackBarcode;
        }
        return next;
      });
      setAssignedRackIdByOrder((prev) => {
        const next = { ...prev };
        for (const task of normalized) {
          if (task.rackId) next[task.orderSalesId] = task.rackId;
        }
        return next;
      });
      setQuantityPickedByTaskId((prev) => {
        const next = { ...prev };
        for (const task of normalized) {
          next[task.taskId] = prev[task.taskId] ?? task.quantityPicked;
        }
        return next;
      });
      setTaskWorkflowById((prev) => {
        const next: Record<string, TaskWorkflowProgress> = { ...prev };
        for (const task of normalized) {
          const fromStatus: TaskWorkflowProgress = {
            started: task.status === "IN_PROGRESS" || task.status === "COMPLETED",
            rackScanned: task.status === "COMPLETED",
            completed: task.status === "COMPLETED",
            movedToPacker: false,
          };
          const existing = prev[task.taskId];
          next[task.taskId] = {
            started: existing?.started ?? fromStatus.started,
            rackScanned: existing?.rackScanned ?? fromStatus.rackScanned,
            completed: existing?.completed ?? fromStatus.completed,
            movedToPacker: existing?.movedToPacker ?? fromStatus.movedToPacker,
          };
        }
        return next;
      });
      setSelectedTaskId((current) => {
        if (current && normalized.some((task) => task.taskId === current)) return current;
        return normalized[0]?.taskId ?? null;
      });
    } catch {
      setTasks([]);
      setCompletedTasksFromApi([]);
      setSelectedTaskId(null);
      setLoadError("Failed to load picking tasks from backend.");
    } finally {
      setLoading(false);
    }
  }, [isAdminView, normalizedRole]);

  useEffect(() => {
    void fetchTasks();
  }, [fetchTasks]);

  const filteredTasks = useMemo(() => {
    const query = orderSearch.trim().toLowerCase();

    return tasks.filter((task) => {
      const matchStatus = statusFilter === "All" || task.status === statusFilter;
      const matchOrder =
        !query ||
        task.orderNumber.toLowerCase().includes(query) ||
        task.taskNumber.toLowerCase().includes(query) ||
        task.itemsDisplay.toLowerCase().includes(query);
      return matchStatus && matchOrder;
    });
  }, [tasks, statusFilter, orderSearch]);

  const selectedTask = tasks.find((task) => task.taskId === selectedTaskId) ?? null;
  const activeWorkflowTask = selectedWorkflowTask
    ? tasks.find((task) => task.taskId === selectedWorkflowTask.taskId) ?? selectedWorkflowTask
    : null;

  const activeWorkflowState: TaskWorkflowProgress | null = activeWorkflowTask
    ? taskWorkflowById[activeWorkflowTask.taskId] ?? {
      started: activeWorkflowTask.status === "IN_PROGRESS" || activeWorkflowTask.status === "COMPLETED",
      rackScanned: activeWorkflowTask.status === "COMPLETED",
      completed: activeWorkflowTask.status === "COMPLETED",
      movedToPacker: false,
    }
    : null;

  const openStartOrderDialog = (task: NormalizedPickingTask) => {
    setStartOrderTask(task);
    setStartOrderTrolleyBarcode("");
    setStartOrderError("");
    setStartOrderDialogOpen(true);
  };

  const openCompleteDialog = (task: NormalizedPickingTask) => {
    const pickedSoFar = quantityPickedByTaskId[task.taskId] ?? task.quantityPicked ?? 0;
    const remaining = Math.max(task.quantityToPick - pickedSoFar, 0);
    setCompleteTask(task);
    setCompleteQuantity(remaining > 0 ? String(remaining) : "");
    setCompleteError("");
    setCompleteDialogOpen(true);
  };

  const openScanRackDialog = (task: NormalizedPickingTask) => {
    const savedTrolleyBarcode = trolleyBarcodeByOrder[task.orderSalesId];
    if (!savedTrolleyBarcode) {
      toast.error("Start Order first. Trolley barcode is not available for this order.");
      return;
    }

    const assignedRackBarcode = assignedRackBarcodeByOrder[task.orderSalesId] ?? "";
    setScanRackTask(task);
    setScanRackBarcode(assignedRackBarcode);
    setScanRackError("");
    setScanRackDialogOpen(true);
  };

  const handleStartOrderSave = async () => {
    if (!startOrderTask) return;
    if (!startOrderTrolleyBarcode.trim()) {
      setStartOrderError("trolley_barcode is required.");
      return;
    }

    setActionSubmitting(startOrderTask.taskId);
    setStartOrderError("");
    try {
      const cleanedTrolleyBarcode = startOrderTrolleyBarcode.trim();
      const startResponse = await pickingService.startTask({
        trolley_barcode: cleanedTrolleyBarcode,
        sales_order_id: startOrderTask.orderSalesId,
        order_number: startOrderTask.orderNumber,
      });

      const startRow = (startResponse ?? {}) as Record<string, unknown>;
      const assignedRackBarcode = String(startRow.rack_barcode ?? "").trim();
      const assignedRackId = String(startRow.rack_id ?? "").trim();

      setTrolleyBarcodeByOrder((prev) => ({
        ...prev,
        [startOrderTask.orderSalesId]: cleanedTrolleyBarcode,
      }));
      if (assignedRackBarcode) {
        setAssignedRackBarcodeByOrder((prev) => ({
          ...prev,
          [startOrderTask.orderSalesId]: assignedRackBarcode,
        }));
      }
      if (assignedRackId) {
        setAssignedRackIdByOrder((prev) => ({
          ...prev,
          [startOrderTask.orderSalesId]: assignedRackId,
        }));
      }
      setTaskWorkflowById((prev) => ({
        ...prev,
        [startOrderTask.taskId]: {
          started: true,
          rackScanned: prev[startOrderTask.taskId]?.rackScanned ?? false,
          completed: prev[startOrderTask.taskId]?.completed ?? false,
          movedToPacker: prev[startOrderTask.taskId]?.movedToPacker ?? false,
        },
      }));
      toast.success("Start order created successfully.");
      setStartOrderDialogOpen(false);
      await fetchTasks();
    } catch {
      setStartOrderError("Failed to start order. Please verify trolley_barcode.");
    } finally {
      setActionSubmitting(null);
    }
  };

  const handleCompleteTask = async () => {
    if (!completeTask) return;

    const enteredQuantity = Number(completeQuantity);
    if (!Number.isFinite(enteredQuantity) || enteredQuantity <= 0) {
      setCompleteError("Please enter a valid picked quantity.");
      return;
    }

    const pickedSoFar = quantityPickedByTaskId[completeTask.taskId] ?? completeTask.quantityPicked ?? 0;
    const requiredQuantity = completeTask.quantityToPick;
    const remainingQuantity = Math.max(requiredQuantity - pickedSoFar, 0);

    if (remainingQuantity <= 0) {
      setCompleteError("This task already has full picked quantity. Move it to packer.");
      return;
    }

    // Accept either remaining quantity input (delta) or final required quantity input.
    let finalQuantity = enteredQuantity;
    if (enteredQuantity === remainingQuantity) {
      finalQuantity = pickedSoFar + enteredQuantity;
    }

    if (finalQuantity !== requiredQuantity) {
      setCompleteError(
        `Enter exact remaining (${remainingQuantity}) or final required (${requiredQuantity}) quantity to complete.`
      );
      return;
    }

    setActionSubmitting(completeTask.taskId);
    setCompleteError("");
    try {
      await pickingService.updateTaskQuantity(completeTask.taskId, finalQuantity);
      await pickingService.completeTaskWithPayload({
        task_id: completeTask.taskId,
        quantity_picked: finalQuantity,
      });

      setQuantityPickedByTaskId((prev) => ({
        ...prev,
        [completeTask.taskId]: finalQuantity,
      }));

      toast.success("Picking task completed successfully.");
      setTaskWorkflowById((prev) => ({
        ...prev,
        [completeTask.taskId]: {
          started: true,
          rackScanned: true,
          completed: true,
          movedToPacker: prev[completeTask.taskId]?.movedToPacker ?? false,
        },
      }));
      setCompleteDialogOpen(false);
      await fetchTasks();
    } catch {
      setCompleteError("Failed to complete task. Please verify quantity.");
    } finally {
      setActionSubmitting(null);
    }
  };

  const handleScanRackSave = async () => {
    if (!scanRackTask) return;

    const savedTrolleyBarcode = trolleyBarcodeByOrder[scanRackTask.orderSalesId];
    if (!savedTrolleyBarcode) {
      setScanRackError("Start Order first. Trolley barcode is not available for this order.");
      return;
    }

    const cleanedRackBarcode = scanRackBarcode.trim();
    if (!cleanedRackBarcode) {
      setScanRackError("rack_barcode is required.");
      return;
    }

    const assignedRackBarcode = assignedRackBarcodeByOrder[scanRackTask.orderSalesId];
    if (assignedRackBarcode && cleanedRackBarcode.toLowerCase() !== assignedRackBarcode.toLowerCase()) {
      setScanRackError(`Scanned rack barcode must match assigned rack barcode: ${assignedRackBarcode}`);
      return;
    }

    setActionSubmitting(scanRackTask.taskId);
    setScanRackError("");
    try {
      await pickingService.startPickingTask(scanRackTask.taskId);

      await pickingService.scanRack({
        trolley_barcode: savedTrolleyBarcode,
        rack_barcode: cleanedRackBarcode,
        sales_order_id: scanRackTask.orderSalesId,
      });
      setTaskWorkflowById((prev) => ({
        ...prev,
        [scanRackTask.taskId]: {
          started: true,
          rackScanned: true,
          completed: prev[scanRackTask.taskId]?.completed ?? false,
          movedToPacker: prev[scanRackTask.taskId]?.movedToPacker ?? false,
        },
      }));
      toast.success("Rack scanned successfully.");
      setScanRackDialogOpen(false);
    } catch {
      setScanRackError("Failed to scan rack. Please verify barcodes.");
    } finally {
      setActionSubmitting(null);
    }
  };

  const handleMoveToPackerByTrolley = async (trolleyBarcode: string) => {
    const cleanedBarcode = trolleyBarcode.trim();
    if (!cleanedBarcode) return;

    setMovingTrolleyBarcode(cleanedBarcode);
    try {
      await pickingService.moveToPacking({
        trolley_barcode: cleanedBarcode,
      });

      // Mark trolley as moved
      setMovedTrolleyBarcodes((prev) => new Set([...prev, cleanedBarcode]));

      // Remove completed tasks for this trolley from display
      setCompletedTasksFromApi((prev) =>
        prev.filter((task) => {
          const taskTrolley = (trolleyBarcodeByOrder[task.orderSalesId] || task.trolleyBarcode || "").trim();
          return taskTrolley.toLowerCase() !== cleanedBarcode.toLowerCase();
        })
      );

      toast.success(`Trolley ${cleanedBarcode} moved to packer successfully.`);
    } catch {
      toast.error("Failed to move trolley to packer. Please verify trolley_barcode.");
    } finally {
      setMovingTrolleyBarcode(null);
    }
  };

  const handleViewDetails = (task: NormalizedPickingTask) => {
    setSelectedWorkflowTask(task);
    setSelectedTaskDetails(task);
    setDetailsDialogOpen(true);
  };

  const stats = useMemo(() => {
    const byStatus: Record<TaskStatus, number> = {
      PENDING: 0,
      ASSIGNED: 0,
      IN_PROGRESS: 0,
      COMPLETED: 0,
      CANCELLED: 0,
      ON_HOLD: 0,
    };

    for (const task of tasks) {
      byStatus[task.status] += 1;
    }

    return {
      total: tasks.length,
      byStatus,
    };
  }, [tasks]);

  const groupedTasks = useMemo(() => {
    const grouped: Record<TaskStatus, NormalizedPickingTask[]> = {
      PENDING: [],
      ASSIGNED: [],
      IN_PROGRESS: [],
      COMPLETED: [],
      CANCELLED: [],
      ON_HOLD: [],
    };

    for (const task of filteredTasks) {
      grouped[task.status].push(task);
    }

    return grouped;
  }, [filteredTasks]);

  const activeStatusSections = useMemo(() => {
    return TASK_STATUS_ORDER.filter((status) => groupedTasks[status].length > 0);
  }, [groupedTasks]);

  const completedTrolleyGroups = useMemo(() => {
    const byTrolley = new Map<string, { orderNumbers: Set<string>; tasks: NormalizedPickingTask[]; seenTaskKeys: Set<string> }>();
    const allCompletedCandidates = [...tasks, ...completedTasksFromApi];

    for (const task of allCompletedCandidates) {
      const workflowCompleted = taskWorkflowById[task.taskId]?.completed ?? false;
      if (task.status !== "COMPLETED" && !workflowCompleted) continue;
      const trolley = (trolleyBarcodeByOrder[task.orderSalesId] || task.trolleyBarcode || "").trim();
      if (!trolley) continue;

      const taskKey = [task.taskId, task.orderSalesId, task.itemId, task.taskNumber].join("|");

      if (!byTrolley.has(trolley)) {
        byTrolley.set(trolley, { orderNumbers: new Set(), tasks: [], seenTaskKeys: new Set() });
      }

      const row = byTrolley.get(trolley);
      if (!row) continue;

      if (row.seenTaskKeys.has(taskKey)) continue;
      row.seenTaskKeys.add(taskKey);
      row.orderNumbers.add(task.orderNumber);
      row.tasks.push(task);
    }

    return Array.from(byTrolley.entries()).map(([trolleyBarcode, row]) => ({
      trolleyBarcode,
      orderNumbers: Array.from(row.orderNumbers),
      tasks: row.tasks,
      completedTaskCount: row.tasks.length,
    })).sort((a, b) => a.trolleyBarcode.localeCompare(b.trolleyBarcode));
  }, [tasks, completedTasksFromApi, taskWorkflowById, trolleyBarcodeByOrder]);

  const activeTrolleyBarcode = activeWorkflowTask
    ? trolleyBarcodeByOrder[activeWorkflowTask.orderSalesId] || activeWorkflowTask.trolleyBarcode || "-"
    : "-";
  const activeRackBarcode = activeWorkflowTask
    ? assignedRackBarcodeByOrder[activeWorkflowTask.orderSalesId] || activeWorkflowTask.rackBarcode || "-"
    : "-";
  const activeRackId = activeWorkflowTask
    ? assignedRackIdByOrder[activeWorkflowTask.orderSalesId] || activeWorkflowTask.rackId || "-"
    : "-";
  const activeQuantityPicked = activeWorkflowTask
    ? String(quantityPickedByTaskId[activeWorkflowTask.taskId] ?? activeWorkflowTask.quantityPicked ?? 0)
    : "0";
  const completeTaskPickedSoFar = completeTask
    ? quantityPickedByTaskId[completeTask.taskId] ?? completeTask.quantityPicked ?? 0
    : 0;
  const completeTaskRequired = completeTask?.quantityToPick ?? 0;
  const completeTaskRemaining = Math.max(completeTaskRequired - completeTaskPickedSoFar, 0);

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight">{isAdminView ? "Picking Admin Dashboard" : "Picking Dashboard"}</h1>
        <p className="text-sm text-muted-foreground">
          {isAdminView
            ? "Monitor picker tasks across the warehouse using the admin dashboard endpoint."
            : "View and manage your assigned picking tasks from sales orders."}
        </p>
        {loadError && <p className="text-sm text-destructive">{loadError}</p>}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 xl:grid-cols-7 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Tasks</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>

        {TASK_STATUS_ORDER.map((status) => (
          <Card key={status}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">{formatStatusLabel(status)}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.byStatus[status]}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Filter by Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as "All" | TaskStatus)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="All">All Status</option>
                {TASK_STATUS_ORDER.map((status) => (
                  <option key={status} value={status}>{formatStatusLabel(status)}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Search by Order Number</label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={orderSearch}
                  onChange={(e) => setOrderSearch(e.target.value)}
                  placeholder="Search order or SKU..."
                  className="pl-9"
                />
              </div>
            </div>
          </div>

          <div className="mt-3 flex justify-end">
            <Button variant="outline" size="sm" onClick={() => void fetchTasks()} disabled={loading}>
              {loading ? "Loading..." : "Refresh Tasks"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {activeStatusSections.length === 0 && (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            {loading ? "Loading picking tasks..." : "No generated tasks match the selected filters."}
          </CardContent>
        </Card>
      )}

      {activeStatusSections.map((status) => {
        const sectionTasks = groupedTasks[status];
        return (
          <Card className="overflow-hidden" key={status}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="text-base">{formatStatusLabel(status)} Tasks</CardTitle>
                <Badge variant="outline" className={statusBadgeClass[status]}>{sectionTasks.length}</Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Task Number</TableHead>
                      <TableHead>Order Number</TableHead>
                      <TableHead>Assigned To</TableHead>
                      <TableHead>Items</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sectionTasks.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="py-6 text-center text-sm text-muted-foreground">
                          No tasks in {formatStatusLabel(status)}.
                        </TableCell>
                      </TableRow>
                    )}

                    {sectionTasks.map((task, index) => (
                      <TableRow
                        key={task.taskId}
                        onClick={() => {
                          setSelectedTaskId(task.taskId);
                          handleViewDetails(task);
                        }}
                        className={`cursor-pointer ${
                          selectedTask?.taskId === task.taskId ? "bg-primary/10 hover:bg-muted/30" : ""
                        } ${index % 2 === 1 ? "bg-muted/20" : ""}`}
                      >
                        <TableCell className="font-semibold">{task.taskNumber}</TableCell>
                        <TableCell>{task.orderNumber}</TableCell>
                        <TableCell>{task.assignedToName}</TableCell>
                        <TableCell className="max-w-xs truncate text-xs" title={task.itemsDisplay}>
                          {task.itemsDisplay}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={
                              priorityBadgeClass[task.priority] ||
                              "bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-900/30 dark:text-gray-400 dark:border-gray-800"
                            }
                          >
                            {getPriorityLabel(task.priority)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={statusBadgeClass[task.status] || statusBadgeClass.PENDING}
                          >
                            {formatStatusLabel(task.status)}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        );
      })}

      <Card className="overflow-hidden">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{isAdminView ? "Completed Trolleys Overview" : "Trolleys Ready To Move To Packer"}</CardTitle>
          <p className="text-xs text-muted-foreground">Only completed tasks with trolley barcode are listed here.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          {completedTrolleyGroups.length === 0 && (
            <div className="py-6 text-center text-sm text-muted-foreground">
              No completed trolleys available.
            </div>
          )}

          {completedTrolleyGroups.map((group) => (
            <div key={group.trolleyBarcode} className="rounded-md border border-border overflow-hidden">
              <div className="px-4 py-3 bg-muted/30 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold">Trolley: {group.trolleyBarcode}</p>
                  <p className="text-xs text-muted-foreground">
                    Orders: {group.orderNumbers.join(", ")} | Tasks: {group.completedTaskCount}
                  </p>
                </div>
                {!isAdminView && (
                  <Button
                    size="sm"
                    disabled={movingTrolleyBarcode === group.trolleyBarcode || movedTrolleyBarcodes.has(group.trolleyBarcode)}
                    onClick={() => void handleMoveToPackerByTrolley(group.trolleyBarcode)}
                  >
                    {movedTrolleyBarcodes.has(group.trolleyBarcode) ? "Moved" : movingTrolleyBarcode === group.trolleyBarcode ? "Moving..." : "Move to Packer"}
                  </Button>
                )}
              </div>

              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Task Number</TableHead>
                      <TableHead>Order Number</TableHead>
                      <TableHead>Item SKU</TableHead>
                      <TableHead>Quantity</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {group.tasks.map((task, index) => (
                      <TableRow
                        key={`${group.trolleyBarcode}-${task.taskId}-${index}`}
                        onClick={() => {
                          setSelectedTaskId(task.taskId);
                          handleViewDetails(task);
                        }}
                        className="cursor-pointer hover:bg-muted/30"
                      >
                        <TableCell className="font-medium">{task.taskNumber}</TableCell>
                        <TableCell>{task.orderNumber}</TableCell>
                        <TableCell>{task.itemSku}</TableCell>
                        <TableCell>{task.quantityPicked} / {task.quantityToPick}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={statusBadgeClass[task.status] || statusBadgeClass.PENDING}>
                            {formatStatusLabel(task.status)}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Dialog
        open={detailsDialogOpen}
        onOpenChange={(open) => {
          setDetailsDialogOpen(open);
          if (!open) setSelectedWorkflowTask(null);
        }}
      >
        <DialogContent className="sm:max-w-6xl lg:max-w-7xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Picking Task Details</DialogTitle>
            <DialogDescription>
              Task {selectedTaskDetails?.taskNumber} - Order {selectedTaskDetails?.orderNumber}
            </DialogDescription>
          </DialogHeader>

          {selectedTaskDetails && (
            <div className="space-y-4">
              <div className="rounded-md border border-border bg-card p-4 sm:p-5 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-2">
                    <p className="inline-flex rounded-md border border-border bg-muted/40 px-2.5 py-1 text-xs font-semibold tracking-wide">
                      TASK {selectedTaskDetails.taskNumber}
                    </p>
                    <p className="text-sm text-muted-foreground">Order {selectedTaskDetails.orderNumber}</p>
                  </div>
                  <Badge variant="outline" className={statusBadgeClass[selectedTaskDetails.status] || statusBadgeClass.PENDING}>
                    {formatStatusLabel(selectedTaskDetails.status)}
                  </Badge>
                </div>

                <div className="rounded-md border border-border bg-muted/30 px-3 py-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <p className="text-xl font-bold leading-tight">{selectedTaskDetails.itemSku}</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {selectedTaskDetails.itemDescription || "No description available"}
                      </p>
                    </div>
                    <div className="text-left sm:text-right">
                      <p className="text-3xl font-bold leading-none">{activeQuantityPicked}</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        of {selectedTaskDetails.quantityToPickRaw} picked
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-md border border-border bg-muted/20 px-3 py-2.5">
                    <p className="text-xs text-muted-foreground">Location</p>
                    <p className="mt-1 text-lg font-semibold">
                      {selectedTaskDetails.sourceBinCode || "-"}
                      {selectedTaskDetails.sourceZoneName ? ` / ${selectedTaskDetails.sourceZoneName}` : ""}
                    </p>
                  </div>

                  <div className="rounded-md border border-border bg-muted/20 px-3 py-2.5">
                    <p className="text-xs text-muted-foreground">Priority</p>
                    <p className="mt-1 text-lg font-semibold">{selectedTaskDetails.priority}</p>
                  </div>

                  <div className="rounded-md border border-border bg-muted/20 px-3 py-2.5">
                    <p className="text-xs text-muted-foreground">Assigned</p>
                    <p className="mt-1 text-lg font-semibold">{selectedTaskDetails.assignedToName}</p>
                  </div>
                </div>

                <div className="border-t border-border pt-3">
                  <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
                    <div className="inline-flex items-center gap-2 text-muted-foreground">
                      <span className="h-2 w-2 rounded-full bg-muted-foreground/70" aria-hidden="true" />
                      <span>Assigned {formatTimelineTime(selectedTaskDetails.assignedAt)}</span>
                    </div>
                    <div className="inline-flex items-center gap-2 text-muted-foreground">
                      <span className="h-2 w-2 rounded-full bg-muted-foreground/70" aria-hidden="true" />
                      <span>Started {formatTimelineTime(selectedTaskDetails.startedAt)}</span>
                    </div>
                    <div className="inline-flex items-center gap-2 text-muted-foreground">
                      <span className="h-2 w-2 rounded-full bg-muted-foreground/70" aria-hidden="true" />
                      <span>Completed {formatTimelineTime(selectedTaskDetails.completedAt)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {!isAdminView && (
                <div className="space-y-2 border-t pt-4">
                  <p className="text-xs font-medium text-muted-foreground">Task Actions</p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={!activeWorkflowTask || activeWorkflowState?.started || activeWorkflowState?.completed || actionSubmitting === activeWorkflowTask.taskId}
                      onClick={() => activeWorkflowTask && openStartOrderDialog(activeWorkflowTask)}
                    >
                      {activeWorkflowTask && actionSubmitting === activeWorkflowTask.taskId ? "Starting..." : "Start"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={
                        !activeWorkflowTask ||
                        !activeWorkflowState?.started ||
                        activeWorkflowState?.rackScanned ||
                        activeWorkflowState?.completed ||
                        actionSubmitting === activeWorkflowTask.taskId
                      }
                      onClick={() => activeWorkflowTask && openScanRackDialog(activeWorkflowTask)}
                    >
                      {activeWorkflowTask && actionSubmitting === activeWorkflowTask.taskId ? "Scanning..." : "Scan Rack"}
                    </Button>
                    <Button
                      size="sm"
                      disabled={
                        !activeWorkflowTask ||
                        !activeWorkflowState?.started ||
                        !activeWorkflowState?.rackScanned ||
                        activeWorkflowState?.completed ||
                        actionSubmitting === activeWorkflowTask.taskId
                      }
                      onClick={() => activeWorkflowTask && openCompleteDialog(activeWorkflowTask)}
                    >
                      {activeWorkflowTask && actionSubmitting === activeWorkflowTask.taskId ? "Completing..." : "Complete"}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={startOrderDialogOpen} onOpenChange={setStartOrderDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Start Order</DialogTitle>
            <DialogDescription>
              Add trolley barcode to start task {startOrderTask?.taskNumber}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Trolley Barcode</label>
            <Input
              value={startOrderTrolleyBarcode}
              onChange={(e) => setStartOrderTrolleyBarcode(e.target.value)}
              placeholder="Enter trolley_barcode"
            />
            {startOrderError && <p className="text-sm text-destructive">{startOrderError}</p>}
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setStartOrderDialogOpen(false)} disabled={Boolean(actionSubmitting)}>
              Cancel
            </Button>
            <Button onClick={() => void handleStartOrderSave()} disabled={Boolean(actionSubmitting)}>
              {actionSubmitting ? "Saving..." : "Save"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={completeDialogOpen} onOpenChange={setCompleteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Complete Picking Task</DialogTitle>
            <DialogDescription>
              Update picked quantity and complete task {completeTask?.taskNumber}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Picked Quantity</label>
            <Input
              type="number"
              min="0"
              step="1"
              value={completeQuantity}
              onChange={(e) => setCompleteQuantity(e.target.value)}
              placeholder="Enter picked quantity"
            />
            <p className="text-xs text-muted-foreground">
              Required: {completeTaskRequired} | Picked so far: {completeTaskPickedSoFar} | Remaining: {completeTaskRemaining}
            </p>
            {completeError && <p className="text-sm text-destructive">{completeError}</p>}
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setCompleteDialogOpen(false)} disabled={Boolean(actionSubmitting)}>
              Cancel
            </Button>
            <Button onClick={() => void handleCompleteTask()} disabled={Boolean(actionSubmitting)}>
              {actionSubmitting ? "Saving..." : "Save"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={scanRackDialogOpen} onOpenChange={setScanRackDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Scan Rack</DialogTitle>
            <DialogDescription>
              Enter trolley and rack barcodes for task {scanRackTask?.taskNumber}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              Trolley Barcode: {scanRackTask ? trolleyBarcodeByOrder[scanRackTask.orderSalesId] : "-"}
            </p>
            <p className="text-xs text-muted-foreground">
              Assigned Rack Barcode: {scanRackTask ? assignedRackBarcodeByOrder[scanRackTask.orderSalesId] || "-" : "-"}
            </p>
            <label className="text-xs font-medium text-muted-foreground">Rack Barcode</label>
            <Input
              value={scanRackBarcode}
              onChange={(e) => setScanRackBarcode(e.target.value)}
              placeholder="Enter rack_barcode"
            />
            {scanRackError && <p className="text-sm text-destructive">{scanRackError}</p>}
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setScanRackDialogOpen(false)} disabled={Boolean(actionSubmitting)}>
              Cancel
            </Button>
            <Button onClick={() => void handleScanRackSave()} disabled={Boolean(actionSubmitting)}>
              {actionSubmitting ? "Saving..." : "Save"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}
