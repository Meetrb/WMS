import api from './api';

export interface CreateSalesOrderItemPayload {
    item_id: string;
    item_sku: string;
    item_description: string;
    quantity_ordered: number;
    unit_price: number;
    lot_number: string;
    batch_number: string;
    expiry_date: string;
    notes: string;
}

export interface CreateSalesOrderPayload {
    customer_id: string;
    customer_name: string;
    customer_email: string;
    requested_delivery_date: string;
    priority: 'HIGH' | 'MEDIUM' | 'LOW';
    notes: string;
    warehouse_id: string;
    items: CreateSalesOrderItemPayload[];
}

export interface SalesOrderItemOption {
    id: string;
    sku: string;
    description: string;
    unitPrice: number;
    lotNumber: string;
    batchNumber: string;
    lotRequired: boolean;
    batchRequired: boolean;
    expiryRequired: boolean;
}

export interface SalesOrderCustomerOption {
    id: string;
    name: string;
    email: string;
}

export interface CreateCustomerPayload {
    code: string;
    name: string;
    email: string;
    phone: string;
    mobile: string;
    address_line1: string;
    address_line2: string;
    city: string;
    state: string;
    country: string;
    pincode: string;
    gstin: string;
    pan: string;
    tax_type: string;
    contact_person_name: string;
    contact_person_phone: string;
    contact_person_email: string;
    business_type: string;
    payment_terms: string;
    credit_limit: number;
    default_warehouse_id: string;
    default_shipping_method: string;
    is_active: boolean;
    is_verified: boolean;
    notes: string;
    custom_data?: Record<string, unknown>;
}

export interface UpdateCustomerPayload {
    code: string;
    name: string;
    email: string;
    phone: string;
    mobile: string;
    address_line1: string;
    address_line2: string;
    city: string;
    state: string;
    country: string;
    pincode: string;
    gstin: string;
    pan: string;
    tax_type: string;
    contact_person_name: string;
    contact_person_phone: string;
    contact_person_email: string;
    business_type: string;
    payment_terms: string;
    credit_limit: number;
    default_shipping_method: string;
    is_active: boolean;
    is_verified: boolean;
    notes: string;
}

const normalizeCustomerOption = (raw: unknown): SalesOrderCustomerOption | null => {
    const customer = (raw ?? {}) as Record<string, unknown>;
    const id = String(customer.id ?? customer.customer_id ?? '').trim();
    const name = String(customer.name ?? customer.customer_name ?? customer.full_name ?? '').trim();
    const email = String(customer.email ?? customer.customer_email ?? '').trim();

    if (!id || !name) return null;
    return { id, name, email };
};

const extractSalesOrders = (payload: unknown): unknown[] => {
    if (Array.isArray(payload)) return payload;

    if (payload && typeof payload === 'object') {
        const wrapped = payload as Record<string, unknown>;
        const nested = wrapped.data ?? wrapped.items ?? wrapped.results ?? wrapped.orders;
        return Array.isArray(nested) ? nested : [];
    }

    return [];
};

const toFiniteNumber = (value: unknown): number => {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
};

const extractSalesItems = (payload: unknown): SalesOrderItemOption[] => {
    const source = Array.isArray(payload)
        ? payload
        : payload && typeof payload === 'object'
            ? ((payload as Record<string, unknown>).data ??
                (payload as Record<string, unknown>).items ??
                (payload as Record<string, unknown>).results)
            : [];

    if (!Array.isArray(source)) return [];

    return source
        .map((entry) => {
            const item = (entry ?? {}) as Record<string, unknown>;
            const id = String(item.id ?? item.item_id ?? '').trim();
            const sku = String(item.sku_code ?? item.item_sku ?? item.sku ?? item.code ?? '').trim();
            if (!id || !sku) return null;

            return {
                id,
                sku,
                description: String(item.description ?? item.product_name ?? item.name ?? '').trim(),
                unitPrice: toFiniteNumber(item.unit_price ?? item.price ?? item.unitPrice),
                lotNumber: String(item.lot_number ?? item.lot ?? '').trim(),
                batchNumber: String(item.batch_number ?? item.batch ?? '').trim(),
                lotRequired: Boolean(item.lot_required ?? item.lotRequired ?? false),
                batchRequired: Boolean(item.batch_required ?? item.batchRequired ?? false),
                expiryRequired: Boolean(item.expiry_required ?? false),
            };
        })
        .filter((item): item is SalesOrderItemOption => Boolean(item));
};

const extractCustomers = (payload: unknown): SalesOrderCustomerOption[] => {
    const source = Array.isArray(payload)
        ? payload
        : payload && typeof payload === 'object'
            ? ((payload as Record<string, unknown>).data ??
                (payload as Record<string, unknown>).items ??
                (payload as Record<string, unknown>).results ??
                (payload as Record<string, unknown>).customers)
            : [];

    if (!Array.isArray(source)) return [];

    return source
        .map((entry) => {
            const customer = (entry ?? {}) as Record<string, unknown>;
            const id = String(customer.id ?? customer.customer_id ?? '').trim();
            const name = String(
                customer.name ?? customer.customer_name ?? customer.full_name ?? ''
            ).trim();
            const email = String(customer.email ?? customer.customer_email ?? '').trim();

            if (!id || !name) return null;

            return {
                id,
                name,
                email,
            };
        })
        .filter((customer): customer is SalesOrderCustomerOption => Boolean(customer));
};

const extractInventoryWarehouseItems = (payload: unknown): SalesOrderItemOption[] => {
    const source = Array.isArray(payload)
        ? payload
        : payload && typeof payload === 'object'
            ? ((payload as Record<string, unknown>).data ??
                (payload as Record<string, unknown>).items ??
                (payload as Record<string, unknown>).results ??
                (payload as Record<string, unknown>).inventory)
            : [];

    if (!Array.isArray(source)) return [];

    return source
        .map((entry) => {
            const item = (entry ?? {}) as Record<string, unknown>;
            const id = String(item.item_id ?? item.item_master_id ?? item.id ?? '').trim();
            const sku = String(item.item_sku ?? item.sku_code ?? item.sku ?? item.code ?? '').trim();
            if (!id || !sku) return null;

            return {
                id,
                sku,
                description: String(item.item_description ?? item.description ?? item.name ?? '').trim(),
                unitPrice: toFiniteNumber(item.unit_price ?? item.price ?? item.unitPrice),
                lotNumber: String(item.lot_number ?? item.lot ?? '').trim(),
                batchNumber: String(item.batch_number ?? item.batch ?? '').trim(),
                lotRequired: Boolean(item.lot_required ?? item.lotRequired ?? false),
                batchRequired: Boolean(item.batch_required ?? item.batchRequired ?? false),
                expiryRequired: Boolean(item.expiry_required ?? false),
            };
        })
        .filter((item): item is SalesOrderItemOption => Boolean(item));
};

export const salesOrderService = {
    getAll: async () => {
        const response = await api.get<unknown>('/sales/orders');
        return extractSalesOrders(response.data);
    },

    getOrderDetails: async (orderId: string) => {
        const response = await api.get(`/sales/orders/${orderId}`);
        return response.data;
    },

    confirmOrder: async (orderId: string) => {
        const response = await api.post(`/sales/orders/${orderId}/confirm`, {});
        return response.data;
    },

    create: async (data: CreateSalesOrderPayload) => {
        const response = await api.post('/sales/orders', data);
        return response.data;
    },

    getItems: async () => {
        try {
            const response = await api.get<unknown>('/itmes/');
            return extractSalesItems(response.data);
        } catch {
            const response = await api.get<unknown>('/items/');
            return extractSalesItems(response.data);
        }
    },

    getItemsByWarehouse: async (warehouseId: string) => {
        const response = await api.get<unknown>(`/inventory/warehouse/${warehouseId}`);
        return extractInventoryWarehouseItems(response.data);
    },

    getCustomers: async () => {
        const response = await api.get<unknown>('/customers/');
        return extractCustomers(response.data);
    },

    createCustomer: async (payload: CreateCustomerPayload) => {
        const response = await api.post<unknown>('/customers', payload);
        const created = normalizeCustomerOption(response.data);
        if (created) return created;

        const fallback = extractCustomers(response.data);
        if (fallback.length > 0) return fallback[0];

        throw new Error('Customer created but response format was unexpected.');
    },

    getCustomerById: async (customerId: string) => {
        try {
            const response = await api.get<unknown>(`/customers/${customerId}`);
            return response.data;
        } catch {
            const fallbackResponse = await api.get<unknown>(`/customers/${customerId}/`);
            return fallbackResponse.data;
        }
    },

    updateCustomer: async (customerId: string, payload: UpdateCustomerPayload) => {
        let responseData: unknown;

        try {
            const response = await api.patch<unknown>(`/customers/${customerId}`, payload);
            responseData = response.data;
        } catch {
            const fallbackResponse = await api.patch<unknown>(`/customers/${customerId}/`, payload);
            responseData = fallbackResponse.data;
        }

        const updated = normalizeCustomerOption(responseData);
        if (updated) return updated;

        return {
            id: customerId,
            name: payload.name,
            email: payload.email,
        };
    },
};
  