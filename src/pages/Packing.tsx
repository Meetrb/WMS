import { useCallback, useEffect, useMemo, useState } from "react";
import { BadgeCheck, CalendarDays, CheckCircle2, CircleDollarSign, Clock3, Package, PackageCheck, RefreshCw, Search, UserRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Dialog,
    DialogContent,
    DialogHeader,   
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/components/auth-provider";
import { packingService, type PackerOrder, type PackPayload } from "@/services/packingService";
import { formatDisplayDateTime } from "@/lib/date";
import { toast } from "sonner";

interface AdminPackerWorker {
    worker_id: string;
    worker_name: string;
    total_tasks: number;
    assigned: number;
    in_progress: number;
    completed_today: number;
}

interface AdminPackerTask {
    task_id: string;
    task_number: string;
    status: string;
    priority: number;
    warehouse_name: string;
    order_number: string;
    customer_name: string;
    item_sku: string;
    item_description: string;
    quantity_to_pick: string;
    quantity_picked: string;
    source_bin_code: string;
    source_zone_name: string;
    assigned_to_name: string;
    assigned_at: string | null;
    started_at: string | null;
    completed_at: string | null;
    created_at: string;
}

interface AdminPackerDashboard {
    total_tasks: number;
    pending: number;
    assigned: number;
    in_progress: number;
    completed_today: number;
    unassigned_pending: number;
    workers: AdminPackerWorker[];
    tasks: AdminPackerTask[];
}

const asString = (value: unknown): string => {
    if (value === null || value === undefined || value === "") return "-";
    return String(value);
};

const asBoolean = (value: unknown): boolean => Boolean(value);

const asNumber = (value: unknown): number => {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : 0;
};

const formatDateTime = (value: string | null): string => {
    return formatDisplayDateTime(value, "-");
};

const formatBigNumeric = (value: string): string => {
    if (!value || value === "-") return "-";

    const raw = String(value).trim();
    if (!raw) return "-";

    const sign = raw.startsWith("-") ? "-" : "";
    const unsigned = sign ? raw.slice(1) : raw;
    if (!/^\d+(\.\d+)?$/.test(unsigned)) return raw;

    const [intPartRaw, fracPartRaw = ""] = unsigned.split(".");
    const intPart = intPartRaw.replace(/^0+(?=\d)/, "");
    const groupedInt = (intPart || "0").replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    const fracPart = fracPartRaw.replace(/0+$/, "");

    return `${sign}${groupedInt}${fracPart ? `.${fracPart}` : ""}`;
};

const priorityVariant = (priority: string): "default" | "secondary" | "outline" | "destructive" => {
    const normalized = priority.toUpperCase();
    if (normalized === "HIGH") return "destructive";
    if (normalized === "MEDIUM") return "secondary";
    if (normalized === "LOW") return "outline";
    return "default";
};

const statusVariant = (status: string): "default" | "secondary" | "outline" | "destructive" => {
    const normalized = status.toLowerCase();
    if (normalized.includes("complete") || normalized.includes("delivered") || normalized.includes("packed")) return "default";
    if (normalized.includes("process") || normalized.includes("pick") || normalized.includes("pack")) return "secondary";
    if (normalized.includes("draft") || normalized.includes("pending") || normalized.includes("new")) return "outline";
    return "destructive";
};

const normalizeOrder = (raw: unknown): PackerOrder => {
    const order = (raw ?? {}) as Record<string, unknown>;

    return {
        customer_id: asString(order.customer_id),
        customer_name: asString(order.customer_name),
        customer_email: asString(order.customer_email),
        requested_delivery_date: asString(order.requested_delivery_date),
        priority: asString(order.priority),
        notes: asString(order.notes),
        id: asString(order.id),
        order_number: asString(order.order_number),
        order_date: asString(order.order_date),
        status: asString(order.status),
        total_items: asNumber(order.total_items),
        total_quantity: asString(order.total_quantity),
        total_value: asString(order.total_value),
        is_picking_complete: asBoolean(order.is_picking_complete),
        is_packing_complete: asBoolean(order.is_packing_complete),
        completed_at: order.completed_at ? String(order.completed_at) : null,
        created_by_id: asString(order.created_by_id),
        created_by_name: asString(order.created_by_name),
        created_at: asString(order.created_at),
        updated_at: asString(order.updated_at),
        picked_by_id: asString(order.picked_by_id),
        picked_by_name: asString(order.picked_by_name),
        picked_at: order.picked_at ? String(order.picked_at) : null,
        packed_by_id: asString(order.packed_by_id),
        packed_by_name: asString(order.packed_by_name),
        packed_at: order.packed_at ? String(order.packed_at) : null,
        items: Array.isArray(order.items) ? order.items : [],
        picking_assignments: Array.isArray(order.picking_assignments) ? order.picking_assignments : [],
    };
};

const extractArray = (value: unknown): unknown[] => {
    return Array.isArray(value) ? value : [];
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
    return Boolean(value && typeof value === "object" && !Array.isArray(value));
};

const getFirstRecord = (...values: unknown[]): Record<string, unknown> => {
    for (const value of values) {
        if (isRecord(value)) return value;
    }
    return {};
};

const getFirstArray = (...values: unknown[]): unknown[] => {
    for (const value of values) {
        if (Array.isArray(value)) return value;
    }
    return [];
};

const isAdminErrorPayload = (payload: unknown): string | null => {
    if (!isRecord(payload)) return null;

    if (typeof payload.detail === "string" && payload.detail.trim()) {
        return payload.detail;
    }

    if (Array.isArray(payload.detail) && payload.detail.length > 0) {
        return "Admin dashboard request returned a validation error.";
    }

    if (typeof payload.message === "string" && payload.message.trim()) {
        return payload.message;
    }

    return null;
};

const findAdminDashboardNode = (payload: unknown): Record<string, unknown> => {
    if (!isRecord(payload)) return {};

    const candidates = [
        payload,
        payload.data,
        payload.result,
        payload.dashboard,
        payload.payload,
        payload.response,
        payload.data && isRecord(payload.data) ? payload.data.data : undefined,
        payload.data && isRecord(payload.data) ? payload.data.result : undefined,
        payload.data && isRecord(payload.data) ? payload.data.dashboard : undefined,
        payload.data && isRecord(payload.data) ? payload.data.payload : undefined,
        payload.data && isRecord(payload.data) ? payload.data.response : undefined,
    ];

    const directMatch = candidates.find((candidate) => {
        if (!isRecord(candidate)) return false;

        return [
            candidate.total_tasks,
            candidate.totalTasks,
            candidate.pending,
            candidate.assigned,
            candidate.in_progress,
            candidate.inProgress,
            candidate.completed_today,
            candidate.completedToday,
            candidate.unassigned_pending,
            candidate.unassignedPending,
            candidate.workers,
            candidate.tasks,
            candidate.worker_stats,
            candidate.workerStats,
            candidate.task_list,
            candidate.taskList,
        ].some((value) => value !== undefined);
    });

    return getFirstRecord(directMatch, ...candidates);
};

const normalizeAdminPackerWorker = (raw: unknown): AdminPackerWorker => {
    const row = (raw ?? {}) as Record<string, unknown>;
    return {
        worker_id: asString(row.worker_id),
        worker_name: asString(row.worker_name),
        total_tasks: asNumber(row.total_tasks),
        assigned: asNumber(row.assigned),
        in_progress: asNumber(row.in_progress),
        completed_today: asNumber(row.completed_today),
    };
};

const normalizeAdminPackerTask = (raw: unknown): AdminPackerTask => {
    const row = (raw ?? {}) as Record<string, unknown>;
    return {
        task_id: asString(row.task_id),
        task_number: asString(row.task_number),
        status: asString(row.status),
        priority: asNumber(row.priority),
        warehouse_name: asString(row.warehouse_name),
        order_number: asString(row.order_number),
        customer_name: asString(row.customer_name),
        item_sku: asString(row.item_sku),
        item_description: asString(row.item_description),
        quantity_to_pick: asString(row.quantity_to_pick),
        quantity_picked: asString(row.quantity_picked),
        source_bin_code: asString(row.source_bin_code),
        source_zone_name: asString(row.source_zone_name),
        assigned_to_name: asString(row.assigned_to_name),
        assigned_at: row.assigned_at ? String(row.assigned_at) : null,
        started_at: row.started_at ? String(row.started_at) : null,
        completed_at: row.completed_at ? String(row.completed_at) : null,
        created_at: asString(row.created_at),
    };
};

const normalizeAdminPackerDashboard = (payload: unknown): AdminPackerDashboard => {
    if (Array.isArray(payload)) {
        const workerRows = payload.filter((entry) => isRecord(entry) && (entry.worker_name !== undefined || entry.workerName !== undefined));
        const taskRows = payload.filter((entry) => isRecord(entry) && (entry.task_id !== undefined || entry.taskId !== undefined || entry.task_number !== undefined || entry.taskNumber !== undefined));

        return {
            total_tasks: payload.length,
            pending: taskRows.length,
            assigned: taskRows.filter((task) => isRecord(task) && (task.assigned_to_name !== undefined || task.assignedToName !== undefined)).length,
            in_progress: taskRows.filter((task) => isRecord(task) && String(task.status ?? task.task_status ?? task.taskStatus ?? "").toLowerCase().includes("process")).length,
            completed_today: taskRows.filter((task) => isRecord(task) && String(task.status ?? task.task_status ?? task.taskStatus ?? "").toLowerCase().includes("complete")).length,
            unassigned_pending: taskRows.filter((task) => isRecord(task) && !(task.assigned_to_name ?? task.assignedToName)).length,
            workers: workerRows.map((worker) => normalizeAdminPackerWorker(worker)),
            tasks: taskRows.map((task) => normalizeAdminPackerTask(task)),
        };
    }

    const root = findAdminDashboardNode(payload);
    const nested = getFirstRecord(root.data, root.result, root.dashboard, root.payload, root.response);
    const workerRows = getFirstArray(
        root.workers,
        nested.workers,
        root.worker_stats,
        nested.worker_stats,
        root.workerStats,
        nested.workerStats,
    );
    const taskRows = getFirstArray(
        root.tasks,
        nested.tasks,
        root.task_list,
        nested.task_list,
        root.taskList,
        nested.taskList,
    );
    const summary = getFirstRecord(root.summary, nested.summary);

    return {
        total_tasks: asNumber(root.total_tasks ?? root.totalTasks ?? summary.total_tasks ?? summary.totalTasks),
        pending: asNumber(root.pending ?? summary.pending),
        assigned: asNumber(root.assigned ?? summary.assigned),
        in_progress: asNumber(root.in_progress ?? root.inProgress ?? summary.in_progress ?? summary.inProgress),
        completed_today: asNumber(root.completed_today ?? root.completedToday ?? summary.completed_today ?? summary.completedToday),
        unassigned_pending: asNumber(root.unassigned_pending ?? root.unassignedPending ?? summary.unassigned_pending ?? summary.unassignedPending),
        workers: workerRows.map((worker) => normalizeAdminPackerWorker(worker)),
        tasks: taskRows.map((task) => normalizeAdminPackerTask(task)),
    };
};

const extractPackerDashboardOrders = (payload: unknown): { readyOrders: unknown[]; packedOrders: unknown[] } => {
    const record = (payload ?? {}) as Record<string, unknown>;

    const readyOrders = [
        record.ready_orders,
        record.readyOrders,
        record.pending_orders,
        record.orders_ready_for_packing,
    ].find((entry) => Array.isArray(entry));

    const packedOrders = [
        record.packed_orders,
        record.packedOrders,
        record.completed_orders,
        record.recent_packed_orders,
    ].find((entry) => Array.isArray(entry));

    const normalizedReady = extractArray(readyOrders);
    const normalizedPacked = extractArray(packedOrders);

    if (normalizedReady.length > 0 || normalizedPacked.length > 0) {
        return { readyOrders: normalizedReady, packedOrders: normalizedPacked };
    }

    const allOrders = extractArray(record.orders);
    if (allOrders.length > 0) {
        const normalized = allOrders.map((entry) => normalizeOrder(entry));
        return {
            readyOrders: normalized.filter((order) => !order.is_packing_complete),
            packedOrders: normalized.filter((order) => order.is_packing_complete),
        };
    }

    return { readyOrders: [], packedOrders: [] };
};

interface PackingViewItem {
    sales_order_item_id: string;
    item_sku: string;
    item_description: string;
    qty_ordered: string;
    qty_picked: string;
    qty_packed: string;
}

interface PackingViewRack {
    rack_id: string;
    rack_barcode: string;
    rack_position: number;
    rack_status: string;
    order_id: string;
    order_number: string;
    customer_name: string;
    is_picking_complete: boolean;
    is_packing_complete: boolean;
    items: PackingViewItem[];
}

interface PackingViewData {
    trolley_id: string;
    trolley_barcode: string;
    trolley_status: string;
    current_location: string;
    racks: PackingViewRack[];
}

interface PackedOrderDetailItem {
    item_sku: string;
    item_description: string;
    quantity_ordered: string;
    quantity_picked: string;
    quantity_packed: string;
    quantity_shipped: string;
    is_fully_picked: boolean;
}

const normalizePackingItem = (raw: unknown): PackingViewItem => {
    const row = (raw ?? {}) as Record<string, unknown>;
    return {
        sales_order_item_id: asString(row.sales_order_item_id),
        item_sku: asString(row.item_sku),
        item_description: asString(row.item_description),
        qty_ordered: asString(row.qty_ordered),
        qty_picked: asString(row.qty_picked),
        qty_packed: asString(row.qty_packed),
    };
};

const normalizePackingRack = (raw: unknown): PackingViewRack => {
    const row = (raw ?? {}) as Record<string, unknown>;
    const itemRows = Array.isArray(row.items) ? row.items : [];

    return {
        rack_id: asString(row.rack_id),
        rack_barcode: asString(row.rack_barcode),
        rack_position: asNumber(row.rack_position),
        rack_status: asString(row.rack_status),
        order_id: asString(row.order_id),
        order_number: asString(row.order_number),
        customer_name: asString(row.customer_name),
        is_picking_complete: asBoolean(row.is_picking_complete),
        is_packing_complete: asBoolean(row.is_packing_complete),
        items: itemRows.map((item) => normalizePackingItem(item)),
    };
};

const normalizePackingView = (raw: unknown): PackingViewData => {
    const row = (raw ?? {}) as Record<string, unknown>;
    const rackRows = Array.isArray(row.racks) ? row.racks : [];

    return {
        trolley_id: asString(row.trolley_id),
        trolley_barcode: asString(row.trolley_barcode),
        trolley_status: asString(row.trolley_status),
        current_location: asString(row.current_location),
        racks: rackRows.map((rack) => normalizePackingRack(rack)),
    };
};

const normalizePackedOrderDetailItem = (raw: unknown): PackedOrderDetailItem => {
    const row = (raw ?? {}) as Record<string, unknown>;
    return {
        item_sku: asString(row.item_sku ?? row.sku ?? row.sku_code),
        item_description: asString(row.item_description ?? row.description),
        quantity_ordered: asString(row.quantity_ordered ?? row.qty_ordered ?? row.quantity),
        quantity_picked: asString(row.quantity_picked ?? row.qty_picked),
        quantity_packed: asString(row.quantity_packed ?? row.qty_packed),
        quantity_shipped: asString(row.quantity_shipped ?? row.qty_shipped),
        is_fully_picked: asBoolean(row.is_fully_picked),
    };
};

const Packing = () => {
    const { user } = useAuth();
    const isAdmin = user?.role === "admin";
    const isPacker = user?.role === "packer";
    const [adminDashboard, setAdminDashboard] = useState<AdminPackerDashboard | null>(null);
    const [orders, setOrders] = useState<PackerOrder[]>([]);
    const [packedWorkOrders, setPackedWorkOrders] = useState<PackerOrder[]>([]);
    const [loading, setLoading] = useState(true);
    const [packedWorkLoading, setPackedWorkLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [packedWorkError, setPackedWorkError] = useState<string | null>(null);
    const [search, setSearch] = useState("");
    const [trolleyBarcode, setTrolleyBarcode] = useState("");
    const [loadingPackingView, setLoadingPackingView] = useState(false);
    const [packingViewError, setPackingViewError] = useState<string | null>(null);
    const [packingViewData, setPackingViewData] = useState<PackingViewData | null>(null);
    const [packingActionKey, setPackingActionKey] = useState<string | null>(null);
    const [packDialogOpen, setPackDialogOpen] = useState(false);
    const [selectedAdminTask, setSelectedAdminTask] = useState<AdminPackerTask | null>(null);
    const [packSalesOrderId, setPackSalesOrderId] = useState("");
    const [packNotes, setPackNotes] = useState("");
    const [packError, setPackError] = useState<string | null>(null);
    const [packActionKey, setPackActionKey] = useState<string | null>(null);
    const [packSuccessLabel, setPackSuccessLabel] = useState("Packed successfully.");
    const [packedOrderDetailOpen, setPackedOrderDetailOpen] = useState(false);
    const [packedOrderDetailLoading, setPackedOrderDetailLoading] = useState(false);
    const [packedOrderDetailError, setPackedOrderDetailError] = useState<string | null>(null);
    const [packedOrderDetail, setPackedOrderDetail] = useState<PackerOrder | null>(null);

    const loadOrders = useCallback(async (isRefresh = false) => {
        if (isRefresh) {
            setRefreshing(true);
        } else {
            setLoading(true);
        }

        setError(null);

        try {
            if (isAdmin) {
                const dashboardPayload = await packingService.getAdminPickerDashboard();
                const adminPayloadError = isAdminErrorPayload(dashboardPayload);
                if (adminPayloadError) {
                    throw new Error(adminPayloadError);
                }

                setAdminDashboard(normalizeAdminPackerDashboard(dashboardPayload));
                setOrders([]);
                setPackedWorkOrders([]);
                setPackedWorkError(null);
                return;
            }

            try {
                const dashboardPayload = await packingService.getPackerDashboard();
                const { readyOrders, packedOrders } = extractPackerDashboardOrders(dashboardPayload);

                setOrders(readyOrders.map((entry) => normalizeOrder(entry)));
                if (!isPacker) {
                    setPackedWorkOrders(packedOrders.map((entry) => normalizeOrder(entry)));
                }
                setPackedWorkError(null);
                if (!isPacker) {
                    setPackedWorkLoading(false);
                }
                return;
            } catch {
                // Keep the screen usable while backend endpoint rollout is in progress.
                const result = await packingService.getReadyOrders();
                setOrders(result.map((entry) => normalizeOrder(entry)));
            }

            setAdminDashboard(null);
        } catch (err) {
            const message = err instanceof Error ? err.message : "Failed to load packing orders.";
            setError(message);
            setOrders([]);
            setAdminDashboard(null);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [isAdmin, isPacker]);

    const loadPackedWork = useCallback(async () => {
        setPackedWorkLoading(true);
        setPackedWorkError(null);

        try {
            const result = await packingService.getPackedOrders();
            setPackedWorkOrders(result.map((entry) => normalizeOrder(entry)));
        } catch (err) {
            const message = err instanceof Error ? err.message : "Failed to load packed work.";
            setPackedWorkError(message);
            setPackedWorkOrders([]);
        } finally {
            setPackedWorkLoading(false);
        }
    }, []);

    const handleLoadPackingView = async () => {
        const cleanedBarcode = trolleyBarcode.trim();
        if (!cleanedBarcode) {
            setPackingViewError("trolley_barcode is required.");
            return;
        }

        setLoadingPackingView(true);
        setPackingViewError(null);
        try {
            const response = await packingService.getPackingView(cleanedBarcode);
            setPackingViewData(normalizePackingView(response));
        } catch {
            setPackingViewData(null);
            setPackingViewError("Failed to load packing view for this trolley barcode.");
        } finally {
            setLoadingPackingView(false);
        }
    };

    useEffect(() => {
        void loadOrders(false);
        if (isPacker) {
            void loadPackedWork();
        }
    }, [isPacker, loadOrders, loadPackedWork]);

    const markPackedLocally = useCallback((orderId: string) => {
        setOrders((prev) => prev.map((order) => {
            if (order.id !== orderId) return order;
            return {
                ...order,
                is_packing_complete: true,
                completed_at: order.completed_at || new Date().toISOString(),
            };
        }));
    }, []);

    const openPackDialog = useCallback((salesOrderId: string, actionKey: string, successLabel: string, defaultNotes: string) => {
        const cleanedSalesOrderId = salesOrderId.trim();
        if (!cleanedSalesOrderId || cleanedSalesOrderId === "-") {
            toast.error("Unable to mark packed. sales_order_id is missing.");
            return;
        }

        setPackSalesOrderId(cleanedSalesOrderId);
        setPackActionKey(actionKey);
        setPackSuccessLabel(successLabel);
        setPackNotes(defaultNotes);
        setPackError(null);
        setPackDialogOpen(true);
    }, []);

    const handleMarkPacked = useCallback(async () => {
        const cleanedSalesOrderId = packSalesOrderId.trim();
        const cleanedNotes = packNotes.trim();

        if (!cleanedSalesOrderId) {
            setPackError("sales_order_id is required.");
            return;
        }
        if (!cleanedNotes) {
            setPackError("notes is required.");
            return;
        }

        const payload: PackPayload = {
            sales_order_id: cleanedSalesOrderId,
            notes: cleanedNotes,
        };

        setPackingActionKey(packActionKey);
        try {
            await packingService.packOrder(payload);
            markPackedLocally(cleanedSalesOrderId);
            toast.success(packSuccessLabel);
            setPackDialogOpen(false);
            await loadOrders(true);
            if (isPacker) {
                await loadPackedWork();
            }
        } catch {
            setPackError("Failed to mark as packed. Please verify sales_order_id and notes.");
        } finally {
            setPackingActionKey(null);
        }
    }, [isPacker, loadOrders, loadPackedWork, markPackedLocally, packActionKey, packNotes, packSalesOrderId, packSuccessLabel]);

    const filteredPackedWork = useMemo(() => {
        const query = search.trim().toLowerCase();
        if (!query) return packedWorkOrders;

        return packedWorkOrders.filter((order) =>
            [
                order.order_number,
                order.customer_name,
                order.customer_email,
                order.status,
                order.priority,
            ].some((value) => value.toLowerCase().includes(query))
        );
    }, [packedWorkOrders, search]);

    const openPackedOrderDetail = useCallback(async (orderId: string) => {
        const cleanedOrderId = orderId.trim();
        if (!cleanedOrderId || cleanedOrderId === "-") {
            toast.error("Unable to load packed order details. order_id is missing.");
            return;
        }

        setPackedOrderDetailOpen(true);
        setPackedOrderDetailLoading(true);
        setPackedOrderDetailError(null);
        setPackedOrderDetail(null);

        try {
            const payload = await packingService.getPackerOrderById(cleanedOrderId);
            const root = getFirstRecord(payload, isRecord(payload) ? payload.data : undefined, isRecord(payload) ? payload.result : undefined, isRecord(payload) ? payload.order : undefined);
            setPackedOrderDetail(normalizeOrder(root));
        } catch (err) {
            const message = err instanceof Error ? err.message : "Failed to load packed order details.";
            setPackedOrderDetailError(message);
        } finally {
            setPackedOrderDetailLoading(false);
        }
    }, []);

    const summary = useMemo(() => {
        if (isAdmin && adminDashboard) {
            return {
                totalOrders: adminDashboard.total_tasks,
                packingCompleted: adminDashboard.completed_today,
                packingPending: adminDashboard.pending,
                assigned: adminDashboard.assigned,
                inProgress: adminDashboard.in_progress,
                unassignedPending: adminDashboard.unassigned_pending,
            };
        }

        const packingCompletedFromOrders = orders.filter((order) => order.is_packing_complete).length;
        const packingPendingFromOrders = orders.filter((order) => !order.is_packing_complete).length;
        return {
            totalOrders: orders.length,
            packingCompleted: isAdmin ? packingCompletedFromOrders : packedWorkOrders.length,
            packingPending: isAdmin ? packingPendingFromOrders : orders.filter((order) => !order.is_packing_complete).length,
            assigned: 0,
            inProgress: 0,
            unassignedPending: 0,
        };
    }, [adminDashboard, isAdmin, orders, packedWorkOrders]);

    const adminTasks = useMemo(() => {
        const query = search.trim().toLowerCase();
        const tasks = adminDashboard?.tasks ?? [];
        if (!query) return tasks;

        return tasks.filter((task) =>
            [
                task.task_number,
                task.order_number,
                task.customer_name,
                task.item_sku,
                task.item_description,
                task.status,
                task.warehouse_name,
                task.assigned_to_name,
                task.source_bin_code,
                task.source_zone_name,
            ].some((value) => String(value ?? "").toLowerCase().includes(query))
        );
    }, [adminDashboard, search]);

    const packedOrderItems = useMemo(() => {
        if (!packedOrderDetail) return [];
        const itemRows = Array.isArray(packedOrderDetail.items) ? packedOrderDetail.items : [];
        return itemRows.map((item) => normalizePackedOrderDetailItem(item));
    }, [packedOrderDetail]);

    return (
        <div className="p-6 space-y-6 animate-fade-in">
            <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                        <PackageCheck className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Packing Tasks</h1>
                        <p className="text-muted-foreground">
                            {isAdmin
                                ? "Admin packing dashboard loaded from /picking/admin/dashboard/picker."
                                : "Packer dashboard loaded from /sales/packer/dashboard."}
                        </p>
                    </div>
                </div>

                <Button
                    variant="outline"
                    onClick={() => {
                        void loadOrders(true);
                        if (isPacker) {
                            void loadPackedWork();
                        }
                    }}
                    disabled={loading || refreshing}
                    className="gap-2"
                >
                    <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
                    {refreshing ? "Refreshing..." : "Refresh"}
                </Button>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}
            {isPacker && packedWorkError && <p className="text-sm text-destructive">{packedWorkError}</p>}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">{isAdmin ? "Total Tasks" : "Total Orders"}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-2xl font-bold">{isAdmin ? summary.totalOrders : summary.totalOrders}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">{isAdmin ? "Completed Today" : "Packing Complete"}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-2xl font-bold text-green-600">{isAdmin ? summary.packingCompleted : summary.packingCompleted}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">{isAdmin ? "Pending" : "Packing Pending"}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-2xl font-bold text-amber-600">{isAdmin ? summary.packingPending : summary.packingPending}</p>
                    </CardContent>
                </Card>
            </div>

            {isAdmin && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">Assigned</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-2xl font-bold">{summary.assigned}</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">In Progress</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-2xl font-bold">{summary.inProgress}</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">Unassigned Pending</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-2xl font-bold">{summary.unassignedPending}</p>
                        </CardContent>
                    </Card>
                </div>
            )}

            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-base">{isAdmin ? "Search Tasks" : "Search Orders"}</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="relative max-w-md">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder={
                                isAdmin
                                    ? "Search tasks by task, order, customer, SKU, warehouse or assignee"
                                    : "Search packed work by order, customer, status or priority"
                            }
                            className="pl-9"
                        />
                    </div>
                </CardContent>
            </Card>

            {isAdmin && (
                <>
                    {loading ? (
                        <Card>
                            <CardContent className="py-16 text-center text-muted-foreground">
                                Loading admin packing dashboard...
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="space-y-6">
                            <Card>
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-base">Workers</CardTitle>
                                </CardHeader>
                                <CardContent className="p-0 overflow-x-auto">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Worker Name</TableHead>
                                                <TableHead>Total Tasks</TableHead>
                                                <TableHead>Assigned</TableHead>
                                                <TableHead>In Progress</TableHead>
                                                <TableHead>Completed Today</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {(adminDashboard?.workers ?? []).length === 0 && (
                                                <TableRow>
                                                    <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                                                        No workers found.
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                            {(adminDashboard?.workers ?? []).map((worker) => (
                                                <TableRow key={worker.worker_id}>
                                                    <TableCell className="font-medium">{worker.worker_name}</TableCell>
                                                    <TableCell>{worker.total_tasks}</TableCell>
                                                    <TableCell>{worker.assigned}</TableCell>
                                                    <TableCell>{worker.in_progress}</TableCell>
                                                    <TableCell>{worker.completed_today}</TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </CardContent>
                            </Card>

                            <Card className="overflow-hidden">
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-base">Tasks</CardTitle>
                                </CardHeader>
                                <CardContent className="p-0 overflow-x-auto">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Task #</TableHead>
                                                <TableHead>Status</TableHead>
                                                <TableHead>Order #</TableHead>
                                                <TableHead>Customer</TableHead>
                                                <TableHead>Item SKU</TableHead>
                                                <TableHead>Qty</TableHead>
                                                <TableHead>Warehouse</TableHead>
                                                <TableHead>Details</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {adminTasks.length === 0 && (
                                                <TableRow>
                                                    <TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                                                        No tasks found.
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                            {adminTasks.map((task) => (
                                                <TableRow
                                                    key={task.task_id}
                                                    className="cursor-pointer"
                                                    onClick={() => setSelectedAdminTask(task)}
                                                >
                                                    <TableCell className="font-semibold text-foreground whitespace-nowrap">{task.task_number}</TableCell>
                                                    <TableCell><Badge variant={statusVariant(task.status)} className="font-semibold">{task.status}</Badge></TableCell>
                                                    <TableCell className="font-medium text-foreground whitespace-nowrap">{task.order_number}</TableCell>
                                                    <TableCell className="font-medium text-foreground">{task.customer_name}</TableCell>
                                                    <TableCell>
                                                        <div className="max-w-[180px] truncate font-medium text-foreground" title={`${task.item_sku} - ${task.item_description}`}>
                                                            {task.item_sku}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="font-semibold text-foreground whitespace-nowrap">{formatBigNumeric(task.quantity_picked)} / {formatBigNumeric(task.quantity_to_pick)}</TableCell>
                                                    <TableCell className="font-medium text-foreground">{task.warehouse_name}</TableCell>
                                                    <TableCell>
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={(event) => {
                                                                event.stopPropagation();
                                                                setSelectedAdminTask(task);
                                                            }}
                                                        >
                                                            View Details
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </CardContent>
                            </Card>

                            <Dialog
                                open={selectedAdminTask !== null}
                                onOpenChange={(open) => {
                                    if (!open) {
                                        setSelectedAdminTask(null);
                                    }
                                }}
                            >
                                <DialogContent className="sm:max-w-3xl">
                                    <DialogHeader>
                                        <DialogTitle>Task Details</DialogTitle>
                                    </DialogHeader>

                                    {selectedAdminTask && (
                                        <div className="space-y-4">
                                            <div className="rounded-md border p-4">
                                                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                                    <div>
                                                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Task Number</p>
                                                        <p className="text-xl font-semibold tracking-tight">{selectedAdminTask.task_number}</p>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <Badge variant={statusVariant(selectedAdminTask.status)} className="font-semibold">{selectedAdminTask.status}</Badge>
                                                        <Badge variant="outline" className="font-semibold">Priority {selectedAdminTask.priority}</Badge>
                                                    </div>
                                                </div>

                                                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                                                    <div>
                                                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Order</p>
                                                        <p className="font-semibold">{selectedAdminTask.order_number}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Customer</p>
                                                        <p className="font-semibold">{selectedAdminTask.customer_name}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Quantity</p>
                                                        <p className="font-semibold">{formatBigNumeric(selectedAdminTask.quantity_picked)} / {formatBigNumeric(selectedAdminTask.quantity_to_pick)}</p>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                                <div className="rounded-md border p-4 space-y-2">
                                                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Item</p>
                                                    <p className="font-semibold">{selectedAdminTask.item_sku}</p>
                                                    <p className="text-sm text-muted-foreground">{selectedAdminTask.item_description}</p>
                                                </div>

                                                <div className="rounded-md border p-4 space-y-2">
                                                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Location</p>
                                                    <p className="font-semibold">{selectedAdminTask.warehouse_name}</p>
                                                    <p className="text-sm text-muted-foreground">{selectedAdminTask.source_zone_name} / {selectedAdminTask.source_bin_code}</p>
                                                </div>
                                            </div>

                                            <div className="rounded-md border p-4">
                                                <p className="text-xs uppercase tracking-wide text-muted-foreground">Assignment & Timeline</p>
                                                <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
                                                    <div>
                                                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Assigned To</p>
                                                        <p className="font-semibold">{selectedAdminTask.assigned_to_name}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Assigned At</p>
                                                        <p className="font-semibold">{formatDateTime(selectedAdminTask.assigned_at)}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Started At</p>
                                                        <p className="font-semibold">{formatDateTime(selectedAdminTask.started_at)}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Completed At</p>
                                                        <p className="font-semibold">{formatDateTime(selectedAdminTask.completed_at)}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </DialogContent>
                            </Dialog>
                        </div>
                    )}
                </>
            )}

            {!isAdmin && (
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-base">Scan Trolley For Packing View</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                    <div className="flex flex-col gap-2 sm:flex-row">
                        <Input
                            value={trolleyBarcode}
                            onChange={(event) => setTrolleyBarcode(event.target.value)}
                            placeholder="Enter trolley_barcode"
                            className="sm:max-w-sm"
                        />
                        <Button onClick={() => void handleLoadPackingView()} disabled={loadingPackingView}>
                            {loadingPackingView ? "Loading..." : "Load Packing View"}
                        </Button>
                    </div>

                    {packingViewError && <p className="text-sm text-destructive">{packingViewError}</p>}

                    {packingViewData !== null && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                                <Card>
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-xs font-medium text-muted-foreground">Trolley Barcode</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <p className="text-sm font-semibold">{packingViewData.trolley_barcode}</p>
                                    </CardContent>
                                </Card>
                                <Card>
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-xs font-medium text-muted-foreground">Trolley Status</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <Badge variant="outline">{packingViewData.trolley_status}</Badge>
                                    </CardContent>
                                </Card>
                                <Card>
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-xs font-medium text-muted-foreground">Current Location</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <p className="text-sm font-semibold">{packingViewData.current_location}</p>
                                    </CardContent>
                                </Card>
                                <Card>
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-xs font-medium text-muted-foreground">Total Racks</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <p className="text-sm font-semibold">{packingViewData.racks.length}</p>
                                    </CardContent>
                                </Card>
                            </div>

                            {packingViewData.racks.length === 0 && (
                                <Card>
                                    <CardContent className="py-6 text-sm text-muted-foreground">
                                        No racks found for this trolley.
                                    </CardContent>
                                </Card>
                            )}

                            {packingViewData.racks.map((rack) => (
                                <Card key={rack.rack_id}>
                                    <CardHeader className="pb-3">
                                        <div className="flex items-center justify-between gap-2">
                                            <CardTitle className="text-base">Rack {rack.rack_barcode}</CardTitle>
                                            <Button
                                                size="sm"
                                                disabled={
                                                    rack.is_packing_complete ||
                                                    loadingPackingView ||
                                                    packingActionKey === `rack-${rack.rack_id}`
                                                }
                                                onClick={() => openPackDialog(
                                                    rack.order_id,
                                                    `rack-${rack.rack_id}`,
                                                    `Order ${rack.order_number} marked as packed.`,
                                                    `Packed from trolley ${packingViewData.trolley_barcode}`
                                                )}
                                            >
                                                {packingActionKey === `rack-${rack.rack_id}` ? "Saving..." : (rack.is_packing_complete ? "Packed" : "Mark Packed")}
                                            </Button>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="space-y-3">
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                                            <div><span className="text-muted-foreground">Position:</span> <span className="font-medium">{rack.rack_position}</span></div>
                                            <div><span className="text-muted-foreground">Rack Status:</span> <span className="font-medium">{rack.rack_status}</span></div>
                                            <div><span className="text-muted-foreground">Order Number:</span> <span className="font-medium">{rack.order_number}</span></div>
                                            <div><span className="text-muted-foreground">Customer:</span> <span className="font-medium">{rack.customer_name}</span></div>
                                            <div><span className="text-muted-foreground">Picking Complete:</span> <span className="font-medium">{rack.is_picking_complete ? "Yes" : "No"}</span></div>
                                            <div><span className="text-muted-foreground">Packing Complete:</span> <span className="font-medium">{rack.is_packing_complete ? "Yes" : "No"}</span></div>
                                        </div>

                                        <div className="rounded-md border overflow-hidden">
                                            <Table>
                                                <TableHeader>
                                                    <TableRow>
                                                        <TableHead>Item SKU</TableHead>
                                                        <TableHead>Description</TableHead>
                                                        <TableHead>Qty Ordered</TableHead>
                                                        <TableHead>Qty Picked</TableHead>
                                                        <TableHead>Qty Packed</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {rack.items.length === 0 && (
                                                        <TableRow>
                                                            <TableCell colSpan={5} className="py-6 text-center text-sm text-muted-foreground">
                                                                No items found for this rack.
                                                            </TableCell>
                                                        </TableRow>
                                                    )}

                                                    {rack.items.map((item) => (
                                                        <TableRow key={item.sales_order_item_id}>
                                                            <TableCell className="font-medium">{item.item_sku}</TableCell>
                                                            <TableCell>{item.item_description}</TableCell>
                                                            <TableCell>{formatBigNumeric(item.qty_ordered)}</TableCell>
                                                            <TableCell>{formatBigNumeric(item.qty_picked)}</TableCell>
                                                            <TableCell>{formatBigNumeric(item.qty_packed)}</TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
            )}

            {isPacker && (
            <Card className="overflow-hidden">
                <CardHeader className="pb-3">
                    <CardTitle className="text-base">Packed Work</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Order Number</TableHead>
                                <TableHead>Customer</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Packed At</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredPackedWork.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={4} className="py-8 text-center text-sm text-muted-foreground">
                                        {packedWorkLoading ? "Loading packed work..." : "No packed work yet."}
                                    </TableCell>
                                </TableRow>
                            )}
                            {filteredPackedWork.map((order) => (
                                <TableRow
                                    key={`packed-${order.id}`}
                                    className="cursor-pointer"
                                    onClick={() => void openPackedOrderDetail(order.id)}
                                >
                                    <TableCell className="font-semibold">{order.order_number}</TableCell>
                                    <TableCell>{order.customer_name}</TableCell>
                                    <TableCell>
                                        <span className="inline-flex items-center gap-1 text-green-700">
                                            <CheckCircle2 className="h-4 w-4" /> Packed
                                        </span>
                                    </TableCell>
                                    <TableCell>{formatDateTime(order.completed_at || order.updated_at)}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
            )}

            {isPacker && (
            <Dialog
                open={packedOrderDetailOpen}
                onOpenChange={(open) => {
                    setPackedOrderDetailOpen(open);
                    if (!open) {
                        setPackedOrderDetail(null);
                        setPackedOrderDetailError(null);
                    }
                }}
            >
                <DialogContent className="w-[96vw] max-w-6xl max-h-[90vh] overflow-y-auto border border-border bg-background text-foreground p-0 gap-0">
                    <DialogHeader className="px-6 py-5 border-b border-border/70 bg-muted/10">
                        <DialogTitle>Packed Work Details</DialogTitle>
                    </DialogHeader>

                    {packedOrderDetailLoading ? (
                        <p className="px-6 py-5 text-sm text-muted-foreground">Loading packed order details...</p>
                    ) : packedOrderDetailError ? (
                        <p className="px-6 py-5 text-sm text-red-400">{packedOrderDetailError}</p>
                    ) : packedOrderDetail ? (
                        <div className="space-y-5 px-6 py-5">
                            <div className="rounded-2xl border border-border bg-card p-4 shadow-sm transition-colors hover:border-primary/40 hover:bg-card">
                                <div className="flex flex-wrap items-start justify-between gap-4">
                                    <div>
                                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Order Number</p>
                                        <p className="mt-1 text-2xl font-semibold tracking-tight text-foreground break-words">{packedOrderDetail.order_number}</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Badge className="inline-flex items-center gap-1.5 border border-emerald-500/40 bg-emerald-500/20 px-3 py-1 text-emerald-200">
                                            <BadgeCheck className="h-3.5 w-3.5" />
                                            {packedOrderDetail.status || "PACKED"}
                                        </Badge>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                                <section className="rounded-2xl border border-border bg-card p-4 shadow-sm transition-colors hover:border-primary/40 hover:bg-card">
                                    <div className="mb-3 flex items-center gap-2 text-foreground">
                                        <Package className="h-4 w-4 text-sky-300" />
                                        <h3 className="text-sm font-semibold">Order Info</h3>
                                    </div>
                                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                        <div>
                                            <p className="text-xs text-muted-foreground">Order Number</p>
                                            <p className="text-base font-semibold text-foreground break-words">{packedOrderDetail.order_number}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-muted-foreground">Total Items</p>
                                            <p className="text-base font-semibold text-foreground break-words">{packedOrderDetail.total_items}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-muted-foreground">Total Quantity</p>
                                            <p className="text-base font-semibold text-foreground break-words">{formatBigNumeric(packedOrderDetail.total_quantity)}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-muted-foreground">Total Value</p>
                                            <p className="inline-flex items-center gap-1 text-base font-semibold text-foreground break-words">
                                                <CircleDollarSign className="h-4 w-4 text-sky-300" />
                                                {formatBigNumeric(packedOrderDetail.total_value)}
                                            </p>
                                        </div>
                                    </div>
                                </section>

                                <section className="rounded-2xl border border-border bg-card p-4 shadow-sm transition-colors hover:border-primary/40 hover:bg-card">
                                    <div className="mb-3 flex items-center gap-2 text-foreground">
                                        <BadgeCheck className="h-4 w-4 text-emerald-300" />
                                        <h3 className="text-sm font-semibold">Status Info</h3>
                                    </div>
                                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                        <div>
                                            <p className="text-xs text-muted-foreground">Status</p>
                                            <p className="text-base font-semibold text-foreground break-words">{packedOrderDetail.status}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-muted-foreground">Picking Complete</p>
                                            <p className="text-base font-semibold text-foreground break-words">{packedOrderDetail.is_picking_complete ? "Yes" : "No"}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-muted-foreground">Packed At</p>
                                            <p className="text-base font-semibold text-foreground break-words">{formatDateTime(packedOrderDetail.packed_at || null)}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-muted-foreground">Completed At</p>
                                            <p className="text-base font-semibold text-foreground break-words">{formatDateTime(packedOrderDetail.completed_at)}</p>
                                        </div>
                                    </div>
                                </section>

                                <section className="rounded-2xl border border-border bg-card p-4 shadow-sm transition-colors hover:border-primary/40 hover:bg-card">
                                    <div className="mb-3 flex items-center gap-2 text-foreground">
                                        <Clock3 className="h-4 w-4 text-indigo-300" />
                                        <h3 className="text-sm font-semibold">Timeline Info</h3>
                                    </div>
                                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                        <div>
                                            <p className="text-xs text-muted-foreground">Order Date</p>
                                            <p className="inline-flex items-center gap-1 text-base font-semibold text-foreground break-words">
                                                <CalendarDays className="h-4 w-4 text-indigo-300" />
                                                {formatDateTime(packedOrderDetail.order_date || null)}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-muted-foreground">Created At</p>
                                            <p className="text-base font-semibold text-foreground break-words">{formatDateTime(packedOrderDetail.created_at || null)}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-muted-foreground">Picked At</p>
                                            <p className="text-base font-semibold text-foreground break-words">{formatDateTime(packedOrderDetail.picked_at || null)}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-muted-foreground">Updated At</p>
                                            <p className="text-base font-semibold text-foreground break-words">{formatDateTime(packedOrderDetail.updated_at || null)}</p>
                                        </div>
                                    </div>
                                </section>

                                <section className="rounded-2xl border border-border bg-card p-4 shadow-sm transition-colors hover:border-primary/40 hover:bg-card">
                                    <div className="mb-3 flex items-center gap-2 text-foreground">
                                        <UserRound className="h-4 w-4 text-cyan-300" />
                                        <h3 className="text-sm font-semibold">User Info</h3>
                                    </div>
                                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                        <div>
                                            <p className="text-xs text-muted-foreground">Picked By</p>
                                            <p className="text-base font-semibold text-foreground break-words">{packedOrderDetail.picked_by_name || "-"}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-muted-foreground">Packed By</p>
                                            <p className="text-base font-semibold text-foreground break-words">{packedOrderDetail.packed_by_name || "-"}</p>
                                        </div>
                                        <div className="sm:col-span-2">
                                            <p className="text-xs text-muted-foreground">Customer Name</p>
                                            <p className="text-base font-semibold text-foreground break-words">{packedOrderDetail.customer_name}</p>
                                        </div>
                                    </div>
                                </section>
                            </div>

                            <div className="rounded-2xl border border-border bg-card p-4 shadow-sm transition-colors hover:border-primary/40 hover:bg-card">
                                <p className="text-xs text-muted-foreground">Notes</p>
                                <p className="mt-1 text-sm font-medium text-foreground break-words whitespace-pre-wrap">{packedOrderDetail.notes}</p>
                            </div>

                            <div className="rounded-2xl border border-border bg-card p-4 shadow-sm transition-colors hover:border-primary/40 hover:bg-card">
                                <div className="mb-3 flex items-center gap-2 text-foreground">
                                    <Package className="h-4 w-4 text-sky-300" />
                                    <h3 className="text-sm font-semibold">SKU Details</h3>
                                </div>

                                <div className="overflow-x-auto rounded-md border border-border">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Item SKU</TableHead>
                                                <TableHead>Description</TableHead>
                                                <TableHead>Qty Ordered</TableHead>
                                                <TableHead>Qty Picked</TableHead>
                                                <TableHead>Qty Packed</TableHead>
                                                <TableHead>Qty Shipped</TableHead>
                                                <TableHead>Fully Picked</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {packedOrderItems.length === 0 ? (
                                                <TableRow>
                                                    <TableCell colSpan={7} className="py-6 text-center text-sm text-muted-foreground">
                                                        No SKU details found for this order.
                                                    </TableCell>
                                                </TableRow>
                                            ) : (
                                                packedOrderItems.map((item, index) => (
                                                    <TableRow key={`${item.item_sku}-${index}`}>
                                                        <TableCell className="font-medium">{item.item_sku}</TableCell>
                                                        <TableCell>{item.item_description}</TableCell>
                                                        <TableCell>{formatBigNumeric(item.quantity_ordered)}</TableCell>
                                                        <TableCell>{formatBigNumeric(item.quantity_picked)}</TableCell>
                                                        <TableCell>{formatBigNumeric(item.quantity_packed)}</TableCell>
                                                        <TableCell>{formatBigNumeric(item.quantity_shipped)}</TableCell>
                                                        <TableCell>
                                                            <Badge variant={item.is_fully_picked ? "default" : "outline"}>
                                                                {item.is_fully_picked ? "Yes" : "No"}
                                                            </Badge>
                                                        </TableCell>
                                                    </TableRow>
                                                ))
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <p className="px-6 py-5 text-sm text-muted-foreground">No order details found.</p>
                    )}
                </DialogContent>
            </Dialog>
            )}

            {!isAdmin && (
            <Dialog
                open={packDialogOpen}
                onOpenChange={(open) => {
                    setPackDialogOpen(open);
                    if (!open) {
                        setPackError(null);
                    }
                }}
            >
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Mark As Packed</DialogTitle>
                    </DialogHeader>

                    <div className="space-y-2">
                        <label className="text-xs font-medium text-muted-foreground">Notes</label>
                        <Input
                            value={packNotes}
                            onChange={(event) => setPackNotes(event.target.value)}
                            placeholder="Packed from trolley TROLLEY-1001"
                        />
                        {packError && <p className="text-sm text-destructive">{packError}</p>}
                    </div>

                    <div className="flex justify-end gap-2">
                        <Button
                            variant="outline"
                            onClick={() => setPackDialogOpen(false)}
                            disabled={Boolean(packingActionKey)}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={() => void handleMarkPacked()}
                            disabled={Boolean(packingActionKey)}
                        >
                            {packingActionKey ? "Saving..." : "Save"}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
            )}
        </div>
    );
};

export default Packing;
