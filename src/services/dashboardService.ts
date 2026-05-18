import api from './api';

// --- Interfaces ---

export interface DashboardSummary {
    total_skus: number;
    total_inventory: number;
    available_inventory: number;
    reserved_inventory: number;
    pending_orders: number;
    picking_orders: number;
    putaway_tasks: number;
    active_shipments: number;
    low_stock_count: number;
    warehouse_utilization: number;
    sku_change_percent?: string;
    inventory_change_count?: string;
}

export interface InventoryAnalytics {
    name: string;
    value: number;
}

export interface DailyActivity {
    name: string;
    value: number;
}

export interface WarehouseUtilization {
    name: string;
    value: number;
}

export interface RecentSalesOrder {
    id: string;
    customer: string;
    qty: number;
    status: string;
    priority: string;
    date: string;
}

export interface RecentAsn {
    id: string;
    supplier: string;
    arrival: string;
    status: string;
    warehouse: string;
}

export interface ActiveShipment {
    id: string;
    customer: string;
    status: string;
    steps: { label: string; active: boolean }[];
    type: string;
}

export interface DashboardAlert {
    id: string;
    type: 'low_stock' | 'delayed' | 'warning';
    title: string;
    description: string;
}

export interface RecentActivity {
    type: string;
    title: string;
    sub: string;
    time: string;
}

export interface TaskSummary {
    picking: number;
    putaway: number;
    packing: number;
    shipping: number;
}

export interface LowStockProduct {
    sku_code: string;
    product_name: string;
    current_stock: number;
    threshold: number;
}

export interface NotificationsSummary {
    unread_count: number;
    recent_notifications: any[];
}

// --- Extraction Helpers ---

const extractList = (payload: unknown): any[] => {
    if (Array.isArray(payload)) return payload;
    if (payload && typeof payload === 'object') {
        const wrapped = payload as Record<string, any>;
        const nested = wrapped.data ?? wrapped.items ?? wrapped.results ?? wrapped.orders ?? wrapped.asns ?? wrapped.shipments ?? wrapped.alerts ?? wrapped.activities ?? wrapped.products ?? [];
        return Array.isArray(nested) ? nested : [];
    }
    return [];
};

const extractObject = (payload: unknown): Record<string, any> => {
    if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
        const wrapped = payload as Record<string, any>;
        // If it's wrapped in a 'data' property, unwrap it
        if (wrapped.data && typeof wrapped.data === 'object' && !Array.isArray(wrapped.data)) {
            return wrapped.data;
        }
        return wrapped;
    }
    return {};
};

// --- Service ---

export const dashboardService = {
    getSummary: async (): Promise<DashboardSummary> => {
        const response = await api.get('/dashboard/summary');
        const data = extractObject(response.data);
        return {
            total_skus: Number(data.total_skus ?? 0),
            total_inventory: Number(data.total_inventory ?? 0),
            available_inventory: Number(data.available_inventory ?? 0),
            reserved_inventory: Number(data.reserved_inventory ?? 0),
            pending_orders: Number(data.pending_orders ?? 0),
            picking_orders: Number(data.picking_orders ?? 0),
            putaway_tasks: Number(data.putaway_tasks ?? 0),
            active_shipments: Number(data.active_shipments ?? 0),
            low_stock_count: Number(data.low_stock_count ?? 0),
            warehouse_utilization: Number(data.warehouse_utilization ?? 0),
            sku_change_percent: String(data.sku_change_percent ?? ''),
            inventory_change_count: String(data.inventory_change_count ?? '')
        };
    },

    getInventoryAnalytics: async (): Promise<InventoryAnalytics[]> => {
        const response = await api.get('/dashboard/inventory-analytics');
        return extractList(response.data).map(item => ({
            name: String(item.name ?? item.label ?? item.date ?? ''),
            value: Number(item.value ?? item.count ?? item.total ?? 0)
        }));
    },

    getDailyActivity: async (): Promise<DailyActivity[]> => {
        const response = await api.get('/dashboard/daily-activity');
        return extractList(response.data).map(item => ({
            name: String(item.name ?? item.type ?? ''),
            value: Number(item.value ?? item.percentage ?? 0)
        }));
    },

    getWarehouseUtilization: async (): Promise<WarehouseUtilization[]> => {
        const response = await api.get('/dashboard/warehouse-utilization');
        return extractList(response.data).map(item => ({
            name: String(item.name ?? item.label ?? ''),
            value: Number(item.value ?? item.count ?? 0)
        }));
    },

    getRecentSalesOrders: async (): Promise<RecentSalesOrder[]> => {
        const response = await api.get('/dashboard/recent-sales-orders');
        return extractList(response.data).map(item => ({
            id: String(item.id ?? item.order_number ?? item.code ?? ''),
            customer: String(item.customer ?? item.customer_name ?? item.client ?? 'Unknown'),
            qty: Number(item.qty ?? item.total_quantity ?? item.quantity ?? 0),
            status: String(item.status ?? item.order_status ?? 'Pending'),
            priority: String(item.priority ?? 'Medium'),
            date: String(item.date ?? item.created_at ?? '')
        }));
    },

    getRecentAsns: async (): Promise<RecentAsn[]> => {
        const response = await api.get('/dashboard/recent-asns');
        return extractList(response.data).map(item => ({
            id: String(item.id ?? item.asn_number ?? ''),
            supplier: String(item.supplier ?? item.supplier_name ?? 'Unknown'),
            arrival: String(item.arrival ?? item.expected_at ?? ''),
            status: String(item.status ?? 'Pending'),
            warehouse: String(item.warehouse ?? item.warehouse_name ?? '')
        }));
    },

    getActiveShipments: async (): Promise<ActiveShipment[]> => {
        const response = await api.get('/dashboard/active-shipments');
        return extractList(response.data).map(item => ({
            id: String(item.id ?? item.shipment_number ?? ''),
            customer: String(item.customer ?? item.customer_name ?? ''),
            status: String(item.status ?? 'In Transit'),
            steps: Array.isArray(item.steps) ? item.steps : [],
            type: String(item.type ?? 'Standard')
        }));
    },

    getAlerts: async (): Promise<DashboardAlert[]> => {
        const response = await api.get('/dashboard/alerts');
        return extractList(response.data).map(item => ({
            id: String(item.id ?? ''),
            type: (item.type === 'low_stock' || item.type === 'delayed' || item.type === 'warning' ? item.type : 'warning') as any,
            title: String(item.title ?? 'Alert'),
            description: String(item.description ?? item.message ?? '')
        }));
    },

    getRecentActivities: async (): Promise<RecentActivity[]> => {
        const response = await api.get('/dashboard/recent-activities');
        return extractList(response.data).map(item => ({
            type: String(item.type ?? item.category ?? 'General'),
            title: String(item.title ?? item.action ?? item.message ?? item.type ?? 'Activity'),
            sub: String(item.sub ?? item.subtitle ?? item.description ?? item.detail ?? item.content ?? ''),
            time: String(item.time ?? item.created_at ?? item.timestamp ?? item.date ?? '')
        }));
    },

    getTaskSummary: async (): Promise<TaskSummary> => {
        const response = await api.get('/dashboard/task-summary');
        const data = extractObject(response.data);
        return {
            picking: Number(data.picking ?? 0),
            putaway: Number(data.putaway ?? 0),
            packing: Number(data.packing ?? 0),
            shipping: Number(data.shipping ?? 0)
        };
    },

    getLowStockProducts: async (): Promise<LowStockProduct[]> => {
        const response = await api.get('/dashboard/low-stock-products');
        return extractList(response.data).map(item => ({
            sku_code: String(item.sku_code ?? item.item_sku ?? item.sku ?? ''),
            product_name: String(item.product_name ?? item.item_description ?? item.name ?? ''),
            current_stock: Number(item.current_stock ?? item.quantity ?? 0),
            threshold: Number(item.threshold ?? item.reorder_level ?? 0)
        }));
    },

    getNotificationsSummary: async (): Promise<NotificationsSummary> => {
        const response = await api.get('/dashboard/notifications-summary');
        const data = extractObject(response.data);
        return {
            unread_count: Number(data.unread_count ?? data.count ?? 0),
            recent_notifications: Array.isArray(data.recent_notifications) ? data.recent_notifications : []
        };
    }
};
