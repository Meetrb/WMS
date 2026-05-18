import api from './api';

export interface InventoryDashboard {
    total_skus?: number;
    total_quantity_on_hand?: number | string;
    total_locations_used?: number;
    items_near_expiry?: number;
    low_stock_items?: number;
    recent_putaways?: number;
    recent_picks?: number;
    [key: string]: unknown;
}

export interface InventoryItem {
    id?: string;
    item_id?: string;
    item_master_id?: string;
    sku?: string;
    sku_code?: string;
    item_sku?: string;
    description?: string;
    item_description?: string;
    name?: string;
    quantity?: number | string;
    current_quantity?: number | string;
    available_quantity?: number | string;
    stock?: number | string;
    location?: string;
    bin_code?: string;
    current_bin?: string;
    bin?: string;
    zone?: string;
    zone_name?: string;
    warehouse_code?: string;
    status?: string;
    stock_status?: string;
    reorder_level?: number | string;
    reorder_point?: number | string;
    [key: string]: unknown;
}

export interface InventoryItemDetail {
    item_id?: string;
    item_sku?: string;
    item_description?: string;
    total_on_hand?: string | number;
    total_reserved?: string | number;
    total_available?: string | number;
    total_in_transit?: string | number;
    location_count?: number;
    locations?: Array<Record<string, unknown> | string>;
    item?: Record<string, any>;
    summary?: Record<string, any>;
    warehouses?: any[];
    bins?: any[];
    [key: string]: any;
}

const asText = (value: unknown): string => {
    if (value === null || value === undefined) return '';
    return String(value);
};

const extractInventoryItems = (payload: unknown): InventoryItem[] => {
    if (Array.isArray(payload)) return payload as InventoryItem[];

    const record = payload as Record<string, unknown>;
    if (Array.isArray(record?.items)) return record.items as InventoryItem[];
    if (Array.isArray(record?.results)) return record.results as InventoryItem[];

    return [];
};

const mapInventoryItemDetail = (rawPayload: Record<string, unknown>): InventoryItemDetail => {
    // Unwrap if the actual response is nested inside a 'data' or 'result' key
    let raw = rawPayload;
    if (rawPayload.data && typeof rawPayload.data === 'object' && !rawPayload.item && !rawPayload.item_sku) {
        raw = rawPayload.data as Record<string, unknown>;
    } else if (rawPayload.result && typeof rawPayload.result === 'object' && !rawPayload.item && !rawPayload.item_sku) {
        raw = rawPayload.result as Record<string, unknown>;
    }

    return {
        ...raw,
        item_id: asText(raw.item_id || (raw.item as any)?.item_id),
        item_sku: asText(raw.item_sku || (raw.item as any)?.item_sku),
        item_description: asText(raw.item_description || (raw.item as any)?.item_description),
        total_on_hand: asText(raw.total_on_hand),
        total_reserved: asText(raw.total_reserved),
        total_available: asText(raw.total_available),
        total_in_transit: asText(raw.total_in_transit),
        location_count: Number(raw.location_count ?? 0) || 0,
        locations: Array.isArray(raw.locations) ? (raw.locations as Array<Record<string, unknown> | string>) : [],
    };
};

export const inventoryService = {
    getDashboard: async () => {
        const response = await api.get<InventoryDashboard>('/inventory/dashboard');
        return response.data;
    },

    getItems: async () => {
        try {
            const response = await api.get<InventoryItem[] | { items?: InventoryItem[]; results?: InventoryItem[] }>('/inventory/');
            const items = extractInventoryItems(response.data);
            
            // Debug: log the structure of the first item to understand the API response
            if (items.length > 0) {
                console.log('First inventory item structure:', items[0]);
                console.log('Available keys:', Object.keys(items[0]));
            }
            
            return items;
        } catch (error) {
            console.error('Error fetching inventory items:', error);
            
            // Fallback: Return mock data for development/testing
            const mockItems: InventoryItem[] = [
                {
                    id: "1",
                    sku_code: "BE-001",
                    description: "Wireless bluetooth Earbuds",
                    current_quantity: 45,
                    zone_name: "Zone A",
                    bin_code: "A-01-01",
                    stock_status: "in_stock",
                },
                {
                    id: "2",
                    sku_code: "FOOD-CHL-004",
                    description: "Frozen Food Package",
                    current_quantity: 0,
                    zone_name: "-",
                    bin_code: "-",
                    stock_status: "out_of_stock",
                },
                {
                    id: "3",
                    sku_code: "IND-25-0001",
                    description: "India 2026 world cup jersey",
                    current_quantity: 120,
                    zone_name: "Zone C",
                    bin_code: "C-05-03",
                    stock_status: "in_stock",
                },
            ];
            
            console.log('Using fallback mock data');
            return mockItems;
        }
    },

    getItemDetail: async (itemId: string) => {
        const response = await api.get<Record<string, unknown>>(`/inventory/item/${itemId}`);

        if (!response.data || typeof response.data !== 'object') {
            throw new Error('Invalid item detail response');
        }
        
        console.log('Item Detail API Response:', response.data);

        return mapInventoryItemDetail(response.data);
    },

    getBinDetail: async (binId: string) => {
        const response = await api.get(`/inventory/bin/${binId}`);
        return response.data;
    },
};
