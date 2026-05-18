import api from './api';

export enum PalletStatus {
    ACTIVE = "ACTIVE",
    INACTIVE = "INACTIVE",
    ACCEPTED = "ACCEPTED",
    REJECTED = "REJECTED",
}

export interface PalletData {
    id?: string;
    pallet_id?: string;
    barcode: string;
    pallet_code: string;
    warehouse_id: string;
    max_quantity?: number | string;
    max_weight_kg?: number | string;
    max_volume_cm3?: number | string;
    current_quantity?: number | string;
    current_weight_kg?: number | string;
    current_volume_cm3?: number | string;
    type?: string;
    pallet_type?: string;
    palletType?: string;
    warehouse_code?: string;
    warehouse?: {
        id?: string;
        code?: string;
    };
    status?: PalletStatus | string;
    is_active?: boolean;
    created_by?: string;
    created_at?: string;
    updated_by?: string;
    updated_at?: string;
}

const extractSingle = <T>(payload: unknown): T | null => {
    if (!payload || typeof payload !== 'object') return null;

    const record = payload as Record<string, unknown>;
    if (record?.data && typeof record.data === 'object' && !Array.isArray(record.data)) {
        return record.data as T;
    }
    if (record?.item && typeof record.item === 'object' && !Array.isArray(record.item)) {
        return record.item as T;
    }
    if (record?.result && typeof record.result === 'object' && !Array.isArray(record.result)) {
        return record.result as T;
    }

    return payload as T;
};

export const palletService = {
    getAll: async (
        skip: number = 0,
        limit: number = 500,
        filters?: {
            warehouse_id?: string;
            warehouse_code?: string;
            supplier_id?: string;
            supplier_code?: string;
        }
    ) => {
        const safeLimit = Math.min(Math.max(Number(limit) || 0, 1), 500);
        const response = await api.get('/pallets', {
            params: { skip, limit: safeLimit, ...(filters || {}) },
        });
        return response.data;
    },

    getById: async (palletId: string) => {
        const response = await api.get(`/pallets/${palletId}`);
        return extractSingle<PalletData>(response.data);
    },

    create: async (data: PalletData) => {
        const response = await api.post('/pallets', data);
        return response.data;
    },

    update: async (palletId: string, data: Partial<PalletData>) => {
        const response = await api.patch(`/pallets/${palletId}`, data);
        return response.data;
    },
};
