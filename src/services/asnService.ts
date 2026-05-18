import api from './api';

export const asnService = {
    /**
     * Get all ASNs
     */
    getAll: async () => {
        const response = await api.get('/asn/');
        return response.data;
    },

    /**
     * Search ASNs by keyword
     */
    search: async (query: string) => {
        const response = await api.get('/asn/', { params: { search: query } });
        return response.data;
    },

    /**
     * Get a specific ASN by ID
     */
    getById: async (id: string | number) => {
        const response = await api.get(`/asn/${id}`);
        return response.data;
    },

    /**
     * Get a specific ASN by Number
     */
    getByNumber: async (asnNumber: string) => {
        const response = await api.get(`/asn/number/${asnNumber}`);
        return response.data;
    },

    /**
     * Create a new ASN
     */
    create: async (data: any) => {
        const response = await api.post('/asn/', data);
        return response.data;
    },

    /**
     * Update an existing ASN by ID
     */
    update: async (id: string | number, data: any) => {
        const response = await api.patch(`/asn/${id}`, data);
        return response.data;
    },

    /**
     * Delete an ASN by ID
     */
    delete: async (id: string | number) => {
        const response = await api.delete(`/asn/${id}`);
        return response.data;
    }
};
