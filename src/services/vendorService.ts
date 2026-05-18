import api from './api';

export const vendorService = {
    getAll: async () => {
        const response = await api.get('/suppliers/', { params: { include_inactive: true } });
        return response.data;
    },

    getById: async (id: string | number) => {
        const response = await api.get(`/suppliers/${id}`);
        console.log('getById response:', response.data);
        return response.data;
    },

    search: async (query: string) => {
        const response = await api.get('/suppliers/', { params: { search: query, include_inactive: true } });
        return Array.isArray(response.data) ? response.data : (response.data?.items || []);
    },

    create: async (data: any) => {
        const response = await api.post('/suppliers/', data);
        return response.data;
    },

    update: async (id: string | number, data: any) => {
        const response = await api.put(`/suppliers/${id}`, data);
        return response.data;
    },

    patch: async (id: string | number, data: any) => {
        const response = await api.patch(`/suppliers/${id}`, data);
        return response.data;
    },

    delete: async (id: string | number) => {
        const response = await api.delete(`/suppliers/${id}`);
        return response.data;
    },

    getByCode: async (code: string) => {
        const response = await api.get(`/suppliers/code/${code}`);
        return response.data;
    }
};
