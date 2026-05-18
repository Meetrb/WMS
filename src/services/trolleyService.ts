import api from "./api";

export type TrolleyStatus = "ACTIVE" | "INACTIVE" | "IN-PACKING";

export interface Trolley {
  trolley_id: string;
  trolley_barcode: string;
  warehouse_id: string;
  warehouse_name?: string;
  warehouse_location?: string;
  capacity_kg: number;
  capacity_units: number;
  current_location: string;
  status: TrolleyStatus;
  created_at?: string;
}

export interface TrolleyWritePayload {
  trolley_barcode: string;
  warehouse_id: string;
  capacity_kg: number;
  capacity_units: number;
  current_location?: string | null;
  status: TrolleyStatus;
}

export interface WarehouseOption {
  warehouse_id: string;
  warehouse_name: string;
  location: string;
}

export interface Rack {
  rack_id: string;
  rack_barcode: string;
  trolley_id: string;
  position_on_trolley: number;
  sales_order_id?: string;
  status: string;
  total_items_to_pick: number;
  items_picked_count: number;
  created_at?: string;
}

export interface RackCreatePayload {
  rack_barcode: string;
  trolley_id: string;
  position_on_trolley: number;
  status: "ACTIVE" | "INACTIVE";
  total_items_to_pick: number;
  items_picked_count: number;
}

export interface StartOrderPayload {
  trolley_id?: string;
  trolley_barcode?: string;
  task_id?: string;
  sales_order_id?: string;
  order_number?: string;
}

const extractArray = (payload: unknown): unknown[] => {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === "object") {
    const wrapped = payload as Record<string, unknown>;
    const nested = wrapped.data ?? wrapped.items ?? wrapped.results ?? wrapped.warehouses ?? wrapped.trolleys;
    return Array.isArray(nested) ? nested : [];
  }
  return [];
};

const toNumber = (value: unknown): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const normalizeStatus = (value: unknown): TrolleyStatus => {
  const text = String(value ?? "").trim().toUpperCase();
  if (text === "ACTIVE" || text === "AVAILABLE") return "ACTIVE";
  if (text === "INACTIVE" || text === "MAINTENANCE") return "INACTIVE";
  if (text === "IN-PACKING" || text === "IN_PACKING" || text === "IN_USE") return "IN-PACKING";
  return "ACTIVE";
};

const parseTrolley = (raw: unknown): Trolley => {
  const row = (raw ?? {}) as Record<string, unknown>;
  const warehouse = (row.warehouse ?? {}) as Record<string, unknown>;

  return {
    trolley_id: String(row.trolley_id ?? row.id ?? ""),
    trolley_barcode: String(row.trolley_barcode ?? row.barcode ?? ""),
    warehouse_id: String(row.warehouse_id ?? warehouse.warehouse_id ?? warehouse.id ?? ""),
    warehouse_name: String(warehouse.warehouse_name ?? warehouse.name ?? row.warehouse_name ?? ""),
    warehouse_location: String(warehouse.location ?? row.warehouse_location ?? ""),
    capacity_kg: toNumber(row.capacity_kg),
    capacity_units: toNumber(row.capacity_units),
    current_location: String(row.current_location ?? ""),
    status: normalizeStatus(row.status),
    created_at: row.created_at ? String(row.created_at) : undefined,
  };
};

const parseWarehouse = (raw: unknown): WarehouseOption => {
  const row = (raw ?? {}) as Record<string, unknown>;
  return {
    warehouse_id: String(row.warehouse_id ?? row.id ?? ""),
    warehouse_name: String(row.warehouse_name ?? row.name ?? ""),
    location: String(row.location ?? row.address ?? ""),
  };
};

const parseRack = (raw: unknown): Rack => {
  const row = (raw ?? {}) as Record<string, unknown>;
  return {
    rack_id: String(row.rack_id ?? row.id ?? ""),
    rack_barcode: String(row.rack_barcode ?? row.barcode ?? ""),
    trolley_id: String(row.trolley_id ?? ""),
    position_on_trolley: toNumber(row.position_on_trolley),
    sales_order_id: row.sales_order_id ? String(row.sales_order_id) : undefined,
    status: String(row.status ?? ""),
    total_items_to_pick: toNumber(row.total_items_to_pick),
    items_picked_count: toNumber(row.items_picked_count),
    created_at: row.created_at ? String(row.created_at) : undefined,
  };
};

export const trolleyService = {
  getAll: async (): Promise<Trolley[]> => {
    const response = await api.get("/trolleys/");
    return extractArray(response.data).map(parseTrolley);
  },

  getById: async (trolleyId: string): Promise<Trolley> => {
    const response = await api.get(`/trolleys/${trolleyId}`);
    return parseTrolley(response.data);
  },

  create: async (payload: TrolleyWritePayload): Promise<Trolley> => {
    const response = await api.post("/trolleys/", payload);
    return parseTrolley(response.data);
  },

  update: async (trolleyId: string, payload: TrolleyWritePayload): Promise<Trolley> => {
    const response = await api.patch(`/trolleys/${trolleyId}`, payload);
    return parseTrolley(response.data);
  },

  getWarehouses: async (): Promise<WarehouseOption[]> => {
    const response = await api.get("/warehouses/");
    return extractArray(response.data).map(parseWarehouse);
  },

  searchWarehouses: async (search: string): Promise<WarehouseOption[]> => {
    const response = await api.get("/warehouses/", { params: { search } });
    return extractArray(response.data).map(parseWarehouse);
  },

  getRacksByTrolleyId: async (trolleyId: string): Promise<Rack[]> => {
    const response = await api.get(`/trolleys/${trolleyId}/racks`);
    return extractArray(response.data).map(parseRack);
  },

  createRack: async (payload: RackCreatePayload): Promise<unknown> => {
    const response = await api.post("/trolleys/racks", payload);
    return response.data;
  },

  startOrder: async (payload: StartOrderPayload): Promise<unknown> => {
    const response = await api.post("/trolleys/ops/start-order", payload);
    return response.data;
  },
};
