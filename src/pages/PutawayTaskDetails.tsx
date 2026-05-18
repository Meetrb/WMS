import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, RefreshCw, AlertTriangle, ScanLine } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Scanner } from "@/components/Scanner";
import { useAuth } from "@/components/auth-provider";
import api from "@/services/api";
import { palletService } from "@/services/palletService";
import { formatDisplayDateTime } from "@/lib/date";

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
  task_data: Record<string, unknown>;
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
  warehouse_name?: string;
  warehouse_id?: string;
  pallet_id?: string;
  pallet_barcode?: string;
  split_required?: boolean;
  items?: Array<{
    grn_item_id?: string;
    item_id?: string;
    item_sku?: string;
    quantity?: number;
    lot_number?: string | null;
    batch_number?: string | null;
    expiry_date?: string | null;
    suggested_bin_id?: string;
    suggested_bin_code?: string;
  }>;
}

interface SeedTask {
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
  item_barcode?: string;
  item_alt_barcodes?: string[] | null;
  asn_number?: string;
  suggested_bin_barcode?: string;
  suggested_zone?: string;
  suggested_aisle?: string;
  suggested_rack?: string;
  suggested_shelf?: string;
  lot_number?: string | null;
  batch_number?: string | null;
  expiry_date?: string | null;
  [key: string]: unknown;
}

interface WorkerDashboardResponse {
  active_tasks?: Array<Record<string, unknown>>;
}

interface BinLookupResponse {
  id?: string;
  code?: string;
  bin_code?: string;
  barcode?: string;
  bin_barcode?: string;
  warehouse_id?: string;
  warehouse_code?: string;
  warehouse_name?: string;
  warehouse?: {
    id?: string;
    code?: string;
    name?: string;
  };
  zone_name?: string;
  zone_code?: string;
  zone?: string;
  aisle?: string;
  rack?: string;
  shelf?: string;
  bin_position?: string;
  [key: string]: unknown;
}

interface ItemLookupResponse {
  id?: string;
  primary_barcode?: string;
  barcode?: string;
  alt_barcodes?: string[];
  [key: string]: unknown;
}

interface PalletLookupResponse {
  id?: string;
  pallet_id?: string;
  barcode?: string;
  pallet_code?: string;
  [key: string]: unknown;
}

interface CompleteTaskForm {
  pallet_code: string;
  items: Array<{
    grn_item_id?: string;
    item_sku: string;
    actual_bin_code: string;
    actual_bin_id?: string;
    quantity_put: number;
  }>;
  notes: string;
}

const fetchTaskDetail = async (taskId: string): Promise<PutawayTaskDetail> => {
  try {
    const response = await api.get<PutawayTaskDetail>(`/putaway/tasks/${taskId}`);
    return response.data;
  } catch {
    const fallbackResponse = await api.get<PutawayTaskDetail>(`/putaway/tasks/${taskId}/`);
    return fallbackResponse.data;
  }
};

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

function parseQuantityNumber(raw: string | number | null | undefined): number {
  if (raw === null || raw === undefined) return 0;

  const value = Number(String(raw).replace(/[,+]/g, "").trim());
  return Number.isFinite(value) ? value : 0;
}

function formatDate(iso: string | null): string {
  if (!iso || iso === "-") return "-";
  return formatDisplayDateTime(iso, "-");
}

function normalizeStatus(raw: string): string {
  return raw
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function priorityMeta(priority: number): { label: string; className: string } {
  switch (priority) {
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
        className: "bg-muted text-muted-foreground border-border",
      };
  }
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "-";
  if (Array.isArray(value)) return value.length ? value.map((item) => String(item)).join(", ") : "-";
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return "-";
    }
  }

  return String(value);
}

function normalizeLookupValue(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function extractPrimitiveByNormalizedKey(value: unknown, targetNormalizedKey: string, depth = 0): unknown {
  if (depth > 4 || value === null || value === undefined) return undefined;

  if (Array.isArray(value)) {
    for (const entry of value) {
      const hit = extractPrimitiveByNormalizedKey(entry, targetNormalizedKey, depth + 1);
      if (hit !== undefined && hit !== null && hit !== "") return hit;
    }
    return undefined;
  }

  if (!isRecord(value)) return undefined;

  for (const [key, child] of Object.entries(value)) {
    if (normalizeKey(key) === targetNormalizedKey && child !== undefined && child !== null && child !== "") {
      return child;
    }

    if (isRecord(child) || Array.isArray(child)) {
      const hit = extractPrimitiveByNormalizedKey(child, targetNormalizedKey, depth + 1);
      if (hit !== undefined && hit !== null && hit !== "") return hit;
    }
  }

  return undefined;
}

function extractPrimitiveByLooseNormalizedKey(value: unknown, targetNormalizedKey: string, depth = 0): unknown {
  if (depth > 4 || value === null || value === undefined) return undefined;

  if (Array.isArray(value)) {
    for (const entry of value) {
      const hit = extractPrimitiveByLooseNormalizedKey(entry, targetNormalizedKey, depth + 1);
      if (hit !== undefined && hit !== null && hit !== "") return hit;
    }
    return undefined;
  }

  if (!isRecord(value)) return undefined;

  for (const [key, child] of Object.entries(value)) {
    const normalizedKey = normalizeKey(key);
    const looseMatch =
      normalizedKey.includes(targetNormalizedKey) ||
      targetNormalizedKey.includes(normalizedKey);

    if (looseMatch && child !== undefined && child !== null && child !== "" && !isRecord(child) && !Array.isArray(child)) {
      return child;
    }

    if (isRecord(child) || Array.isArray(child)) {
      const hit = extractPrimitiveByLooseNormalizedKey(child, targetNormalizedKey, depth + 1);
      if (hit !== undefined && hit !== null && hit !== "") return hit;
    }
  }

  return undefined;
}

function valueFromRecord(record: Record<string, unknown> | undefined, key: string): unknown {
  if (!record) return undefined;
  return record[key];
}

function hasUsableValue(value: unknown): boolean {
  if (value === undefined || value === null) return false;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed !== "" && trimmed !== "-" && trimmed.toLowerCase() !== "null";
  }

  return true;
}

function resolveRawDetailField(
  detail: PutawayTaskDetail,
  seedTask: SeedTask | undefined,
  workerSeedTask: SeedTask | undefined,
  ...keys: string[]
): unknown {
  const detailRecord = detail as unknown as Record<string, unknown>;
  const seedRecord = seedTask as Record<string, unknown> | undefined;
  const workerSeedRecord = workerSeedTask as Record<string, unknown> | undefined;

  for (const key of keys) {
    const normalizedKey = normalizeKey(key);

    const detailValue = valueFromRecord(detailRecord, key);
    if (hasUsableValue(detailValue)) {
      return detailValue;
    }

    const detailNestedValue = extractPrimitiveByNormalizedKey(detailRecord, normalizedKey);
    if (hasUsableValue(detailNestedValue)) {
      return detailNestedValue;
    }

    const detailLooseValue = extractPrimitiveByLooseNormalizedKey(detailRecord, normalizedKey);
    if (hasUsableValue(detailLooseValue)) {
      return detailLooseValue;
    }

    const taskDataValue = valueFromRecord(detail.task_data, key);
    if (hasUsableValue(taskDataValue)) {
      return taskDataValue;
    }

    const taskDataNestedValue = extractPrimitiveByNormalizedKey(detail.task_data, normalizedKey);
    if (hasUsableValue(taskDataNestedValue)) {
      return taskDataNestedValue;
    }

    const taskDataLooseValue = extractPrimitiveByLooseNormalizedKey(detail.task_data, normalizedKey);
    if (hasUsableValue(taskDataLooseValue)) {
      return taskDataLooseValue;
    }

    const seedValue = valueFromRecord(seedRecord, key);
    if (hasUsableValue(seedValue)) {
      return seedValue;
    }

    const seedNestedValue = extractPrimitiveByNormalizedKey(seedRecord, normalizedKey);
    if (hasUsableValue(seedNestedValue)) {
      return seedNestedValue;
    }

    const seedLooseValue = extractPrimitiveByLooseNormalizedKey(seedRecord, normalizedKey);
    if (hasUsableValue(seedLooseValue)) {
      return seedLooseValue;
    }

    const workerSeedValue = valueFromRecord(workerSeedRecord, key);
    if (hasUsableValue(workerSeedValue)) {
      return workerSeedValue;
    }

    const workerSeedNestedValue = extractPrimitiveByNormalizedKey(workerSeedRecord, normalizedKey);
    if (hasUsableValue(workerSeedNestedValue)) {
      return workerSeedNestedValue;
    }

    const workerSeedLooseValue = extractPrimitiveByLooseNormalizedKey(workerSeedRecord, normalizedKey);
    if (hasUsableValue(workerSeedLooseValue)) {
      return workerSeedLooseValue;
    }
  }

  return undefined;
}

function resolveNestedEntityField(
  detail: PutawayTaskDetail,
  seedTask: SeedTask | undefined,
  workerSeedTask: SeedTask | undefined,
  entityKeys: string[],
  fieldKeys: string[],
): unknown {
  const sources: unknown[] = [detail, detail.task_data, seedTask, workerSeedTask];

  for (const source of sources) {
    if (!isRecord(source)) continue;

    for (const entityKey of entityKeys) {
      const entityValue = source[entityKey];
      if (!isRecord(entityValue)) continue;

      for (const fieldKey of fieldKeys) {
        const direct = entityValue[fieldKey];
        if (hasUsableValue(direct)) {
          return direct;
        }

        const normalized = normalizeKey(fieldKey);
        const nested = extractPrimitiveByLooseNormalizedKey(entityValue, normalized);
        if (hasUsableValue(nested)) {
          return nested;
        }
      }
    }
  }

  return undefined;
}

function resolveDetailField(
  detail: PutawayTaskDetail,
  seedTask: SeedTask | undefined,
  workerSeedTask: SeedTask | undefined,
  ...keys: string[]
): string {
  const resolvedValue = resolveRawDetailField(detail, seedTask, workerSeedTask, ...keys);
  return hasUsableValue(resolvedValue) ? formatValue(resolvedValue) : "-";
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-card px-4 py-3">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-semibold break-all">{value || "-"}</p>
    </div>
  );
}

function buildMockTaskDetail(taskId: string, seedTask?: SeedTask): PutawayTaskDetail {
  const now = new Date().toISOString();

  return {
    id: taskId,
    task_number: seedTask?.task_number || `PUT-${taskId.slice(0, 8).toUpperCase()}`,
    inbound_shipment_id: "",
    grn_id: "",
    asn_shipment_item_id: "",
    item_id: "",
    item_sku: seedTask?.item_sku || "-",
    item_description: seedTask?.item_description || "-",
    quantity_to_put: seedTask?.quantity_to_put || "0",
    quantity_put: seedTask?.quantity_put || "0",
    source_location: "Receiving Dock N/A",
    suggested_bin_id: "",
    suggested_bin_code: "-",
    actual_bin_code: "-",
    lot_number: "",
    batch_number: "",
    expiry_date: null,
    priority: seedTask?.priority || 0,
    notes: "Could not load all details from server.",
    task_data: {},
    assigned_to_id: "",
    assigned_to_name: seedTask?.assigned_to_name || "Unassigned",
    assigned_at: null,
    started_at: null,
    completed_at: seedTask?.completed_at || null,
    status: seedTask?.status || "pending",
    queue_position: 0,
    created_by_id: "",
    created_by_name: "System",
    created_at: seedTask?.created_at || now,
    updated_at: now,
    inbound_shipment_number: "-",
    grn_number: "-",
  };
}

function normalizeCompleteTaskItems(detail: PutawayTaskDetail): CompleteTaskForm["items"] {
  const detailItems =
    detail.items && detail.items.length > 0
      ? detail.items
      : Array.isArray(detail.task_data?.items)
        ? (detail.task_data.items as Array<Record<string, unknown>>)
        : [];

  const quantityToPut = parseQuantityNumber(detail.quantity_to_put);
  const quantityAlreadyPut = parseQuantityNumber(detail.quantity_put);
  const fallbackQuantity = quantityAlreadyPut > 0 ? quantityAlreadyPut : quantityToPut;

  if (detailItems.length === 0) {
    const detailRecord = detail as unknown as Record<string, unknown>;
    const fallbackGrnItemId = String(
      detailRecord.grn_item_id ||
      detailRecord.grn_item_code ||
      detail.task_data?.grn_item_id ||
      detail.task_data?.grn_item_code ||
      detail.asn_shipment_item_id ||
      "",
    ).trim();

    return [
      {
        grn_item_id: fallbackGrnItemId || undefined,
        item_sku: detail.item_sku || "-",
        actual_bin_code: detail.actual_bin_code || detail.suggested_bin_code || "",
        quantity_put: fallbackQuantity,
      },
    ];
  }

  return detailItems.map((item) => {
    const itemQuantity = parseQuantityNumber(item.quantity);
    return {
      grn_item_id: String(item.grn_item_id || item.grn_item_code || item.item_id || "").trim() || undefined,
      item_sku: String(item.item_sku || detail.item_sku || "-").trim(),
      actual_bin_code: String(item.suggested_bin_code || detail.actual_bin_code || detail.suggested_bin_code || "").trim(),
      quantity_put: itemQuantity > 0 ? itemQuantity : fallbackQuantity,
    };
  });
}

function buildCompleteTaskForm(detail: PutawayTaskDetail, palletCode: string): CompleteTaskForm {
  return {
    pallet_code: palletCode,
    items: normalizeCompleteTaskItems(detail),
    notes: detail.notes || "",
  };
}

export default function PutawayTaskDetails() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const navigate = useNavigate();
  const location = useLocation();
  const { taskId } = useParams<{ taskId: string }>();
  const navigationState = (location.state as { seedTask?: SeedTask; from?: string } | null) ?? null;
  const seedTask = navigationState?.seedTask;
  const backTo = navigationState?.from || "/dashboard/putaway-tasks";
  const backLabel = backTo === "/dashboard/worker" ? "Back to Worker Dashboard" : "Back to Putaway Tasks";

  const [taskDetail, setTaskDetail] = useState<PutawayTaskDetail | null>(null);
  const [workerSeedTask, setWorkerSeedTask] = useState<SeedTask | undefined>(seedTask);
  const [suggestedBinDetail, setSuggestedBinDetail] = useState<BinLookupResponse | null>(null);
  const [itemLookupDetail, setItemLookupDetail] = useState<ItemLookupResponse | null>(null);
  const [palletLookupDetail, setPalletLookupDetail] = useState<PalletLookupResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [completeDialogOpen, setCompleteDialogOpen] = useState<boolean>(false);
  const [completingTask, setCompletingTask] = useState<boolean>(false);
  const [completeForm, setCompleteForm] = useState<CompleteTaskForm | null>(null);
  const [availableBins, setAvailableBins] = useState<BinLookupResponse[]>([]);
  const [binsLoading, setBinsLoading] = useState<boolean>(false);
  const [scannerOpen, setScannerOpen] = useState<boolean>(false);

  const loadTaskDetail = useCallback(async () => {
    if (!taskId) {
      setLoading(false);
      setError("Task is missing.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const detail = await fetchTaskDetail(taskId);
      setTaskDetail(detail);

      if (!seedTask) {
        try {
          const workerDashboardResponse = await api.get<WorkerDashboardResponse>("/putaway/worker/dashboard");
          const matchedTask = (workerDashboardResponse.data.active_tasks || []).find(
            (task) => String(task?.id || "") === taskId
          );
          if (matchedTask) {
            setWorkerSeedTask(matchedTask as unknown as SeedTask);
          }
        } catch {
          // No-op; detail page can still render with primary task detail payload.
        }
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to fetch task details.";
      setError(message);
      setTaskDetail(buildMockTaskDetail(taskId, seedTask));

      if (!seedTask) {
        try {
          const workerDashboardResponse = await api.get<WorkerDashboardResponse>("/putaway/worker/dashboard");
          const matchedTask = (workerDashboardResponse.data.active_tasks || []).find(
            (task) => String(task?.id || "") === taskId
          );
          if (matchedTask) {
            setWorkerSeedTask(matchedTask as unknown as SeedTask);
          }
        } catch {
          // No-op; mock payload remains fallback of last resort.
        }
      }
    } finally {
      setLoading(false);
    }
  }, [taskId, seedTask]);

  useEffect(() => {
    loadTaskDetail();
  }, [loadTaskDetail]);

  useEffect(() => {
    if (!taskDetail) {
      setSuggestedBinDetail(null);
      return;
    }

    const suggestedBinIdRaw = resolveRawDetailField(
      taskDetail,
      seedTask,
      workerSeedTask,
      "suggested_bin_id",
      "suggestedBinId",
      "bin_id",
      "binId"
    );

    const suggestedBinId = hasUsableValue(suggestedBinIdRaw) ? String(suggestedBinIdRaw) : "";
    if (!suggestedBinId) {
      setSuggestedBinDetail(null);
      return;
    }

    let disposed = false;

    const loadSuggestedBin = async () => {
      try {
        const response = await api.get<BinLookupResponse>(`/bins/${suggestedBinId}`);
        if (!disposed) {
          setSuggestedBinDetail(response.data);
        }
      } catch {
        try {
          const fallbackResponse = await api.get<BinLookupResponse>(`/bins/${suggestedBinId}/`);
          if (!disposed) {
            setSuggestedBinDetail(fallbackResponse.data);
          }
        } catch {
          if (!disposed) {
            setSuggestedBinDetail(null);
          }
        }
      }
    };

    void loadSuggestedBin();

    return () => {
      disposed = true;
    };
  }, [taskDetail, seedTask, workerSeedTask]);

  useEffect(() => {
    if (!taskDetail) {
      setItemLookupDetail(null);
      return;
    }

    const itemIdRaw = resolveRawDetailField(
      taskDetail,
      seedTask,
      workerSeedTask,
      "item_id",
      "itemId",
      "sku_item_id"
    );

    const itemId = hasUsableValue(itemIdRaw) ? String(itemIdRaw) : "";
    if (!itemId) {
      setItemLookupDetail(null);
      return;
    }

    let disposed = false;

    const loadItem = async () => {
      try {
        const response = await api.get<ItemLookupResponse>(`/items/${itemId}`);
        if (!disposed) {
          setItemLookupDetail(response.data);
        }
      } catch {
        try {
          const fallbackResponse = await api.get<ItemLookupResponse>(`/items/${itemId}/`);
          if (!disposed) {
            setItemLookupDetail(fallbackResponse.data);
          }
        } catch {
          if (!disposed) {
            setItemLookupDetail(null);
          }
        }
      }
    };

    void loadItem();

    return () => {
      disposed = true;
    };
  }, [taskDetail, seedTask, workerSeedTask]);

  useEffect(() => {
    if (!taskDetail) {
      setPalletLookupDetail(null);
      return;
    }

    const palletIdRaw = resolveRawDetailField(taskDetail, seedTask, workerSeedTask, "pallet_id", "palletId");
    const palletId = hasUsableValue(palletIdRaw) ? String(palletIdRaw).trim() : "";
    if (!palletId) {
      setPalletLookupDetail(null);
      return;
    }

    let disposed = false;

    const loadPallet = async () => {
      try {
        const response = await palletService.getById(palletId);
        if (!disposed && response) {
          setPalletLookupDetail(response);
        }
      } catch {
        if (!disposed) {
          setPalletLookupDetail(null);
        }
      }
    };

    void loadPallet();

    return () => {
      disposed = true;
    };
  }, [taskDetail, seedTask, workerSeedTask]);

  const extraFields = useMemo(() => {
    if (!taskDetail || !taskDetail.task_data) return [];

    return Object.entries(taskDetail.task_data)
      .filter(([key, value]) => !/id/i.test(key) && value !== null && value !== undefined && value !== "")
      .filter(([key]) => {
        const normalized = key.toLowerCase();
        const alreadyShown = [
          "item_barcode",
          "item_alt_barcodes",
          "item_alt_barcode",
          "asn_number",
          "asn",
          "suggested_bin_barcode",
          "bin_barcode",
          "suggested_zone",
          "zone",
          "suggested_aisle",
          "aisle",
          "suggested_rack",
          "rack",
          "suggested_shelf",
          "shelf",
          "items",
          "group_items",
        ];

        return !alreadyShown.includes(normalized);
      })
      .map(([key, value]) => ({
        label: key.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase()),
        value: formatValue(value),
      }));
  }, [taskDetail]);

  const handleScan = (decodedText: string) => {
    toast.success(`Scanned: ${decodedText}`);
    setScannerOpen(false);
  };

  const openCompleteDialog = () => {
    if (!taskDetail) return;
    const normalizedStatus = String(taskDetail.status || "").toLowerCase();
    if (normalizedStatus === "completed") {
      toast.info("This task is already completed.");
      return;
    }

    const palletCode = String(
      palletLookupDetail?.pallet_code ??
      taskDetail.pallet_barcode ??
      resolveRawDetailField(taskDetail, seedTask, workerSeedTask, "pallet_code", "palletCode") ??
      "",
    ).trim();

    const initialForm = buildCompleteTaskForm(taskDetail, palletCode);
    setCompleteForm(initialForm);
    setCompleteDialogOpen(true);
  };

  const updateCompleteField = <K extends keyof CompleteTaskForm>(key: K, value: CompleteTaskForm[K]) => {
    setCompleteForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const updateCompleteItemField = <K extends keyof CompleteTaskForm["items"][number]>(
    index: number,
    key: K,
    value: CompleteTaskForm["items"][number][K],
  ) => {
    setCompleteForm((prev) => {
      if (!prev) return prev;

      return {
        ...prev,
        items: prev.items.map((item, itemIndex) =>
          itemIndex === index ? { ...item, [key]: value } : item,
        ),
      };
    });
  };

  useEffect(() => {
    if (!completeDialogOpen || isAdmin || !taskDetail) return;

    let disposed = false;

    const loadBins = async () => {
      const targetWarehouseId = normalizeLookupValue(
        resolveRawDetailField(
          taskDetail,
          seedTask,
          workerSeedTask,
          "warehouse_id",
          "warehouseId"
        )
      );
      const targetWarehouseCode = normalizeLookupValue(
        resolveRawDetailField(
          taskDetail,
          seedTask,
          workerSeedTask,
          "warehouse_code",
          "warehouseCode"
        )
      );
      const targetWarehouseName = normalizeLookupValue(
        resolveRawDetailField(
          taskDetail,
          seedTask,
          workerSeedTask,
          "warehouse_name",
          "warehouseName"
        )
      );

      setBinsLoading(true);
      try {
        const response = await api.get("/bins/", {
          params: {
            limit: 200,
            ...(targetWarehouseId ? { warehouse_id: targetWarehouseId } : {}),
            ...(targetWarehouseCode ? { warehouse_code: targetWarehouseCode } : {}),
          },
        });

        const payload = response.data as unknown;
        const bins = Array.isArray(payload)
          ? payload
          : Array.isArray((payload as Record<string, unknown>)?.items)
            ? ((payload as Record<string, unknown>).items as unknown[])
            : Array.isArray((payload as Record<string, unknown>)?.results)
              ? ((payload as Record<string, unknown>).results as unknown[])
              : Array.isArray((payload as Record<string, unknown>)?.data)
                ? ((payload as Record<string, unknown>).data as unknown[])
                : [];

        const normalized = bins
          .map((entry) => (entry as BinLookupResponse))
          .filter((bin) => Boolean(String(bin.id || "").trim()))
          .filter((bin) => {
            // If task has no warehouse context, keep existing behavior.
            if (!targetWarehouseId && !targetWarehouseCode && !targetWarehouseName) {
              return true;
            }

            const binValues = [
              bin.warehouse_id,
              bin.warehouse_code,
              bin.warehouse_name,
              bin.warehouse?.id,
              bin.warehouse?.code,
              bin.warehouse?.name,
            ].map(normalizeLookupValue).filter(Boolean);

            const expected = [targetWarehouseId, targetWarehouseCode, targetWarehouseName]
              .filter(Boolean);

            return expected.some((value) => binValues.includes(value));
          });

        if (!disposed) {
          setAvailableBins(normalized);
        }
      } catch {
        if (!disposed) {
          setAvailableBins([]);
          toast.error("Failed to load bins.");
        }
      } finally {
        if (!disposed) {
          setBinsLoading(false);
        }
      }
    };

    void loadBins();

    return () => {
      disposed = true;
    };
  }, [completeDialogOpen, isAdmin, taskDetail, seedTask, workerSeedTask]);

  const submitCompleteTask = async () => {
    if (!taskId || !completeForm || completingTask) return;

    const normalizedStatus = String(taskDetail?.status || "").toLowerCase();
    if (normalizedStatus === "completed") {
      toast.error("Task cannot be completed from status COMPLETED.");
      return;
    }

    const palletCode = completeForm.pallet_code.trim();
    if (!palletCode) {
      toast.error("Pallet code is required.");
      return;
    }

    if (completeForm.items.length === 0) {
      toast.error("At least one item is required.");
      return;
    }

    const rejectedTaskSignals = [
      String(taskDetail?.status || ""),
      String(taskDetail?.source_location || ""),
      String(taskDetail?.notes || ""),
      JSON.stringify(taskDetail?.task_data || {}),
      JSON.stringify(seedTask || {}),
      JSON.stringify(workerSeedTask || {}),
    ].join(" ").toLowerCase();
    const isRejectedPutawayTask = rejectedTaskSignals.includes("reject");
    const rejectedTaskTargetQuantity = parseQuantityNumber(taskDetail?.quantity_to_put);
    const submissionItems = completeForm.items.map((item) => ({
      grn_item_id: item.grn_item_id || undefined,
      item_sku: item.item_sku.trim(),
      actual_bin_id: (() => {
        const selectedBinCode = normalizeLookupValue(item.actual_bin_code);
        const matchedBin = binsForTaskWarehouse.find((bin) => {
          const binCodes = [
            bin.id,
            bin.code,
            bin.bin_code,
            bin.barcode,
            bin.bin_barcode,
          ]
            .map(normalizeLookupValue)
            .filter(Boolean);

          return selectedBinCode && binCodes.includes(selectedBinCode);
        });

        return String(matchedBin?.id ?? matchedBin?.code ?? matchedBin?.bin_code ?? "").trim();
      })(),
      actual_bin_code: item.actual_bin_code.trim(),
      quantity_put: isRejectedPutawayTask ? rejectedTaskTargetQuantity : item.quantity_put,
    }));

    if (submissionItems.some((item) => !item.grn_item_id || !item.item_sku || !item.actual_bin_code || !item.actual_bin_id)) {
      toast.error("Each item needs GRN item ID, SKU, and a valid actual bin code.");
      return;
    }

    const payload = {
      task_number: taskDetail?.task_number || taskId,
      pallet_code: palletCode,
      items: submissionItems,
      notes: completeForm.notes,
    };

    setCompletingTask(true);
    try {
      const response = await api.post(`/putaway/tasks/${taskId}/complete`, payload);
      const responsePayload =
        response && typeof response.data === "object" && response.data !== null
          ? (response.data as Record<string, unknown>)
          : {};
      const inspectionId =
        String(
          responsePayload.inspection_id ??
          responsePayload.inspectionId ??
          responsePayload.created_inspection_id ??
          responsePayload.createdInspectionId ??
          "",
        ).trim();
      const inspectionCreated =
        Boolean(responsePayload.inspection_created ?? responsePayload.inspectionCreated) ||
        Boolean(inspectionId);

      toast.success("Task ended successfully.");
      if (inspectionCreated) {
        toast.info(
          inspectionId
            ? `Inspection ${inspectionId} created and assigned. It now appears in My Assigned Inspections.`
            : "Inspection task created and assigned. It now appears in My Assigned Inspections.",
        );
      }
      setCompleteDialogOpen(false);
      await loadTaskDetail();
    } catch (completeError) {
      const apiDetail =
        (completeError as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;

      const message =
        typeof apiDetail === "string" && apiDetail.trim()
          ? apiDetail
          : completeError instanceof Error
            ? completeError.message
            : "Failed to end task.";

      toast.error(message);
    } finally {
      setCompletingTask(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Loading putaway task details...</p>
      </div>
    );
  }

  if (!taskDetail) {
    return (
      <div className="space-y-4 p-4 sm:p-6">
        <Button variant="outline" size="sm" onClick={() => navigate(backTo)}>{backLabel}</Button>
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          Could not load task details.
        </div>
      </div>
    );
  }

  const priority = priorityMeta(taskDetail.priority);
  const suggestedBinCode =
    resolveDetailField(taskDetail, seedTask, workerSeedTask, "suggested_bin_code", "suggestedBinCode", "recommended_bin_code", "target_bin_code", "bin_code") !== "-"
      ? resolveDetailField(taskDetail, seedTask, workerSeedTask, "suggested_bin_code", "suggestedBinCode", "recommended_bin_code", "target_bin_code", "bin_code")
      : hasUsableValue(resolveNestedEntityField(taskDetail, seedTask, workerSeedTask, ["suggested_bin", "suggestedBin", "target_bin", "targetBin", "bin", "location"], ["code", "bin_code", "binCode", "barcode", "bin_barcode", "binBarcode"]))
        ? formatValue(resolveNestedEntityField(taskDetail, seedTask, workerSeedTask, ["suggested_bin", "suggestedBin", "target_bin", "targetBin", "bin", "location"], ["code", "bin_code", "binCode", "barcode", "bin_barcode", "binBarcode"]))
        : formatValue(suggestedBinDetail?.code ?? suggestedBinDetail?.bin_code);
  const suggestedBinBarcode =
    resolveDetailField(taskDetail, seedTask, workerSeedTask, "suggested_bin_barcode", "suggestedBinBarcode", "bin_barcode", "binBarcode", "recommended_bin_barcode", "target_bin_barcode") !== "-"
      ? resolveDetailField(taskDetail, seedTask, workerSeedTask, "suggested_bin_barcode", "suggestedBinBarcode", "bin_barcode", "binBarcode", "recommended_bin_barcode", "target_bin_barcode")
      : hasUsableValue(resolveNestedEntityField(taskDetail, seedTask, workerSeedTask, ["suggested_bin", "suggestedBin", "target_bin", "targetBin", "bin", "location"], ["barcode", "bin_barcode", "binBarcode", "code", "bin_code", "binCode"]))
        ? formatValue(resolveNestedEntityField(taskDetail, seedTask, workerSeedTask, ["suggested_bin", "suggestedBin", "target_bin", "targetBin", "bin", "location"], ["barcode", "bin_barcode", "binBarcode", "code", "bin_code", "binCode"]))
        : formatValue(suggestedBinDetail?.barcode ?? suggestedBinDetail?.bin_barcode);
  const suggestedZone =
    resolveDetailField(taskDetail, seedTask, workerSeedTask, "suggested_zone", "suggestedZone", "zone") !== "-"
      ? resolveDetailField(taskDetail, seedTask, workerSeedTask, "suggested_zone", "suggestedZone", "zone")
      : hasUsableValue(resolveNestedEntityField(taskDetail, seedTask, workerSeedTask, ["suggested_bin", "suggestedBin", "target_bin", "targetBin", "bin", "location"], ["zone", "zone_name", "zoneCode", "zone_code"]))
        ? formatValue(resolveNestedEntityField(taskDetail, seedTask, workerSeedTask, ["suggested_bin", "suggestedBin", "target_bin", "targetBin", "bin", "location"], ["zone", "zone_name", "zoneCode", "zone_code"]))
        : formatValue(suggestedBinDetail?.zone_name ?? suggestedBinDetail?.zone_code ?? suggestedBinDetail?.zone);
  const suggestedAisle =
    resolveDetailField(taskDetail, seedTask, workerSeedTask, "suggested_aisle", "suggestedAisle", "aisle") !== "-"
      ? resolveDetailField(taskDetail, seedTask, workerSeedTask, "suggested_aisle", "suggestedAisle", "aisle")
      : hasUsableValue(resolveNestedEntityField(taskDetail, seedTask, workerSeedTask, ["suggested_bin", "suggestedBin", "target_bin", "targetBin", "bin", "location"], ["aisle"]))
        ? formatValue(resolveNestedEntityField(taskDetail, seedTask, workerSeedTask, ["suggested_bin", "suggestedBin", "target_bin", "targetBin", "bin", "location"], ["aisle"]))
        : formatValue(suggestedBinDetail?.aisle);
  const suggestedRack =
    resolveDetailField(taskDetail, seedTask, workerSeedTask, "suggested_rack", "suggestedRack", "rack") !== "-"
      ? resolveDetailField(taskDetail, seedTask, workerSeedTask, "suggested_rack", "suggestedRack", "rack")
      : hasUsableValue(resolveNestedEntityField(taskDetail, seedTask, workerSeedTask, ["suggested_bin", "suggestedBin", "target_bin", "targetBin", "bin", "location"], ["rack"]))
        ? formatValue(resolveNestedEntityField(taskDetail, seedTask, workerSeedTask, ["suggested_bin", "suggestedBin", "target_bin", "targetBin", "bin", "location"], ["rack"]))
        : formatValue(suggestedBinDetail?.rack);
  const suggestedShelf =
    resolveDetailField(taskDetail, seedTask, workerSeedTask, "suggested_shelf", "suggestedShelf", "shelf") !== "-"
      ? resolveDetailField(taskDetail, seedTask, workerSeedTask, "suggested_shelf", "suggestedShelf", "shelf")
      : hasUsableValue(resolveNestedEntityField(taskDetail, seedTask, workerSeedTask, ["suggested_bin", "suggestedBin", "target_bin", "targetBin", "bin", "location"], ["shelf", "bin_position", "binPosition"]))
        ? formatValue(resolveNestedEntityField(taskDetail, seedTask, workerSeedTask, ["suggested_bin", "suggestedBin", "target_bin", "targetBin", "bin", "location"], ["shelf", "bin_position", "binPosition"]))
        : formatValue(suggestedBinDetail?.shelf ?? suggestedBinDetail?.bin_position);
  const itemBarcode =
    resolveDetailField(taskDetail, seedTask, workerSeedTask, "item_barcode", "itemBarcode", "barcode", "primary_barcode", "primaryBarcode") !== "-"
      ? resolveDetailField(taskDetail, seedTask, workerSeedTask, "item_barcode", "itemBarcode", "barcode", "primary_barcode", "primaryBarcode")
      : formatValue(itemLookupDetail?.primary_barcode ?? itemLookupDetail?.barcode);
  const itemAltBarcodes =
    resolveDetailField(taskDetail, seedTask, workerSeedTask, "item_alt_barcodes", "itemAltBarcodes", "item_alt_barcode", "alt_barcodes", "altBarcodes") !== "-"
      ? resolveDetailField(taskDetail, seedTask, workerSeedTask, "item_alt_barcodes", "itemAltBarcodes", "item_alt_barcode", "alt_barcodes", "altBarcodes")
      : formatValue(itemLookupDetail?.alt_barcodes);
  const taskWarehouseId = normalizeLookupValue(
    resolveRawDetailField(taskDetail, seedTask, workerSeedTask, "warehouse_id", "warehouseId")
  );
  const taskWarehouseCode = normalizeLookupValue(
    resolveRawDetailField(taskDetail, seedTask, workerSeedTask, "warehouse_code", "warehouseCode")
  );
  const taskWarehouseName = formatValue(
    resolveDetailField(taskDetail, seedTask, workerSeedTask, "warehouse_name", "warehouseName")
  );
  const palletCodeForDisplay =
    completeForm?.pallet_code ||
    palletLookupDetail?.pallet_code ||
    String(resolveRawDetailField(taskDetail, seedTask, workerSeedTask, "pallet_code", "palletCode") ?? "").trim() ||
    String(taskDetail.pallet_barcode || "").trim() ||
    "-";
  const binsForTaskWarehouse = availableBins.filter((bin) => {
    if (!taskWarehouseId && !taskWarehouseCode) return true;
    const binValues = [
      bin.warehouse_id,
      bin.warehouse_code,
      bin.warehouse?.id,
      bin.warehouse?.code,
    ].map(normalizeLookupValue).filter(Boolean);

    return [taskWarehouseId, taskWarehouseCode]
      .filter(Boolean)
      .some((value) => binValues.includes(value));
  });
  const isTaskCompleted = String(taskDetail.status || "").toLowerCase() === "completed";
  const rejectedTaskSignals = [
    String(taskDetail.status || ""),
    String(taskDetail.source_location || ""),
    String(taskDetail.notes || ""),
    JSON.stringify(taskDetail.task_data || {}),
    JSON.stringify(seedTask || {}),
    JSON.stringify(workerSeedTask || {}),
  ].join(" ").toLowerCase();
  const isRejectedPutawayTask = rejectedTaskSignals.includes("reject");

  return (
    <div className="w-full max-w-full overflow-x-hidden p-4 sm:p-6 space-y-6 animate-fade-in">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Button variant="outline" size="sm" onClick={() => navigate(backTo)}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          {backLabel}
        </Button>

        <Button variant="ghost" size="sm" onClick={loadTaskDetail}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh Details
        </Button>
      </div>

      <div>
        <h1 className="text-2xl font-bold tracking-tight">Putaway Task Details</h1>
        <p className="text-muted-foreground">{taskDetail.task_number}</p>
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
          <CardTitle className="text-base">Task Overview</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <DetailField label="Task Number" value={taskDetail.task_number} />
          <div className="rounded-md border border-border bg-card px-4 py-3">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Status</p>
            <Badge variant="outline" className="mt-1">
              {normalizeStatus(taskDetail.status)}
            </Badge>
          </div>
          <div className="rounded-md border border-border bg-card px-4 py-3">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Priority</p>
            <Badge variant="outline" className={`mt-1 ${priority.className}`}>
              {priority.label}
            </Badge>
          </div>
          <DetailField
            label="Queue Position"
            value={resolveDetailField(taskDetail, seedTask, workerSeedTask, "queue_position", "queuePosition")}
          />
          <DetailField label="Assigned To" value={taskDetail.assigned_to_name || "Unassigned"} />
          <DetailField label="GRN Number" value={resolveDetailField(taskDetail, seedTask, workerSeedTask, "grn_number", "grnNumber")} />
          <DetailField label="Inbound Shipment" value={resolveDetailField(taskDetail, seedTask, workerSeedTask, "inbound_shipment_number", "inboundShipmentNumber")} />
          <DetailField
            label="Warehouse"
            value={resolveDetailField(taskDetail, seedTask, workerSeedTask, "warehouse_name", "warehouseName")}
          />
        </CardContent>
      </Card>

      {/* Task JSON removed per user request; fields are now shown in Pallet & Item sections */}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Pallet & Item Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Pallet Information */}
          <div>
            <h4 className="text-sm font-semibold mb-3">Pallet Details</h4>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <DetailField label="Source Location" value={resolveDetailField(taskDetail, seedTask, workerSeedTask, "source_location", "sourceLocation", "source_bin_code", "sourceBinCode") || taskDetail.source_location || "-"} />
              <DetailField label="GRN Number" value={resolveDetailField(taskDetail, seedTask, workerSeedTask, "grn_number", "grnNumber") || taskDetail.grn_number || "-"} />
              <DetailField label="Inbound Shipment" value={resolveDetailField(taskDetail, seedTask, workerSeedTask, "inbound_shipment_number", "inboundShipmentNumber") || taskDetail.inbound_shipment_number || "-"} />
              <DetailField label="Warehouse Name" value={resolveDetailField(taskDetail, seedTask, workerSeedTask, "warehouse_name", "warehouseName") || taskDetail.warehouse_name || "-"} />

              <DetailField label="Pallet Code" value={resolveDetailField(taskDetail, seedTask, workerSeedTask, "pallet_code", "palletCode") !== "-" ? resolveDetailField(taskDetail, seedTask, workerSeedTask, "pallet_code", "palletCode") : palletCodeForDisplay} />
              <DetailField label="Pallet Barcode" value={resolveDetailField(taskDetail, seedTask, workerSeedTask, "pallet_barcode", "palletBarcode") !== "-" ? resolveDetailField(taskDetail, seedTask, workerSeedTask, "pallet_barcode", "palletBarcode") : taskDetail.pallet_barcode || "-"} />
              <DetailField label="Assigned To" value={taskDetail.assigned_to_name || "-"} />
              <DetailField label="Assigned At" value={formatDate(taskDetail.assigned_at)} />

              <DetailField label="Created At" value={formatDate(taskDetail.created_at)} />
              <DetailField label="Split Required" value={taskDetail.split_required ? "Yes" : "No"} />
            </div>
          </div>

          {/* Items in Pallet */}
          {(() => {
            const items = taskDetail.items && taskDetail.items.length > 0 ? taskDetail.items : (taskDetail.task_data?.items as Array<any>);

            if (items && items.length > 0) {
              return (
                <div>
                  <h4 className="text-sm font-semibold mb-3 border-b pb-2">Pallet Items ({items.length})</h4>
                  <div className="space-y-4">
                    {items.map((item: any, index: number) => (
                      <div key={index} className="p-4 border rounded-lg bg-muted/30">
                        <div className="flex justify-between items-start mb-3">
                          <span className="text-sm font-semibold">Item {index + 1}</span>
                          <span className="text-xs text-muted-foreground">Code: {item.item_sku || "—"}</span>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                          <DetailField label="Item SKU" value={item.item_sku || item.itemSku || "-"} />
                          <DetailField label="Quantity" value={cleanQuantity(item.quantity)} />

                          <DetailField label="Lot Number" value={item.lot_number || item.lotNo || "-"} />
                          <DetailField label="Batch Number" value={item.batch_number || "-"} />
                          <DetailField label="Expiry Date" value={formatDate(item.expiry_date)} />
                          <DetailField label="Suggested Zone" value={item.suggested_zone || item.suggestedZone || "-"} />

                          <DetailField label="Suggested Aisle" value={item.suggested_aisle || item.suggestedAisle || "-"} />
                          <DetailField label="Suggested Rack" value={item.suggested_rack || item.suggestedRack || "-"} />
                          <DetailField label="Suggested Shelf" value={item.suggested_shelf || item.suggestedShelf || "-"} />
                          <DetailField label="Suggested Bin" value={item.suggested_bin_code || item.suggestedBinCode || "-"} />

                          <DetailField label="Actual Bin Code" value={item.actual_bin_code || item.actualBinCode || "-"} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            }

            return (
              <div>
                <h4 className="text-sm font-semibold mb-3">Item Details</h4>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <DetailField label="Item SKU" value={taskDetail.item_sku} />
                  <DetailField label="Item Description" value={taskDetail.item_description} />
                  <DetailField label="Item Barcode" value={itemBarcode} />
                  <DetailField label="Item Alt Barcodes" value={itemAltBarcodes} />
                  <DetailField label="Quantity To Put" value={cleanQuantity(taskDetail.quantity_to_put)} />
                  <DetailField label="Quantity Put" value={cleanQuantity(taskDetail.quantity_put)} />
                  <DetailField label="Lot Number" value={resolveDetailField(taskDetail, seedTask, workerSeedTask, "lot_number", "lotNumber", "lot_no", "lot")} />
                  <DetailField label="Batch Number" value={resolveDetailField(taskDetail, seedTask, workerSeedTask, "batch_number", "batchNumber", "batch_no", "batch")} />
                  <DetailField label="Expiry Date" value={formatDate(resolveDetailField(taskDetail, seedTask, workerSeedTask, "expiry_date", "expiryDate", "expiry", "expiration_date", "expiryDateTime"))} />
                </div>
              </div>
            );
          })()}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Timeline & Notes</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <DetailField label="Assigned At" value={formatDate(taskDetail.assigned_at)} />
          <DetailField label="Started At" value={formatDate(taskDetail.started_at)} />
          <DetailField label="Completed At" value={formatDate(taskDetail.completed_at)} />
          <DetailField
            label="Created By"
            value={resolveDetailField(
              taskDetail,
              seedTask,
              workerSeedTask,
              "created_by_name",
              "createdByName",
              "created_by",
              "createdBy",
              "assigned_to_name"
            )}
          />
          <DetailField label="Created At" value={formatDate(taskDetail.created_at)} />
          <DetailField label="Updated At" value={formatDate(taskDetail.updated_at)} />
          <div className="rounded-md border border-border bg-card px-4 py-3 sm:col-span-2 lg:col-span-4">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Notes</p>
            <p className="mt-1 text-sm font-semibold">{taskDetail.notes?.trim() || "-"}</p>
          </div>
        </CardContent>
      </Card>

      {extraFields.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Additional Details</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {extraFields.map((field) => (
              <DetailField key={field.label} label={field.label} value={field.value} />
            ))}
          </CardContent>
        </Card>
      )}

      <div className="flex flex-col sm:flex-row justify-end gap-2 pt-2">
        {!isAdmin && (
          <Button
            size="lg"
            variant="outline"
            className="w-full sm:w-auto"
            onClick={openCompleteDialog}
            disabled={isTaskCompleted}
          >
            {isTaskCompleted ? "Task Completed" : "End Task"}
          </Button>
        )}

        {!isAdmin && (
          <Button size="lg" className="w-full sm:w-auto" onClick={() => setScannerOpen(true)}>
            <ScanLine className="mr-2 h-4 w-4" />
            Scan Barcode
          </Button>
        )}
      </div>

      {!isAdmin && (
        <Dialog open={completeDialogOpen} onOpenChange={setCompleteDialogOpen}>
          <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>End Task</DialogTitle>
            </DialogHeader>

            {completeForm && (
              <div className="space-y-6">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Complete Task</CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-4">
                    <div className="space-y-2">
                      <Label>Task Number</Label>
                      <Input value={taskDetail.task_number} disabled />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="pallet_code">Pallet Code</Label>
                      <Select
                        value={completeForm.pallet_code}
                        onValueChange={(value) => updateCompleteField("pallet_code", value)}
                      >
                        <SelectTrigger id="pallet_code">
                          <SelectValue placeholder="Select a pallet code" />
                        </SelectTrigger>
                        <SelectContent>
                          {palletCodeForDisplay !== "-" && (
                            <SelectItem value={palletCodeForDisplay}>{palletCodeForDisplay}</SelectItem>
                          )}
                          {taskDetail.pallet_barcode && taskDetail.pallet_barcode !== palletCodeForDisplay && (
                            <SelectItem value={taskDetail.pallet_barcode}>{taskDetail.pallet_barcode}</SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">Select the pallet by code, not by ID.</p>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <Label>Items</Label>
                        <span className="text-xs text-muted-foreground">Codes only</span>
                      </div>
                      <div className="space-y-4">
                        {completeForm.items.map((item, index) => (
                          <div key={`${item.item_sku}-${index}`} className="rounded-lg border border-border bg-muted/30 p-3 space-y-3">
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <p className="text-sm font-semibold">{item.item_sku}</p>
                                <p className="text-xs text-muted-foreground">Quantity: {cleanQuantity(item.quantity_put)}</p>
                              </div>
                              <span className="text-xs text-muted-foreground">Item {index + 1}</span>
                            </div>

                            <div className="space-y-2">
                              <Label htmlFor={`actual_bin_code_${index}`}>Actual Bin Code</Label>
                              <Select
                                value={item.actual_bin_code}
                                onValueChange={(value) => updateCompleteItemField(index, "actual_bin_code", value)}
                                disabled={binsLoading || binsForTaskWarehouse.length === 0}
                              >
                                <SelectTrigger id={`actual_bin_code_${index}`}>
                                  <SelectValue placeholder={binsLoading ? "Loading bins..." : "Select a bin code"} />
                                </SelectTrigger>
                                <SelectContent>
                                  {binsForTaskWarehouse.map((bin) => {
                                    const code = String(bin.code || bin.bin_code || "").trim();
                                    const barcode = String(bin.barcode || bin.bin_barcode || "").trim();
                                    const label = code ? `${code}${barcode ? ` (${barcode})` : ""}` : barcode;

                                    if (!code) return null;

                                    return (
                                      <SelectItem key={code} value={code}>
                                        {label || code}
                                      </SelectItem>
                                    );
                                  })}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="notes">Notes</Label>
                      <Input
                        id="notes"
                        value={completeForm.notes}
                        onChange={(e) => updateCompleteField("notes", e.target.value)}
                        placeholder="Optional notes"
                      />
                    </div>
                  </CardContent>
                </Card>

                <div className="flex flex-col sm:flex-row justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setCompleteDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="button" onClick={() => void submitCompleteTask()} disabled={completingTask}>
                    {completingTask ? "Submitting..." : "End Task"}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      )}

      {!isAdmin && scannerOpen && <Scanner onScan={handleScan} onClose={() => setScannerOpen(false)} />}
    </div>
  );
}
