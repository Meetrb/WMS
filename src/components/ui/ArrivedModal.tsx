import React, { useState, useEffect, useRef } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { inboundService } from "@/services/inboundService";
import { warehouseService, type Warehouse } from "@/services/warehouseService";

import { PhoneInput } from "@/components/ui/PhoneInput";

const VEHICLE_CONFIGS: Record<string, { placeholder: string; regex: RegExp; helperText: string; formatter?: (v: string) => string }> = {
    "+91": {
        placeholder: "Example: GJ05AB1234",
        regex: /^[A-Z]{2}[0-9]{2}[A-Z]{1,2}[0-9]{4}$/,
        helperText: "Format: GJ05AB1234 (State, RTO, Series, Number)",
        formatter: (v) => v.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10)
    },
    "+1": {
        placeholder: "Example: ABC1234",
        regex: /^[A-Z0-9]{1,8}$/,
        helperText: "USA format: Max 8 Alphanumeric characters",
        formatter: (v) => v.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8)
    },
    "+44": {
        placeholder: "Example: AB12 XYZ",
        regex: /^[A-Z]{2}[0-9]{2}\s?[A-Z]{3}$/,
        helperText: "UK format: AB12 XYZ",
        formatter: (v) => {
            let val = v.toUpperCase().replace(/[^A-Z0-9]/g, "");
            if (val.length > 4) return val.slice(0, 4) + " " + val.slice(4, 7);
            return val;
        }
    },
    "+49": {
        placeholder: "Example: B AB 1234",
        regex: /^[A-Z]{1,3}\s?[A-Z]{1,2}\s?[0-9]{1,4}$/,
        helperText: "Germany format: City(1-3) Letters(1-2) Numbers(1-4)",
        formatter: (v) => v.toUpperCase()
    },
    "+971": {
        placeholder: "Example: Dubai 12345",
        regex: /^([A-Z]+\s)?[0-9]{1,6}$/,
        helperText: "UAE format: Optional City + Number (e.g. Dubai 12345)",
        formatter: (v) => v.toUpperCase()
    }
};


interface InboundData {
    id: string;
    asn_number?: string;
    warehouse_code?: string;
    warehouseCode?: string;
    expectedDate?: string;
    expected_arrival_date?: string;
    driverName?: string;
    driver_name?: string;
    driverPhone?: string;
    driver_phone?: string;
    vehicleNumber?: string;
    vehicle_number?: string;
    receivingDock?: string;
    dock_number?: string;
    notes?: string;
}

interface ArrivedModalProps {
    open: boolean;
    setOpen: (open: boolean) => void;
    inbound: InboundData | null;
    onSuccess: () => void;
}

export const ArrivedModal: React.FC<ArrivedModalProps> = ({ open, setOpen, inbound, onSuccess }) => {
    const fieldClassName = "rounded-md hover:border-primary/40 focus-visible:ring-primary/30";
    const cancelButtonRef = useRef<HTMLButtonElement>(null);
    const submitButtonRef = useRef<HTMLButtonElement>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [defaultWarehouseCode, setDefaultWarehouseCode] = useState<string>("");
    const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
    const [warehouseSearch, setWarehouseSearch] = useState("");
    const [warehouseOpen, setWarehouseOpen] = useState(false);
    const [countryCodeOpen, setCountryCodeOpen] = useState(false);

    const [formData, setFormData] = useState({
        expectedDate: "",
        warehouseCode: "",
        driverName: "",
        countryCode: "+971",
        driverPhone: "",
        vehicleNumber: "",
        receivingDock: "",
        notes: "",
        status: "arrived"
    });

    // Fetch active warehouses
    useEffect(() => {
        if (open) {
            warehouseService.getActive()
                .then((data) => {
                    setWarehouses(data || []);
                    // Set default warehouse code
                    if (data && data.length > 0) {
                        setDefaultWarehouseCode(data[0].code || "");
                    }
                })
                .catch((err) => {
                    console.error("Failed to fetch warehouses:", err);
                    toast.error("Failed to load warehouses");
                });
        }
    }, [open]);

    useEffect(() => {
        if (inbound && open) {
            // Format datetime-local string (YYYY-MM-DDThh:mm) using local time
            const pad = (n: number) => String(n).padStart(2, "0");
            
            // Always default arrival date/time to CURRENT local time for "Actual Arrival"
            const now = new Date();
            const formattedDate = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;

            const clean = (val: any) => {
                if (val === "N/A" || val === "undefined" || val === "null" || val === null || val === undefined) {
                    return "";
                }
                return String(val);
            };

            setFormData({
                expectedDate: formattedDate,
                warehouseCode: clean(inbound.warehouse_code || inbound.warehouseCode || defaultWarehouseCode),
                driverName: clean(inbound.driverName || inbound.driver_name),
                countryCode: "+971",
                driverPhone: clean(inbound.driverPhone || inbound.driver_phone),
                vehicleNumber: clean(inbound.vehicleNumber || inbound.vehicle_number),
                receivingDock: clean(inbound.receivingDock || inbound.dock_number),
                notes: clean(inbound.notes),
                status: "arrived"
            });
        }
    }, [inbound, open, defaultWarehouseCode]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleWarehouseSelect = (warehouseCode: string) => {
        setFormData(prev => ({
            ...prev,
            warehouseCode: warehouseCode
        }));
        setWarehouseOpen(false);
        setWarehouseSearch("");
        
        // Move focus to the next field (Driver Name) after a small delay
        // to allow the popover to close and focus return to be handled
        setTimeout(() => {
            const nextField = document.getElementById("driverName");
            if (nextField) {
                nextField.focus();
            }
        }, 100);
    };

    const handleWarehouseTriggerKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "ArrowDown" || e.key === "Enter") {
            if (!warehouseOpen) {
                e.preventDefault();
                setWarehouseOpen(true);
            }
        }
    };

    const handleCountryCodeSelect = (code: string) => {
        setFormData(prev => ({
            ...prev,
            countryCode: code
        }));
    };

    const handleNotesKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            submitButtonRef.current?.focus();
        }
    };


    // Get current date/time for restrictions



    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    const minDateTime = `${todayStr}T00:00`;
    const maxDateTime = `${todayStr}T23:59`;

    const currentVehConfig = VEHICLE_CONFIGS[formData.countryCode] || {
        placeholder: "N/A",
        regex: /.*/,
        helperText: ""
    };

    const isVehEmpty = !formData.vehicleNumber.trim();
    const isVehValid = isVehEmpty || currentVehConfig.regex.test(formData.vehicleNumber);
    const showSuccess = !isVehEmpty && isVehValid;
    const showErr = !isVehEmpty && !isVehValid;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!inbound?.id) {
            toast.error("Invalid Inbound ID");
            return;
        }

        // Validate that the date is today
        const selectedDate = new Date(formData.expectedDate);
        const isToday = selectedDate.getFullYear() === now.getFullYear() &&
                        selectedDate.getMonth() === now.getMonth() &&
                        selectedDate.getDate() === now.getDate();

        if (!isToday) {
            toast.error("Arrival date must be today's date.");
            return;
        }

        setIsLoading(true);
        try {
            // Map form data exactly to requested backend schema
            const fullPhoneNumber = formData.driverPhone ? `${formData.countryCode}${formData.driverPhone}` : null;
            const payload = {
                actual_arrival_date: formData.expectedDate ? formData.expectedDate.replace("T", " ") + ":00" : new Date().toISOString(),
                receiving_dock: formData.receivingDock || null,
                driver_name: formData.driverName || null,
                driver_phone: fullPhoneNumber,
                vehicle_number: formData.vehicleNumber || null,
                notes: formData.notes || null,
                warehouse_code:
                    (formData.warehouseCode && formData.warehouseCode !== "N/A" && formData.warehouseCode !== "undefined")
                        ? formData.warehouseCode
                        : (defaultWarehouseCode || "WH-DXB-01")
            };

            // Use POST method for arrival at /inbound/asn/{asn_number}/arrive
            await inboundService.updateArrival(inbound.asn_number || inbound.id, payload);

            toast.success("Shipment marked as arrived successfully");
            setOpen(false);
            onSuccess();
        } catch (error) {
            console.error("Error updating inbound status:", error);
            toast.error("Failed to update shipment status");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent className="sm:max-w-[580px] rounded-none">
                <DialogHeader>
                    <DialogTitle>Mark as Arrived</DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="expectedDate">Arrival Date & Time <span className="text-destructive">*</span></Label>
                        <Input
                            id="expectedDate"
                            name="expectedDate"
                            type="datetime-local"
                            value={formData.expectedDate}
                            onChange={handleInputChange}
                            placeholder="N/A"
                            min={minDateTime}
                            max={maxDateTime}
                            className={fieldClassName}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="warehouseCode">Warehouse Code <span className="text-destructive">*</span></Label>
                            <Popover open={warehouseOpen} onOpenChange={setWarehouseOpen}>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        role="combobox"
                                        aria-expanded={warehouseOpen}
                                        onKeyDown={handleWarehouseTriggerKeyDown}
                                        className="w-full justify-between rounded-md border-input bg-background hover:bg-primary/10 hover:text-foreground hover:border-primary/40 focus-visible:ring-primary/30"
                                    >
                                        {formData.warehouseCode
                                            ? warehouses.find(w => w.code === formData.warehouseCode)?.name || formData.warehouseCode
                                            : "N/A"}
                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[200px] rounded-md p-0">
                                    <Command>
                                        <CommandInput
                                            placeholder="Search warehouse..."
                                            value={warehouseSearch}
                                            onValueChange={setWarehouseSearch}
                                            className={fieldClassName}
                                        />
                                        <CommandList>
                                            <CommandEmpty>No warehouse found.</CommandEmpty>
                                            <CommandGroup>
                                                {warehouses.map((warehouse) => (
                                                    <CommandItem
                                                        key={warehouse.code}
                                                        value={`${warehouse.code} ${warehouse.name}`}
                                                        onSelect={() => handleWarehouseSelect(warehouse.code)}
                                                        className="group rounded-md border border-transparent hover:bg-primary/10 hover:text-foreground hover:border-primary/40 data-[selected=true]:bg-primary/10 data-[selected=true]:text-foreground data-[selected=true]:border-primary/50 [&[data-selected=true]_.warehouse-name]:text-foreground/80"
                                                    >
                                                        <Check
                                                            className={cn(
                                                                "mr-2 h-4 w-4",
                                                                formData.warehouseCode === warehouse.code
                                                                    ? "opacity-100"
                                                                    : "opacity-0"
                                                            )}
                                                        />
                                                        <div className="flex flex-col">
                                                            <span className="font-medium">{warehouse.code}</span>
                                                            <span className="warehouse-name text-xs text-muted-foreground group-hover:text-foreground/80">{warehouse.name}</span>
                                                        </div>
                                                    </CommandItem>
                                                ))}
                                            </CommandGroup>
                                        </CommandList>
                                    </Command>
                                </PopoverContent>
                            </Popover>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="driverName">Driver Name <span className="text-destructive">*</span></Label>
                            <Input
                                id="driverName"
                                name="driverName"
                                value={formData.driverName}
                                onChange={handleInputChange}
                                placeholder="N/A"
                                className={fieldClassName}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="driverPhone">Driver Phone <span className="text-destructive">*</span></Label>
                            <PhoneInput
                                id="driverPhone"
                                value={formData.driverPhone}
                                countryCode={formData.countryCode}
                                onPhoneChange={(val) => setFormData(prev => ({ ...prev, driverPhone: val }))}
                                onCountryCodeChange={handleCountryCodeSelect}
                                placeholder="N/A"
                                className="flex-1"
                                required
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="vehicleNumber" className={cn(showErr && "text-destructive")}>Vehicle Number <span className="text-destructive">*</span></Label>
                            <Input
                                id="vehicleNumber"
                                name="vehicleNumber"
                                value={formData.vehicleNumber}
                                onChange={(e) => {
                                    let val = e.target.value;
                                    if (currentVehConfig.formatter) {
                                        val = currentVehConfig.formatter(val);
                                    } else {
                                        val = val.toUpperCase();
                                    }
                                    setFormData(prev => ({ ...prev, vehicleNumber: val }));
                                }}
                                placeholder={currentVehConfig.placeholder}
                                className={cn(
                                    fieldClassName,
                                    showErr && "border-destructive focus-visible:ring-destructive/30",
                                    showSuccess && "border-green-500 focus-visible:ring-green-500/30"
                                )}
                            />
                            {showErr && currentVehConfig.helperText && (
                                <p className="text-[10px] text-destructive font-medium animate-in fade-in slide-in-from-top-1 duration-200">
                                    {currentVehConfig.helperText}
                                </p>
                            )}
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="receivingDock">Receiving Dock <span className="text-destructive">*</span></Label>
                            <Input
                                id="receivingDock"
                                name="receivingDock"
                                value={formData.receivingDock}
                                onChange={handleInputChange}
                                placeholder="N/A"
                                className={fieldClassName}
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="notes">Notes</Label>
                        <Textarea
                            id="notes"
                            name="notes"
                            value={formData.notes}
                            onChange={handleInputChange}
                            onKeyDown={handleNotesKeyDown}
                            placeholder="Add any additional notes here..."
                            rows={3}
                            className={fieldClassName}
                        />
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t">
                        <Button
                            type="button"
                            variant="outline"
                            ref={cancelButtonRef}
                            onClick={() => setOpen(false)}
                            disabled={isLoading}
                            className="rounded-md"
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            ref={submitButtonRef}
                            disabled={isLoading}
                            className="rounded-md bg-green-600 hover:bg-green-700"
                        >
                            {isLoading ? "Saving..." : "Mark as Arrived"}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
};
