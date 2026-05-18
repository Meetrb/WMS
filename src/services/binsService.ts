import api from './api';

export interface BinData {
    id?: string;
    code: string;
    barcode?: string;
    rfid_tag?: string;
    aisle?: string;
    rack?: string;
    shelf?: string;
    bin_position?: string;
    bin_type?: string;
    length_cm?: number;
    width_cm?: number;
    height_cm?: number;
    max_volume_cc?: number;
    max_weight_kg?: number;
    max_sku_count?: number;
    max_quantity?: number;
    max_stack_height?: number;
    x_coordinate?: number;
    y_coordinate?: number;
    z_coordinate?: number;
    pick_priority?: number;
    distance_from_packing?: number;
    compatibility_rules?: Record<string, any>;
    fefo_allowed?: boolean;
    fifo_allowed?: boolean;
    warehouse_id?: string;
    zone_id?: string | null;
    status?: string;
    is_blocked?: boolean;
    blocked_reason?: string | null;
    is_active?: boolean;
}

export interface BinUpdateData {
    zone_id?: string | null;
    barcode?: string | null;
    rfid_tag?: string | null;
    bin_type?: string | null;
    length_cm?: number | null;
    width_cm?: number | null;
    height_cm?: number | null;
    max_volume_cc?: number | null;
    max_weight_kg?: number | null;
    max_sku_count?: number | null;
    max_quantity?: number | null;
    max_stack_height?: number | null;
    x_coordinate?: number | null;
    y_coordinate?: number | null;
    z_coordinate?: number | null;
    pick_priority?: number | null;
    distance_from_packing?: number | null;
    compatibility_rules?: Record<string, any> | null;
    fefo_allowed?: boolean | null;
    fifo_allowed?: boolean | null;
    status?: string | null;
    is_blocked?: boolean | null;
    blocked_reason?: string | null;
}

export const binsService = {
    createBin: async (data: BinData) => {
        const response = await api.post('/bins/', data);
        return response.data;
    },

    getBinsByZone: async (zoneId: string, skip: number = 0, limit: number = 10) => {
        const response = await api.get(`/bins/zone/${zoneId}`, {
            params: { skip, limit }
        });
        return response.data;
    },

    getAllBins: async (skip: number = 0, limit: number = 100) => {
        const response = await api.get('/bins/', {
            params: { skip, limit }
        });
        return response.data;
    },

    getBinById: async (binId: string) => {
        const response = await api.get(`/bins/${binId}`);
        return response.data;
    },

    updateBin: async (binId: string, data: BinUpdateData) => {
        const response = await api.patch(`/bins/${binId}`, data);
        return response.data;
    },

    getBinsByWarehouse: async (warehouseId: string, skip: number = 0, limit: number = 500) => {
        const response = await api.get(`/bins/warehouse/${warehouseId}`, {
            params: { skip, limit }
        });
        return response.data;
    },

    getBinsByZoneV2: async (zoneId: string, skip: number = 0, limit: number = 10) => {
        const response = await api.get(`/zones/${zoneId}/bins`, {
            params: { skip, limit }
        });
        return response.data;
    },

    createBinInZone: async (zoneId: string, data: BinData) => {
        const response = await api.post(`/zones/${zoneId}/bins`, data);
        return response.data;
    }
};
