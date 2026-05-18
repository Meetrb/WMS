import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/components/auth-provider";
import { inboundService } from "@/services/inboundService";
import { warehouseService } from "@/services/warehouseService";
import { ArrowLeft, Building2, CheckCircle2, Clock3, Package, XCircle } from "lucide-react";
import { toast } from "sonner";

type ResolveAction = "ACCEPT" | "RETURN";

interface AssignedInspectionItem {
  id: string;
  grn_id: string;
  inspection_number: string;
  inspection_type: string;
  warehouse_id: string;
  warehouse_name: string;
  grn_number: string;
  asn_number: string;
  status: string;
  item_count: number;
  pending_items: number;
  resolved_items: number;
  rejected_count: number;
  shortage_count: number;
  total_exception_quantity: string;
  comments: string;
  created_at: string;
  assigned_at: string;
  action_required?: string;
  assigned_to_name?: string;
  source_bin?: string;
  destination_bin?: string;
  inspection_items?: any[];
}

interface ExceptionLine {
  inspection_detail_id: string;
  sku: string;
  item_description: string;
  expected_quantity: number;
  received_quantity: number;
  rejected_quantity: number;
  rejection_reason: string;
  shortage_quantity: number;
  decision: ResolveAction;
  decision_notes: string;
}

interface InspectionReport {
  inspection_id: string;
  inspection_number: string;
  warehouse_name: string;
  grn_number: string;
  status: string;
  total_items: number;
  expected_total: number;
  received_total: number;
  accepted_total: number;
  rejected_total: number;
  shortage_total: number;
  resolved_total: number;
  pending_total: number;
  exception_rate_percent: number;
  lines: ExceptionLine[];
}

interface LineDecision {
  checked: boolean;
  action: ResolveAction;
  accepted_quantity: number;
  rejected_quantity: number;
  notes: string;
}

interface WarehouseFilterOption {
  id: string;
  label: string;
}

const asRecord = (value: unknown): Record<string, unknown> => (value && typeof value === "object" ? (value as Record<string, unknown>) : {});

const asString = (value: unknown, fallback = "-") => {
  if (value === undefined || value === null || value === "") return fallback;
  return String(value);
};

const asNumber = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const toRelativeTime = (input: string) => {
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return "-";

  const deltaMs = Date.now() - date.getTime();
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (deltaMs < minute) return "just now";
  if (deltaMs < hour) return `${Math.floor(deltaMs / minute)}m ago`;
  if (deltaMs < day) return `${Math.floor(deltaMs / hour)}h ago`;
  return `${Math.floor(deltaMs / day)}d ago`;
};

const normalizeAssignedInspection = (raw: unknown): AssignedInspectionItem => {
  const row = asRecord(raw);
  const inspection = asRecord(row.inspection);
  const warehouse = asRecord(row.warehouse);
  const grn = asRecord(row.grn);
  const asn = asRecord(row.asn);

  const summary = asRecord(row.summary);
  const timeline = asRecord(row.timeline);
  const assignedTo = asRecord(row.assigned_to);
  const location = asRecord(row.location);

  const inspectionId = asString(row.id ?? row.inspection_id ?? inspection.id ?? inspection.inspection_id, "");
  const totalItems = asNumber(
    summary.total_items ?? row.total_items ?? inspection.total_items ?? row.item_count ?? inspection.item_count ?? row.rejected_lines ?? row.details_count ?? 0
  );
  const pendingItems = asNumber(summary.pending_items ?? row.pending_items ?? inspection.pending_items ?? 0);
  const resolvedItems = asNumber(summary.resolved_items ?? row.resolved_items ?? inspection.resolved_items ?? 0);
  const assignedAt = asString(
    timeline.assigned_at ?? row.assigned_at ?? row.assignedAt ?? inspection.assigned_at ?? timeline.created_at ?? row.created_at ?? row.createdAt ?? row.inspection_date ?? ""
  );

  return {
    id: inspectionId,
    grn_id: asString(row.grn_id ?? inspection.grn_id ?? grn.id ?? ""),
    inspection_number: asString(
      row.inspection_number ?? row.case_number ?? inspection.inspection_number ?? inspection.case_number ?? inspectionId
    ),
    inspection_type: asString(row.inspection_type ?? inspection.inspection_type ?? "-"),
    warehouse_id: asString(row.warehouse_id ?? row.warehouseId ?? inspection.warehouse_id ?? warehouse.id ?? ""),
    warehouse_name: asString(
      row.warehouse_name ??
        row.warehouse_code ??
        row.warehouseCode ??
        inspection.warehouse_name ??
        inspection.warehouse_code ??
        warehouse.name ??
        warehouse.warehouse_name ??
        warehouse.code ??
        "-"
    ),
    grn_number: asString(row.grn_number ?? row.grnNumber ?? inspection.grn_number ?? grn.number ?? grn.grn_number ?? "-"),
    asn_number: asString(
      row.asn_number ??
        row.asnNumber ??
        inspection.asn_number ??
        inspection.inbound_shipment_number ??
        asn.asn_number ??
        asn.number ??
        "-"
    ),
    status: asString(row.status ?? row.inspection_status ?? inspection.status ?? inspection.inspection_status ?? "ASSIGNED"),
    item_count: totalItems,
    pending_items: pendingItems,
    resolved_items: resolvedItems,
    rejected_count: asNumber(row.rejected_count ?? inspection.rejected_count ?? row.total_rejected ?? inspection.total_rejected ?? row.rejected_lines),
    shortage_count: asNumber(row.shortage_count ?? inspection.shortage_count ?? row.total_shortage ?? inspection.total_shortage ?? row.shortage_lines),
    total_exception_quantity: asString(
      row.total_exception_quantity ?? inspection.total_exception_quantity ?? row.exception_quantity ?? inspection.exception_quantity ?? "0"
    ),
    comments: asString(row.comments ?? row.note ?? row.notes ?? inspection.comments ?? inspection.note ?? "-"),
    created_at: asString(
      timeline.created_at ?? row.created_at ?? row.createdAt ?? row.inspection_date ?? row.assigned_at ?? row.assignedAt ?? inspection.created_at ?? inspection.assigned_at ?? ""
    ),
    assigned_at: assignedAt,
    action_required: asString(row.action_required, ""),
    assigned_to_name: asString(assignedTo.name, ""),
    source_bin: asString(location.source_bin, ""),
    destination_bin: asString(location.destination_bin, ""),
    inspection_items: Array.isArray(row.inspection_items) ? row.inspection_items : [],
  };
};

const normalizeExceptionLine = (raw: unknown): ExceptionLine => {
  const row = asRecord(raw);
  const lineType = asString(row.type ?? "").toUpperCase();
  const inspected = asNumber(row.inspected_quantity ?? row.quantity);
  const pending = asNumber(row.pending_quantity);
  const derivedRejected = lineType === "REJECTED" ? (pending || inspected) : 0;
  const derivedShortage = lineType === "SHORTAGE" ? (pending || inspected) : 0;

  return {
    inspection_detail_id: asString(row.inspection_detail_id ?? row.id ?? row.detail_id, ""),
    sku: asString(row.sku ?? row.item_sku ?? row.sku_code),
    item_description: asString(row.item_description ?? row.description ?? row.item_name),
    expected_quantity: asNumber(row.expected_quantity ?? row.expected_qty ?? row.inspected_quantity),
    received_quantity: asNumber(row.received_quantity ?? row.received_qty ?? row.inspected_quantity),
    rejected_quantity: asNumber(row.rejected_quantity ?? row.rejected_qty ?? row.inspected_quantity ?? derivedRejected),
    rejection_reason: asString(row.rejection_reason ?? row.reason ?? "-"),
    shortage_quantity: asNumber(row.shortage_quantity ?? row.shortage_qty ?? derivedShortage),
    decision: asString(row.decision ?? "").toUpperCase() === "ACCEPT" ? "ACCEPT" : "RETURN",
    decision_notes: asString(row.decision_notes ?? row.notes ?? "", ""),
  };
};

const normalizeInspectionReport = (raw: unknown): InspectionReport => {
  const payload = asRecord(raw);
  const summary = asRecord(payload.summary);
  const linesSource =
    (Array.isArray(payload.line_items) && payload.line_items) ||
    (Array.isArray(payload.lines) && payload.lines) ||
    (Array.isArray(payload.details) && payload.details) ||
    (Array.isArray(payload.exception_items) && payload.exception_items) ||
    [];

  const normalizedLines = linesSource.map(normalizeExceptionLine).filter((line) => line.inspection_detail_id);
  
  const derivedReceivedTotal = normalizedLines.reduce((acc, line) => acc + line.received_quantity, 0);

  return {
    inspection_id: asString(payload.inspection_id ?? payload.id ?? summary.inspection_id, ""),
    inspection_number: asString(payload.inspection_number ?? payload.case_number ?? summary.inspection_id ?? payload.inspection_id),
    warehouse_name: asString(payload.warehouse_name ?? payload.warehouse_code ?? payload.warehouseCode ?? summary.warehouse),
    grn_number: asString(payload.grn_number ?? payload.grnNumber ?? summary.grn_number),
    status: asString(payload.status ?? payload.inspection_status ?? summary.status ?? "PENDING"),
    total_items: asNumber(payload.total_items ?? summary.total_items),
    expected_total: asNumber(payload.expected_total ?? payload.total_expected ?? summary.expected_quantity),
    received_total: asNumber(payload.received_total ?? payload.total_received ?? summary.received_quantity ?? derivedReceivedTotal),
    accepted_total: asNumber(payload.accepted_total ?? payload.total_accepted ?? summary.accepted_quantity),
    rejected_total: asNumber(
      payload.rejected_total ??
      payload.total_rejected ??
      summary.inspection_rejected_quantity ??
      summary.grn_rejected_quantity
    ),
    shortage_total: asNumber(
      payload.shortage_total ??
      payload.total_shortage ??
      summary.inspection_shortage_quantity ??
      summary.grn_shortage_quantity
    ),
    resolved_total: asNumber(payload.resolved_total ?? summary.resolved_quantity),
    pending_total: asNumber(payload.pending_total ?? summary.pending_quantity),
    exception_rate_percent: asNumber(payload.exception_rate_percent ?? summary.exception_rate_percent),
    lines: normalizedLines,
  };
};

const statusOptions = ["ALL", "ASSIGNED", "IN_PROGRESS"];

const InspectionQueue = () => {
  const { user } = useAuth();
  const isInspectionWorker = String(user?.role ?? "").toLowerCase() === "inspection worker";

  const [assignedInspections, setAssignedInspections] = useState<AssignedInspectionItem[]>([]);
  const [loadingAssigned, setLoadingAssigned] = useState(false);
  const [warehouseOptions, setWarehouseOptions] = useState<WarehouseFilterOption[]>([]);

  const [warehouseFilter, setWarehouseFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ASSIGNED");

  const [selectedInspectionId, setSelectedInspectionId] = useState<string>("");
  const [report, setReport] = useState<InspectionReport | null>(null);
  const [loadingReport, setLoadingReport] = useState(false);

  const [decisions, setDecisions] = useState<Record<string, LineDecision>>({});
  const [finalComments, setFinalComments] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [reportSubmitOpen, setReportSubmitOpen] = useState(false);

  const loadWarehouses = useCallback(async () => {
    try {
      const response = await warehouseService.getAll();
      const container = asRecord(response);
      const list =
        (Array.isArray(response) && response) ||
        (Array.isArray(container.items) && container.items) ||
        (Array.isArray(container.data) && container.data) ||
        (Array.isArray(container.results) && container.results) ||
        (Array.isArray(container.warehouses) && container.warehouses) ||
        [];

      const normalized = list
        .map((entry) => {
          const row = asRecord(entry);
          const id = asString(row.id ?? row.warehouse_id ?? row.code, "");
          const code = asString(row.code ?? row.warehouse_code, "");
          const name = asString(row.name ?? row.warehouse_name, "");
          const label = code && name ? `${code} - ${name}` : code || name || id;
          return { id, label };
        })
        .filter((row) => row.id);

      setWarehouseOptions(normalized);
    } catch {
      // Keep the filter usable even if warehouse list API fails.
      setWarehouseOptions([]);
    }
  }, []);

  const fallbackWarehouseOptions = useMemo(() => {
    const map = new Map<string, string>();
    assignedInspections.forEach((entry) => {
      if (!entry.warehouse_id) return;
      map.set(entry.warehouse_id, entry.warehouse_name || entry.warehouse_id);
    });
    return Array.from(map.entries()).map(([id, label]) => ({ id, label }));
  }, [assignedInspections]);

  const effectiveWarehouseOptions = warehouseOptions.length > 0 ? warehouseOptions : fallbackWarehouseOptions;

  const loadAssignedInspections = useCallback(async () => {
    setLoadingAssigned(true);
    try {
      const response = await inboundService.getMyAssignedInspections({
        warehouse_id: warehouseFilter === "ALL" ? undefined : warehouseFilter,
        status: statusFilter === "ALL" ? undefined : statusFilter,
      });

      const container = asRecord(response);
      const dataContainer = asRecord(container.data);
      const listSource =
        (Array.isArray(response) && response) ||
        (Array.isArray(container.items) && container.items) ||
        (Array.isArray(container.data) && container.data) ||
        (Array.isArray(dataContainer.items) && dataContainer.items) ||
        (Array.isArray(container.results) && container.results) ||
        (Array.isArray(container.rows) && container.rows) ||
        (Array.isArray(container.inspections) && container.inspections) ||
        [];

      const normalized = listSource.map(normalizeAssignedInspection).filter((row) => row.id);
      setAssignedInspections(normalized);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load assigned inspections.";
      toast.error(message);
      setAssignedInspections([]);
    } finally {
      setLoadingAssigned(false);
    }
  }, [warehouseFilter, statusFilter]);

  const loadReport = useCallback(async (inspectionId: string) => {
    if (!inspectionId) return;

    setLoadingReport(true);
    setSelectedInspectionId(inspectionId);

    try {
      const response = await inboundService.getInspectionReport(inspectionId);
      const normalizedReport = normalizeInspectionReport(response);
      setReport(normalizedReport);

      const seeded: Record<string, LineDecision> = {};
      normalizedReport.lines.forEach((line) => {
        const taskQuantity = isInspectionWorker ? line.rejected_quantity : line.received_quantity;
        const rejectedQuantity = isInspectionWorker
          ? line.rejected_quantity
          : (line.rejected_quantity > 0 ? line.rejected_quantity : (line.shortage_quantity > 0 ? line.shortage_quantity : 0));
        const acceptedQuantity = isInspectionWorker ? 0 : Math.max(0, taskQuantity - rejectedQuantity);
        seeded[line.inspection_detail_id] = {
          checked: true,
          action: line.decision ?? (line.rejected_quantity > 0 || line.shortage_quantity > 0 ? "RETURN" : "ACCEPT"),
          accepted_quantity: acceptedQuantity,
          rejected_quantity: rejectedQuantity,
          notes: line.decision_notes || "",
        };
      });
      setDecisions(seeded);
      setFinalComments("");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load inspection report.";
      toast.error(message);
      setSelectedInspectionId("");
    } finally {
      setLoadingReport(false);
    }
  }, [isInspectionWorker]);

  const resetToDashboard = () => {
    setSelectedInspectionId("");
    setReport(null);
    setDecisions({});
    setFinalComments("");
    setReportSubmitOpen(false);
  };

  const updateDecision = (detailId: string, patch: Partial<LineDecision>) => {
    setDecisions((prev) => ({
      ...prev,
      [detailId]: {
        ...(prev[detailId] ?? { checked: true, action: "RETURN", accepted_quantity: 0, rejected_quantity: 0, notes: "" }),
        ...patch,
      },
    }));
  };

  const prepareSubmission = () => {
    if (!report?.inspection_id) return;

    const selectedLines = report.lines;
    if (selectedLines.length === 0) return null;

    return {
      inspection_id: report.inspection_id,
      comments: finalComments.trim(),
      decisions: selectedLines.map((line) => {
        const choice = decisions[line.inspection_detail_id];
        const acceptedQuantity = Number(choice?.accepted_quantity ?? 0);
        const taskQuantity = isInspectionWorker ? Number(line.rejected_quantity ?? 0) : Number(line.received_quantity ?? 0);
        const rejectedQuantity = Math.max(0, taskQuantity - acceptedQuantity);
        return {
          inspection_detail_id: line.inspection_detail_id,
          action: rejectedQuantity > 0 ? "RETURN" : "ACCEPT",
          accepted_quantity: acceptedQuantity,
          rejected_quantity: rejectedQuantity,
          notes: choice?.notes?.trim() || undefined,
        };
      }),
    };
  };

  const completeInspection = async () => {
    const prepared = prepareSubmission();
    if (!prepared) return;

    setSubmitting(true);
    try {
      await inboundService.resolveInspection(prepared.inspection_id, {
        decisions: prepared.decisions,
        comments: prepared.comments || undefined,
      });

      toast.success("Inspection decisions submitted successfully.");
      setReportSubmitOpen(false);
      resetToDashboard();
      await loadAssignedInspections();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to submit inspection decisions.";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    void loadAssignedInspections();
  }, [loadAssignedInspections]);

  useEffect(() => {
    void loadWarehouses();
  }, [loadWarehouses]);

  if (!selectedInspectionId) {
    return (
      <div className="p-6 space-y-6">
        <div>
          <h1 className="font-heading text-3xl font-bold">My Assigned Inspections</h1>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Filter</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label>Warehouse</Label>
                <Select value={warehouseFilter} onValueChange={setWarehouseFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select warehouse" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Warehouses</SelectItem>
                    {effectiveWarehouseOptions.map((option) => (
                      <SelectItem key={option.id} value={option.id}>{option.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label>Status</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptions.map((status) => (
                      <SelectItem key={status} value={status}>{status}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-end">
                <Button onClick={() => void loadAssignedInspections()} disabled={loadingAssigned}>
                  {loadingAssigned ? "Loading..." : "Apply Filters"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Assigned Cases</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingAssigned ? (
              <p className="text-sm text-muted-foreground">Loading assigned inspections...</p>
            ) : assignedInspections.length === 0 ? (
              <p className="text-sm text-muted-foreground">No assigned inspections found.</p>
            ) : (
              <div className="space-y-3">
                {assignedInspections.map((inspection) => (
                  <div key={inspection.id} className="rounded-lg border border-border p-4">
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                      <div className="space-y-3 flex-1 w-full min-w-0">
                        <div className="space-y-1">
                          <p className="font-semibold text-base flex flex-wrap items-center gap-x-2 bg-muted/30 w-fit px-2 py-0.5 rounded-md text-primary">
                            <span>{inspection.inspection_type}</span>
                            <span className="text-muted-foreground/30 font-normal">|</span>
                            <span>{inspection.item_count} items</span>
                          </p>
                          <p className="text-sm font-medium mt-1">
                            GRN NO: {inspection.grn_number}
                          </p>
                          {Boolean(inspection.action_required && inspection.action_required !== "-") && (
                            <p className="text-sm font-medium text-amber-600 dark:text-amber-500">
                              Action Required: {inspection.action_required}
                            </p>
                          )}
                          <p className="text-sm text-muted-foreground">
                            Assigned: {toRelativeTime(inspection.assigned_at)} 
                            {Boolean(inspection.assigned_to_name && inspection.assigned_to_name !== "-") && ` to ${inspection.assigned_to_name}`}
                          </p>
                          {Boolean((inspection.source_bin && inspection.source_bin !== "-" && inspection.source_bin !== "N/A") || 
                            (inspection.destination_bin && inspection.destination_bin !== "-" && inspection.destination_bin !== "N/A")) && (
                            <p className="text-xs text-muted-foreground">
                              Src: {inspection.source_bin || "-"} → Dest: {inspection.destination_bin || "-"}
                            </p>
                          )}
                        </div>

                        {Boolean(inspection.inspection_items && inspection.inspection_items.length > 0) && (
                          <div className="space-y-2 mt-2">
                            <p className="text-sm font-semibold">Inspection Items</p>
                            <div className="grid gap-2">
                              {inspection.inspection_items?.map((item: any, i: number) => (
                                <div key={i} className="flex flex-col gap-1 rounded-md border border-border/50 bg-background/50 p-2.5 text-sm">
                                  <div className="flex items-start justify-between gap-2">
                                    <span className="font-medium text-foreground">{item.sku_name || "Unknown SKU"}</span>
                                    <Badge variant="secondary" className="text-[10px] uppercase">{item.status || "PENDING"}</Badge>
                                  </div>
                                  <div className="text-muted-foreground flex flex-wrap gap-x-3 gap-y-1 text-xs">
                                    <span>Qty: {item.quantity} {item.uom}</span>
                                    {item.issue && item.issue !== "N/A" && <span className="text-destructive font-medium">Issue: {item.issue}</span>}
                                  </div>
                                  {item.rejection_reason && item.rejection_reason !== "N/A" && (
                                    <p className="text-xs text-amber-600 dark:text-amber-500 mt-0.5">Note: {item.rejection_reason}</p>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center justify-between gap-2 md:flex-col md:items-end">
                        <Badge variant="outline" className="bg-primary/5 text-primary tracking-wide">{inspection.status}</Badge>
                        <Button size="sm" onClick={() => void loadReport(inspection.id)}>
                          Review
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div className="rounded-2xl border bg-card/60 shadow-sm px-4 py-4 md:px-6 md:py-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={resetToDashboard} className="h-9 rounded-lg">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
            <div>
              <h1 className="font-heading text-2xl md:text-3xl font-bold tracking-tight">Inspection Details</h1>
              <p className="text-sm text-muted-foreground break-all">
                {report?.inspection_number || selectedInspectionId}
              </p>
            </div>
          </div>
          <Badge variant="outline" className="w-fit px-3 py-1 text-xs uppercase tracking-wide">
            {report?.status || "Pending"}
          </Badge>
        </div>
      </div>

      {loadingReport || !report ? (
        <Card className="border-border/70 shadow-sm">
          <CardContent className="py-8">
            <p className="text-sm text-muted-foreground">Loading inspection detail...</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card className="border-border/70 shadow-sm">
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                <div className="rounded-xl border bg-background/60 p-3 space-y-1">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">GRN</p>
                  <p className="font-semibold">{report.grn_number}</p>
                </div>
                <div className="rounded-xl border bg-background/60 p-3 space-y-1">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Warehouse</p>
                  <p className="font-semibold inline-flex items-center gap-1"><Building2 className="h-4 w-4 text-primary" />{report.warehouse_name}</p>
                </div>
                <div className="rounded-xl border bg-background/60 p-3 space-y-1">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Items</p>
                  <p className="font-semibold inline-flex items-center gap-1"><Package className="h-4 w-4 text-primary" />{report.total_items}</p>
                </div>
                <div className="rounded-xl border bg-background/60 p-3 space-y-1">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Exception Rate</p>
                  <p className="font-semibold">{report.exception_rate_percent}%</p>
                </div>

                <div className="rounded-xl border bg-background/60 p-3 space-y-1">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Expected</p>
                  <p className="font-semibold">{report.expected_total}</p>
                </div>
                <div className="rounded-xl border bg-background/60 p-3 space-y-1">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Received</p>
                  <p className="font-semibold">{report.received_total}</p>
                </div>
                <div className="rounded-xl border bg-background/60 p-3 space-y-1">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Accepted</p>
                  <p className="font-semibold inline-flex items-center gap-1"><CheckCircle2 className="h-4 w-4 text-emerald-600" />{report.accepted_total}</p>
                </div>
                <div className="rounded-xl border bg-background/60 p-3 space-y-1">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Rejected</p>
                  <p className="font-semibold inline-flex items-center gap-1"><XCircle className="h-4 w-4 text-amber-600" />{report.rejected_total}</p>
                </div>

                <div className="rounded-xl border bg-background/60 p-3 space-y-1">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Shortage</p>
                  <p className="font-semibold">{report.shortage_total}</p>
                </div>
                <div className="rounded-xl border bg-background/60 p-3 space-y-1">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Resolved</p>
                  <p className="font-semibold">{report.resolved_total}</p>
                </div>
                <div className="rounded-xl border bg-background/60 p-3 space-y-1">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Pending</p>
                  <p className="font-semibold inline-flex items-center gap-1"><Clock3 className="h-4 w-4 text-sky-600" />{report.pending_total}</p>
                </div>
                <div className="rounded-xl border bg-background/60 p-3 space-y-1">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Current Status</p>
                  <p className="font-semibold">{report.status}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/70 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Exception Items</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {report.lines.length === 0 ? (
                <p className="text-sm text-muted-foreground">No exception items found for this case.</p>
              ) : (
                report.lines.map((line) => {
                  const lineState = decisions[line.inspection_detail_id] ?? {
                    checked: true,
                    action: "RETURN" as ResolveAction,
                    accepted_quantity: 0,
                    rejected_quantity: line.rejected_quantity,
                    notes: "",
                  };

                  return (
                    <div key={line.inspection_detail_id} className="rounded-xl border border-border bg-card/40 p-4 space-y-4 shadow-sm">
                      <div className="flex items-start gap-3">
                        <Checkbox
                          checked={lineState.checked}
                          onCheckedChange={(checked) => updateDecision(line.inspection_detail_id, { checked: Boolean(checked) })}
                          aria-label={`Select ${line.sku}`}
                        />
                        <div className="space-y-1 flex-1">
                          <p className="font-semibold text-base">{line.sku} | {line.item_description}</p>
                          <p className="text-sm text-muted-foreground">
                            Expected: {line.expected_quantity} | Received: {line.received_quantity}
                          </p>
                          <p className="text-sm font-medium">
                            Rejected: {line.rejected_quantity} ({line.rejection_reason})
                          </p>
                          {line.shortage_quantity > 0 ? (
                            <p className="text-sm">Shortage: {line.shortage_quantity}</p>
                          ) : null}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-3">
                        <div className="space-y-1">
                          <Label htmlFor={`${line.inspection_detail_id}-notes`}>Notes</Label>
                          <Input
                            id={`${line.inspection_detail_id}-notes`}
                            placeholder="Add line note"
                            value={lineState.notes}
                            onChange={(event) => updateDecision(line.inspection_detail_id, { notes: event.target.value })}
                            className="h-10"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })
              )}

              <div className="space-y-1 rounded-xl border bg-background/60 p-3">
                <Label htmlFor="final-comments">Final Comments</Label>
                <Textarea
                  id="final-comments"
                  value={finalComments}
                  onChange={(event) => setFinalComments(event.target.value)}
                  placeholder="Add final case comments"
                />
              </div>

              <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2">
                <Button variant="outline" onClick={resetToDashboard}>Cancel</Button>
                <Button onClick={() => setReportSubmitOpen(true)}>
                  Submit Report
                </Button>
              </div>
            </CardContent>
          </Card>

          <Dialog open={reportSubmitOpen} onOpenChange={setReportSubmitOpen}>
            <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Submit Report</DialogTitle>
              </DialogHeader>

              {report && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Report Payload</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-3">
                      <p className="text-sm font-semibold">decisions</p>
                      {report.lines.map((line) => {
                        const lineState = decisions[line.inspection_detail_id] ?? {
                          checked: true,
                          accepted_quantity: 0,
                          notes: "",
                        };

                        return (
                          <div key={line.inspection_detail_id} className="bg-background border border-border-tertiary rounded-lg p-6">
                            <div className="flex justify-between items-start mb-5">
                              <div>
                                <div className="flex items-center gap-2 mb-1">
                                  <h3 className="text-base font-medium">{line.sku}</h3>
                                  <div className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center">
                                    <span className="text-green-600 text-xs">✓</span>
                                  </div>
                                </div>
                                <p className="text-sm text-muted-foreground">{line.item_description}</p>
                              </div>
                              <span className="text-sm text-muted-foreground bg-secondary px-2.5 py-1 rounded-md">{isInspectionWorker ? line.rejected_quantity : line.received_quantity} units</span>
                            </div>
                            <div className="grid grid-cols-2 gap-4 mb-5">
                              <div>
                                <label className="block text-sm text-muted-foreground mb-1.5">Accepted quantity <span className="text-destructive">*</span></label>
                                <Input
                                  type="number"
                                  value={lineState.accepted_quantity}
                                  onChange={(event) => updateDecision(line.inspection_detail_id, { accepted_quantity: Number(event.target.value) })}
                                  className="text-base font-medium"
                                />
                              </div>
                              <div>
                                <label className="block text-sm text-muted-foreground mb-1.5">Notes</label>
                                <Input
                                  placeholder="Add notes"
                                  value={lineState.notes}
                                  onChange={(event) => updateDecision(line.inspection_detail_id, { notes: event.target.value })}
                                />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2">
                      <Button variant="outline" onClick={() => setReportSubmitOpen(false)} disabled={submitting}>Cancel</Button>
                      <Button onClick={() => void completeInspection()} disabled={submitting}>
                        {submitting ? "Completing..." : "Complete Inspection"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  );
};

export default InspectionQueue;
