import api from './api';

export interface PackerOrder {
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
    picked_by_id?: string;
    picked_by_name?: string;
    picked_at?: string | null;
    packed_by_id?: string;
    packed_by_name?: string;
    packed_at?: string | null;
    items: unknown[];
    picking_assignments?: unknown[];
}

export interface PackPayload {
    sales_order_id: string;
    notes: string;
}

export interface PackerDashboardPayload {
    [key: string]: unknown;
}

export interface AdminPackerDashboardPayload {
    [key: string]: unknown;
}

const extractArray = (payload: unknown): unknown[] => {
    if (Array.isArray(payload)) return payload;

    if (payload && typeof payload === 'object') {
        const wrapped = payload as Record<string, unknown>;
        const nested = wrapped.data ?? wrapped.items ?? wrapped.results ?? wrapped.orders;
        return Array.isArray(nested) ? nested : [];
    }

    return [];
};

export const packingService = {
    getAdminPickerDashboard: async () => {
        const response = await api.get<AdminPackerDashboardPayload>('/picking/admin/dashboard/picker', { timeout: 10000 });
        const payload = response.data as Record<string, unknown>;
        if (payload && typeof payload.detail === 'string' && payload.detail.trim()) {
            throw new Error(payload.detail);
        }
        return response.data;
    },

    getPackerDashboard: async () => {
        const response = await api.get<PackerDashboardPayload>('/sales/packer/dashboard');
        return response.data;
    },

    getPackerOrders: async () => {
        const response = await api.get<unknown>('/sales/packer/orders');
        return extractArray(response.data);
    },

    getReadyOrders: async () => {
        const response = await api.get<unknown>('/picking/packer/ready-orders', { timeout: 10000 });
        return extractArray(response.data);
    },

    getPackedOrders: async () => {
        const response = await api.get<unknown>('/picking/packer/packed-orders', { timeout: 10000 });
        return extractArray(response.data);
    },

    getPackerOrderById: async (orderId: string) => {
        const response = await api.get<unknown>(`/picking/packer/orders/${encodeURIComponent(orderId)}`, { timeout: 10000 });
        return response.data;
    },

    getPackingView: async (trolleyBarcode: string) => {
        const response = await api.get<unknown>(`/trolleys/ops/packing-view/${encodeURIComponent(trolleyBarcode)}`, {
            timeout: 10000,
        });
        return response.data;
    },

    packOrder: async (payload: PackPayload) => {
        const response = await api.post<unknown>('/picking/packer/pack', payload, { timeout: 10000 });
        return response.data;
    },
};
