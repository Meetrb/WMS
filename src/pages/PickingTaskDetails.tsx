import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, RefreshCw, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { pickingService } from "@/services/pickingService";
import { formatDisplayDateTime } from "@/lib/date";
import { toast } from "sonner";

interface PickingTaskDetail {
  id: string;
  task_number: string;
  sales_order_id: string | null;
  sales_order_number: string | null;
  sales_order_item_id: string | null;
  item_id: string | null;
  item_sku: string | null;
  item_description: string | null;
  quantity_to_pick: string | number | null;
  quantity_picked: string | number | null;
  status: string;
  priority: string | number | null;
  source_bin_id: string | null;
  source_bin_code: string | null;
  source_zone_id: string | null;
  source_zone_name: string | null;
  assigned_to_id: string | null;
  assigned_to_name: string | null;
  assigned_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  lot_number: string | null;
  batch_number: string | null;
  expiry_date: string | null;
  notes: string | null;
  created_at: string | null;
  created_by_name: string | null;
  trolley_id: string | null;
  trolley_barcode: string | null;
  trolley_status: string | null;
  rack_id: string | null;
  rack_barcode: string | null;
  rack_status: string | null;
  [key: string]: unknown;
}

interface DetailFieldProps {
  label: string;
  value: string | number | null | undefined;
}

const DetailField = ({ label, value }: DetailFieldProps) => (
  <div className="rounded-md border border-border bg-card px-4 py-3">
    <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
    <p className="mt-1 text-sm font-semibold">{value || "-"}</p>
  </div>
);

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

const getPriorityLabel = (priority: string | number): string => {
  const p = Number(priority);
  if (p === 1) return "High";
  if (p === 2) return "Medium";
  if (p === 3) return "Low";
  return String(priority);
};

const getPriorityClass = (priority: string | number): string => {
  const p = Number(priority);
  if (p === 1) return "bg-red-50 text-red-700 border-red-200";
  if (p === 2) return "bg-orange-50 text-orange-700 border-orange-200";
  return "bg-blue-50 text-blue-700 border-blue-200";
};

const normalizeStatus = (status: string): string => {
  return String(status || "").toUpperCase().replace(/_/g, " ");
};

export default function PickingTaskDetails() {
  const { taskId } = useParams();
  const navigate = useNavigate();
  const [taskDetail, setTaskDetail] = useState<PickingTaskDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadTaskDetail = useCallback(async () => {
    if (!taskId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await pickingService.getTaskDetail(taskId);
      setTaskDetail(response);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load picking task details";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    loadTaskDetail();
  }, [loadTaskDetail]);

  if (loading) {
    return (
      <div className="w-full max-w-full overflow-x-hidden p-4 sm:p-6 space-y-6 animate-fade-in">
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (!taskDetail) {
    return (
      <div className="w-full max-w-full overflow-x-hidden p-4 sm:p-6 space-y-6 animate-fade-in">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
        </div>
        <div className="flex items-start gap-3 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            <strong>Error:</strong> {error || "Picking task not found"}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-full overflow-x-hidden p-4 sm:p-6 space-y-6 animate-fade-in">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Button variant="outline" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <Button variant="ghost" size="sm" onClick={loadTaskDetail}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh Details
        </Button>
      </div>

      <div>
        <h1 className="text-2xl font-bold tracking-tight">Picking Task Details</h1>
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
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <DetailField label="Task Number" value={taskDetail.task_number} />
          <DetailField label="Sales Order Number" value={taskDetail.sales_order_number} />
          <div className="rounded-md border border-border bg-card px-4 py-3">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Status</p>
            <Badge variant="outline" className="mt-1">
              {normalizeStatus(taskDetail.status)}
            </Badge>
          </div>
          <div className="rounded-md border border-border bg-card px-4 py-3">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Priority</p>
            <Badge variant="outline" className={`mt-1 ${getPriorityClass(taskDetail.priority)}`}>
              {getPriorityLabel(taskDetail.priority)}
            </Badge>
          </div>
          <DetailField label="Assigned To" value={taskDetail.assigned_to_name} />
          <DetailField label="Assigned At" value={formatDate(taskDetail.assigned_at)} />
          <DetailField label="Started At" value={formatDate(taskDetail.started_at)} />
          <DetailField label="Completed At" value={formatDate(taskDetail.completed_at)} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Item Information</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <DetailField label="Item SKU" value={taskDetail.item_sku} />
          <DetailField label="Item Description" value={taskDetail.item_description} />
          <DetailField label="Lot Number" value={taskDetail.lot_number} />
          <DetailField label="Batch Number" value={taskDetail.batch_number} />
          <DetailField label="Expiry Date" value={formatDate(taskDetail.expiry_date)} />
          <DetailField label="Quantity to Pick" value={cleanQuantity(taskDetail.quantity_to_pick)} />
          <DetailField label="Quantity Picked" value={cleanQuantity(taskDetail.quantity_picked)} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Source Location</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <DetailField label="Source Bin Code" value={taskDetail.source_bin_code} />
          <DetailField label="Source Zone Name" value={taskDetail.source_zone_name} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Trolley Information</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <DetailField label="Trolley Barcode" value={taskDetail.trolley_barcode} />
          <DetailField label="Trolley Status" value={taskDetail.trolley_status} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Rack Information</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <DetailField label="Rack Barcode" value={taskDetail.rack_barcode} />
          <DetailField label="Rack Status" value={taskDetail.rack_status} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Timeline & Notes</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <DetailField label="Created At" value={formatDate(taskDetail.created_at)} />
          <DetailField label="Created By" value={taskDetail.created_by_name} />
          <div className="rounded-md border border-border bg-card px-4 py-3 sm:col-span-2 lg:col-span-4">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Notes</p>
            <p className="mt-1 text-sm font-semibold">{taskDetail.notes?.trim() || "-"}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
