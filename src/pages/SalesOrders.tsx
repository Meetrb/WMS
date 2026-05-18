import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, ArrowRight, ArrowUpRight, Check, CheckCircle2, ChevronDown, Circle, PackageCheck, Plus, RefreshCw, Trash2, UserRound } from "lucide-react";
import { PhoneInput, COUNTRY_DATA, isPhoneValid } from "@/components/ui/PhoneInput";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { formatDisplayDateTime } from "@/lib/date";
import { useEnterNavigation } from "@/hooks/useEnterNavigation";
import { warehouseService } from "@/services/warehouseService";
import { toast } from "sonner";
import { pickingService } from "@/services/pickingService";
import api from "@/services/api";
import {
    type CreateCustomerPayload,
    salesOrderService,
    type CreateSalesOrderPayload,
    type SalesOrderCustomerOption,
    type SalesOrderItemOption,
    type UpdateCustomerPayload,
} from "@/services/salesOrderService";

interface SalesOrder {
    customer_id: string;
    customer_name: string;
    customer_email: string;
    requested_delivery_date: string;
    priority: string;
    notes: string;
    id: string;
    order_number: string;
    order_date: string;
    status: string;
    total_items: number;
    total_quantity: string;
    total_value: string;
    is_picking_complete: boolean;
    is_packing_complete: boolean;
    completed_at: string | null;
    created_by_id: string;
    created_by_name: string;
    created_at: string;
    updated_at: string;
    picked_by_id: string;
    picked_by_name: string;
    picked_at: string;
    packed_by_id: string;
    packed_by_name: string;
    packed_at: string;
    workflow_status?: Record<string, unknown> | null;
    warehouse?: Record<string, unknown> | null;
    customer?: Record<string, unknown> | null;
    dates?: Record<string, unknown> | null;
    summary?: Record<string, unknown> | null;
    inventory_summary?: Record<string, unknown> | null;
    picking_assignments: unknown[];
    items: unknown[];
    allocations?: unknown[];
    picking_tasks?: unknown[];
    packing?: Record<string, unknown> | null;
    shipment?: Record<string, unknown> | null;
    audit?: Record<string, unknown> | null;
    timeline?: unknown[];
}

interface CreateSalesOrderItem {
    item_id: string;
    item_sku: string;
    item_description: string;
    quantity_ordered: number;
    unit_price: number;
    lot_number: string;
    batch_number: string;
    lot_required: boolean;
    batch_required: boolean;
    expiry_date: string;
    expiry_required: boolean;
    notes: string;
}

interface CreateSalesOrderForm {
    customer_id: string;
    customer_name: string;
    customer_email: string;
    requested_delivery_date: string;
    priority: "HIGH" | "MEDIUM" | "LOW";
    notes: string;
    warehouse_id: string;
    items: CreateSalesOrderItem[];
}

interface CreateCustomerForm {
    code: string;
    name: string;
    email: string;
    phone_country_code: string;
    phone: string;
    mobile_country_code: string;
    mobile: string;

    address_line1: string;
    address_line2: string;
    city: string;
    state: string;
    country: string;
    pincode: string;
    gstin: string;
    pan: string;
    tax_type: string;
    contact_person_name: string;
    contact_person_country_code: string;
    contact_person_phone: string;

    contact_person_email: string;
    business_type: string;
    payment_terms: string;
    credit_limit: string;
    default_warehouse_id: string;
    default_shipping_method: string;
    is_active: boolean;
    is_verified: boolean;
    notes: string;
}

interface UpdateCustomerForm {
    code: string;
    name: string;
    email: string;
    phone_country_code: string;
    phone: string;
    mobile_country_code: string;
    mobile: string;

    address_line1: string;
    address_line2: string;
    city: string;
    state: string;
    country: string;
    pincode: string;
    gstin: string;
    pan: string;
    tax_type: string;
    contact_person_name: string;
    contact_person_country_code: string;
    contact_person_phone: string;

    contact_person_email: string;
    business_type: string;
    payment_terms: string;
    credit_limit: string;
    default_shipping_method: string;
    is_active: boolean;
    is_verified: boolean;
    notes: string;
}

interface WarehouseOption {
    id: string;
    code: string;
    name: string;
}

interface SalesOrderPickingTask {
    task_id: string;
    task_number: string;
    sales_order_id: string;
    sales_order_number: string;
    sales_order_item_id: string;
    item_id: string;
    item_sku: string;
    item_description: string;
    quantity_to_pick: string;
    quantity_picked: string;
    status: string;
    priority: string;
    source_bin_id: string;
    source_bin_code: string;
    source_zone_id: string;
    source_zone_name: string;
    assigned_to_name: string;
    assigned_to_id: string;
    assigned_at: string;
    started_at: string;
    completed_at: string;
    lot_number: string;
    batch_number: string;
    expiry_date: string;
    notes: string;
    created_at: string;
    created_by_name: string;
}

type OrderAssignmentMap = Record<string, string>;
type DetailsTab = "overview" | "items" | "timeline";

const emptyCreateItem = (): CreateSalesOrderItem => ({
    item_id: "",
    item_sku: "",
    item_description: "",
    quantity_ordered: 0,
    unit_price: 0,
    lot_number: "",
    batch_number: "",
    lot_required: false,
    batch_required: false,
    expiry_date: "",
    expiry_required: false,
    notes: "",
});

const defaultCreateForm = (): CreateSalesOrderForm => ({
    customer_id: "",
    customer_name: "",
    customer_email: "",
    requested_delivery_date: "",
    priority: "MEDIUM",
    notes: "",
    warehouse_id: "",
    items: [emptyCreateItem()],
});

const defaultCreateCustomerForm = (): CreateCustomerForm => ({
    code: "",
    name: "",
    email: "",
    phone_country_code: "+971",
    phone: "",
    mobile_country_code: "+971",
    mobile: "",
    address_line1: "",
    address_line2: "",
    city: "",
    state: "",
    country: "",
    pincode: "",
    gstin: "",
    pan: "",
    tax_type: "",
    contact_person_name: "",
    contact_person_country_code: "+971",
    contact_person_phone: "",
    contact_person_email: "",
    business_type: "",
    payment_terms: "",
    credit_limit: "0",
    default_warehouse_id: "",
    default_shipping_method: "",
    is_active: true,
    is_verified: false,
    notes: "",
});

const defaultUpdateCustomerForm = (): UpdateCustomerForm => ({
    code: "",
    name: "",
    email: "",
    phone_country_code: "+971",
    phone: "",
    mobile_country_code: "+971",
    mobile: "",
    address_line1: "",
    address_line2: "",
    city: "",
    state: "",
    country: "",
    pincode: "",
    gstin: "",
    pan: "",
    tax_type: "",
    contact_person_name: "",
    contact_person_country_code: "+971",
    contact_person_phone: "",
    contact_person_email: "",
    business_type: "",
    payment_terms: "",
    credit_limit: "0",
    default_shipping_method: "",
    is_active: true,
    is_verified: false,
    notes: "",
});

function asString(value: unknown, fallback: string = "-"): string {
    if (value === null || value === undefined || value === "") return fallback;
    return String(value);
}

function asBoolean(value: unknown): boolean {
    return Boolean(value);
}

function asNumber(value: unknown): number {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
}

function asNullableDateTime(value: unknown): string | null {
    if (value === null || value === undefined) return null;
    const raw = String(value).trim();
    if (!raw || raw === "null" || raw === "undefined" || raw === "N/A" || raw === "-") return null;
    return raw;
}

function formatDateTime(value: unknown): string {
    return formatDisplayDateTime(value, "-");
}

function formatBigNumeric(value: unknown): string {
    if (value === null || value === undefined || value === "") return "-";

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
}

function normalizeOrder(raw: unknown): SalesOrder {
    const order = (raw ?? {}) as Record<string, unknown>;
    const warehouse = isRecord(order.warehouse) ? order.warehouse : null;
    const customer = isRecord(order.customer) ? order.customer : null;
    const dates = isRecord(order.dates) ? order.dates : null;
    const summary = isRecord(order.summary) ? order.summary : null;
    const inventorySummary = isRecord(order.inventory_summary) ? order.inventory_summary : null;
    const workflowStatus = isRecord(order.workflow_status) ? order.workflow_status : null;
    const packing = isRecord(order.packing) ? order.packing : null;
    const shipment = isRecord(order.shipment) ? order.shipment : null;
    const audit = isRecord(order.audit) ? order.audit : null;
    const createdBy = audit && isRecord(audit.created_by) ? audit.created_by : null;
    const completedAt = asNullableDateTime(
        order.completed_at ??
        order.completedAt ??
        order.completed_date ??
        order.completedDate ??
        order.completion_date ??
        order.completionDate ??
        order.done_at ??
        order.doneAt
    );
    const normalizedWarehouseId = asString(
        (warehouse && (warehouse.warehouse_id ?? warehouse.id ?? warehouse.warehouseId)) ??
        order.warehouse_id ??
        order.warehouseId ??
        order.warehouse_code ??
        order.warehouseCode
    );
    const normalizedWarehouseName = asString(
        (warehouse && (warehouse.warehouse_name ?? warehouse.name ?? warehouse.warehouseName)) ??
        order.warehouse_name ??
        order.warehouseName
    );
    const normalizedCustomerId = asString(
        (customer && (customer.customer_id ?? customer.id ?? customer.customerId)) ??
        order.customer_id ??
        order.customerId
    );
    const normalizedCustomerName = asString(
        (customer && (customer.customer_name ?? customer.name ?? customer.full_name)) ??
        order.customer_name ??
        order.customerName
    );
    const normalizedCustomerEmail = asString(
        (customer && (customer.customer_email ?? customer.email)) ??
        order.customer_email ??
        order.customerEmail,
        ""
    );
    const normalizedWorkflowStatus = {
        allocation: asString((workflowStatus && (workflowStatus.allocation ?? workflowStatus.allocation_status)) ?? order.allocation_status ?? order.allocationStatus ?? "PENDING"),
        picking: asString((workflowStatus && (workflowStatus.picking ?? workflowStatus.picking_status)) ?? order.picking_status ?? order.pickingStatus ?? "PENDING"),
        packing: asString((workflowStatus && (workflowStatus.packing ?? workflowStatus.packing_status)) ?? order.packing_status ?? order.packingStatus ?? "PENDING"),
        shipping: asString((workflowStatus && (workflowStatus.shipping ?? workflowStatus.shipping_status)) ?? order.shipping_status ?? order.shippingStatus ?? "PENDING"),
    };
    const normalizedDates = {
        order_date: asString((dates && (dates.order_date ?? dates.orderDate)) ?? order.order_date ?? order.orderDate),
        requested_delivery_date: asString((dates && (dates.requested_delivery_date ?? dates.requestedDeliveryDate)) ?? order.requested_delivery_date ?? order.requestedDeliveryDate),
        created_at: asString((dates && (dates.created_at ?? dates.createdAt)) ?? order.created_at ?? order.createdAt),
        updated_at: asString((dates && (dates.updated_at ?? dates.updatedAt)) ?? order.updated_at ?? order.updatedAt),
        completed_at: completedAt,
    };
    const normalizedSummary = {
        total_items: asNumber((summary && summary.total_items) ?? order.total_items),
        total_quantity: asString((summary && summary.total_quantity) ?? order.total_quantity),
        total_value: asString((summary && summary.total_value) ?? order.total_value),
    };
    const normalizedInventorySummary = {
        available_qty: asNumber((inventorySummary && inventorySummary.available_qty) ?? order.available_qty),
        reserved_qty: asNumber((inventorySummary && inventorySummary.reserved_qty) ?? order.reserved_qty),
        short_qty: asNumber((inventorySummary && inventorySummary.short_qty) ?? order.short_qty),
    };

    return {
        customer_id: normalizedCustomerId,
        customer_name: normalizedCustomerName,
        customer_email: normalizedCustomerEmail,
        requested_delivery_date: normalizedDates.requested_delivery_date,
        priority: asString(order.priority),
        notes: asString(order.notes),
        id: asString(order.id),
        order_number: asString(order.order_number),
        order_date: normalizedDates.order_date,
        status: asString(order.status),
        total_items: normalizedSummary.total_items,
        total_quantity: normalizedSummary.total_quantity,
        total_value: normalizedSummary.total_value,
        is_picking_complete: asBoolean(order.is_picking_complete),
        is_packing_complete: asBoolean(order.is_packing_complete),
        completed_at: completedAt,
        created_by_id: asString(createdBy?.user_id ?? order.created_by_id ?? order.createdById),
        created_by_name: asString(createdBy?.user_name ?? order.created_by_name ?? order.createdByName),
        created_at: normalizedDates.created_at,
        updated_at: normalizedDates.updated_at,
        picked_by_id: asString(order.picked_by_id, ""),
        picked_by_name: asString(order.picked_by_name, ""),
        picked_at: asNullableDateTime(order.picked_at ?? order.pickedAt) ?? "",
        packed_by_id: asString(order.packed_by_id, ""),
        packed_by_name: asString(order.packed_by_name, ""),
        packed_at: asNullableDateTime(order.packed_at ?? order.packedAt) ?? "",
        workflow_status: normalizedWorkflowStatus,
        warehouse: {
            warehouse_id: normalizedWarehouseId,
            warehouse_name: normalizedWarehouseName,
        },
        customer: {
            customer_id: normalizedCustomerId,
            customer_name: normalizedCustomerName,
            customer_email: normalizedCustomerEmail,
        },
        dates: normalizedDates,
        summary: normalizedSummary,
        inventory_summary: normalizedInventorySummary,
        picking_assignments: Array.isArray(order.picking_assignments) ? order.picking_assignments : [],
        items: Array.isArray(order.items) ? order.items : [],
        allocations: Array.isArray(order.allocations) ? order.allocations : [],
        picking_tasks: Array.isArray(order.picking_tasks) ? order.picking_tasks : [],
        packing: packing ?? {
            status: asString(order.packing_status ?? order.packingStatus ?? "PENDING"),
            packed_by: order.packed_by_name ?? null,
            packed_at: order.packed_at ?? order.packedAt ?? null,
            packages: [],
        },
        shipment: shipment ?? {
            shipment_id: order.shipment_id ?? null,
            status: asString(order.shipment_status ?? order.shipmentStatus ?? "NOT_SHIPPED"),
            carrier: order.carrier ?? null,
            tracking_number: order.tracking_number ?? null,
            dispatch_location: order.dispatch_location ?? null,
            dispatched_at: order.dispatched_at ?? null,
        },
        audit: audit ?? {
            created_by: {
                user_id: asString(order.created_by_id),
                user_name: asString(order.created_by_name),
            },
            picked_by: null,
            packed_by: null,
        },
        timeline: Array.isArray(order.timeline) ? order.timeline : [],
    };
}

function getAssignedWorkerFromOrder(order: SalesOrder): string {
    if (order.picked_by_name && order.picked_by_name !== "-") return order.picked_by_name;

    const firstAssignment = order.picking_assignments.find((entry) => entry && typeof entry === "object") as Record<string, unknown> | undefined;
    if (firstAssignment) {
        const candidate =
            (typeof firstAssignment.assigned_to_name === "string" && firstAssignment.assigned_to_name.trim() && firstAssignment.assigned_to_name) ||
            (typeof firstAssignment.picker_name === "string" && firstAssignment.picker_name.trim() && firstAssignment.picker_name) ||
            "";
        if (candidate) return String(candidate).trim();
    }

    return "";
}

function resolveAssignedWorkerDisplay(order: SalesOrder, mappedValue?: string): string {
    const mapped = String(mappedValue ?? "").trim();
    if (mapped && mapped !== "Unassigned" && mapped !== "-") return mapped;

    const orderValue = getAssignedWorkerFromOrder(order);
    if (orderValue) return orderValue;

    return "Unassigned";
}

function extractWarehouses(payload: unknown): WarehouseOption[] {
    const source = Array.isArray(payload)
        ? payload
        : payload && typeof payload === "object"
            ? ((payload as Record<string, unknown>).data ??
                (payload as Record<string, unknown>).items ??
                (payload as Record<string, unknown>).results ??
                (payload as Record<string, unknown>).warehouses)
            : [];

    if (!Array.isArray(source)) return [];

    return source
        .map((entry) => {
            const warehouse = (entry ?? {}) as Record<string, unknown>;
            const id = String(warehouse.id ?? warehouse.warehouse_id ?? "").trim();
            const code = String(warehouse.code ?? "").trim();
            const name = String(warehouse.name ?? "").trim();

            if (!id || !code) return null;

            return { id, code, name };
        })
        .filter((warehouse): warehouse is WarehouseOption => Boolean(warehouse));
}

function normalizePickingTask(raw: unknown): SalesOrderPickingTask {
    const task = (raw ?? {}) as Record<string, unknown>;

    const resolveAssignedName = (): string => {
        const directCandidates: unknown[] = [
            task.assigned_to_name,
            task.assignedToName,
            task.picker_name,
            task.worker_name,
            task.assigned_worker_name,
        ];

        for (const candidate of directCandidates) {
            if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
        }

        const objectCandidates = [
            task.assigned_to,
            task.assignee,
            task.assigned_user,
            task.assigned_to_user,
            task.worker,
            task.user,
        ];

        for (const candidate of objectCandidates) {
            if (!candidate || typeof candidate !== "object") continue;
            const source = candidate as Record<string, unknown>;
            const nested = source.name ?? source.full_name ?? source.username ?? source.worker_name;
            if (typeof nested === "string" && nested.trim()) return nested.trim();
        }

        if (typeof task.assigned_to === "string" && task.assigned_to.trim()) return task.assigned_to.trim();
        return "Unassigned";
    };

    const resolveAssignedId = (): string => {
        if (typeof task.assigned_to_id === "string" && task.assigned_to_id.trim()) return task.assigned_to_id.trim();
        if (typeof task.picker_id === "string" && task.picker_id.trim()) return task.picker_id.trim();

        const objectCandidates = [task.assigned_to, task.assignee, task.assigned_user, task.assigned_to_user, task.worker, task.user];
        for (const candidate of objectCandidates) {
            if (!candidate || typeof candidate !== "object") continue;
            const source = candidate as Record<string, unknown>;
            const nestedId = source.id ?? source.user_id ?? source.worker_id;
            if (nestedId === null || nestedId === undefined) continue;
            const parsed = String(nestedId).trim();
            if (parsed) return parsed;
        }

        return "-";
    };

    return {
        task_id: asString(task.id ?? task.task_id, "-"),
        task_number: asString(task.task_number, "-"),
        sales_order_id: asString(task.sales_order_id ?? task.order_id, ""),
        sales_order_number: asString(task.sales_order_number ?? task.order_number, "-"),
        sales_order_item_id: asString(task.sales_order_item_id, "-"),
        item_id: asString(task.item_id, "-"),
        item_sku: asString(task.item_sku, "-"),
        item_description: asString(task.item_description, "-"),
        quantity_to_pick: asString(task.quantity_to_pick, "-"),
        quantity_picked: asString(task.quantity_picked, "-"),
        status: asString(task.status ?? task.task_status, "-"),
        priority: asString(task.priority, "-"),
        source_bin_id: asString(task.source_bin_id, "-"),
        source_bin_code: asString(task.source_bin_code, "-"),
        source_zone_id: asString(task.source_zone_id, "-"),
        source_zone_name: asString(task.source_zone_name, "-"),
        assigned_to_name: resolveAssignedName(),
        assigned_to_id: resolveAssignedId(),
        assigned_at: asString(task.assigned_at, "-"),
        started_at: asString(task.started_at, "-"),
        completed_at: asString(task.completed_at, "-"),
        lot_number: asString(task.lot_number, "-"),
        batch_number: asString(task.batch_number, "-"),
        expiry_date: asString(task.expiry_date, "-"),
        notes: asString(task.notes, "-"),
        created_at: asString(task.created_at, "-"),
        created_by_name: asString(task.created_by_name, "-"),
    };
}

function getAssignedWorkerLabel(tasks: SalesOrderPickingTask[]): string {
    if (!tasks.length) return "Unassigned";

    const assignedTask = tasks.find((task) => task.assigned_to_name && task.assigned_to_name !== "Unassigned");
    return assignedTask?.assigned_to_name || tasks[0]?.assigned_to_name || "Unassigned";
}

function extractAssignedNameFromOrderDetailsPayload(payload: unknown): string {
    if (!payload || typeof payload !== "object") return "";
    const data = payload as Record<string, unknown>;

    const direct = [data.assigned_to_name, data.picker_name, data.assigned_to, data.picker]
        .find((value) => typeof value === "string" && value.trim());
    if (typeof direct === "string" && direct.trim()) return direct.trim();

    const candidateObjects = [
        data.picking_task,
        data.pickup_task,
        data.task,
        data.assignment,
    ];

    for (const candidate of candidateObjects) {
        if (!candidate || typeof candidate !== "object") continue;
        const source = candidate as Record<string, unknown>;
        const nestedDirect = [source.assigned_to_name, source.picker_name]
            .find((value) => typeof value === "string" && value.trim());
        if (typeof nestedDirect === "string" && nestedDirect.trim()) return nestedDirect.trim();

        const assignedToObject = source.assigned_to;
        if (assignedToObject && typeof assignedToObject === "object") {
            const assignedUser = assignedToObject as Record<string, unknown>;
            const nestedName = [assignedUser.full_name, assignedUser.name, assignedUser.username, assignedUser.worker_name]
                .find((value) => typeof value === "string" && value.trim());
            if (typeof nestedName === "string" && nestedName.trim()) return nestedName.trim();
        }
    }

    const taskArrays = [data.picking_tasks, data.pickup_tasks, data.tasks].filter(Array.isArray) as unknown[][];
    for (const taskArray of taskArrays) {
        for (const item of taskArray) {
            if (!item || typeof item !== "object") continue;
            const source = item as Record<string, unknown>;
            const nestedDirect = [source.assigned_to_name, source.picker_name]
                .find((value) => typeof value === "string" && value.trim());
            if (typeof nestedDirect === "string" && nestedDirect.trim()) return nestedDirect.trim();
        }
    }

    return "";
}

async function getPendingTaskAssignmentByOrder(order: Pick<SalesOrder, "id" | "order_number">): Promise<SalesOrderPickingTask[]> {
    try {
        const pendingTasks = await pickingService.getPendingTasks();
        const normalized = (Array.isArray(pendingTasks) ? pendingTasks : []).map((task) => normalizePickingTask(task));

        return normalized.filter((task) => {
            const orderIdMatches = task.sales_order_id && task.sales_order_id === order.id;
            const orderNumberMatches = task.sales_order_number && task.sales_order_number === order.order_number;
            return orderIdMatches || orderNumberMatches;
        });
    } catch {
        return [];
    }
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

function getRecordArray(value: unknown): Record<string, unknown>[] {
    return Array.isArray(value) ? value.filter(isRecord) : [];
}

function getRecordText(record: Record<string, unknown> | null | undefined, keys: string[], fallback = "-"): string {
    if (!record) return fallback;

    for (const key of keys) {
        const value = record[key];
        if (typeof value === "string" && value.trim()) return value.trim();
        if (typeof value === "number" && Number.isFinite(value)) return String(value);
        if (typeof value === "boolean") return value ? "true" : "false";
    }

    return fallback;
}

function getInventoryCreateErrorMessage(
    error: unknown,
    items: Array<{ item_id: string; item_sku: string; item_description: string }>
): string | null {
    if (!isRecord(error)) return null;

    const response = isRecord(error.response) ? error.response : null;
    const data = response && isRecord(response.data) ? response.data : null;
    const detail = data && isRecord(data.detail) ? data.detail : null;
    const detailMessage = detail && typeof detail.message === "string" ? detail.message : null;
    const fallbackMessage = data && typeof data.message === "string" ? data.message : null;
    const outOfStock = detail && Array.isArray(detail.out_of_stock_items) ? detail.out_of_stock_items : [];

    if (!outOfStock.length) {
        const message = detailMessage ?? fallbackMessage;
        if (message && message.toLowerCase().includes("insufficient inventory")) {
            return message;
        }
        return null;
    }

    const lineItems = outOfStock
        .map((entry) => {
            if (!isRecord(entry)) return null;

            const itemId = String(entry.item_id ?? "").trim();
            const requested = Number(entry.requested_quantity ?? 0);
            const available = Number(entry.available_quantity ?? 0);
            const matchedItem = items.find((item) => item.item_id.trim() === itemId);
            const label = matchedItem?.item_sku || matchedItem?.item_description || itemId || "Unknown item";

            return `${label}: requested ${requested}, available ${available}`;
        })
        .filter((line): line is string => Boolean(line));

    const prefix = detailMessage ?? fallbackMessage ?? "Insufficient inventory for one or more items";
    return `${prefix}. ${lineItems.join(" | ")}`;
}

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

const isDoneState = (status: string): boolean => {
    const normalized = status.toLowerCase();
    return normalized.includes("complete") || normalized.includes("done") || normalized.includes("packed") || normalized.includes("shipped") || normalized.includes("allocated");
};

const isInProgressState = (status: string): boolean => {
    const normalized = status.toLowerCase();
    return normalized.includes("progress") || normalized.includes("process") || normalized.includes("in_");
};

const workflowPillClass = (status: string): string => {
    if (isDoneState(status)) return "border border-emerald-500/40 bg-emerald-600/25 text-emerald-300";
    if (isInProgressState(status)) return "border border-blue-500/40 bg-blue-600/25 text-blue-300";
    return "border border-amber-500/40 bg-amber-600/25 text-amber-300";
};

const SalesOrders = () => {
    const createFormRef = useRef<HTMLFormElement>(null);
    const [orders, setOrders] = useState<SalesOrder[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [createOpen, setCreateOpen] = useState(false);
    const [createCustomerOpen, setCreateCustomerOpen] = useState(false);
    const [updateCustomerOpen, setUpdateCustomerOpen] = useState(false);

    useEnterNavigation(createFormRef, { submitOnLast: true });
    const [createSubmitting, setCreateSubmitting] = useState(false);
    const [createForm, setCreateForm] = useState<CreateSalesOrderForm>(defaultCreateForm);
    const [detailsOpen, setDetailsOpen] = useState(false);
    const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
    const [orderDetails, setOrderDetails] = useState<SalesOrder | null>(null);
    const [detailsTab, setDetailsTab] = useState<DetailsTab>("overview");
    const [detailsLoading, setDetailsLoading] = useState(false);
    const [pickingTasksLoading, setPickingTasksLoading] = useState(false);
    const [orderPickingTasks, setOrderPickingTasks] = useState<SalesOrderPickingTask[]>([]);
    const [orderAssignments, setOrderAssignments] = useState<OrderAssignmentMap>({});
    const [confirming, setConfirming] = useState(false);
    const [warehouseOptions, setWarehouseOptions] = useState<WarehouseOption[]>([]);
    const [warehouseLoading, setWarehouseLoading] = useState(false);
    const [warehouseSearch, setWarehouseSearch] = useState("");
    const [showWarehouseOptions, setShowWarehouseOptions] = useState(false);
    const [customerOptions, setCustomerOptions] = useState<SalesOrderCustomerOption[]>([]);
    const [customerLoading, setCustomerLoading] = useState(false);
    const [createCustomerSubmitting, setCreateCustomerSubmitting] = useState(false);
    const updateCustomerLoading = false;
    const [updateCustomerSubmitting, setUpdateCustomerSubmitting] = useState(false);
    const [createCustomerForm, setCreateCustomerForm] = useState<CreateCustomerForm>(defaultCreateCustomerForm);
    const [updateCustomerForm, setUpdateCustomerForm] = useState<UpdateCustomerForm>(defaultUpdateCustomerForm);
    const [customerSearch, setCustomerSearch] = useState("");
    const [showCustomerOptions, setShowCustomerOptions] = useState(false);
    const [activeCustomerIndex, setActiveCustomerIndex] = useState<number>(-1);
    const [activeWarehouseIndex, setActiveWarehouseIndex] = useState<number>(-1);
    const [itemOptions, setItemOptions] = useState<SalesOrderItemOption[]>([]);
    const [itemsLoading, setItemsLoading] = useState(false);
    const [openItemSkuIndex, setOpenItemSkuIndex] = useState<number | null>(null);
    const pickerNameCacheRef = useRef<Record<string, string>>({});

    useEffect(() => {
        setActiveCustomerIndex(-1);
    }, [customerSearch, customerOptions]);

    useEffect(() => {
        setActiveWarehouseIndex(-1);
    }, [warehouseSearch, warehouseOptions]);

    const handleCustomerKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (!showCustomerOptions) {
            if (e.key === "Enter") {
                e.preventDefault();
                e.stopPropagation();
                document.getElementById("warehouse_id")?.focus();
            } else if (e.key === "ArrowDown") {
                e.preventDefault();
                e.stopPropagation();
                setShowCustomerOptions(true);
                setActiveCustomerIndex(0);
            }
            return;
        }

        if (e.key === "ArrowDown") {
            e.preventDefault();
            e.stopPropagation();
            setActiveCustomerIndex((prev) => {
                const next = prev + 1;
                return next >= filteredCustomerOptions.length ? 0 : next;
            });
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            e.stopPropagation();
            setActiveCustomerIndex((prev) => {
                const next = prev - 1;
                return next < 0 ? filteredCustomerOptions.length - 1 : next;
            });
        } else if (e.key === "Enter") {
            e.preventDefault();
            e.stopPropagation();
            if (activeCustomerIndex >= 0 && activeCustomerIndex < filteredCustomerOptions.length) {
                selectCustomer(filteredCustomerOptions[activeCustomerIndex]);
            } else {
                setShowCustomerOptions(false);
                document.getElementById("warehouse_id")?.focus();
            }
        } else if (e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation();
            setShowCustomerOptions(false);
        }
    };

    const handleWarehouseKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (!showWarehouseOptions) {
            if (e.key === "Enter") {
                e.preventDefault();
                e.stopPropagation();
                document.getElementById("requested_delivery_date")?.focus();
            } else if (e.key === "ArrowDown") {
                e.preventDefault();
                e.stopPropagation();
                setShowWarehouseOptions(true);
                setActiveWarehouseIndex(0);
            }
            return;
        }

        if (e.key === "ArrowDown") {
            e.preventDefault();
            e.stopPropagation();
            setActiveWarehouseIndex((prev) => {
                const next = prev + 1;
                return next >= filteredWarehouseOptions.length ? 0 : next;
            });
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            e.stopPropagation();
            setActiveWarehouseIndex((prev) => {
                const next = prev - 1;
                return next < 0 ? filteredWarehouseOptions.length - 1 : next;
            });
        } else if (e.key === "Enter") {
            e.preventDefault();
            e.stopPropagation();
            if (activeWarehouseIndex >= 0 && activeWarehouseIndex < filteredWarehouseOptions.length) {
                selectWarehouse(filteredWarehouseOptions[activeWarehouseIndex]);
            } else {
                setShowWarehouseOptions(false);
                document.getElementById("requested_delivery_date")?.focus();
            }
        } else if (e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation();
            setShowWarehouseOptions(false);
        }
    };

    const handleRequestedDeliveryDateKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") {
            e.preventDefault();
            e.stopPropagation();
            document.getElementById("priority")?.focus();
        }
    };

    const handlePriorityKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
        if (e.key === "Enter") {
            e.preventDefault();
            e.stopPropagation();
            document.getElementById("order_notes")?.focus();
        }
    };

    const handleNotesKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Enter") {
            e.preventDefault();
            e.stopPropagation();
            document.getElementById("item_sku_0")?.focus();
        }
    };

    const resolveAssignmentLabelFromTasks = useCallback(async (tasks: SalesOrderPickingTask[]): Promise<string> => {
        const direct = getAssignedWorkerLabel(tasks);
        if (direct && direct !== "Unassigned") return direct;

        const pickerId = tasks.find((task) => task.assigned_to_id && task.assigned_to_id !== "-")?.assigned_to_id?.trim() || "";
        if (!pickerId) return "Unassigned";

        const cached = pickerNameCacheRef.current[pickerId];
        if (cached) return cached;

        try {
            const response = await api.get(`/users/${pickerId}`);
            const user = (response.data ?? {}) as Record<string, unknown>;
            const resolved =
                (typeof user.full_name === "string" && user.full_name.trim() ? user.full_name.trim() : "") ||
                (typeof user.username === "string" && user.username.trim() ? user.username.trim() : "") ||
                (typeof user.name === "string" && user.name.trim() ? user.name.trim() : "");

            if (!resolved) return "Unassigned";

            pickerNameCacheRef.current[pickerId] = resolved;
            return resolved;
        } catch {
            return "Unassigned";
        }
    }, []);

    const loadOrderAssignments = useCallback(async (orderList: SalesOrder[]) => {
        if (!orderList.length) {
            setOrderAssignments({});
            return;
        }

        const assignmentPairs = await Promise.all(
            orderList.map(async (order) => {
                try {
                    const pickingTasks = await pickingService.getTasksBySalesOrder(order.id);
                    let normalizedTasks = (Array.isArray(pickingTasks) ? pickingTasks : []).map((task) => normalizePickingTask(task));
                    let label = await resolveAssignmentLabelFromTasks(normalizedTasks);

                    if (label === "Unassigned") {
                        const pendingMatches = await getPendingTaskAssignmentByOrder(order);
                        if (pendingMatches.length > 0) {
                            normalizedTasks = pendingMatches;
                            label = await resolveAssignmentLabelFromTasks(normalizedTasks);
                        }
                    }

                    if (label === "Unassigned") {
                        try {
                            const details = await salesOrderService.getOrderDetails(order.id);
                            const fromDetails = extractAssignedNameFromOrderDetailsPayload(details);
                            if (fromDetails) label = fromDetails;
                        } catch {
                            // Ignore details fallback failures and keep current label.
                        }
                    }

                    return [order.id, resolveAssignedWorkerDisplay(order, label)] as const;
                } catch {
                    return [order.id, resolveAssignedWorkerDisplay(order, "Unassigned")] as const;
                }
            })
        );

        const nextAssignments = Object.fromEntries(assignmentPairs) as OrderAssignmentMap;

        setOrderAssignments(nextAssignments);
    }, [resolveAssignmentLabelFromTasks]);

    const loadOrders = useCallback(async (isRefresh = false) => {
        if (isRefresh) {
            setRefreshing(true);
        } else {
            setLoading(true);
        }

        setError(null);

        try {
            const list = await salesOrderService.getAll();
            const normalizedOrders = list.map((entry) => normalizeOrder(entry));

            setOrders(normalizedOrders);
            await loadOrderAssignments(normalizedOrders);
        } catch (err) {
            const message = err instanceof Error ? err.message : "Failed to load sales orders.";
            setError(message);
            setOrders([]);
            setOrderAssignments({});
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [loadOrderAssignments]);

    useEffect(() => {
        void loadOrders(false);
    }, [loadOrders]);

    const loadWarehouses = useCallback(async () => {
        setWarehouseLoading(true);
        try {
            const response = await warehouseService.getAll();
            setWarehouseOptions(extractWarehouses(response));
        } catch (err) {
            const message = err instanceof Error ? err.message : "Failed to load warehouses.";
            toast.error(message);
            setWarehouseOptions([]);
        } finally {
            setWarehouseLoading(false);
        }
    }, []);

    const loadItems = useCallback(async (warehouseId?: string) => {
        const targetWarehouseId = (warehouseId ?? createForm.warehouse_id).trim();
        if (!targetWarehouseId) {
            setItemOptions([]);
            return;
        }

        setItemsLoading(true);
        try {
            // Load both warehouse inventory and full SKU master data
            const [warehouseItems, allItems] = await Promise.all([
                salesOrderService.getItemsByWarehouse(targetWarehouseId),
                salesOrderService.getItems(),
            ]);

            // Create a map of SKU codes to SKU details for quick lookup
            const skuMap = new Map(
                allItems.map((item) => [item.sku.toLowerCase(), item])
            );

            // Merge warehouse items with SKU master data to get requirement flags.
            const mergedItems = warehouseItems.map((item) => {
                const skuDetail = skuMap.get(item.sku.toLowerCase());
                return {
                    ...item,
                    lotRequired: skuDetail?.lotRequired ?? item.lotRequired ?? false,
                    batchRequired: skuDetail?.batchRequired ?? item.batchRequired ?? false,
                    expiryRequired: skuDetail?.expiryRequired ?? false,
                };
            });

            setItemOptions(mergedItems);
        } catch (err) {
            const message = err instanceof Error ? err.message : "Failed to load items.";
            toast.error(message);
            setItemOptions([]);
        } finally {
            setItemsLoading(false);
        }
    }, [createForm.warehouse_id]);

    const loadCustomers = useCallback(async () => {
        setCustomerLoading(true);
        try {
            const customers = await salesOrderService.getCustomers();
            setCustomerOptions(customers);
        } catch (err) {
            const message = err instanceof Error ? err.message : "Failed to load customers.";
            toast.error(message);
            setCustomerOptions([]);
        } finally {
            setCustomerLoading(false);
        }
    }, []);

    useEffect(() => {
        if (!createOpen) {
            setShowWarehouseOptions(false);
            setShowCustomerOptions(false);
            setOpenItemSkuIndex(null);
            return;
        }

        void loadWarehouses();
        void loadCustomers();
    }, [createOpen, loadCustomers, loadWarehouses]);

    useEffect(() => {
        if (!createOpen) return;

        const warehouseId = createForm.warehouse_id.trim();
        if (!warehouseId) {
            setItemOptions([]);
            return;
        }

        void loadItems(warehouseId);
    }, [createOpen, createForm.warehouse_id, loadItems]);

    const minDateTime = useMemo(() => {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        return `${year}-${month}-${day}T${hours}:${minutes}`;
    }, [createOpen]);

    const completedOrders = useMemo(() => orders.filter((o) => o.completed_at).length, [orders]);
    const totalItems = useMemo(() => orders.reduce((sum, order) => sum + order.total_items, 0), [orders]);

    const filteredCustomerOptions = useMemo(() => {
        const q = customerSearch.trim().toLowerCase();
        if (!q) return customerOptions;
        return customerOptions.filter((customer) =>
            [customer.name, customer.email, customer.id].some((value) => value.toLowerCase().includes(q))
        );
    }, [customerOptions, customerSearch]);

    const filteredWarehouseOptions = useMemo(() => {
        const q = warehouseSearch.trim().toLowerCase();
        if (!q) return warehouseOptions;
        return warehouseOptions.filter((warehouse) =>
            [warehouse.code, warehouse.name, warehouse.id].some((value) => value.toLowerCase().includes(q))
        );
    }, [warehouseOptions, warehouseSearch]);

    const updateCreateForm = <K extends keyof CreateSalesOrderForm>(field: K, value: CreateSalesOrderForm[K]) => {
        setCreateForm((prev) => ({ ...prev, [field]: value }));
    };

    const updateCreateItem = <K extends keyof CreateSalesOrderItem>(
        index: number,
        field: K,
        value: CreateSalesOrderItem[K]
    ) => {
        setCreateForm((prev) => ({
            ...prev,
            items: prev.items.map((item, itemIndex) => {
                if (itemIndex !== index) return item;
                return { ...item, [field]: value };
            }),
        }));
    };

    const addCreateItem = () => {
        setCreateForm((prev) => ({
            ...prev,
            items: [...prev.items, emptyCreateItem()],
        }));
    };

    const removeCreateItem = (index: number) => {
        setCreateForm((prev) => ({
            ...prev,
            items: prev.items.length <= 1 ? prev.items : prev.items.filter((_, itemIndex) => itemIndex !== index),
        }));
    };

    const toIsoString = (value: string): string | null => {
        if (!value.trim()) return null;
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return null;
        return date.toISOString();
    };

    const openCreateDialog = () => {
        setCreateForm(defaultCreateForm());
        setCreateCustomerForm(defaultCreateCustomerForm());
        setCustomerSearch("");
        setWarehouseSearch("");
        setCreateOpen(true);
        setShowWarehouseOptions(false);
        setShowCustomerOptions(false);
        setActiveCustomerIndex(-1);
        setActiveWarehouseIndex(-1);
    };

    const closeCreateDialog = () => {
        if (createSubmitting) return;
        setShowWarehouseOptions(false);
        setShowCustomerOptions(false);
        setOpenItemSkuIndex(null);
        setCreateCustomerOpen(false);
        setUpdateCustomerOpen(false);
        setCreateOpen(false);
    };

    const openUpdateCustomerDialog = async () => {
        const customerId = createForm.customer_id.trim();
        if (!customerId) {
            toast.error("Select an existing customer first.");
            return;
        }

        try {
            const customerData = await salesOrderService.getCustomerById(customerId);

            const parsePhone = (raw: string) => {
                let country_code = "+971";
                let phone = raw;
                for (const country of COUNTRY_DATA) {
                    if (raw.startsWith(country.code)) {
                        country_code = country.code;
                        phone = raw.substring(country.code.length);
                        break;
                    }
                }
                return { country_code, phone };
            };

            const phoneInfo = parsePhone(String(customerData.phone || ""));
            const mobileInfo = parsePhone(String(customerData.mobile || ""));
            const contactPhoneInfo = parsePhone(String(customerData.contact_person_phone || ""));

            setUpdateCustomerForm({
                code: customerId,
                name: String(customerData.name || ""),
                email: String(customerData.email || ""),
                phone_country_code: phoneInfo.country_code,
                phone: phoneInfo.phone,
                mobile_country_code: mobileInfo.country_code,
                mobile: mobileInfo.phone,
                address_line1: String(customerData.address_line1 || ""),
                address_line2: String(customerData.address_line2 || ""),
                city: String(customerData.city || ""),
                state: String(customerData.state || ""),
                country: String(customerData.country || ""),
                pincode: String(customerData.pincode || ""),
                gstin: String(customerData.gstin || ""),
                pan: String(customerData.pan || ""),
                tax_type: String(customerData.tax_type || ""),
                contact_person_name: String(customerData.contact_person_name || ""),
                contact_person_country_code: contactPhoneInfo.country_code,
                contact_person_phone: contactPhoneInfo.phone,
                contact_person_email: String(customerData.contact_person_email || ""),
                business_type: String(customerData.business_type || ""),
                payment_terms: String(customerData.payment_terms || ""),
                credit_limit: String(customerData.credit_limit || "0"),
                default_shipping_method: String(customerData.default_shipping_method || ""),
                is_active: Boolean(customerData.is_active ?? true),
                is_verified: Boolean(customerData.is_verified ?? false),
                notes: String(customerData.notes || ""),
            });
            setUpdateCustomerOpen(true);
        } catch (err) {
            toast.error("Failed to load customer details.");
        }
    };

    const submitCreateCustomer = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        if (!createCustomerForm.code.trim() || !createCustomerForm.name.trim() || !createCustomerForm.email.trim()) {
            toast.error("code, name, and email are required.");
            return;
        }

        const payload: CreateCustomerPayload = {
            code: createCustomerForm.code.trim(),
            name: createCustomerForm.name.trim(),
            email: createCustomerForm.email.trim(),
            phone: createCustomerForm.phone ? `${createCustomerForm.phone_country_code}${createCustomerForm.phone}` : "",
            mobile: createCustomerForm.mobile ? `${createCustomerForm.mobile_country_code}${createCustomerForm.mobile}` : "",

            address_line1: createCustomerForm.address_line1.trim(),
            address_line2: createCustomerForm.address_line2.trim(),
            city: createCustomerForm.city.trim(),
            state: createCustomerForm.state.trim(),
            country: createCustomerForm.country.trim(),
            pincode: createCustomerForm.pincode.trim(),
            gstin: createCustomerForm.gstin.trim(),
            pan: createCustomerForm.pan.trim(),
            tax_type: createCustomerForm.tax_type.trim(),
            contact_person_name: createCustomerForm.contact_person_name.trim(),
            contact_person_phone: createCustomerForm.contact_person_phone ? `${createCustomerForm.contact_person_country_code}${createCustomerForm.contact_person_phone}` : "",
            contact_person_email: createCustomerForm.contact_person_email.trim(),

            business_type: createCustomerForm.business_type.trim(),
            payment_terms: createCustomerForm.payment_terms.trim(),
            credit_limit: Number(createCustomerForm.credit_limit) || 0,
            default_warehouse_id: createCustomerForm.default_warehouse_id.trim(),
            default_shipping_method: createCustomerForm.default_shipping_method.trim(),
            is_active: createCustomerForm.is_active,
            is_verified: createCustomerForm.is_verified,
            notes: createCustomerForm.notes.trim(),
        };

        setCreateCustomerSubmitting(true);
        try {
            const created = await salesOrderService.createCustomer(payload);
            await loadCustomers();
            selectCustomer(created);
            setCreateCustomerOpen(false);
            setCreateCustomerForm(defaultCreateCustomerForm());
            toast.success("Customer created successfully.");
        } catch (err) {
            const message = err instanceof Error ? err.message : "Failed to create customer.";
            toast.error(message);
        } finally {
            setCreateCustomerSubmitting(false);
        }
    };

    const submitUpdateCustomer = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        const customerId = createForm.customer_id.trim();
        if (!customerId) {
            toast.error("Select an existing customer first.");
            return;
        }

        if (!updateCustomerForm.code.trim() || !updateCustomerForm.name.trim() || !updateCustomerForm.email.trim()) {
            toast.error("code, name, and email are required.");
            return;
        }

        const payload = buildUpdateCustomerPayload(updateCustomerForm);

        setUpdateCustomerSubmitting(true);
        try {
            const updated = await salesOrderService.updateCustomer(customerId, payload);
            await loadCustomers();
            selectCustomer(updated);
            setUpdateCustomerOpen(false);
            toast.success("Customer updated successfully.");
        } catch (err) {
            const message = err instanceof Error ? err.message : "Failed to update customer.";
            toast.error(message);
        } finally {
            setUpdateCustomerSubmitting(false);
        }
    };

    const buildUpdateCustomerPayload = (form: UpdateCustomerForm): UpdateCustomerPayload => {
        return {
            code: form.code.trim(),
            name: form.name.trim(),
            email: form.email.trim(),
            phone: form.phone ? `${form.phone_country_code}${form.phone}` : "",
            mobile: form.mobile ? `${form.mobile_country_code}${form.mobile}` : "",
            address_line1: form.address_line1.trim(),
            address_line2: form.address_line2.trim(),
            city: form.city.trim(),
            state: form.state.trim(),
            country: form.country.trim(),
            pincode: form.pincode.trim(),
            gstin: form.gstin.trim(),
            pan: form.pan.trim(),
            tax_type: form.tax_type.trim(),
            contact_person_name: form.contact_person_name.trim(),
            contact_person_phone: form.contact_person_phone ? `${form.contact_person_country_code}${form.contact_person_phone}` : "",
            contact_person_email: form.contact_person_email.trim(),
            business_type: form.business_type.trim(),
            payment_terms: form.payment_terms.trim(),
            credit_limit: Number(form.credit_limit) || 0,
            default_shipping_method: form.default_shipping_method.trim(),
            is_active: form.is_active,
            is_verified: form.is_verified,
            notes: form.notes.trim(),
        };
    };

    const selectCustomer = (customer: SalesOrderCustomerOption) => {
        setCustomerSearch(customer.name);
        setCreateForm((prev) => ({
            ...prev,
            customer_id: customer.id,
            customer_name: customer.name,
            customer_email: customer.email,
        }));
        setShowCustomerOptions(false);
        setTimeout(() => {
            document.getElementById("warehouse_id")?.focus();
        }, 50);
    };

    const selectWarehouse = (warehouse: WarehouseOption) => {
        setWarehouseSearch(warehouse.code);
        updateCreateForm("warehouse_id", warehouse.id);
        setShowWarehouseOptions(false);
        void loadItems(warehouse.id);
        setTimeout(() => {
            document.getElementById("requested_delivery_date")?.focus();
        }, 50);
    };

    const selectItemForRow = (index: number, selectedItem: SalesOrderItemOption) => {
        setCreateForm((prev) => ({
            ...prev,
            items: prev.items.map((item, itemIndex) => {
                if (itemIndex !== index) return item;
                return {
                    ...item,
                    item_id: selectedItem.id,
                    item_sku: selectedItem.sku,
                    item_description: selectedItem.description,
                    unit_price: selectedItem.unitPrice,
                    lot_number: selectedItem.lotRequired && selectedItem.batchRequired
                        ? (item.lot_number || selectedItem.lotNumber)
                        : "",
                    batch_number: selectedItem.lotRequired && selectedItem.batchRequired
                        ? (item.batch_number || selectedItem.batchNumber)
                        : "",
                    lot_required: selectedItem.lotRequired,
                    batch_required: selectedItem.batchRequired,
                    expiry_required: selectedItem.expiryRequired,
                };
            }),
        }));
    };

    const openOrderDetails = async (orderId: string) => {
        setSelectedOrderId(orderId);
        setDetailsTab("overview");
        setDetailsOpen(true);
        setDetailsLoading(true);
        setPickingTasksLoading(true);
        setOrderDetails(null);
        setOrderPickingTasks([]);

        try {
            const details = await salesOrderService.getOrderDetails(orderId);
            const normalizedDetails = normalizeOrder(details);
            setOrderDetails(normalizedDetails);

            try {
                const pickingTasks = await pickingService.getTasksBySalesOrder(orderId);
                const normalizedTasks = (Array.isArray(pickingTasks) ? pickingTasks : []).map((task) => normalizePickingTask(task));
                setOrderPickingTasks(normalizedTasks);
                let assignedLabel = await resolveAssignmentLabelFromTasks(normalizedTasks);

                if (assignedLabel === "Unassigned") {
                    const pendingMatches = await getPendingTaskAssignmentByOrder({ id: orderId, order_number: normalizedDetails.order_number });
                    if (pendingMatches.length > 0) {
                        assignedLabel = await resolveAssignmentLabelFromTasks(pendingMatches);
                    }
                }

                setOrderAssignments((prev) => ({
                    ...prev,
                    [orderId]: resolveAssignedWorkerDisplay(normalizedDetails, assignedLabel),
                }));
            } catch {
                setOrderPickingTasks([]);
                setOrderAssignments((prev) => ({
                    ...prev,
                    [orderId]: resolveAssignedWorkerDisplay(normalizedDetails, "Unassigned"),
                }));
            }
        } catch (err) {
            const message = err instanceof Error ? err.message : "Failed to load order details.";
            toast.error(message);
            setDetailsOpen(false);
        } finally {
            setDetailsLoading(false);
            setPickingTasksLoading(false);
        }
    };

    const refreshPickingTasksForOrder = useCallback(async (orderId: string) => {
        setPickingTasksLoading(true);
        try {
            const pickingTasks = await pickingService.getTasksBySalesOrder(orderId);
            const normalizedTasks = (Array.isArray(pickingTasks) ? pickingTasks : []).map((task) => normalizePickingTask(task));
            setOrderPickingTasks(normalizedTasks);
            let assignedLabel = await resolveAssignmentLabelFromTasks(normalizedTasks);

            if (assignedLabel === "Unassigned" && orderDetails && orderDetails.id === orderId) {
                const pendingMatches = await getPendingTaskAssignmentByOrder({ id: orderId, order_number: orderDetails.order_number });
                if (pendingMatches.length > 0) {
                    assignedLabel = await resolveAssignmentLabelFromTasks(pendingMatches);
                }
            }

            setOrderAssignments((prev) => ({
                ...prev,
                [orderId]: orderDetails && orderDetails.id === orderId
                    ? resolveAssignedWorkerDisplay(orderDetails, assignedLabel)
                    : assignedLabel,
            }));
        } catch {
            setOrderPickingTasks([]);
            setOrderAssignments((prev) => ({
                ...prev,
                [orderId]: orderDetails && orderDetails.id === orderId
                    ? resolveAssignedWorkerDisplay(orderDetails, "Unassigned")
                    : "Unassigned",
            }));
        } finally {
            setPickingTasksLoading(false);
        }
    }, [orderDetails, resolveAssignmentLabelFromTasks]);

    const closeOrderDetails = () => {
        if (confirming) return;
        setDetailsOpen(false);
        setDetailsTab("overview");
        setOrderDetails(null);
        setOrderPickingTasks([]);
        setSelectedOrderId(null);
    };

    const handleConfirmOrder = async () => {
        if (!selectedOrderId) return;

        setConfirming(true);
        try {
            await salesOrderService.confirmOrder(selectedOrderId);
            toast.success("Sales order confirmed successfully.");
            setDetailsOpen(false);
            setOrderDetails(null);
            setSelectedOrderId(null);
            await loadOrders(true);
        } catch (err) {
            const message = err instanceof Error ? err.message : "Failed to confirm order.";
            toast.error(message);
        } finally {
            setConfirming(false);
        }
    };

    const submitCreateOrder = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        const requestedDelivery = toIsoString(createForm.requested_delivery_date);
        if (!requestedDelivery) {
            toast.error("Requested delivery date is required.");
            return;
        }

        const deliveryDate = new Date(requestedDelivery);
        const now = new Date();
        if (deliveryDate.getTime() < now.getTime() - 60000) {
            toast.error("Requested delivery date cannot be in the past.");
            return;
        }

        const normalizedItems = createForm.items.map((item) => ({
            item_id: item.item_id.trim(),
            item_sku: item.item_sku.trim(),
            item_description: item.item_description.trim(),
            quantity_ordered: Number(item.quantity_ordered) || 0,
            unit_price: Number(item.unit_price) || 0,
            lot_number: item.lot_number.trim(),
            batch_number: item.batch_number.trim(),
            expiry_date: toIsoString(item.expiry_date),
            expiry_required: item.expiry_required,
            notes: item.notes.trim(),
        }));

        const hasInvalidItems = normalizedItems.some(
            (item) => !item.item_id || !item.item_sku || !item.item_description || (item.expiry_required && !item.expiry_date)
        );

        if (hasInvalidItems) {
            toast.error("Each item must include item_id, item_sku, item_description, and expiry_date (when required).");
            return;
        }

        const payload: CreateSalesOrderPayload = {
            customer_id: createForm.customer_id.trim(),
            customer_name: createForm.customer_name.trim(),
            customer_email: createForm.customer_email.trim(),
            requested_delivery_date: requestedDelivery,
            priority: createForm.priority,
            notes: createForm.notes.trim(),
            warehouse_id: createForm.warehouse_id.trim(),
            items: normalizedItems.map((item) => ({
                ...item,
                expiry_date: item.expiry_date as string,
            })),
        };

        if (!payload.customer_id || !payload.customer_name || !payload.customer_email || !payload.warehouse_id) {
            toast.error("customer_id, customer_name, customer_email, and warehouse_id are required.");
            return;
        }

        setCreateSubmitting(true);
        try {
            await salesOrderService.create(payload);
            toast.success("Sales order created successfully.");
            setCreateOpen(false);
            setCreateForm(defaultCreateForm());
            await loadOrders(true);
        } catch (err: unknown) {
            const inventoryMessage = getInventoryCreateErrorMessage(err, normalizedItems);
            if (inventoryMessage) {
                toast.error(inventoryMessage);
                return;
            }

            const message = err instanceof Error ? err.message : "Failed to create sales order.";
            toast.error(message);
        } finally {
            setCreateSubmitting(false);
        }
    };

    return (
        <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto">
            <div className="flex items-center justify-between gap-4">
                <div>
                    <h1 className="font-heading text-3xl font-bold">Sales Orders</h1>
                </div>
                <div className="flex items-center gap-2">
                    <Button className="gap-2" onClick={openCreateDialog}>
                        <Plus className="h-4 w-4" />
                        Create Sales Order
                    </Button>
                    <Button
                        variant="outline"
                        className="gap-2"
                        onClick={() => void loadOrders(true)}
                        disabled={refreshing}
                    >
                        <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
                        {refreshing ? "Refreshing..." : "Refresh"}
                    </Button>
                </div>
            </div>

            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                <DialogContent className="sm:max-w-5xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Create Sales Order</DialogTitle>
                    </DialogHeader>

                    <form ref={createFormRef} onSubmit={submitCreateOrder} className="space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base">Order Header</CardTitle>
                            </CardHeader>
                            <CardContent className="grid gap-4 sm:grid-cols-2">
                                <div className="space-y-2">
                                    <Label htmlFor="customer_name">Customer Name</Label>
                                    <div className="relative">
                                        <Input
                                            id="customer_name"
                                            value={customerSearch}
                                            placeholder={customerLoading ? "Loading customers..." : "Type customer name..."}
                                            className={customerSearch.trim() ? "pr-10" : undefined}
                                            role="combobox"
                                            aria-expanded={showCustomerOptions ? "true" : "false"}
                                            onFocus={() => setShowCustomerOptions(true)}
                                            onBlur={() => window.setTimeout(() => setShowCustomerOptions(false), 120)}
                                            onKeyDown={handleCustomerKeyDown}
                                            onChange={(e) => {
                                                const value = e.target.value;
                                                setCustomerSearch(value);
                                                setShowCustomerOptions(true);
                                                setCreateForm((prev) => ({
                                                    ...prev,
                                                    customer_name: value,
                                                    customer_id: "",
                                                    customer_email: "",
                                                }));
                                            }}
                                            required
                                        />
                                        {customerSearch.trim() ? (
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                className="absolute right-1 top-1 h-8 w-8"
                                                onMouseDown={(e) => e.preventDefault()}
                                                onClick={() => void openUpdateCustomerDialog()}
                                                disabled={updateCustomerLoading}
                                                aria-label="Update customer"
                                            >
                                                <ArrowRight className="h-4 w-4" />
                                            </Button>
                                        ) : null}
                                        {showCustomerOptions && (
                                            <div className="absolute z-50 mt-1 max-h-52 w-full overflow-auto rounded-md border bg-background shadow-md">
                                                {filteredCustomerOptions.length === 0 ? (
                                                    <div className="px-3 py-2 space-y-2">
                                                        <p className="text-sm text-muted-foreground">No customer found.</p>
                                                        <Button
                                                            type="button"
                                                            size="sm"
                                                            className="w-full"
                                                            onMouseDown={() => {
                                                                setCreateCustomerForm((prev) => ({
                                                                    ...prev,
                                                                    name: customerSearch.trim(),
                                                                }));
                                                                setCreateCustomerOpen(true);
                                                            }}
                                                        >
                                                            Create New Customer
                                                        </Button>
                                                    </div>
                                                ) : (
                                                    filteredCustomerOptions.map((customer, index) => (
                                                        <button
                                                            key={customer.id}
                                                            type="button"
                                                            className={cn(
                                                                "w-full px-3 py-2 text-left text-sm transition-colors",
                                                                index === activeCustomerIndex
                                                                    ? "bg-primary/10 text-foreground font-medium"
                                                                    : "hover:bg-primary/10 hover:text-foreground"
                                                            )}
                                                            onMouseDown={() => selectCustomer(customer)}
                                                        >
                                                            <div className="font-medium">{customer.name}</div>
                                                            {customer.email ? (
                                                                <div className="text-xs text-muted-foreground">{customer.email}</div>
                                                            ) : null}
                                                        </button>
                                                    ))
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="customer_email">Customer Email</Label>
                                    <Input
                                        id="customer_email"
                                        type="email"
                                        value={createForm.customer_email}
                                        onChange={(e) => updateCreateForm("customer_email", e.target.value)}
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="warehouse_id">Warehouse ID</Label>
                                    <div className="relative">
                                        <Input
                                            id="warehouse_id"
                                            value={warehouseSearch}
                                            placeholder={warehouseLoading ? "Loading warehouses..." : "Type warehouse code..."}
                                            role="combobox"
                                            aria-expanded={showWarehouseOptions ? "true" : "false"}
                                            onFocus={() => setShowWarehouseOptions(true)}
                                            onBlur={() => window.setTimeout(() => setShowWarehouseOptions(false), 120)}
                                            onKeyDown={handleWarehouseKeyDown}
                                            onChange={(e) => {
                                                setWarehouseSearch(e.target.value);
                                                setShowWarehouseOptions(true);
                                                updateCreateForm("warehouse_id", "");
                                                setItemOptions([]);
                                            }}
                                            required
                                        />
                                        {showWarehouseOptions && (
                                            <div className="absolute z-50 mt-1 max-h-52 w-full overflow-auto rounded-md border bg-background shadow-md">
                                                {filteredWarehouseOptions.length === 0 ? (
                                                    <p className="px-3 py-2 text-sm text-muted-foreground">No warehouse found.</p>
                                                ) : (
                                                    filteredWarehouseOptions.map((warehouse, index) => (
                                                        <button
                                                            key={warehouse.id}
                                                            type="button"
                                                            className={cn(
                                                                "w-full px-3 py-2 text-left text-sm transition-colors",
                                                                index === activeWarehouseIndex
                                                                    ? "bg-primary/10 text-foreground font-medium"
                                                                    : "hover:bg-primary/10 hover:text-foreground"
                                                            )}
                                                            onMouseDown={() => selectWarehouse(warehouse)}
                                                        >
                                                            <div className="font-medium">{warehouse.code}</div>
                                                            {warehouse.name ? (
                                                                <div className="text-xs text-muted-foreground">{warehouse.name}</div>
                                                            ) : null}
                                                        </button>
                                                    ))
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="requested_delivery_date">Requested Delivery Date</Label>
                                    <Input
                                        id="requested_delivery_date"
                                        type="datetime-local"
                                        value={createForm.requested_delivery_date}
                                        onChange={(e) => updateCreateForm("requested_delivery_date", e.target.value)}
                                        onKeyDown={handleRequestedDeliveryDateKeyDown}
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="priority">Priority</Label>
                                    <Select
                                        value={createForm.priority}
                                        onValueChange={(value) => updateCreateForm("priority", value as "HIGH" | "MEDIUM" | "LOW")}
                                        required
                                    >
                                        <SelectTrigger id="priority" className="w-full" onKeyDown={handlePriorityKeyDown}>
                                            <SelectValue placeholder="Select priority" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="HIGH">HIGH</SelectItem>
                                            <SelectItem value="MEDIUM">MEDIUM</SelectItem>
                                            <SelectItem value="LOW">LOW</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2 sm:col-span-2">
                                    <Label htmlFor="order_notes">Notes</Label>
                                    <Textarea
                                        id="order_notes"
                                        value={createForm.notes}
                                        onChange={(e) => updateCreateForm("notes", e.target.value)}
                                        onKeyDown={handleNotesKeyDown}
                                        rows={3}
                                    />
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0">
                                <CardTitle className="text-base">Items</CardTitle>
                                <Button type="button" variant="outline" className="gap-2" onClick={addCreateItem}>
                                    <Plus className="h-4 w-4" />
                                    Add Item
                                </Button>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {createForm.items.map((item, index) => (
                                    <div key={`create-item-${index}`} className="rounded-lg border border-border p-4 space-y-4">
                                        <div className="flex items-center justify-between">
                                            <p className="text-sm font-semibold">Item {index + 1}</p>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                className="text-destructive gap-1"
                                                onClick={() => removeCreateItem(index)}
                                                disabled={createForm.items.length <= 1}
                                            >
                                                <Trash2 className="h-4 w-4" /> Remove
                                            </Button>
                                        </div>

                                        <div className="grid gap-4 sm:grid-cols-2">
                                            <div className="space-y-2">
                                                <Label htmlFor={`item_sku_${index}`}>Item SKU</Label>
                                                <Popover
                                                    open={openItemSkuIndex === index}
                                                    onOpenChange={(open) => setOpenItemSkuIndex(open ? index : null)}
                                                >
                                                    <PopoverTrigger asChild>
                                                        <Button
                                                            id={`item_sku_${index}`}
                                                            type="button"
                                                            variant="outline"
                                                            role="combobox"
                                                            aria-expanded={openItemSkuIndex === index}
                                                            className="w-full justify-between font-normal"
                                                        >
                                                            {item.item_sku || (itemsLoading ? "Loading SKUs..." : "Search item SKU...")}
                                                            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                        </Button>
                                                    </PopoverTrigger>
                                                    <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                                                        <Command>
                                                            <CommandInput placeholder="Type SKU..." />
                                                            <CommandList>
                                                                <CommandEmpty>
                                                                    {!createForm.warehouse_id.trim()
                                                                        ? "Select warehouse in Order Header first."
                                                                        : itemsLoading
                                                                            ? "Loading items..."
                                                                            : "No SKU found."}
                                                                </CommandEmpty>
                                                                <CommandGroup>
                                                                    {itemOptions.map((option) => (
                                                                        <CommandItem
                                                                            key={option.id}
                                                                            value={`${option.sku} ${option.description} ${option.id}`}
                                                                            onSelect={() => {
                                                                                selectItemForRow(index, option);
                                                                                setOpenItemSkuIndex(null);
                                                                            }}
                                                                        >
                                                                            <Check
                                                                                className={cn(
                                                                                    "mr-2 h-4 w-4",
                                                                                    item.item_sku === option.sku ? "opacity-100" : "opacity-0"
                                                                                )}
                                                                            />
                                                                            <div className="flex flex-col">
                                                                                <span>{option.sku}</span>
                                                                                {option.description ? (
                                                                                    <span className="text-xs text-muted-foreground">{option.description}</span>
                                                                                ) : null}
                                                                            </div>
                                                                        </CommandItem>
                                                                    ))}
                                                                </CommandGroup>
                                                            </CommandList>
                                                        </Command>
                                                        <div className="border-t p-2">
                                                            <Button
                                                                type="button"
                                                                variant="ghost"
                                                                size="sm"
                                                                className="w-full justify-start gap-2"
                                                                onClick={() => void loadItems(createForm.warehouse_id)}
                                                                disabled={itemsLoading || !createForm.warehouse_id.trim()}
                                                            >
                                                                <RefreshCw className={`h-3.5 w-3.5 ${itemsLoading ? "animate-spin" : ""}`} />
                                                                Refresh items
                                                            </Button>
                                                        </div>
                                                    </PopoverContent>
                                                </Popover>
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor={`item_id_${index}`}>Item ID</Label>
                                                <Input
                                                    id={`item_id_${index}`}
                                                    value={item.item_id}
                                                    onChange={(e) => updateCreateItem(index, "item_id", e.target.value)}
                                                    required
                                                />
                                            </div>
                                            <div className="space-y-2 sm:col-span-2">
                                                <Label htmlFor={`item_description_${index}`}>Item Description</Label>
                                                <Input
                                                    id={`item_description_${index}`}
                                                    value={item.item_description}
                                                    onChange={(e) => updateCreateItem(index, "item_description", e.target.value)}
                                                    required
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor={`quantity_ordered_${index}`}>Quantity Ordered</Label>
                                                <Input
                                                    id={`quantity_ordered_${index}`}
                                                    type="number"
                                                    min={0}
                                                    value={item.quantity_ordered}
                                                    onChange={(e) => updateCreateItem(index, "quantity_ordered", Number(e.target.value || 0))}
                                                    required
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor={`unit_price_${index}`}>Unit Price</Label>
                                                <Input
                                                    id={`unit_price_${index}`}
                                                    type="number"
                                                    min={0}
                                                    step="0.01"
                                                    value={item.unit_price}
                                                    onChange={(e) => updateCreateItem(index, "unit_price", Number(e.target.value || 0))}
                                                    required
                                                />
                                            </div>
                                            {item.lot_required && item.batch_required && (
                                                <>
                                                    <div className="space-y-2">
                                                        <Label htmlFor={`lot_number_${index}`}>Lot Number</Label>
                                                        <Input
                                                            id={`lot_number_${index}`}
                                                            value={item.lot_number}
                                                            onChange={(e) => updateCreateItem(index, "lot_number", e.target.value)}
                                                        />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label htmlFor={`batch_number_${index}`}>Batch Number</Label>
                                                        <Input
                                                            id={`batch_number_${index}`}
                                                            value={item.batch_number}
                                                            onChange={(e) => updateCreateItem(index, "batch_number", e.target.value)}
                                                        />
                                                    </div>
                                                </>
                                            )}
                                            {item.expiry_required && (
                                                <div className="space-y-2">
                                                    <Label htmlFor={`expiry_date_${index}`}>Expiry Date</Label>
                                                    <Input
                                                        id={`expiry_date_${index}`}
                                                        type="datetime-local"
                                                        value={item.expiry_date}
                                                        onChange={(e) => updateCreateItem(index, "expiry_date", e.target.value)}
                                                        required
                                                    />
                                                </div>
                                            )}
                                            <div className="space-y-2 sm:col-span-2">
                                                <Label htmlFor={`item_notes_${index}`}>Item Notes</Label>
                                                <Textarea
                                                    id={`item_notes_${index}`}
                                                    value={item.notes}
                                                    onChange={(e) => updateCreateItem(index, "notes", e.target.value)}
                                                    rows={2}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </CardContent>
                        </Card>

                        <div className="flex items-center justify-end gap-2">
                            <Button type="button" variant="outline" onClick={closeCreateDialog} disabled={createSubmitting}>
                                Cancel
                            </Button>
                            <Button type="submit" disabled={createSubmitting}>
                                {createSubmitting ? "Creating..." : "Create Sales Order"}
                            </Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>

            <Dialog open={createCustomerOpen} onOpenChange={setCreateCustomerOpen}>
                <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Create New Customer</DialogTitle>
                    </DialogHeader>

                    <form onSubmit={submitCreateCustomer} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1"><Label htmlFor="customer_code">Code</Label><Input id="customer_code" value={createCustomerForm.code} onChange={(e) => setCreateCustomerForm((p) => ({ ...p, code: e.target.value }))} required /></div>
                            <div className="space-y-1"><Label htmlFor="customer_name_new">Name</Label><Input id="customer_name_new" value={createCustomerForm.name} onChange={(e) => setCreateCustomerForm((p) => ({ ...p, name: e.target.value }))} required /></div>
                            <div className="space-y-1"><Label htmlFor="customer_email_new">Email</Label><Input id="customer_email_new" type="email" value={createCustomerForm.email} onChange={(e) => setCreateCustomerForm((p) => ({ ...p, email: e.target.value }))} required /></div>
                            <div className="space-y-1"><Label htmlFor="customer_phone">Phone</Label><PhoneInput id="customer_phone" value={createCustomerForm.phone} countryCode={createCustomerForm.phone_country_code} onPhoneChange={(v) => setCreateCustomerForm(p => ({ ...p, phone: v }))} onCountryCodeChange={(c) => setCreateCustomerForm(p => ({ ...p, phone_country_code: c }))} /></div>
                            <div className="space-y-1"><Label htmlFor="customer_mobile">Mobile</Label><PhoneInput id="customer_mobile" value={createCustomerForm.mobile} countryCode={createCustomerForm.mobile_country_code} onPhoneChange={(v) => setCreateCustomerForm(p => ({ ...p, mobile: v }))} onCountryCodeChange={(c) => setCreateCustomerForm(p => ({ ...p, mobile_country_code: c }))} /></div>
                            <div className="space-y-1"><Label htmlFor="customer_address1">Address Line 1</Label><Input id="customer_address1" value={createCustomerForm.address_line1} onChange={(e) => setCreateCustomerForm((p) => ({ ...p, address_line1: e.target.value }))} /></div>
                            <div className="space-y-1"><Label htmlFor="customer_address2">Address Line 2</Label><Input id="customer_address2" value={createCustomerForm.address_line2} onChange={(e) => setCreateCustomerForm((p) => ({ ...p, address_line2: e.target.value }))} /></div>
                            <div className="space-y-1"><Label htmlFor="customer_city">City</Label><Input id="customer_city" value={createCustomerForm.city} onChange={(e) => setCreateCustomerForm((p) => ({ ...p, city: e.target.value }))} /></div>
                            <div className="space-y-1"><Label htmlFor="customer_state">State</Label><Input id="customer_state" value={createCustomerForm.state} onChange={(e) => setCreateCustomerForm((p) => ({ ...p, state: e.target.value }))} /></div>
                            <div className="space-y-1"><Label htmlFor="customer_country">Country</Label><Input id="customer_country" value={createCustomerForm.country} onChange={(e) => setCreateCustomerForm((p) => ({ ...p, country: e.target.value }))} /></div>
                            <div className="space-y-1"><Label htmlFor="customer_pincode">Pincode</Label><Input id="customer_pincode" value={createCustomerForm.pincode} onChange={(e) => setCreateCustomerForm((p) => ({ ...p, pincode: e.target.value }))} /></div>
                            <div className="space-y-1"><Label htmlFor="customer_gstin">GSTIN</Label><Input id="customer_gstin" value={createCustomerForm.gstin} onChange={(e) => setCreateCustomerForm((p) => ({ ...p, gstin: e.target.value }))} /></div>
                            <div className="space-y-1"><Label htmlFor="customer_pan">PAN</Label><Input id="customer_pan" value={createCustomerForm.pan} onChange={(e) => setCreateCustomerForm((p) => ({ ...p, pan: e.target.value }))} /></div>
                            <div className="space-y-1"><Label htmlFor="customer_tax_type">Tax Type</Label><Input id="customer_tax_type" value={createCustomerForm.tax_type} onChange={(e) => setCreateCustomerForm((p) => ({ ...p, tax_type: e.target.value }))} /></div>
                            <div className="space-y-1"><Label htmlFor="contact_person_name">Contact Person Name</Label><Input id="contact_person_name" value={createCustomerForm.contact_person_name} onChange={(e) => setCreateCustomerForm((p) => ({ ...p, contact_person_name: e.target.value }))} /></div>
                            <div className="space-y-1"><Label htmlFor="contact_person_phone">Contact Person Phone</Label><PhoneInput id="contact_person_phone" value={createCustomerForm.contact_person_phone} countryCode={createCustomerForm.contact_person_country_code} onPhoneChange={(v) => setCreateCustomerForm(p => ({ ...p, contact_person_phone: v }))} onCountryCodeChange={(c) => setCreateCustomerForm(p => ({ ...p, contact_person_country_code: c }))} /></div>
                            <div className="space-y-1"><Label htmlFor="contact_person_email">Contact Person Email</Label><Input id="contact_person_email" type="email" value={createCustomerForm.contact_person_email} onChange={(e) => setCreateCustomerForm((p) => ({ ...p, contact_person_email: e.target.value }))} /></div>
                            <div className="space-y-1"><Label htmlFor="business_type">Business Type</Label><Input id="business_type" value={createCustomerForm.business_type} onChange={(e) => setCreateCustomerForm((p) => ({ ...p, business_type: e.target.value }))} /></div>
                            <div className="space-y-1"><Label htmlFor="payment_terms">Payment Terms</Label><Input id="payment_terms" value={createCustomerForm.payment_terms} onChange={(e) => setCreateCustomerForm((p) => ({ ...p, payment_terms: e.target.value }))} /></div>
                            <div className="space-y-1"><Label htmlFor="credit_limit">Credit Limit</Label><Input id="credit_limit" type="number" min={0} value={createCustomerForm.credit_limit} onChange={(e) => setCreateCustomerForm((p) => ({ ...p, credit_limit: e.target.value }))} /></div>
                            <div className="space-y-1"><Label htmlFor="default_warehouse_id">Default Warehouse ID</Label><Input id="default_warehouse_id" value={createCustomerForm.default_warehouse_id} onChange={(e) => setCreateCustomerForm((p) => ({ ...p, default_warehouse_id: e.target.value }))} /></div>
                            <div className="space-y-1"><Label htmlFor="default_shipping_method">Default Shipping Method</Label><Input id="default_shipping_method" value={createCustomerForm.default_shipping_method} onChange={(e) => setCreateCustomerForm((p) => ({ ...p, default_shipping_method: e.target.value }))} /></div>
                            <div className="space-y-1"><Label htmlFor="customer_notes">Notes</Label><Input id="customer_notes" value={createCustomerForm.notes} onChange={(e) => setCreateCustomerForm((p) => ({ ...p, notes: e.target.value }))} /></div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={createCustomerForm.is_active} onChange={(e) => setCreateCustomerForm((p) => ({ ...p, is_active: e.target.checked }))} /> Is Active</label>
                            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={createCustomerForm.is_verified} onChange={(e) => setCreateCustomerForm((p) => ({ ...p, is_verified: e.target.checked }))} /> Is Verified</label>
                        </div>

                        <div className="flex justify-end gap-2">
                            <Button type="button" variant="outline" onClick={() => setCreateCustomerOpen(false)} disabled={createCustomerSubmitting}>Cancel</Button>
                            <Button type="submit" disabled={createCustomerSubmitting}>{createCustomerSubmitting ? "Creating..." : "Create Customer"}</Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>

            <Dialog open={updateCustomerOpen} onOpenChange={setUpdateCustomerOpen}>
                <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Update Customers</DialogTitle>
                    </DialogHeader>

                    <form onSubmit={submitUpdateCustomer} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1"><Label htmlFor="update_customer_code">Code</Label><Input id="update_customer_code" value={updateCustomerForm.code} onChange={(e) => setUpdateCustomerForm((p) => ({ ...p, code: e.target.value }))} required /></div>
                            <div className="space-y-1"><Label htmlFor="update_customer_name">Name</Label><Input id="update_customer_name" value={updateCustomerForm.name} onChange={(e) => setUpdateCustomerForm((p) => ({ ...p, name: e.target.value }))} required /></div>
                            <div className="space-y-1"><Label htmlFor="update_customer_email">Email</Label><Input id="update_customer_email" type="email" value={updateCustomerForm.email} onChange={(e) => setUpdateCustomerForm((p) => ({ ...p, email: e.target.value }))} required /></div>
                            <div className="space-y-1"><Label htmlFor="update_customer_phone">Phone</Label><PhoneInput id="update_customer_phone" value={updateCustomerForm.phone} countryCode={updateCustomerForm.phone_country_code} onPhoneChange={(v) => setUpdateCustomerForm(p => ({ ...p, phone: v }))} onCountryCodeChange={(c) => setUpdateCustomerForm(p => ({ ...p, phone_country_code: c }))} /></div>
                            <div className="space-y-1"><Label htmlFor="update_customer_mobile">Mobile</Label><PhoneInput id="update_customer_mobile" value={updateCustomerForm.mobile} countryCode={updateCustomerForm.mobile_country_code} onPhoneChange={(v) => setUpdateCustomerForm(p => ({ ...p, mobile: v }))} onCountryCodeChange={(c) => setUpdateCustomerForm(p => ({ ...p, mobile_country_code: c }))} /></div>
                            <div className="space-y-1"><Label htmlFor="update_customer_address1">Address Line 1</Label><Input id="update_customer_address1" value={updateCustomerForm.address_line1} onChange={(e) => setUpdateCustomerForm((p) => ({ ...p, address_line1: e.target.value }))} /></div>
                            <div className="space-y-1"><Label htmlFor="update_customer_address2">Address Line 2</Label><Input id="update_customer_address2" value={updateCustomerForm.address_line2} onChange={(e) => setUpdateCustomerForm((p) => ({ ...p, address_line2: e.target.value }))} /></div>
                            <div className="space-y-1"><Label htmlFor="update_customer_city">City</Label><Input id="update_customer_city" value={updateCustomerForm.city} onChange={(e) => setUpdateCustomerForm((p) => ({ ...p, city: e.target.value }))} /></div>
                            <div className="space-y-1"><Label htmlFor="update_customer_state">State</Label><Input id="update_customer_state" value={updateCustomerForm.state} onChange={(e) => setUpdateCustomerForm((p) => ({ ...p, state: e.target.value }))} /></div>
                            <div className="space-y-1"><Label htmlFor="update_customer_country">Country</Label><Input id="update_customer_country" value={updateCustomerForm.country} onChange={(e) => setUpdateCustomerForm((p) => ({ ...p, country: e.target.value }))} /></div>
                            <div className="space-y-1"><Label htmlFor="update_customer_pincode">Pincode</Label><Input id="update_customer_pincode" value={updateCustomerForm.pincode} onChange={(e) => setUpdateCustomerForm((p) => ({ ...p, pincode: e.target.value }))} /></div>
                            <div className="space-y-1"><Label htmlFor="update_customer_gstin">GSTIN</Label><Input id="update_customer_gstin" value={updateCustomerForm.gstin} onChange={(e) => setUpdateCustomerForm((p) => ({ ...p, gstin: e.target.value }))} /></div>
                            <div className="space-y-1"><Label htmlFor="update_customer_pan">PAN</Label><Input id="update_customer_pan" value={updateCustomerForm.pan} onChange={(e) => setUpdateCustomerForm((p) => ({ ...p, pan: e.target.value }))} /></div>
                            <div className="space-y-1"><Label htmlFor="update_customer_tax_type">Tax Type</Label><Input id="update_customer_tax_type" value={updateCustomerForm.tax_type} onChange={(e) => setUpdateCustomerForm((p) => ({ ...p, tax_type: e.target.value }))} /></div>
                            <div className="space-y-1"><Label htmlFor="update_contact_person_name">Contact Person Name</Label><Input id="update_contact_person_name" value={updateCustomerForm.contact_person_name} onChange={(e) => setUpdateCustomerForm((p) => ({ ...p, contact_person_name: e.target.value }))} /></div>
                            <div className="space-y-1"><Label htmlFor="update_contact_person_phone">Contact Person Phone</Label><PhoneInput id="update_contact_person_phone" value={updateCustomerForm.contact_person_phone} countryCode={updateCustomerForm.contact_person_country_code} onPhoneChange={(v) => setUpdateCustomerForm(p => ({ ...p, contact_person_phone: v }))} onCountryCodeChange={(c) => setUpdateCustomerForm(p => ({ ...p, contact_person_country_code: c }))} /></div>
                            <div className="space-y-1"><Label htmlFor="update_contact_person_email">Contact Person Email</Label><Input id="update_contact_person_email" type="email" value={updateCustomerForm.contact_person_email} onChange={(e) => setUpdateCustomerForm((p) => ({ ...p, contact_person_email: e.target.value }))} /></div>
                            <div className="space-y-1"><Label htmlFor="update_business_type">Business Type</Label><Input id="update_business_type" value={updateCustomerForm.business_type} onChange={(e) => setUpdateCustomerForm((p) => ({ ...p, business_type: e.target.value }))} /></div>
                            <div className="space-y-1"><Label htmlFor="update_payment_terms">Payment Terms</Label><Input id="update_payment_terms" value={updateCustomerForm.payment_terms} onChange={(e) => setUpdateCustomerForm((p) => ({ ...p, payment_terms: e.target.value }))} /></div>
                            <div className="space-y-1"><Label htmlFor="update_credit_limit">Credit Limit</Label><Input id="update_credit_limit" type="number" min={0} value={updateCustomerForm.credit_limit} onChange={(e) => setUpdateCustomerForm((p) => ({ ...p, credit_limit: e.target.value }))} /></div>
                            <div className="space-y-1"><Label htmlFor="update_default_shipping_method">Default Shipping Method</Label><Input id="update_default_shipping_method" value={updateCustomerForm.default_shipping_method} onChange={(e) => setUpdateCustomerForm((p) => ({ ...p, default_shipping_method: e.target.value }))} /></div>
                            <div className="space-y-1 md:col-span-2"><Label htmlFor="update_customer_notes">Notes</Label><Input id="update_customer_notes" value={updateCustomerForm.notes} onChange={(e) => setUpdateCustomerForm((p) => ({ ...p, notes: e.target.value }))} /></div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={updateCustomerForm.is_active} onChange={(e) => setUpdateCustomerForm((p) => ({ ...p, is_active: e.target.checked }))} /> Is Active</label>
                            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={updateCustomerForm.is_verified} onChange={(e) => setUpdateCustomerForm((p) => ({ ...p, is_verified: e.target.checked }))} /> Is Verified</label>
                        </div>

                        <div className="flex justify-end gap-2">
                            <Button type="button" variant="outline" onClick={() => setUpdateCustomerOpen(false)} disabled={updateCustomerSubmitting}>Cancel</Button>
                            <Button type="submit" disabled={updateCustomerSubmitting}>{updateCustomerSubmitting ? "Updating..." : "Update Customer"}</Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>

            <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
                <DialogContent className="flex max-h-[92vh] w-[95vw] flex-col overflow-hidden border-border/60 p-0 shadow-2xl sm:max-w-5xl xl:max-w-6xl">
                    <DialogHeader className="border-b border-border/60 px-4 py-3">
                        <DialogTitle className="text-base font-semibold">
                            {detailsLoading ? "Loading Order Details..." : `Sales Order: ${orderDetails?.order_number}`}
                        </DialogTitle>
                    </DialogHeader>

                    <div className="flex-1 overflow-y-auto overscroll-contain">
                        {detailsLoading ? (
                            <div className="flex items-center gap-3 px-5 py-8">
                                <span className="h-4 w-4 rounded-full border-2 border-border border-t-primary animate-spin" />
                                <p className="text-sm text-muted-foreground">Loading order details...</p>
                            </div>
                        ) : orderDetails ? (
                            <div className="space-y-0 bg-gradient-to-b from-background to-muted/20">
                                <div className="border-b border-border/60 px-4 py-4">
                                    <div className="flex flex-wrap items-start justify-between gap-4">
                                        <div>
                                            <p className="text-3xl font-semibold leading-tight">Sales Order: {orderDetails.order_number}</p>
                                            <p className="mt-1 text-sm text-muted-foreground">
                                                Order ID: {orderDetails.id} • Created {formatDateTime(orderDetails.created_at)} by {orderDetails.created_by_name}
                                            </p>
                                        </div>

                                        <div className="flex flex-wrap gap-2">
                                            <Button variant="outline" onClick={() => window.print()}>
                                                Print slip <ArrowUpRight className="ml-1 h-4 w-4" />
                                            </Button>
                                            <Button onClick={() => void handleConfirmOrder()} disabled={confirming || orderDetails.status.toLowerCase() === "confirmed"}>
                                                {confirming ? "Shipping..." : "Ship order"} <ArrowUpRight className="ml-1 h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>

                                    <div className="mt-6">
                                        <div className="h-1 w-full rounded-full bg-border/60">
                                            <div
                                                className="h-1 rounded-full bg-emerald-500 transition-all"
                                                style={{
                                                    width: `${Math.max(20, [
                                                        String(orderDetails.workflow_status?.allocation ?? "PENDING"),
                                                        String(orderDetails.workflow_status?.picking ?? "PENDING"),
                                                        String(orderDetails.workflow_status?.packing ?? "PENDING"),
                                                        String(orderDetails.workflow_status?.shipping ?? "PENDING"),
                                                    ].filter((entry) => isDoneState(entry)).length * 25)}%`,
                                                }}
                                            />
                                        </div>
                                        <div className="mt-3 grid grid-cols-5 gap-2">
                                            {[
                                                { label: "Ordered", status: "COMPLETED" },
                                                { label: "Allocated", status: String(orderDetails.workflow_status?.allocation ?? "PENDING") },
                                                { label: "Picked", status: String(orderDetails.workflow_status?.picking ?? "PENDING") },
                                                { label: "Packed", status: String(orderDetails.workflow_status?.packing ?? "PENDING") },
                                                { label: "Shipping", status: String(orderDetails.workflow_status?.shipping ?? "PENDING") },
                                            ].map((step) => {
                                                const done = isDoneState(step.status);
                                                const progress = isInProgressState(step.status);

                                                return (
                                                    <div key={step.label} className="flex flex-col items-center gap-1 text-center">
                                                        <span className={cn("inline-flex h-7 w-7 items-center justify-center rounded-full border", done ? "border-emerald-500/50 bg-emerald-600/25 text-emerald-300" : progress ? "border-blue-500/50 bg-blue-600/25 text-blue-300" : "border-muted-foreground/40 bg-muted text-muted-foreground")}>
                                                            {done ? <CheckCircle2 className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
                                                        </span>
                                                        <span className={cn("text-sm font-medium", done ? "text-emerald-300" : progress ? "text-blue-300" : "text-muted-foreground")}>{step.label}</span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3 border-b border-border/60 px-4 py-4 md:grid-cols-4">
                                    <div className="rounded-2xl border border-border/70 bg-card p-4">
                                        <p className="text-xs font-medium text-muted-foreground">Total items</p>
                                        <p className="mt-1 text-4xl font-semibold">{orderDetails.total_items}</p>
                                    </div>
                                    <div className="rounded-2xl border border-border/70 bg-card p-4">
                                        <p className="text-xs font-medium text-muted-foreground">Total quantity</p>
                                        <p className="mt-1 text-4xl font-semibold">{formatBigNumeric(orderDetails.total_quantity)}</p>
                                    </div>
                                    <div className="rounded-2xl border border-border/70 bg-card p-4">
                                        <p className="text-xs font-medium text-muted-foreground">Total value</p>
                                        <p className="mt-1 text-4xl font-semibold">₹{formatBigNumeric(orderDetails.total_value)}</p>
                                    </div>
                                    <div className="rounded-2xl border border-border/70 bg-card p-4">
                                        <p className="text-xs font-medium text-muted-foreground">Short qty</p>
                                        <p className="mt-1 text-4xl font-semibold text-amber-400">{formatBigNumeric(orderDetails.inventory_summary?.short_qty)}</p>
                                    </div>
                                </div>

                                <div className="border-b border-border/60 px-4 py-3">
                                    <div className="flex flex-wrap gap-2">
                                        <Button
                                            type="button"
                                            variant="outline"
                                            className={cn("rounded-xl", detailsTab === "overview" && "bg-primary/10 text-primary border-primary/40")}
                                            onClick={() => setDetailsTab("overview")}
                                        >
                                            Overview
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            className={cn("rounded-xl", detailsTab === "items" && "bg-primary/10 text-primary border-primary/40")}
                                            onClick={() => setDetailsTab("items")}
                                        >
                                            Items & Inventory
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            className={cn("rounded-xl", detailsTab === "timeline" && "bg-primary/10 text-primary border-primary/40")}
                                            onClick={() => setDetailsTab("timeline")}
                                        >
                                            Timeline
                                        </Button>
                                    </div>
                                </div>

                                {detailsTab === "overview" && (
                                    <div className="grid grid-cols-1 gap-4 px-4 py-4 md:grid-cols-2">
                                        <Card className="border-border/70 shadow-sm">
                                            <CardHeader><CardTitle>Order details</CardTitle></CardHeader>
                                            <CardContent className="space-y-3 text-sm">
                                                <div><p className="text-muted-foreground">Order number</p><p className="font-semibold">{orderDetails.order_number}</p></div>
                                                <div><p className="text-muted-foreground">Priority</p><Badge className={workflowPillClass(orderDetails.priority)}>{orderDetails.priority}</Badge></div>
                                                <div><p className="text-muted-foreground">Status</p><Badge className={workflowPillClass(orderDetails.status)}>{orderDetails.status}</Badge></div>
                                            </CardContent>
                                        </Card>

                                        <Card className="border-border/70 shadow-sm">
                                            <CardHeader><CardTitle>Warehouse & customer</CardTitle></CardHeader>
                                            <CardContent className="space-y-3 text-sm">
                                                <div><p className="text-muted-foreground">Warehouse</p><p className="font-semibold">{getRecordText(orderDetails.warehouse ?? null, ["warehouse_name"], "-")}</p></div>
                                                <div><p className="text-muted-foreground">Customer</p><p className="font-semibold">{getRecordText(orderDetails.customer ?? null, ["customer_name"], "-")}</p></div>
                                                <div><p className="text-muted-foreground">Email</p><p className="font-semibold text-blue-400 break-all">{getRecordText(orderDetails.customer ?? null, ["customer_email"], "-")}</p></div>
                                            </CardContent>
                                        </Card>

                                        <Card className="border-border/70 shadow-sm md:col-span-2">
                                            <CardHeader><CardTitle>Packing & shipment</CardTitle></CardHeader>
                                            <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
                                                <div className="space-y-3">
                                                    <div><p className="text-muted-foreground">Packing status</p><div className="mt-1 flex items-center gap-2"><Badge className={workflowPillClass(String(orderDetails.packing?.status ?? "PENDING"))}>{String(orderDetails.packing?.status ?? "PENDING")}</Badge><span className="font-semibold">{getRecordText(orderDetails.packing ?? null, ["packed_by"], "Unassigned")}</span></div></div>
                                                    <div><p className="text-muted-foreground">Shipment status</p><div className="mt-1 flex items-center gap-2"><Badge className={workflowPillClass(String(orderDetails.shipment?.status ?? "NOT_SHIPPED"))}>{String(orderDetails.shipment?.status ?? "NOT_SHIPPED")}</Badge><span className="font-semibold">{getRecordText(orderDetails.shipment ?? null, ["carrier"], "No carrier")}</span></div></div>
                                                </div>
                                                <div className="space-y-3">
                                                    <div><p className="text-muted-foreground">Packed at</p><p className="font-semibold">{formatDateTime(orderDetails.packing?.packed_at ?? orderDetails.packed_at)}</p></div>
                                                    <div><p className="text-muted-foreground">Tracking</p><p className="font-semibold">{getRecordText(orderDetails.shipment ?? null, ["tracking_number"], "-")}</p></div>
                                                </div>
                                            </CardContent>
                                        </Card>

                                        <Card className="border-border/70 shadow-sm md:col-span-2">
                                            <CardHeader><CardTitle>Workflow progress</CardTitle></CardHeader>
                                            <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
                                                <div><p className="text-muted-foreground">Allocation</p><Badge className={workflowPillClass(String(orderDetails.workflow_status?.allocation ?? "PENDING"))}>{String(orderDetails.workflow_status?.allocation ?? "PENDING")}</Badge></div>
                                                <div><p className="text-muted-foreground">Picking</p><Badge className={workflowPillClass(String(orderDetails.workflow_status?.picking ?? "PENDING"))}>{String(orderDetails.workflow_status?.picking ?? "PENDING")}</Badge></div>
                                                <div><p className="text-muted-foreground">Packing</p><Badge className={workflowPillClass(String(orderDetails.workflow_status?.packing ?? "PENDING"))}>{String(orderDetails.workflow_status?.packing ?? "PENDING")}</Badge></div>
                                                <div><p className="text-muted-foreground">Shipping</p><Badge className={workflowPillClass(String(orderDetails.workflow_status?.shipping ?? "PENDING"))}>{String(orderDetails.workflow_status?.shipping ?? "PENDING")}</Badge></div>
                                            </CardContent>
                                        </Card>
                                    </div>
                                )}

                                {detailsTab === "items" && (
                                    <div className="grid grid-cols-1 gap-4 px-4 py-4 xl:grid-cols-2">
                                        <Card className="border-border/70 shadow-sm xl:col-span-2">
                                            <CardHeader><CardTitle>Items</CardTitle></CardHeader>
                                            <CardContent className="space-y-4">
                                                {getRecordArray(orderDetails.items).length ? getRecordArray(orderDetails.items).map((item, index) => {
                                                    const quantity = isRecord(item.quantity) ? item.quantity : null;
                                                    const pricing = isRecord(item.pricing) ? item.pricing : null;
                                                    const tracking = isRecord(item.tracking) ? item.tracking : null;
                                                    const status = isRecord(item.status) ? item.status : null;
                                                    return (
                                                        <div key={`${String(item.item_id ?? item.sku ?? index)}-${index}`} className="rounded-2xl border border-border/70 bg-muted/20 p-4">
                                                            <div className="flex flex-wrap items-start justify-between gap-3">
                                                                <div>
                                                                    <p className="text-lg font-semibold">{getRecordText(item, ["sku"], `Item ${index + 1}`)}</p>
                                                                    <p className="text-sm text-muted-foreground">{getRecordText(item, ["description"], "No description")}</p>
                                                                </div>
                                                                <div className="flex flex-wrap items-center gap-2">
                                                                    <Badge variant="outline">Ordered {getRecordText(quantity, ["ordered"], "-")}</Badge>
                                                                    <Badge variant="outline">Allocated {getRecordText(quantity, ["allocated"], "-")}</Badge>
                                                                    <Badge variant="outline">Picked {getRecordText(quantity, ["picked"], "-")}</Badge>
                                                                    <Badge variant="outline">Packed {getRecordText(quantity, ["packed"], "-")}</Badge>
                                                                    <Badge variant="outline">Shipped {getRecordText(quantity, ["shipped"], "-")}</Badge>
                                                                </div>
                                                            </div>
                                                            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                                                                <div><p className="text-xs text-muted-foreground">Unit price</p><p className="font-semibold">₹{formatBigNumeric(getRecordText(pricing, ["unit_price"], "-"))}</p></div>
                                                                <div><p className="text-xs text-muted-foreground">Total price</p><p className="font-semibold">₹{formatBigNumeric(getRecordText(pricing, ["total_price"], "-"))}</p></div>
                                                                <div><p className="text-xs text-muted-foreground">Tracking</p><p className="font-semibold">Batch {getRecordText(tracking, ["batch_number"], "-")} • Lot {getRecordText(tracking, ["lot_number"], "-")}</p></div>
                                                                <div>
                                                                    <p className="text-xs text-muted-foreground">Item status</p>
                                                                    <div className="mt-1 flex flex-wrap gap-2">
                                                                        <Badge variant={getRecordText(status, ["is_fully_allocated"], "false") === "true" ? "default" : "outline"}>Allocated {getRecordText(status, ["is_fully_allocated"], "false") === "true" ? "Yes" : "No"}</Badge>
                                                                        <Badge variant={getRecordText(status, ["is_fully_picked"], "false") === "true" ? "default" : "outline"}>Picked {getRecordText(status, ["is_fully_picked"], "false") === "true" ? "Yes" : "No"}</Badge>
                                                                        <Badge variant={getRecordText(status, ["is_fully_packed"], "false") === "true" ? "default" : "outline"}>Packed {getRecordText(status, ["is_fully_packed"], "false") === "true" ? "Yes" : "No"}</Badge>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                }) : <p className="text-sm text-muted-foreground">No line items were returned for this order.</p>}
                                            </CardContent>
                                        </Card>

                                        <Card className="border-border/70 shadow-sm">
                                            <CardHeader><CardTitle>Inventory Summary</CardTitle></CardHeader>
                                            <CardContent className="grid grid-cols-3 gap-3 text-sm">
                                                <div className="rounded-xl bg-muted/30 p-3"><p className="text-xs text-muted-foreground">Available</p><p className="text-2xl font-semibold">{formatBigNumeric(orderDetails.inventory_summary?.available_qty)}</p></div>
                                                <div className="rounded-xl bg-muted/30 p-3"><p className="text-xs text-muted-foreground">Reserved</p><p className="text-2xl font-semibold">{formatBigNumeric(orderDetails.inventory_summary?.reserved_qty)}</p></div>
                                                <div className="rounded-xl bg-muted/30 p-3"><p className="text-xs text-muted-foreground">Short</p><p className="text-2xl font-semibold text-amber-400">{formatBigNumeric(orderDetails.inventory_summary?.short_qty)}</p></div>
                                            </CardContent>
                                        </Card>

                                        <Card className="border-border/70 shadow-sm">
                                            <CardHeader><CardTitle>Task Summary</CardTitle></CardHeader>
                                            <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
                                                <div className="rounded-xl bg-muted/30 p-3"><p className="text-muted-foreground">Allocations</p><p className="text-xl font-semibold">{Array.isArray(orderDetails.allocations) ? orderDetails.allocations.length : 0}</p></div>
                                                <div className="rounded-xl bg-muted/30 p-3"><p className="text-muted-foreground">Picking tasks</p><p className="text-xl font-semibold">{Array.isArray(orderDetails.picking_tasks) ? orderDetails.picking_tasks.length : 0}</p></div>
                                            </CardContent>
                                        </Card>
                                    </div>
                                )}

                                {detailsTab === "timeline" && (
                                    <div className="grid grid-cols-1 gap-4 px-4 py-4 md:grid-cols-2">
                                        <Card className="border-border/70 shadow-sm md:col-span-2">
                                            <CardHeader><CardTitle>Timeline</CardTitle></CardHeader>
                                            <CardContent className="space-y-2">
                                                {getRecordArray(orderDetails.timeline).length ? getRecordArray(orderDetails.timeline).map((entry, index) => (
                                                    <div key={`${String(entry.event ?? "event")}-${index}`} className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2">
                                                        <span className="font-medium">{getRecordText(entry, ["event"], `Event ${index + 1}`)}</span>
                                                        <span className="text-xs text-muted-foreground">{formatDateTime(getRecordText(entry, ["timestamp"], "-"))}</span>
                                                    </div>
                                                )) : <p className="text-sm text-muted-foreground">No timeline entries were returned.</p>}
                                            </CardContent>
                                        </Card>

                                        <Card className="border-border/70 shadow-sm">
                                            <CardHeader><CardTitle>Audit</CardTitle></CardHeader>
                                            <CardContent className="space-y-2 text-sm">
                                                <div><p className="text-muted-foreground">Created by</p><p className="font-semibold">{orderDetails.created_by_name}</p></div>
                                                <div><p className="text-muted-foreground">Created at</p><p className="font-semibold">{formatDateTime(orderDetails.created_at)}</p></div>
                                                <div><p className="text-muted-foreground">Last updated</p><p className="font-semibold">{formatDateTime(orderDetails.updated_at)}</p></div>
                                            </CardContent>
                                        </Card>

                                        <Card className="border-border/70 shadow-sm">
                                            <CardHeader><CardTitle>Notes</CardTitle></CardHeader>
                                            <CardContent>
                                                <p className="text-sm italic text-muted-foreground whitespace-pre-wrap break-words">
                                                    {orderDetails.notes && orderDetails.notes.trim() ? orderDetails.notes : "No notes added."}
                                                </p>
                                            </CardContent>
                                        </Card>
                                    </div>
                                )}

                                <div className="flex items-center justify-end gap-2 border-t border-border/60 px-4 py-3">
                                    <Button variant="outline" onClick={closeOrderDetails} disabled={confirming}>Close</Button>
                                </div>
                            </div>
                        ) : null}
                    </div>
                </DialogContent>
            </Dialog>

            {error && (
                <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    {error}
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm text-muted-foreground">Total Orders</CardTitle>
                    </CardHeader>
                    <CardContent className="text-2xl font-semibold">{orders.length}</CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm text-muted-foreground">Completed Orders</CardTitle>
                    </CardHeader>
                    <CardContent className="text-2xl font-semibold">{completedOrders}</CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm text-muted-foreground">Total Items</CardTitle>
                    </CardHeader>
                    <CardContent className="text-2xl font-semibold">{totalItems}</CardContent>
                </Card>
            </div>

            {loading ? (
                <Card>
                    <CardContent className="py-16 flex items-center justify-center">
                        <div className="flex items-center gap-3 text-muted-foreground">
                            <span className="h-5 w-5 rounded-full border-2 border-border border-t-primary animate-spin" />
                            Loading sales orders...
                        </div>
                    </CardContent>
                </Card>
            ) : orders.length === 0 ? (
                <Card>
                    <CardContent className="py-16 text-center text-muted-foreground">
                        No sales orders found.
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-4">
                    {orders.map((order) => (
                        <Card key={order.id} className="w-full rounded-xl">
                            <CardHeader className="pb-3">
                                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                    <div className="space-y-1">
                                        <CardTitle className="text-lg break-words">{order.order_number}</CardTitle>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2 md:justify-end">
                                        <Badge variant={priorityVariant(order.priority)}>{order.priority}</Badge>
                                        <Badge variant={statusVariant(order.status)}>{order.status}</Badge>
                                        <Button
                                            size="sm"
                                            onClick={() => void openOrderDetails(order.id)}
                                            disabled={detailsLoading}
                                        >
                                            View Details
                                        </Button>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 text-sm items-stretch">
                                    <div className="rounded-lg border border-border p-3">
                                        <p className="text-xs text-muted-foreground">Customer</p>
                                        <p className="font-medium mt-1 break-words">{order.customer_name}</p>
                                        <p className="text-xs text-muted-foreground mt-1 break-all">{order.customer_email}</p>
                                    </div>

                                    <div className="rounded-lg border border-border p-3">
                                        <p className="text-xs text-muted-foreground">Dates</p>
                                        <p className="mt-1">Order: {formatDateTime(order.order_date)}</p>
                                        <p className="mt-1">Requested: {formatDateTime(order.requested_delivery_date)}</p>
                                        <p className="mt-1">Completed: {formatDateTime(order.completed_at)}</p>
                                    </div>

                                    <div className="rounded-lg border border-border p-3">
                                        <p className="text-xs text-muted-foreground">Quantities & Value</p>
                                        <p className="mt-1">Total items: <span className="font-medium">{order.total_items}</span></p>
                                        <p className="mt-1 break-all">Total qty: <span className="font-medium">{formatBigNumeric(order.total_quantity)}</span></p>
                                        <p className="mt-1 break-all">Total value: <span className="font-medium">{formatBigNumeric(order.total_value)}</span></p>
                                    </div>

                                    <div className="rounded-lg border border-border p-3">
                                        <p className="text-xs text-muted-foreground">Processing</p>
                                        <div className="mt-2 space-y-2">
                                            <div className="flex items-center gap-2">
                                                {order.is_picking_complete ? (
                                                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                                                ) : (
                                                    <Circle className="h-4 w-4 text-muted-foreground" />
                                                )}
                                                <span>Picking complete</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {order.is_packing_complete ? (
                                                    <PackageCheck className="h-4 w-4 text-green-600" />
                                                ) : (
                                                    <Circle className="h-4 w-4 text-muted-foreground" />
                                                )}
                                                <span>Packing complete</span>
                                            </div>
                                            <div className="pt-1">
                                                <p className="text-xs text-muted-foreground">Assigned Worker</p>
                                                <p className="font-medium">
                                                    {resolveAssignedWorkerDisplay(order, orderAssignments[order.id])}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 text-sm">
                                    <div className="rounded-lg border border-border p-3">
                                        <p className="text-xs text-muted-foreground">Created By</p>
                                        <div className="mt-2 flex items-start gap-2">
                                            <UserRound className="h-4 w-4 mt-0.5 text-muted-foreground" />
                                            <div>
                                                <p className="font-medium break-words">{order.created_by_name}</p>
                                                <p className="text-xs text-muted-foreground mt-1">Created: {formatDateTime(order.created_at)}</p>
                                                <p className="text-xs text-muted-foreground">Updated: {formatDateTime(order.updated_at)}</p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="rounded-lg border border-border p-3">
                                        <p className="text-xs text-muted-foreground">Notes & Items</p>
                                        <p className="mt-2 whitespace-pre-wrap break-words">{order.notes}</p>
                                        <p className="text-xs text-muted-foreground mt-3">Items in payload: {order.items.length}</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
};

export default SalesOrders;
