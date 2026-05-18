import api from './api';

export interface Warehouse {
    id?: string;
    code: string;
    name: string;
    description?: string;
    is_active?: boolean;
    is_open?: boolean;
    [key: string]: any;
}

export const warehouseService = {
    getAll: async () => {
        const response = await api.get('/warehouses/');
        return response.data;
    },
    getActive: async () => {
        const response = await api.get('/warehouses/');
        const data = response.data;
        
        // Filter for active warehouses
        let warehouses = Array.isArray(data) ? data : (data.items || []);
        return warehouses.filter((w: any) => w.is_active !== false && w.is_open !== false);
    },
    getById: async (id: string) => {
        const response = await api.get(`/warehouses/${id}/`);
        return response.data;
    },
    getByCode: async (code: string) => {
        const response = await api.get(`/warehouses/code/${code}`);
        return response.data;
    },
    getStatistics: async (id: string) => {
        const response = await api.get(`/warehouses/${id}/statistics`);
        return response.data;
    },
    create: async (data: any) => {
        const response = await api.post('/warehouses/', data);
        return response.data;
    },
    update: async (id: string, data: any) => {
        const response = await api.patch(`/warehouses/${id}/`, data);
        return response.data;
    }
};
