import api from './api';

export const warehouseService = {
    getAll: async () => {
        const response = await api.get('/warehouses/');
        return response.data;
    },
    getById: async (id: string) => {
        const response = await api.get(`/warehouses/${id}/`);
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
