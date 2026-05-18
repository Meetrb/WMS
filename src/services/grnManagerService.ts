import api from "./api";

export interface GrnManagerPallet {
  id?: string;
  barcode?: string;
  pallet_code?: string;
  type?: string;
  pallet_type?: string;
  palletType?: string;
  category?: string;
  pallet_category?: string;
  status?: string;
  warehouse_id?: string;
  warehouse_code?: string;
  warehouse?: {
    id?: string;
    code?: string;
  };
}

export interface GrnManagerCreateGrnItem {
  asn_shipment_item_id: string;
  received_quantity: number;
  pallets: Array<{
    pallet_barcode: string;
    quantity: number;
    status: string;
  }>;
  rejected_pallets: Array<{
    pallet_barcode: string;
    quantity: number;
    status: string;
    reason: string;
  }>;
  shortage_note: string;
  rejection_note: string;
}

export interface GrnManagerCreateGrnPayload {
  inbound_shipment_id: string;
  items: GrnManagerCreateGrnItem[];
}

const extractList = <T>(payload: unknown): T[] => {
  if (Array.isArray(payload)) return payload as T[];

  const record = payload as Record<string, unknown>;
  if (Array.isArray(record?.items)) return record.items as T[];
  if (Array.isArray(record?.results)) return record.results as T[];
  if (Array.isArray(record?.data)) return record.data as T[];

  return [];
};

export const grnManagerService = {
  getArrivedInbounds: async (skip = 0, limit = 100) => {
    const response = await api.get("/inbound/today/arrived", {
      params: { skip, limit },
    });
    return extractList<Record<string, unknown>>(response.data);
  },

  getPallets: async (
    skip = 0,
    limit = 500,
    filters?: {
      warehouse_id?: string;
      warehouse_code?: string;
      type?: string;
    }
  ) => {
    const params = { skip, limit, ...(filters || {}) };
    const typeValues = filters?.type
      ? Array.from(new Set([filters.type, filters.type.toUpperCase(), filters.type.toLowerCase()]))
      : [];

    const typeAliasParams = typeValues.flatMap((typeValue) => [
      { ...params, type: typeValue },
      { ...params, pallet_type: typeValue },
      { ...params, palletType: typeValue },
    ]);

    const attempts = [
      () => api.get("/pallets", { params }),
      () => api.get("/pallets/", { params }),
      () => api.get("/pallets", { params: { ...params, limit: 500 } }),
      () => api.get("/pallets/", { params: { ...params, limit: 500 } }),
      ...typeAliasParams.map((aliasParams) => () => api.get("/pallets", { params: aliasParams })),
      ...typeAliasParams.map((aliasParams) => () => api.get("/pallets/", { params: aliasParams })),
      () => api.get("/pallets", { params: filters || {} }),
      () => api.get("/pallets/", { params: filters || {} }),
    ];

    let lastError: unknown = null;
    for (const attempt of attempts) {
      try {
        const response = await attempt();
        return extractList<GrnManagerPallet>(response.data);
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError ?? new Error("Failed to fetch pallets.");
  },

  getPalletsByWarehouseId: async (warehouseId: string) => {
    const normalizedWarehouseId = String(warehouseId ?? "").trim();
    if (!normalizedWarehouseId) return [];

    const attempts = [
      () => api.get(`/pallets/warehouse/${normalizedWarehouseId}`),
      () => api.get(`/pallets/warehouse/${normalizedWarehouseId}/`),
    ];

    let lastError: unknown = null;
    for (const attempt of attempts) {
      try {
        const response = await attempt();
        return extractList<GrnManagerPallet>(response.data);
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError ?? new Error("Failed to fetch pallets by warehouse.");
  },

  createGrn: async (payload: GrnManagerCreateGrnPayload) => {
    const response = await api.post("/inbound/grn", payload);
    return response.data;
  },

  getGrns: async (skip = 0, limit = 100) => {
    const response = await api.get("/inbound/grns", {
      params: { skip, limit },
    });
    return response.data;
  },

  getGrnById: async (id: string) => {
    const response = await api.get(`/inbound/grn/${id}`);
    return response.data;
  },
};
