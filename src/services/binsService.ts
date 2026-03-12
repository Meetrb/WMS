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
    warehouse_id: string;
    zone_id: string;
    is_active?: boolean;
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

    getBinsByWarehouse: async (warehouseId: string, skip: number = 0, limit: number = 500) => {
        const response = await api.get(`/bins/warehouse/${warehouseId}`, {
            params: { skip, limit }
        });
        return response.data;
    }
};
