import api from './api';

export interface ReplenishmentCreatePayload {
    item_id: string;
    item_sku: string;
    item_description: string;
    source_bin_id: string;
    destination_bin_id: string;
    warehouse_id: string;
    quantity: number;
    trigger_reason: string;
    priority: number;
    notes: string;
    created_by_id: string;
    created_by_name: string;
}

export interface ReplenishmentRuleCreatePayload {
    rule_type: 'SKU' | 'CATEGORY';
    sku_id: string | null;
    category_id: string | null;
    fulfillment_rule: 'FEFO' | 'FIFO' | 'LIFO';
    assigned_trolley_id: string | null;
    min_threshold: number;
    target_quantity: number;
    time_based_enabled: boolean;
    refill_frequency_minutes: number | null;
    is_fast_mover: boolean;
    priority: 'HIGH' | 'MEDIUM' | 'LOW';
    status: 'ACTIVE' | 'INACTIVE';
}

export interface CompleteReplenishmentTaskPayload {
    source_bin_barcode: string;
    destination_bin_barcode: string;
    quantity_moved: number;
    notes: string;
}

const extractArray = (payload: unknown): unknown[] => {
    if (Array.isArray(payload)) return payload;

    if (payload && typeof payload === 'object') {
        const wrapped = payload as Record<string, unknown>;
        const nested = wrapped.tasks ?? wrapped.items ?? wrapped.data ?? wrapped.results;
        return Array.isArray(nested) ? nested : [];
    }

    return [];
};

export const replenishmentService = {
    getTasks: async () => {
        const response = await api.get('/replenishment/tasks', { timeout: 10000 });
        return extractArray(response.data);
    },

    getTaskById: async (taskId: string) => {
        try {
            const response = await api.get(`/replenishment/tasks/${encodeURIComponent(taskId)}`, { timeout: 10000 });
            return response.data;
        } catch {
            const fallbackResponse = await api.get(`/replenishment/tasks/${encodeURIComponent(taskId)}/`, { timeout: 10000 });
            return fallbackResponse.data;
        }
    },

    searchItems: async (query: string, limit: number = 10) => {
        const response = await api.get('/items/', {
            params: { search: query, limit },
            timeout: 10000,
        });

        return extractArray(response.data);
    },

    createTask: async (payload: ReplenishmentCreatePayload) => {
        try {
            const response = await api.post('/replenishment/tasks', payload, { timeout: 10000 });
            return response.data;
        } catch (error) {
            const status = (error as { response?: { status?: number } })?.response?.status;
            if (status === 404 || status === 405) {
                const fallbackResponse = await api.post('/replenishmnt/tasks', payload, { timeout: 10000 });
                return fallbackResponse.data;
            }
            throw error;
        }
    },

    createRule: async (payload: ReplenishmentRuleCreatePayload) => {
        const response = await api.post('/replenishment/rules', payload, { timeout: 10000 });
        return response.data;
    },

    completeTask: async (taskId: string, payload: CompleteReplenishmentTaskPayload) => {
        const encodedTaskId = encodeURIComponent(taskId);
        const response = await api.post(`/replenishment/tasks/${encodedTaskId}/complete`, payload, { timeout: 10000 });
        return response.data;
    },

    getCompletedTasks: async () => {
        const response = await api.get('/replenishment/worker/tasks/completed', { timeout: 10000 });
        return extractArray(response.data);
    },
};
