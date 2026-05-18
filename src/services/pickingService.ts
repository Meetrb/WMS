import api from './api';

export interface PickingTask {
    id: string;
    task_number: string;
    sales_order_id: string;
    order_number: string;
    assigned_to_id: string;
    assigned_to_name: string;
    assigned_at: string;
    started_at: string | null;
    completed_at: string | null;
    status: string;
    priority: number;
    notes: string;
    created_by_id: string;
    created_at: string;
    updated_at: string;
    items: PickingItem[];
}

export interface PickingItem {
    id?: string;
    sku?: string;
    description?: string;
    quantity?: number;
    [key: string]: unknown;
}

export interface CompletePickingTaskPayload {
    task_id: string;
    quantity_picked: number;
}

export interface StartOrderPayload {
    trolley_barcode: string;
    sales_order_id: string;
    order_number?: string;
}

export interface ScanRackPayload {
    trolley_barcode: string;
    rack_barcode: string;
    sales_order_id: string;
}

export interface MoveToPackingPayload {
    trolley_barcode: string;
}

const extractArray = (payload: unknown): unknown[] => {
    if (Array.isArray(payload)) return payload;

    if (payload && typeof payload === 'object') {
        const wrapped = payload as Record<string, unknown>;
        const nested = wrapped.tasks ?? wrapped.items ?? wrapped.data ?? wrapped.results ?? wrapped.picking_tasks;
        return Array.isArray(nested) ? nested : [];
    }

    return [];
};

export const pickingService = {
    getAdminDashboardPickerTasks: async () => {
        const response = await api.get('/picking/admin/dashboard/picker', { timeout: 10000 });
        return response.data;
    },

    getTasksBySalesOrder: async (salesOrderId: string) => {
        const response = await api.get('/picking/tasks', {
            params: { sales_order_id: salesOrderId },
            timeout: 10000,
        });
        return extractArray(response.data);
    },

    getTasksByStatus: async (status: string) => {
        const response = await api.get('/picking/tasks', {
            params: { status },
            timeout: 10000,
        });
        return extractArray(response.data);
    },

    getCompletedNotMovedOrders: async () => {
        const response = await api.get('/picking/orders/completed-not-moved', {
            timeout: 10000,
        });
        return Array.isArray(response.data) ? response.data : [];
    },

    getPendingTasks: async () => {
        const response = await api.get('/sales/picking-tasks/pending', { timeout: 10000 });
        return extractArray(response.data);
    },

    getAssignedTasks: async () => {
        const response = await api.get('/sales/picking-tasks/my-tasks', { timeout: 10000 });
        return extractArray(response.data);
    },

    // Backward-compatible alias kept to avoid breaking existing imports/calls.
    getAssigendTasks: async () => {
        return pickingService.getAssignedTasks();
    },

    startTask: async (payload: StartOrderPayload) => {
        const response = await api.post('/trolleys/ops/start-order', payload, { timeout: 10000 });
        return response.data;
    },

    scanRack: async (payload: ScanRackPayload) => {
        const response = await api.post('/trolleys/ops/scan-rack', payload, { timeout: 10000 });
        return response.data;
    },

    startPickingTask: async (taskId: string) => {
        const response = await api.post(`/picking/tasks/${taskId}/start`, null, { timeout: 10000 });
        return response.data;
    },

    moveToPacking: async (payload: MoveToPackingPayload) => {
        const response = await api.post('/trolleys/ops/move-to-packing', payload, { timeout: 10000 });
        return response.data;
    },

    updateTaskQuantity: async (taskId: string, quantity: number) => {
        const response = await api.post(`/picking/tasks/${taskId}/update-quantity`, null, {
            params: { quantity },
            timeout: 10000,
        });
        return response.data;
    },

    completeTaskWithPayload: async (payload: CompletePickingTaskPayload) => {
        const response = await api.post('/picking/tasks/complete', payload, { timeout: 10000 });
        return response.data;
    },

    completeTask: async (taskId: string) => {
        const response = await api.post(`/sales/picking-tasks/${taskId}/complete`, {}, { timeout: 10000 });
        return response.data;
    },

    getCompletedTasks: async () => {
        const response = await api.get('/picking/worker/tasks/completed', { timeout: 10000 });
        return extractArray(response.data);
    },

    getTaskDetail: async (taskId: string) => {
        const response = await api.get(`/picking/tasks/${taskId}`, { timeout: 10000 });
        return response.data;
    },
};
