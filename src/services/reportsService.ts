import api from './api';

// --- Interfaces ---

export interface AnalyticsResponse {
    summary: Record<string, any>;
    charts: Record<string, any[] | Record<string, any[]>>;
    tables?: Record<string, any[]>;
    last_updated: string;
}

// --- Helpers ---

const normalizeResponse = (endpoint: string, payload: any): AnalyticsResponse => {
    const data = payload?.data ?? payload;
    
    const normalized: AnalyticsResponse = {
        summary: {},
        charts: {},
        tables: {},
        last_updated: new Date().toISOString()
    };

    if (!data) return normalized;

    // Direct mapping based on endpoint structure
    if (endpoint.includes('sales-analytics')) {
        normalized.summary = {
            total_orders: data.total_orders,
            total_revenue: data.total_revenue,
            total_quantity_sold: data.total_quantity_sold,
            average_order_value: data.average_order_value,
            pending_orders: data.pending_orders
        };
        normalized.charts.status = data.status_breakdown || [];
        normalized.charts.customers = data.top_customers || [];
    } 
    else if (endpoint.includes('inventory-analytics')) {
        normalized.summary = {
            total_skus: data.total_skus,
            total_on_hand: data.total_on_hand,
            total_available: data.total_available,
            total_in_transit: data.total_in_transit
        };
        normalized.charts.fast_moving = data.fast_moving_skus || [];
    }
    else if (endpoint.includes('inbound-analytics')) {
        normalized.summary = {
            total_shipments: data.total_inbound_shipments,
            total_grns: data.total_grns,
            total_received: data.total_quantity_received,
            rejection_rate: data.overall_rejection_rate
        };
        normalized.charts.suppliers = data.supplier_breakdown || [];
    }
    else if (endpoint.includes('picking-analytics')) {
        normalized.summary = {
            total_tasks: data.total_tasks,
            completed_tasks: data.completed_tasks,
            total_picked: data.total_quantity_picked,
            completion_rate: data.completion_rate
        };
        normalized.charts.status = [
            { name: 'Completed', value: data.completed_tasks || 0 },
            { name: 'Pending', value: data.pending_tasks || 0 },
            { name: 'In Progress', value: data.in_progress_tasks || 0 },
            { name: 'Cancelled', value: data.cancelled_tasks || 0 }
        ].filter(item => item.value > 0);
    }
    else if (endpoint.includes('warehouse-utilization')) {
        normalized.summary = {
            total_bins: data.total_bins,
            occupied_bins: data.occupied_bins,
            utilization: data.overall_utilization_percentage,
            empty_bins: data.empty_bins
        };
        normalized.charts.zones = data.zone_breakdown || [];
    }
    else if (endpoint.includes('replenishment-trends')) {
        normalized.summary = {
            total_tasks: data.total_tasks,
            completed_tasks: data.completed_tasks,
            total_replenished: data.total_quantity_replenished,
            completion_rate: data.completion_rate
        };
        normalized.charts.skus = data.top_replenished_skus || [];
    }
    else if (endpoint.includes('worker-performance')) {
        normalized.summary = {
            active_workers: data.total_active_workers
        };
        normalized.charts.performers = data.top_performers || [];
    }

    // Fallback for generic chart data
    if (Object.keys(normalized.charts).length === 0) {
        normalized.charts.main = Array.isArray(data) ? data : (data.results || []);
    }

    return normalized;
};

// --- Service ---

export const reportsService = {
    getSalesAnalytics: async (): Promise<AnalyticsResponse> => {
        const response = await api.get('/reports/sales-analytics');
        return normalizeResponse('sales-analytics', response.data);
    },
    getInventoryAnalytics: async (): Promise<AnalyticsResponse> => {
        const response = await api.get('/reports/inventory-analytics');
        return normalizeResponse('inventory-analytics', response.data);
    },
    getInboundAnalytics: async (): Promise<AnalyticsResponse> => {
        const response = await api.get('/reports/inbound-analytics');
        return normalizeResponse('inbound-analytics', response.data);
    },
    getPickingAnalytics: async (): Promise<AnalyticsResponse> => {
        const response = await api.get('/reports/picking-analytics');
        return normalizeResponse('picking-analytics', response.data);
    },
    getWarehouseUtilization: async (): Promise<AnalyticsResponse> => {
        const response = await api.get('/reports/warehouse-utilization');
        return normalizeResponse('warehouse-utilization', response.data);
    },
    getReplenishmentTrends: async (): Promise<AnalyticsResponse> => {
        const response = await api.get('/reports/replenishment-trends');
        return normalizeResponse('replenishment-trends', response.data);
    },
    getWorkerPerformance: async (): Promise<AnalyticsResponse> => {
        const response = await api.get('/reports/worker-performance');
        return normalizeResponse('worker-performance', response.data);
    }
};
