import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import { useEnterNavigation } from "@/hooks/useEnterNavigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { replenishmentService } from "@/services/replenishmentService";
import { skuService } from "@/services/skuService";
import { trolleyService } from "@/services/trolleyService";
import { binsService } from "@/services/binsService";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/components/auth-provider";

type TaskPriority = "High" | "Medium" | "Low";
type TaskStatus = "Pending" | "In Progress" | "Completed";
type RuleType = "SKU";
type FulfillmentRule = "FEFO" | "FIFO" | "LIFO";
type RulePriority = "HIGH" | "MEDIUM" | "LOW";
type RuleStatus = "ACTIVE" | "INACTIVE";

interface ReplenishmentTask {
  taskId: string;
  itemName: string;
  sku: string;
  barcode: string;
  fromLocation: string;
  toLocation: string;
  quantity: number;
  priority: TaskPriority;
  status: TaskStatus;
}

interface CreateRuleFormState {
  ruleType: RuleType;
  skuCode: string;
  fulfillmentRule: FulfillmentRule;
  assignedTrolleyCode: string;
  minThreshold: string;
  targetQuantity: string;
  timeBasedEnabled: boolean;
  refillFrequencyMinutes: string;
  isFastMover: boolean;
  priority: RulePriority;
  status: RuleStatus;
}

interface CompleteTaskFormState {
  sourceBinBarcode: string;
  destinationBinBarcode: string;
  quantityMoved: string;
  notes: string;
}

type ApiReplenishmentTask = Record<string, unknown>;
type ApiReplenishmentTaskDetail = Record<string, unknown>;
type SkuOption = {
  id: string;
  code: string;
  label: string;
};

type TrolleyOption = {
  id: string;
  code: string;
  label: string;
};

type BinOption = {
  code: string;
  label: string;
};

const DEFAULT_CREATE_RULE_FORM: CreateRuleFormState = {
  ruleType: "SKU",
  skuCode: "",
  fulfillmentRule: "FEFO",
  assignedTrolleyCode: "",
  minThreshold: "10",
  targetQuantity: "50",
  timeBasedEnabled: false,
  refillFrequencyMinutes: "",
  isFastMover: true,
  priority: "HIGH",
  status: "ACTIVE",
};

const DEFAULT_COMPLETE_TASK_FORM: CompleteTaskFormState = {
  sourceBinBarcode: "",
  destinationBinBarcode: "",
  quantityMoved: "",
  notes: "",
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

const normalizePriority = (raw: unknown): TaskPriority => {
  const value = String(raw ?? "").trim().toLowerCase();
  if (value === "1" || value === "high") return "High";
  if (value === "2" || value === "medium") return "Medium";
  if (value === "3" || value === "low") return "Low";
  return "Low";
};

const normalizeStatus = (raw: unknown): TaskStatus => {
  const value = String(raw ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (["in_progress", "inprocess", "started", "active"].includes(value)) return "In Progress";
  if (["completed", "complete", "done", "closed"].includes(value)) return "Completed";
  return "Pending";
};

const normalizeTask = (task: ApiReplenishmentTask, index: number): ReplenishmentTask => {
  return {
    taskId: str(task.task_id ?? task.id ?? task.task_number ?? task.replenishment_task_id ?? `REP-${index + 1}`),
    itemName: str(task.item_name ?? task.item_description ?? task.description ?? task.name ?? task.product_name),
    sku: str(task.item_sku ?? task.sku ?? task.sku_code),
    barcode: str(task.item_barcode ?? task.barcode ?? task.primary_barcode),
    fromLocation: str(task.from_location ?? task.source_location ?? task.reserve_location ?? task.source_bin_code),
    toLocation: str(task.to_location ?? task.destination_location ?? task.pick_face_location ?? task.target_location ?? task.suggested_bin_code),
    quantity: num(
      task.rejected_quantity ??
      task.rejectedQuantity ??
      task.quantity ??
      task.required_quantity ??
      task.quantity_to_move ??
      task.quantity_to_replenish ??
      task.quantity_to_put
    ),
    priority: normalizePriority(task.priority ?? task.task_priority),
    status: normalizeStatus(task.status ?? task.task_status ?? task.current_status),
  };
};

const priorityBadgeClass: Record<TaskPriority, string> = {
  High:
    "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800",
  Medium:
    "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800",
  Low:
    "bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800",
};

const statusBadgeClass: Record<TaskStatus, string> = {
  Pending:
    "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800",
  "In Progress":
    "bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800",
  Completed:
    "bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800",
};

const toText = (value: unknown, fallback = "-"): string => {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "string") return value.trim() ? value : fallback;
  if (typeof value === "number" || typeof value === "bigint" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.length ? value.map((entry) => toText(entry, "")).join(", ") : fallback;
  try {
    const text = JSON.stringify(value);
    return text && text !== "{}" ? text : fallback;
  } catch {
    return fallback;
  }
};

const toRecord = (value: unknown): Record<string, unknown> => {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
};

const toArray = (value: unknown): unknown[] => {
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object") {
    const wrapped = value as Record<string, unknown>;
    const nested = wrapped.items ?? wrapped.data ?? wrapped.results ?? wrapped.bins;
    if (Array.isArray(nested)) return nested;
  }
  return [];
};

const DetailField = ({ label, value }: { label: string; value: unknown }) => (
  <div className="rounded-md border border-border/70 bg-card px-3 py-2">
    <p className="text-xs text-muted-foreground">{label}</p>
    <p className="mt-1 break-all text-sm font-medium">{toText(value)}</p>
  </div>
);

export default function ReplenishmentTasks() {
  const { user } = useAuth();
  const isAdmin = String(user?.role ?? "").toLowerCase() === "admin";
  const isReplenishmentWorker = String(user?.role ?? "").toLowerCase() === "replenishment worker";

  const [tasks, setTasks] = useState<ReplenishmentTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"All" | TaskStatus>("All");
  const [priorityFilter, setPriorityFilter] = useState<"All" | TaskPriority>("All");
  const [skuSearch, setSkuSearch] = useState("");
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [createForm, setCreateForm] = useState<CreateRuleFormState>(DEFAULT_CREATE_RULE_FORM);
  const [skuOptions, setSkuOptions] = useState<SkuOption[]>([]);
  const [trolleyOptions, setTrolleyOptions] = useState<TrolleyOption[]>([]);
  const [createOptionsLoading, setCreateOptionsLoading] = useState(false);
  const [selectedTaskDetail, setSelectedTaskDetail] = useState<ApiReplenishmentTaskDetail | null>(null);
  const [selectedTaskDetailLoading, setSelectedTaskDetailLoading] = useState(false);
  const [selectedTaskDetailError, setSelectedTaskDetailError] = useState<string | null>(null);
  const [taskDetailDialogOpen, setTaskDetailDialogOpen] = useState(false);
  const [completeTaskDialogOpen, setCompleteTaskDialogOpen] = useState(false);
  const [completeTaskSubmitting, setCompleteTaskSubmitting] = useState(false);
  const [completeTaskForm, setCompleteTaskForm] = useState<CompleteTaskFormState>(DEFAULT_COMPLETE_TASK_FORM);
  const [sourceBinOptions, setSourceBinOptions] = useState<BinOption[]>([]);
  const [sourceBinsLoading, setSourceBinsLoading] = useState(false);
  const [destinationBinOptions, setDestinationBinOptions] = useState<BinOption[]>([]);
  const [destinationBinsLoading, setDestinationBinsLoading] = useState(false);
  const createFormRef = useRef<HTMLFormElement>(null);

  useEnterNavigation(createFormRef, { submitOnLast: true });

  useEffect(() => {
    if (!createDialogOpen) return;

    let disposed = false;

    const loadOptions = async () => {
      setCreateOptionsLoading(true);
      try {
        const [skuRows, trolleyRows] = await Promise.all([skuService.getAll(), trolleyService.getAll()]);

        const nextSkuOptions = skuRows
          .map((item) => {
            const id = String(item?.id ?? item?.item_id ?? item?.itemId ?? "").trim();
            const code = String(item?.skuCode ?? item?.sku_code ?? item?.code ?? "").trim();
            if (!id || !code) return null;
            return {
              id,
              code,
              label: `${code}${item?.description ? ` - ${item.description}` : ""}`,
            };
          })
          .filter((entry): entry is SkuOption => Boolean(entry));

        const nextTrolleyOptions = trolleyRows
          .map((trolley) => {
            const id = String(trolley?.trolley_id ?? trolley?.id ?? "").trim();
            const code = String(trolley?.trolley_barcode ?? "").trim();
            if (!id || !code) return null;
            return {
              id,
              code,
              label: `${code}${trolley?.current_location ? ` - ${trolley.current_location}` : ""}`,
            };
          })
          .filter((entry): entry is TrolleyOption => Boolean(entry));

        if (!disposed) {
          setSkuOptions(nextSkuOptions);
          setTrolleyOptions(nextTrolleyOptions);
        }
      } catch {
        if (!disposed) {
          setSkuOptions([]);
          setTrolleyOptions([]);
        }
      } finally {
        if (!disposed) {
          setCreateOptionsLoading(false);
        }
      }
    };

    void loadOptions();

    return () => {
      disposed = true;
    };
  }, [createDialogOpen]);

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    setLoadError(null);

    try {
      const taskList = await replenishmentService.getTasks();

      const normalized = taskList.map((task, index) => normalizeTask(task as ApiReplenishmentTask, index));
      setTasks(normalized);
      setSelectedTaskId((current) => {
        if (current && normalized.some((task) => task.taskId === current)) return current;
        return normalized[0]?.taskId ?? null;
      });
    } catch {
      setTasks([]);
      setSelectedTaskId(null);
      setLoadError("Failed to load replenishment tasks from backend.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchTasks();
  }, [fetchTasks]);

  useEffect(() => {
    if (!taskDetailDialogOpen || !selectedTaskId) {
      setSelectedTaskDetail(null);
      setSelectedTaskDetailError(null);
      setSelectedTaskDetailLoading(false);
      return;
    }

    let disposed = false;

    const fetchTaskDetail = async () => {
      setSelectedTaskDetailLoading(true);
      setSelectedTaskDetailError(null);
      try {
        const detail = await replenishmentService.getTaskById(selectedTaskId);
        if (!disposed) {
          setSelectedTaskDetail(toRecord(detail));
        }
      } catch {
        if (!disposed) {
          setSelectedTaskDetail(null);
          setSelectedTaskDetailError("Failed to load task details from backend.");
        }
      } finally {
        if (!disposed) {
          setSelectedTaskDetailLoading(false);
        }
      }
    };

    void fetchTaskDetail();

    return () => {
      disposed = true;
    };
  }, [selectedTaskId, taskDetailDialogOpen]);

  useEffect(() => {
    if (!completeTaskDialogOpen) {
      setSourceBinOptions([]);
      setSourceBinsLoading(false);
      setDestinationBinOptions([]);
      setDestinationBinsLoading(false);
      return;
    }

    let disposed = false;

    const loadBinOptions = async () => {
      setSourceBinsLoading(true);
      setDestinationBinsLoading(true);
      try {
        const response = await binsService.getAllBins(0, 500);
        const options = toArray(response)
          .map((entry) => {
            const row = toRecord(entry);
            const code = toText(row.barcode ?? row.code, "").trim();
            const name = toText(row.code, "").trim();
            if (!code) return null;
            return {
              code,
              label: name && name !== code ? `${code} - ${name}` : code,
            };
          })
          .filter((entry): entry is BinOption => Boolean(entry));

        const sourceBinRecord = toRecord(selectedTaskDetail?.source);
        const sourceCode = toText(sourceBinRecord.barcode ?? sourceBinRecord.bin_code ?? sourceBinRecord.code, "").trim();
        const sourceName = toText(sourceBinRecord.bin_code ?? sourceBinRecord.code, "").trim();
        const hasSourceInOptions = sourceCode ? options.some((entry) => entry.code === sourceCode) : true;

        const mergedSourceOptions =
          sourceCode && !hasSourceInOptions
            ? [{ code: sourceCode, label: sourceName && sourceName !== sourceCode ? `${sourceCode} - ${sourceName}` : sourceCode }, ...options]
            : options;

        if (!disposed) {
          setSourceBinOptions(mergedSourceOptions);
          setDestinationBinOptions(options);
        }
      } catch {
        if (!disposed) {
          setSourceBinOptions([]);
          setDestinationBinOptions([]);
          toast.error("Failed to load source bins.");
          toast.error("Failed to load destination bins.");
        }
      } finally {
        if (!disposed) {
          setSourceBinsLoading(false);
          setDestinationBinsLoading(false);
        }
      }
    };

    void loadBinOptions();

    return () => {
      disposed = true;
    };
  }, [completeTaskDialogOpen, selectedTaskDetail]);

  const filteredTasks = useMemo(() => {
    const query = skuSearch.trim().toLowerCase();

    return tasks.filter((task) => {
      const matchStatus = statusFilter === "All" || task.status === statusFilter;
      const matchPriority = priorityFilter === "All" || task.priority === priorityFilter;
      const matchSku = !query || task.sku.toLowerCase().includes(query);
      return matchStatus && matchPriority && matchSku;
    });
  }, [tasks, statusFilter, priorityFilter, skuSearch]);

  const selectedTask =
    tasks.find((task) => task.taskId === selectedTaskId) ?? filteredTasks[0] ?? tasks[0] ?? null;

  const updateTaskStatus = (taskId: string, nextStatus: TaskStatus) => {
    setTasks((prev) => prev.map((task) => (task.taskId === taskId ? { ...task, status: nextStatus } : task)));
  };

  const updateCreateForm = <K extends keyof CreateRuleFormState>(field: K, value: CreateRuleFormState[K]) => {
    setCreateForm((prev) => ({ ...prev, [field]: value }));
  };

  const resetCreateForm = () => {
    setCreateForm(DEFAULT_CREATE_RULE_FORM);
  };

  const closeCreateDialog = () => {
    setCreateDialogOpen(false);
    resetCreateForm();
  };

  const resetCompleteTaskForm = () => {
    const sourceRecord = toRecord(selectedTaskDetail?.source);
    const source = sourceRecord.barcode ?? sourceRecord.bin_code ?? sourceRecord.code;
    setCompleteTaskForm({
      sourceBinBarcode: toText(source, ""),
      destinationBinBarcode: "",
      quantityMoved: "",
      notes: "",
    });
  };

  const openCompleteTaskDialog = () => {
    resetCompleteTaskForm();
    setCompleteTaskDialogOpen(true);
  };

  const closeCompleteTaskDialog = () => {
    setCompleteTaskDialogOpen(false);
    setCompleteTaskForm(DEFAULT_COMPLETE_TASK_FORM);
  };

  const submitCompleteTask = async () => {
    if (!selectedTaskId) {
      toast.error("No task selected.");
      return;
    }

    const sourceBinBarcode = completeTaskForm.sourceBinBarcode.trim();
    const destinationBinBarcode = completeTaskForm.destinationBinBarcode.trim();
    const notes = completeTaskForm.notes.trim();
    const quantityMoved = Number(completeTaskForm.quantityMoved);

    if (!sourceBinBarcode) {
      toast.error("Source bin barcode is required.");
      return;
    }

    if (!destinationBinBarcode) {
      toast.error("Destination bin barcode is required.");
      return;
    }

    if (!Number.isFinite(quantityMoved) || quantityMoved <= 0) {
      toast.error("Quantity moved must be greater than 0.");
      return;
    }

    setCompleteTaskSubmitting(true);
    try {
      await replenishmentService.completeTask(selectedTaskId, {
        source_bin_barcode: sourceBinBarcode,
        destination_bin_barcode: destinationBinBarcode,
        quantity_moved: quantityMoved,
        notes,
      });

      toast.success("Task completed successfully.");
      closeCompleteTaskDialog();
      setTaskDetailDialogOpen(false);
      await fetchTasks();
    } catch {
      toast.error("Failed to complete task.");
    } finally {
      setCompleteTaskSubmitting(false);
    }
  };

  const submitCreateRule = async () => {
    const minThreshold = Number(createForm.minThreshold);
    const targetQuantity = Number(createForm.targetQuantity);
    const refillFrequencyMinutes = createForm.timeBasedEnabled
      ? Number(createForm.refillFrequencyMinutes)
      : null;

    if (!Number.isFinite(minThreshold) || minThreshold < 0) {
      toast.error("Minimum threshold must be a valid number.");
      return;
    }

    if (!Number.isFinite(targetQuantity) || targetQuantity <= 0) {
      toast.error("Target quantity must be greater than 0.");
      return;
    }

    if (createForm.ruleType === "SKU" && !createForm.skuCode.trim()) {
      toast.error("SKU code is required for SKU rules.");
      return;
    }

    if (createForm.timeBasedEnabled) {
      if (!Number.isFinite(refillFrequencyMinutes ?? Number.NaN) || (refillFrequencyMinutes ?? 0) <= 0) {
        toast.error("Refill frequency must be greater than 0 when time-based replenishment is enabled.");
        return;
      }
    }

    const payload: import("@/services/replenishmentService").ReplenishmentRuleCreatePayload = {
      rule_type: createForm.ruleType,
      sku_id: createForm.ruleType === "SKU" ? skuOptions.find((option) => option.code === createForm.skuCode.trim())?.id ?? null : null,
      category_id: null,
      fulfillment_rule: createForm.fulfillmentRule,
      assigned_trolley_id: trolleyOptions.find((option) => option.code === createForm.assignedTrolleyCode.trim())?.id ?? null,
      min_threshold: minThreshold,
      target_quantity: targetQuantity,
      time_based_enabled: createForm.timeBasedEnabled,
      refill_frequency_minutes: createForm.timeBasedEnabled ? refillFrequencyMinutes : null,
      is_fast_mover: createForm.isFastMover,
      priority: createForm.priority,
      status: createForm.status,
    };

    setCreateSubmitting(true);
    try {
      await replenishmentService.createRule(payload);

      toast.success("Replenishment rule created successfully.");
      closeCreateDialog();
    } catch {
      toast.error("Failed to create replenishment rule.");
    } finally {
      setCreateSubmitting(false);
    }
  };

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight">Replenishment Tasks</h1>
        <p className="text-sm text-muted-foreground">
          Track movement of inventory from reserve storage to active pick shelves.
        </p>
        {loadError && <p className="text-sm text-destructive">{loadError}</p>}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Filter by Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as "All" | TaskStatus)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="All">All Status</option>
                <option value="Pending">Pending</option>
                <option value="In Progress">In Progress</option>
                <option value="Completed">Completed</option>
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Filter by Priority</label>
              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value as "All" | TaskPriority)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="All">All Priorities</option>
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Search by SKU</label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={skuSearch}
                  onChange={(e) => setSkuSearch(e.target.value)}
                  placeholder="Type SKU..."
                  className="pl-9"
                />
              </div>
            </div>
          </div>
            <div className="mt-3 flex flex-wrap justify-end gap-2">
              {!isReplenishmentWorker && (
                <Button size="sm" onClick={() => setCreateDialogOpen(true)} disabled={createSubmitting}>
                  Create Rule
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={() => void fetchTasks()} disabled={loading}>
                {loading ? "Loading..." : "Refresh Tasks"}
              </Button>
            </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6">
        <Card className="overflow-hidden">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Task Queue</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Task ID</TableHead>
                    <TableHead>Item Name</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>From Location</TableHead>
                    <TableHead>To Location</TableHead>
                    <TableHead className="text-right">Quantity</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTasks.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
                        {loading ? "Loading replenishment tasks..." : "No replenishment tasks match the selected filters."}
                      </TableCell>
                    </TableRow>
                  )}

                  {filteredTasks.map((task, index) => (
                    <TableRow
                      key={task.taskId}
                      onClick={() => {
                        setSelectedTaskId(task.taskId);
                        setTaskDetailDialogOpen(true);
                      }}
                      className={`cursor-pointer ${
                        selectedTask?.taskId === task.taskId ? "bg-primary/10 hover:bg-muted/30" : ""
                      } ${index % 2 === 1 ? "bg-muted/20" : ""}`}
                    >
                      <TableCell className="font-semibold">{task.taskId}</TableCell>
                      <TableCell className="max-w-[180px] truncate" title={task.itemName}>
                        {task.itemName}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{task.sku}</TableCell>
                      <TableCell>{task.fromLocation}</TableCell>
                      <TableCell>{task.toLocation}</TableCell>
                      <TableCell className="text-right font-medium">{task.quantity}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={priorityBadgeClass[task.priority]}>
                          {task.priority}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={statusBadgeClass[task.status]}>
                          {task.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

      </div>

      <Dialog open={taskDetailDialogOpen} onOpenChange={setTaskDetailDialogOpen}>
        <DialogContent className="sm:max-w-6xl max-h-[90vh] overflow-hidden p-0">
          <div className="flex max-h-[90vh] flex-col">
            <div className="px-6 pt-6 pb-4 border-b border-border">
              <DialogHeader>
                <DialogTitle>Task Details</DialogTitle>
                <DialogDescription>
                  Detailed replenishment task information for the selected row.
                </DialogDescription>
              </DialogHeader>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              {selectedTaskDetailLoading && (
                <p className="text-sm text-muted-foreground">Loading task details...</p>
              )}

              {selectedTaskDetailError && (
                <p className="text-sm text-destructive">{selectedTaskDetailError}</p>
              )}

              {selectedTaskDetail && !selectedTaskDetailLoading && (
                <>
                  <div className="grid gap-3 md:grid-cols-3">
                    <DetailField label="Task Number" value={selectedTaskDetail.task_number} />
                    <DetailField label="Task Type" value={selectedTaskDetail.task_type} />
                    <DetailField label="Status" value={selectedTaskDetail.status} />
                    <DetailField label="Priority" value={selectedTaskDetail.priority} />
                    <DetailField label="SKU Code" value={selectedTaskDetail.sku_code} />
                    <DetailField label="SKU Name" value={selectedTaskDetail.sku_name} />
                    <DetailField label="Unit Of Measure" value={selectedTaskDetail.unit_of_measure} />
                    <DetailField label="Requested Quantity" value={selectedTaskDetail.requested_quantity} />
                    <DetailField label="Picked Quantity" value={selectedTaskDetail.picked_quantity} />
                    <DetailField label="Remaining Quantity" value={selectedTaskDetail.remaining_quantity} />
                    <DetailField label="Assigned Worker Name" value={selectedTaskDetail.assigned_worker_name} />
                    <DetailField label="Worker Status" value={selectedTaskDetail.worker_status} />
                    <DetailField label="Created At" value={selectedTaskDetail.created_at} />
                    <DetailField label="Started At" value={selectedTaskDetail.started_at} />
                    <DetailField label="Completed At" value={selectedTaskDetail.completed_at} />
                    <DetailField label="Notes" value={selectedTaskDetail.notes} />
                    <DetailField label="Suggested Bin Code" value={selectedTaskDetail.suggested_bin_code} />
                  </div>

                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold">Source</h3>
                    <div className="grid gap-3 md:grid-cols-3">
                      <DetailField label="Bin Code" value={toRecord(selectedTaskDetail.source).bin_code} />
                      <DetailField label="Bin Type" value={toRecord(selectedTaskDetail.source).bin_type} />
                      <DetailField label="Zone" value={toRecord(selectedTaskDetail.source).zone} />
                      <DetailField label="Available Quantity" value={toRecord(selectedTaskDetail.source).available_quantity} />
                      <DetailField label="Is Valid" value={toRecord(selectedTaskDetail.source).is_valid} />
                      <DetailField label="Validation Message" value={toRecord(selectedTaskDetail.source).validation_message} />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold">Destination</h3>
                    <div className="grid gap-3 md:grid-cols-3">
                      <DetailField label="Bin Code" value={toRecord(selectedTaskDetail.destination).bin_code} />
                      <DetailField label="Bin Type" value={toRecord(selectedTaskDetail.destination).bin_type} />
                      <DetailField label="Zone" value={toRecord(selectedTaskDetail.destination).zone} />
                      <DetailField label="Current Stock" value={toRecord(selectedTaskDetail.destination).current_stock} />
                      <DetailField label="Max Capacity" value={toRecord(selectedTaskDetail.destination).max_capacity} />
                      <DetailField label="Is Valid" value={toRecord(selectedTaskDetail.destination).is_valid} />
                      <DetailField label="Validation Message" value={toRecord(selectedTaskDetail.destination).validation_message} />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold">Batch</h3>
                    <div className="grid gap-3 md:grid-cols-3">
                      <DetailField label="Batch Number" value={toRecord(selectedTaskDetail.batch).batch_number} />
                      <DetailField label="Lot Number" value={toRecord(selectedTaskDetail.batch).lot_number} />
                      <DetailField label="Expiry Date" value={toRecord(selectedTaskDetail.batch).expiry_date} />
                      <DetailField label="Received At" value={toRecord(selectedTaskDetail.batch).received_at} />
                      <DetailField label="Days Until Expiry" value={toRecord(selectedTaskDetail.batch).days_until_expiry} />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold">Rule Context</h3>
                    <div className="grid gap-3 md:grid-cols-3">
                      <DetailField label="Rule Type" value={toRecord(selectedTaskDetail.rule_context).rule_type} />
                      <DetailField label="Min Threshold" value={toRecord(selectedTaskDetail.rule_context).min_threshold} />
                      <DetailField label="Target Quantity" value={toRecord(selectedTaskDetail.rule_context).target_quantity} />
                      <DetailField label="Fulfillment Rule" value={toRecord(selectedTaskDetail.rule_context).fulfillment_rule} />
                      <DetailField label="Is Fast Mover" value={toRecord(selectedTaskDetail.rule_context).is_fast_mover} />
                      <DetailField label="Priority" value={toRecord(selectedTaskDetail.rule_context).priority} />
                      <DetailField label="Triggered By" value={toRecord(selectedTaskDetail.rule_context).triggered_by} />
                      <DetailField label="Trigger Reason" value={toRecord(selectedTaskDetail.rule_context).trigger_reason} />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold">System State</h3>
                    <div className="grid gap-3 md:grid-cols-2">
                      <DetailField label="Current Pick Face Stock" value={toRecord(selectedTaskDetail.system_state).current_pick_face_stock} />
                      <DetailField label="Current Bulk Stock" value={toRecord(selectedTaskDetail.system_state).current_bulk_stock} />
                      <DetailField label="Bulk Stock Snapshot" value={toRecord(selectedTaskDetail.system_state).bulk_stock_snapshot} />
                      <DetailField label="Is Partial Allowed" value={toRecord(selectedTaskDetail.system_state).is_partial_allowed} />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold">Validation</h3>
                    <div className="grid gap-3 md:grid-cols-3">
                      <DetailField label="Is Source Valid" value={toRecord(selectedTaskDetail.validation).is_source_valid} />
                      <DetailField label="Is Destination Valid" value={toRecord(selectedTaskDetail.validation).is_destination_valid} />
                      <DetailField label="Is Stock Available" value={toRecord(selectedTaskDetail.validation).is_stock_available} />
                      <DetailField label="Is Batch Valid" value={toRecord(selectedTaskDetail.validation).is_batch_valid} />
                      <DetailField label="Is Worker Assigned" value={toRecord(selectedTaskDetail.validation).is_worker_assigned} />
                      <DetailField label="Can Be Started" value={toRecord(selectedTaskDetail.validation).can_be_started} />
                      <DetailField label="Can Be Completed" value={toRecord(selectedTaskDetail.validation).can_be_completed} />
                    </div>
                    <DetailField label="Validation Messages" value={toRecord(selectedTaskDetail.validation).validation_messages} />
                  </div>

                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold">Task Data</h3>
                    <DetailField label="task_data" value={selectedTaskDetail.task_data} />
                  </div>
                </>
              )}
            </div>

            <DialogFooter className="border-t border-border bg-card/95 px-6 py-4 flex flex-row items-center justify-end gap-2 backdrop-blur supports-[backdrop-filter]:bg-card/80">
              <Button type="button" variant="outline" onClick={() => setTaskDetailDialogOpen(false)}>
                Close
              </Button>
              {isReplenishmentWorker && String(selectedTaskDetail?.status).toUpperCase() !== "COMPLETED" && (
                <Button type="button" onClick={openCompleteTaskDialog}>
                  Complete Task
                </Button>
              )}
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={completeTaskDialogOpen}
        onOpenChange={(open) => {
          setCompleteTaskDialogOpen(open);
          if (!open) {
            setCompleteTaskForm(DEFAULT_COMPLETE_TASK_FORM);
          }
        }}
      >
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Complete Task</DialogTitle>
            <DialogDescription>Provide movement details to complete this replenishment task.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="source-bin-barcode">Source Bin Barcode</Label>
              <Select
                value={completeTaskForm.sourceBinBarcode}
                onValueChange={(value) => setCompleteTaskForm((prev) => ({ ...prev, sourceBinBarcode: value }))}
                disabled={completeTaskSubmitting || sourceBinsLoading || sourceBinOptions.length === 0}
              >
                <SelectTrigger id="source-bin-barcode">
                  <SelectValue placeholder={sourceBinsLoading ? "Loading source bins..." : "Select source bin"} />
                </SelectTrigger>
                <SelectContent>
                  {sourceBinOptions.length === 0 ? (
                    <SelectItem value="__no_source_bin__" disabled>
                      No source bins available
                    </SelectItem>
                  ) : (
                    sourceBinOptions.map((option) => (
                      <SelectItem key={option.code} value={option.code}>
                        {option.label}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Auto-selected from task source; you can change it from the dropdown.</p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="destination-bin-barcode">Destination Bin Barcode</Label>
              <Select
                value={completeTaskForm.destinationBinBarcode}
                onValueChange={(value) => setCompleteTaskForm((prev) => ({ ...prev, destinationBinBarcode: value }))}
                disabled={completeTaskSubmitting || destinationBinsLoading || destinationBinOptions.length === 0}
              >
                <SelectTrigger id="destination-bin-barcode">
                  <SelectValue
                    placeholder={destinationBinsLoading ? "Loading destination bins..." : "Select destination bin"}
                  />
                </SelectTrigger>
                <SelectContent>
                  {destinationBinOptions.length === 0 ? (
                    <SelectItem value="__no_destination_bin__" disabled>
                      No destination bins available
                    </SelectItem>
                  ) : (
                    destinationBinOptions.map((option) => (
                      <SelectItem key={option.code} value={option.code}>
                        {option.label}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="quantity-moved">Quantity Moved</Label>
              <Input
                id="quantity-moved"
                type="number"
                min="1"
                value={completeTaskForm.quantityMoved}
                onChange={(e) => setCompleteTaskForm((prev) => ({ ...prev, quantityMoved: e.target.value }))}
                placeholder="0"
                disabled={completeTaskSubmitting}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="complete-notes">Notes</Label>
              <Input
                id="complete-notes"
                value={completeTaskForm.notes}
                onChange={(e) => setCompleteTaskForm((prev) => ({ ...prev, notes: e.target.value }))}
                placeholder="Optional notes"
                disabled={completeTaskSubmitting}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={closeCompleteTaskDialog} disabled={completeTaskSubmitting}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void submitCompleteTask()} disabled={completeTaskSubmitting}>
              {completeTaskSubmitting ? "Submitting..." : "Submit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={createDialogOpen} onOpenChange={(open) => {
        setCreateDialogOpen(open);
        if (!open) {
          resetCreateForm();
        }
      }}>
        <DialogContent className="sm:max-w-5xl max-h-[90vh] overflow-hidden p-0">
          <div className="flex max-h-[90vh] flex-col">
            <div className="px-6 pt-6 pb-4">
              <DialogHeader>
                <DialogTitle>Create Replenishment Rule</DialogTitle>
                <DialogDescription>
                  Configure the replenishment rule parameters and save them to the backend.
                </DialogDescription>
              </DialogHeader>
            </div>

            <div className="flex-1 overflow-y-auto px-6 pb-6 pt-0">
              <Card className="border-border/70 shadow-none">
                <CardContent className="pt-6">
              <form
                ref={createFormRef}
                id="replenishment-rule-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  void submitCreateRule();
                }}
                className="grid grid-cols-1 gap-4 md:grid-cols-2"
              >
                <div className="space-y-1.5">
                  <Label htmlFor="rule-type">Rule Type</Label>
                  <Select
                    value={createForm.ruleType}
                    onValueChange={(value) => updateCreateForm("ruleType", value as RuleType)}
                    disabled={createSubmitting}
                  >
                    <SelectTrigger id="rule-type">
                      <SelectValue placeholder="Select rule type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SKU">SKU</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="fulfillment-rule">Fulfillment Rule</Label>
                  <Select
                    value={createForm.fulfillmentRule}
                    onValueChange={(value) => updateCreateForm("fulfillmentRule", value as FulfillmentRule)}
                    disabled={createSubmitting}
                  >
                    <SelectTrigger id="fulfillment-rule">
                      <SelectValue placeholder="Select fulfillment rule" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="FEFO">FEFO</SelectItem>
                      <SelectItem value="FIFO">FIFO</SelectItem>
                      <SelectItem value="LIFO">LIFO</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="sku-code">SKU Code</Label>
                  <Select
                    value={createForm.skuCode}
                    onValueChange={(value) => updateCreateForm("skuCode", value)}
                    disabled={createSubmitting || createOptionsLoading || skuOptions.length === 0}
                  >
                    <SelectTrigger id="sku-code">
                      <SelectValue placeholder={createOptionsLoading ? "Loading SKU codes..." : "Select SKU code"} />
                    </SelectTrigger>
                    <SelectContent>
                      {skuOptions.length === 0 ? (
                        <SelectItem value="__no_sku__" disabled>
                          No SKU codes available
                        </SelectItem>
                      ) : (
                        skuOptions.map((option) => (
                          <SelectItem key={option.id} value={option.code}>
                            {option.label}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>



                <div className="space-y-1.5">
                  <Label htmlFor="priority">Priority</Label>
                  <Select
                    value={createForm.priority}
                    onValueChange={(value) => updateCreateForm("priority", value as RulePriority)}
                    disabled={createSubmitting}
                  >
                    <SelectTrigger id="priority">
                      <SelectValue placeholder="Select priority" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="HIGH">HIGH</SelectItem>
                      <SelectItem value="MEDIUM">MEDIUM</SelectItem>
                      <SelectItem value="LOW">LOW</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="status">Status</Label>
                  <Select
                    value={createForm.status}
                    onValueChange={(value) => updateCreateForm("status", value as RuleStatus)}
                    disabled={createSubmitting}
                  >
                    <SelectTrigger id="status">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ACTIVE">ACTIVE</SelectItem>
                      <SelectItem value="INACTIVE">INACTIVE</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="min-threshold">Min Threshold</Label>
                  <Input
                    id="min-threshold"
                    type="number"
                    min="0"
                    value={createForm.minThreshold}
                    onChange={(e) => updateCreateForm("minThreshold", e.target.value)}
                    disabled={createSubmitting}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="target-quantity">Target Quantity</Label>
                  <Input
                    id="target-quantity"
                    type="number"
                    min="1"
                    value={createForm.targetQuantity}
                    onChange={(e) => updateCreateForm("targetQuantity", e.target.value)}
                    disabled={createSubmitting}
                  />
                </div>

                <div className="space-y-1.5 md:col-span-2">
                  <Label htmlFor="time-based-enabled">Time Based Enabled</Label>
                  <div className="flex items-center justify-between rounded-md border border-input bg-background px-3 py-2">
                    <div>
                      <p className="text-sm font-medium">Enable time-based refill</p>
                      <p className="text-xs text-muted-foreground">Turn on to require a refill frequency.</p>
                    </div>
                    <Switch
                      id="time-based-enabled"
                      checked={createForm.timeBasedEnabled}
                      onCheckedChange={(checked) => updateCreateForm("timeBasedEnabled", checked)}
                      disabled={createSubmitting}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="refill-frequency-minutes">Refill Frequency Minutes</Label>
                  <Input
                    id="refill-frequency-minutes"
                    type="number"
                    min="1"
                    value={createForm.refillFrequencyMinutes}
                    onChange={(e) => updateCreateForm("refillFrequencyMinutes", e.target.value)}
                    disabled={createSubmitting || !createForm.timeBasedEnabled}
                    placeholder={createForm.timeBasedEnabled ? "Minutes" : "Disabled"}
                  />
                </div>

                <div className="space-y-1.5 md:col-span-2">
                  <Label htmlFor="is-fast-mover">Fast Mover</Label>
                  <div className="flex items-center justify-between rounded-md border border-input bg-background px-3 py-2">
                    <div>
                      <p className="text-sm font-medium">Mark as fast mover</p>
                      <p className="text-xs text-muted-foreground">Used for rules that need a higher replenishment cadence.</p>
                    </div>
                    <Switch
                      id="is-fast-mover"
                      checked={createForm.isFastMover}
                      onCheckedChange={(checked) => updateCreateForm("isFastMover", checked)}
                      disabled={createSubmitting}
                    />
                  </div>
                </div>
              </form>
                </CardContent>
              </Card>
            </div>

            <DialogFooter className="border-t border-border bg-card/95 px-6 py-4 backdrop-blur supports-[backdrop-filter]:bg-card/80">
              <Button type="button" variant="outline" onClick={closeCreateDialog} disabled={createSubmitting}>
                Cancel
              </Button>
              <Button type="submit" form="replenishment-rule-form" disabled={createSubmitting}>
                {createSubmitting ? "Creating..." : "Create Rule"}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
