import api from './api';

export const inboundService = {
    getAll: async (skip: number = 0, limit: number = 10) => {
        const response = await api.get('/inbound/', { params: { skip, limit } });
        return response.data;
    },

    getById: async (id: string | number) => {
        const response = await api.get(`/inbound/${id}`);
        return response.data;
    },

    getByAsnNumber: async (asnNumber: string) => {
        // Fetches the full inbound record by ASN number to get the real inboundId UUID
        const response = await api.get(`/inbound/asn/${asnNumber}`);
        return response.data;
    },

    create: async (data: any) => {
        const response = await api.post('/inbound/', data);
        return response.data;
    },

    update: async (id: string | number, data: any) => {
        const response = await api.put(`/inbound/${id}`, data);
        return response.data;
    },

    updateArrival: async (asnNumber: string | number, data: any) => {
        const response = await api.post(`/inbound/asn/${asnNumber}/arrive`, data);
        return response.data;
    },

    updateASN: async (asnId: string | number, payload: any) => {
        const response = await api.patch(`/asns/${asnId}/`, payload);
        return response.data;
    },

    delete: async (id: string | number) => {
        const response = await api.delete(`/inbound/${id}`);
        return response.data;
    },

    getDashboardToday: async (filters: any = {}, pagination: any = {}) => {
        const response = await api.get('/inbound/today', {
            params: {
                ...filters,
                overdue_skip: pagination.overdue?.skip,
                overdue_limit: pagination.overdue?.limit,
                today_skip: pagination.today?.skip,
                today_limit: pagination.today?.limit,
                arrived_skip: pagination.arrived?.skip,
                arrived_limit: pagination.arrived?.limit
            }
        });
        return response.data;
    },

    getOverdue: async (skip: number = 0, limit: number = 10) => {
        const response = await api.get('/inbound/today/overdue', { params: { skip, limit } });
        return response.data;
    },

    getExpectedToday: async (skip: number = 0, limit: number = 10) => {
        const response = await api.get('/inbound/today', { params: { skip, limit } });
        return response.data;
    },

    getArrivedToday: async (skip: number = 0, limit: number = 10) => {
        const response = await api.get('/inbound/today/arrived', { params: { skip, limit } });
        return response.data;
    },

    markAsArrived: async (asnNumber: string) => {
        const response = await api.post(
            `/inbound/asn/${asnNumber}/arrive`,
            {
                status: "ARRIVED"
            }
        );
        return response.data;
    },

    createReceivingTask: async (data: {
        inbound_shipment_id: string;
        assignedToId: string;
        items: Array<{
            asn_shipment_item_id: string;
            received_quantity: number;
            rejected_quantity: number;
            rejection_reason: string;
        }>;
    }) => {
        const response = await api.post('/inbound/receiving-tasks', data);
        return response.data;
    },

    createInspection: async (data: {
        inbound_shipment_id: string;
        inspection_type: "manual";
        inspector_id: string;
        details: Array<{
            asn_shipment_item_id: string;
            inspected_quantity: number;
            passed_quantity: number;
            rejected_quantity: number;
            rejection_reason: string;
        }>;
    }) => {
        const response = await api.post('/inbound/inspection', data);
        return response.data;
    },

    getMyAssignedInspections: async (params?: { warehouse_id?: string; status?: string }) => {
        const response = await api.get('/inbound/inspection/officer/my-assigned', { params });
        return response.data;
    },

    getInspectionReport: async (inspectionId: string) => {
        const response = await api.get(`/inbound/inspection/${encodeURIComponent(inspectionId)}/report`);
        return response.data;
    },

    resolveInspection: async (
        inspectionId: string,
        payload: {
            decisions: Array<{
                inspection_detail_id: string;
                action: 'ACCEPT' | 'RETURN';
                accepted_quantity: number;
                rejected_quantity: number;
                notes?: string;
            }>;
            comments?: string;
        }
    ) => {
        const response = await api.patch(`/inbound/inspection/${encodeURIComponent(inspectionId)}/resolve`, payload);
        return response.data;
    },

    createGrn: async (data: {
        inbound_shipment_id: string;
        pallet_id?: string;
        items: Array<{
            asn_shipment_item_id: string;
            received_quantity: number;
            accepted_quantity: number;
            rejected_quantity: number;
            pallet_barcode?: string;
            reject_pallet_barcode?: string;
            pallet_splits?: Array<{
                pallet_barcode: string;
                quantity: number;
            }>;
            accepted_pallet_id?: string;
            rejected_pallet_id?: string;
        }>;
        created_by?: string;
    }) => {
        const response = await api.post('/inbound/grn', data);
        console.log(response.data);
        return response.data;
    },

    /** Simple GRN creation — only needs the inbound_shipment_id */
    createGrnSimple: async (inboundShipmentId: string) => {
        const response = await api.post('/grn/create', {
            inbound_shipment_id: inboundShipmentId,
        });
        return response.data;
    },
};
