import { useEffect, useMemo, useRef, useState } from "react";
import { AxiosError } from "axios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { trolleyService, type Trolley, type TrolleyStatus, type WarehouseOption } from "@/services/trolleyService";

interface TrolleyFormValues {
  trolley_barcode: string;
  warehouse_id: string;
  capacity_kg: string;
  capacity_units: string;
  current_location: string;
  status: TrolleyStatus;
}

const defaultValues: TrolleyFormValues = {
  trolley_barcode: "",
  warehouse_id: "",
  capacity_kg: "",
  capacity_units: "",
  current_location: "",
  status: "ACTIVE",
};

interface TrolleyFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  initialData?: Trolley | null;
  onSuccess: (savedTrolley?: Trolley) => Promise<void> | void;
}

export default function TrolleyFormModal({
  open,
  onOpenChange,
  mode,
  initialData,
  onSuccess,
}: TrolleyFormModalProps) {
  const [form, setForm] = useState<TrolleyFormValues>(defaultValues);
  const [saving, setSaving] = useState(false);
  const [inlineError, setInlineError] = useState<string>("");

  const [warehouseQuery, setWarehouseQuery] = useState("");
  const [warehouseOptions, setWarehouseOptions] = useState<WarehouseOption[]>([]);
  const [warehouseLoading, setWarehouseLoading] = useState(false);
  const [warehouseDropdownOpen, setWarehouseDropdownOpen] = useState(false);
  const warehousePickerRef = useRef<HTMLDivElement>(null);
  const isEditLocked = mode === "edit" && initialData?.status === "IN-PACKING";

  useEffect(() => {
    if (!open) return;

    if (mode === "edit" && initialData) {
      setForm({
        trolley_barcode: initialData.trolley_barcode,
        warehouse_id: initialData.warehouse_id,
        capacity_kg: String(initialData.capacity_kg),
        capacity_units: String(initialData.capacity_units),
        current_location: initialData.current_location || "",
        status: initialData.status,
      });
      setWarehouseQuery(initialData.warehouse_name || "");
    } else {
      setForm(defaultValues);
      setWarehouseQuery("");
    }

    setInlineError("");
  }, [open, mode, initialData]);

  useEffect(() => {
    if (!open) return;

    let alive = true;
    const timer = setTimeout(async () => {
      setWarehouseLoading(true);
      try {
        const list = warehouseQuery.trim()
          ? await trolleyService.searchWarehouses(warehouseQuery.trim())
          : await trolleyService.getWarehouses();
        if (alive) {
          setWarehouseOptions(list);
        }
      } catch {
        if (alive) {
          setWarehouseOptions([]);
        }
      } finally {
        if (alive) {
          setWarehouseLoading(false);
        }
      }
    }, 300);

    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [open, warehouseQuery]);

  useEffect(() => {
    if (!open) return;

    const onDocumentClick = (event: MouseEvent) => {
      if (!warehousePickerRef.current) return;
      if (!warehousePickerRef.current.contains(event.target as Node)) {
        setWarehouseDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", onDocumentClick);
    return () => document.removeEventListener("mousedown", onDocumentClick);
  }, [open]);

  const selectedWarehouse = useMemo(() => {
    return warehouseOptions.find((w) => w.warehouse_id === form.warehouse_id) || null;
  }, [warehouseOptions, form.warehouse_id]);

  const warehouseList = useMemo(() => {
    const query = warehouseQuery.trim().toLowerCase();
    if (!query) return warehouseOptions;
    return warehouseOptions.filter((warehouse) => {
      const label = `${warehouse.warehouse_name} ${warehouse.location}`.toLowerCase();
      return label.includes(query);
    });
  }, [warehouseOptions, warehouseQuery]);

  const readApiErrorMessage = (error: unknown): string => {
    const axiosError = error as AxiosError<{ detail?: unknown; message?: unknown }>;
    const detail = axiosError.response?.data?.detail;
    const message = axiosError.response?.data?.message;

    if (typeof detail === "string" && detail.trim()) return detail;
    if (Array.isArray(detail)) {
      const text = detail
        .map((item) => {
          if (typeof item === "string") return item;
          if (item && typeof item === "object") {
            const row = item as { msg?: unknown; loc?: unknown };
            const msg = String(row.msg ?? "").trim();
            const loc = Array.isArray(row.loc)
              ? String(row.loc[row.loc.length - 1] ?? "").trim()
              : "";
            if (loc && msg) return `${loc}: ${msg}`;
            if (msg) return msg;
          }
          return "";
        })
        .filter(Boolean)
        .join("; ");
      if (text) return text;
    }
    if (detail && typeof detail === "object") return JSON.stringify(detail);
    if (typeof message === "string" && message.trim()) return message;
    return "Failed to save trolley.";
  };

  const handleWarehouseQueryChange = (value: string) => {
    setWarehouseQuery(value);
    setWarehouseDropdownOpen(true);
    setForm((prev) => ({ ...prev, warehouse_id: "" }));
  };

  const chooseWarehouse = (warehouse: WarehouseOption) => {
    const label = warehouse.location
      ? `${warehouse.warehouse_name} - ${warehouse.location}`
      : warehouse.warehouse_name;
    setWarehouseQuery(label);
    setForm((prev) => ({ ...prev, warehouse_id: warehouse.warehouse_id }));
    setWarehouseDropdownOpen(false);
  };

  const validate = (): boolean => {
    if (!form.trolley_barcode.trim()) {
      setInlineError("Trolley Barcode is required.");
      return false;
    }
    if (!form.warehouse_id) {
      setInlineError("Warehouse is required.");
      return false;
    }

    const capacityKg = Number(form.capacity_kg);
    const capacityUnits = Number(form.capacity_units);

    if (!Number.isFinite(capacityKg) || capacityKg <= 0) {
      setInlineError("Capacity (kg) must be a positive number.");
      return false;
    }

    if (!Number.isFinite(capacityUnits) || capacityUnits <= 0) {
      setInlineError("Capacity (Units) must be a positive number.");
      return false;
    }

    setInlineError("");
    return true;
  };

  const submit = async () => {
    if (isEditLocked) {
      setInlineError("Trolley cannot be edited while status is IN-PACKING.");
      return;
    }

    if (!validate()) return;

    let resolvedWarehouseId = form.warehouse_id;
    if (!resolvedWarehouseId && warehouseQuery.trim()) {
      const query = warehouseQuery.trim().toLowerCase();
      const exact = warehouseOptions.find((warehouse) => {
        const label = warehouse.location
          ? `${warehouse.warehouse_name} - ${warehouse.location}`
          : warehouse.warehouse_name;
        return label.toLowerCase() === query || warehouse.warehouse_name.toLowerCase() === query;
      });
      const partial = warehouseOptions.find((warehouse) => {
        const label = `${warehouse.warehouse_name} ${warehouse.location}`.toLowerCase();
        return label.includes(query);
      });
      const picked = exact || partial;
      if (picked) {
        resolvedWarehouseId = picked.warehouse_id;
        setForm((prev) => ({ ...prev, warehouse_id: picked.warehouse_id }));
      }
    }

    if (!resolvedWarehouseId) {
      setInlineError("Warehouse is required. Please select a warehouse from the dropdown.");
      return;
    }

    setSaving(true);
    setInlineError("");

    const payload = {
      trolley_barcode: form.trolley_barcode.trim(),
      warehouse_id: resolvedWarehouseId,
      capacity_kg: Number(form.capacity_kg),
      capacity_units: Number(form.capacity_units),
      current_location: form.current_location.trim(),
      status: form.status,
    };

    try {
      let savedTrolley: Trolley;
      if (mode === "edit" && initialData?.trolley_id) {
        savedTrolley = await trolleyService.update(initialData.trolley_id, payload);
      } else {
        savedTrolley = await trolleyService.create(payload);
      }

      onOpenChange(false);
      await onSuccess(savedTrolley);
    } catch (error) {
      setInlineError(readApiErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Add Trolley" : "Edit Trolley"}</DialogTitle>
          <DialogDescription>
            {mode === "create" ? "Create a new trolley record." : "Update trolley details."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1.5 md:col-span-2">
            <label className="text-xs text-muted-foreground">Trolley Barcode</label>
            <Input
              value={form.trolley_barcode}
              onChange={(e) => setForm((p) => ({ ...p, trolley_barcode: e.target.value }))}
              placeholder="e.g. TROLLEY-001"
            />
          </div>

          <div className="space-y-1.5 md:col-span-2" ref={warehousePickerRef}>
            <label className="text-xs text-muted-foreground">Warehouse</label>
            <div className="relative">
              <Input
                value={warehouseQuery}
                onFocus={() => setWarehouseDropdownOpen(true)}
                onChange={(e) => handleWarehouseQueryChange(e.target.value)}
                placeholder="Search and select warehouse..."
              />

              {warehouseDropdownOpen && (
                <div className="absolute z-50 mt-1 max-h-56 w-full overflow-auto rounded-md border border-input bg-popover p-1 shadow-md">
                  {warehouseLoading && (
                    <p className="px-2 py-1.5 text-xs text-muted-foreground">Searching warehouses...</p>
                  )}

                  {!warehouseLoading && warehouseList.length === 0 && (
                    <p className="px-2 py-1.5 text-xs text-muted-foreground">No warehouses found.</p>
                  )}

                  {!warehouseLoading && warehouseList.map((warehouse) => (
                    <button
                      key={warehouse.warehouse_id}
                      type="button"
                      onClick={() => chooseWarehouse(warehouse)}
                      className="flex w-full items-start justify-between rounded-sm px-2 py-1.5 text-left text-sm hover:bg-muted/30"
                    >
                      <span className="font-medium">{warehouse.warehouse_name}</span>
                      <span className="text-xs text-muted-foreground">{warehouse.location || "-"}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Selected: {selectedWarehouse ? `${selectedWarehouse.warehouse_name}${selectedWarehouse.location ? ` (${selectedWarehouse.location})` : ""}` : "None"}
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">Capacity (kg)</label>
            <Input
              type="number"
              min="0"
              value={form.capacity_kg}
              onChange={(e) => setForm((p) => ({ ...p, capacity_kg: e.target.value }))}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">Capacity (Units)</label>
            <Input
              type="number"
              min="0"
              value={form.capacity_units}
              onChange={(e) => setForm((p) => ({ ...p, capacity_units: e.target.value }))}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">Current Location</label>
            <Input
              value={form.current_location}
              onChange={(e) => setForm((p) => ({ ...p, current_location: e.target.value }))}
              placeholder="Optional"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">Status</label>
            <select
              value={form.status}
              onChange={(e) => setForm((p) => ({ ...p, status: e.target.value as TrolleyStatus }))}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="ACTIVE">ACTIVE</option>
              <option value="INACTIVE">INACTIVE</option>
              <option value="IN-PACKING">IN-PACKING</option>
            </select>
          </div>
        </div>

        {inlineError && (
          <p className="text-sm text-destructive">{inlineError}</p>
        )}

        {isEditLocked && (
          <p className="text-sm text-destructive">Trolley cannot be edited while status is IN-PACKING.</p>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} disabled={saving || isEditLocked}>
            {saving ? "Saving..." : mode === "create" ? "Create" : "Save"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
