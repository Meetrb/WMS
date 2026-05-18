import api from './api';

export interface ZoneData {
    id?: string;
    code: string;
    name: string;
    description?: string;
    zone_type: string;
    length_meters?: number;
    width_meters?: number;
    height_meters?: number;
    floor_area_sqft?: number;
    temperature_min_celsius?: number;
    temperature_max_celsius?: number;
    humidity_percent?: number;
    is_hazardous?: boolean;
    is_refrigerated?: boolean;
    is_clean_room?: boolean;
    special_condition?: string;
    max_pallet_positions?: number;
    is_active?: boolean;
    warehouse_id: string;
}

export const zoneService = {
    createZone: async (data: ZoneData) => {
        const response = await api.post('/zones/', data);
        return response.data;
    },

    getZonesByWarehouse: async (warehouseId: string, skip: number = 0, limit: number = 100) => {
        const response = await api.get(`/zones/warehouse/${warehouseId}`, {
            params: { skip, limit }
        });
        return response.data;
    },

    updateZone: async (zoneId: string, data: Partial<ZoneData>) => {
        const response = await api.patch(`/zones/${zoneId}`, data);
        return response.data;
    }
};
