import api from './api';

export const poService = {
    getAll: async () => {
        const response = await api.get('/po/');
        return response.data;
    },

    getById: async (id: string | number) => {
        const response = await api.get(`/po/${id}`);
        return response.data;
    },

    create: async (data: any) => {
        const response = await api.post('/po/', data);
        return response.data;
    },

    update: async (id: string | number, data: any) => {
        const response = await api.put(`/po/${id}`, data);
        return response.data;
    },

    delete: async (id: string | number) => {
        const response = await api.delete(`/po/${id}`);
        return response.data;
    }
};
