import api from './api';

const normalizeItem = (p: any) => {
    if (!p) return {} as any;
    // Helper to extract value from potentially nested or varied keys
    const getVal = (obj: any, keys: string[]) => {
        for (const key of keys) {
            if (obj && obj[key] !== undefined && obj[key] !== null) {
                if (typeof obj[key] === 'object' && obj[key].name) return obj[key].name;
                if (typeof obj[key] === 'object' && obj[key].code) return obj[key].code;
                return obj[key];
            }
        }
        return null;
    };

    return {
        id: p.id,
        skuCode: p.sku_code || p.code || "N/A",
        description: p.description || "",
        shortDescription: p.short_description || "",
        primaryBarcode: p.primary_barcode || p.barcode || "",
        altBarcodes: Array.isArray(p.alt_barcodes) ? p.alt_barcodes : [],
        rfidTag: p.rfid_tag || "",
        baseUom: p.base_uom || p.uom || p.unit_of_measure || "N/A",
        altUom: p.alt_uom || "",
        uomConversion: p.uom_conversion || 0,
        uomHierarchy: p.uom_hierarchy || {},
        lengthCm: p.length_cm || 0,
        widthCm: p.width_cm || 0,
        heightCm: p.height_cm || 0,
        weightKg: p.weight_kg || 0,
        volumeCc: p.volume_cc || 0,
        palletQuantity: p.pallet_quantity || 0,
        caseQuantity: p.case_quantity || 0,
        innerQuantity: p.inner_quantity || 0,
        itemType: p.item_type || "",
        itemCategory: p.item_category || p.category || "",
        category: getVal(p, ['category', 'category_name', 'categoryName']) || "N/A",
        storageCondition: p.storage_condition || "",
        velocityClass: p.velocity_class || "",
        fefoEnabled: p.fefo_enabled ?? true,
        fifoEnabled: p.fifo_enabled ?? true,
        shelfLifeDays: p.shelf_life_days || 0,
        batchRequired: p.batch_required ?? true,
        serialRequired: p.serial_required ?? true,
        pickFaceEligible: p.pick_face_eligible ?? true,
        pickFaceCapacity: p.pick_face_capacity || 0,
        pickFaceReplenishmentPoint: p.pick_face_replenishment_point || 0,
        preferredZones: p.preferred_zones || [],
        preferredBinTypes: p.preferred_bin_types || [],
        pickingStrategy: p.picking_strategy || "",
        maxStackHeight: p.max_stack_height || 0,
        maxQtyPerBin: p.max_qty_per_bin || 0,
        compatibilityRules: p.compatibility_rules || {},
        isHazardous: p.is_hazardous ?? true,
        hazardClass: p.hazard_class || "",
        hazmatCode: p.hazmat_code || "",
        requiresInspection: p.requires_inspection ?? true,
        inspectionRule: p.inspection_rule || "",
        samplePercentage: p.sample_percentage || 0,
        quarantineOnFailure: p.quarantine_on_failure ?? true,
        hsnCode: p.hsn_code || "",
        taxRate: p.tax_rate || 0,
        active: p.active ?? true,
        velocityScore: p.velocity_score || 0,
        pickFrequency: p.pick_frequency || 0,
        lastVelocityCalc: p.last_velocity_calc || null,
        // Keep these for backward compatibility/UI if needed
        productName: p.product_name || p.name || p.description || "Unknown Product",
        minStockLevel: p.min_stock || p.minStock || 0,
        unitPrice: p.unit_price || p.price || p.unitPrice || 0,
        stock: p.stock_quantity || p.stock || 0
    };
};

export const skuService = {
    getAll: async () => {
        const response = await api.get('/items/');
        const data = Array.isArray(response.data) ? response.data : (response.data?.items || []);
        return data.map(normalizeItem);
    },

    getById: async (id: string | number) => {
        const response = await api.get(`/items/${id}`);
        return normalizeItem(response.data);
    },

    search: async (query: string) => {
        const response = await api.get('/items/', { params: { search: query } });
        const data = Array.isArray(response.data) ? response.data : (response.data?.items || []);
        return data.map(normalizeItem);
    },

    create: async (data: any) => {
        const response = await api.post('/items/', data);
        return response.data; // Usually returns the created object, normalization happens on next fetch
    },

    update: async (id: string | number, data: any) => {
        const response = await api.patch(`/items/${id}`, data);
        return response.data;
    },

    delete: async (id: string | number) => {
        const response = await api.delete(`/items/${id}`);
        return response.data;
    }
};
