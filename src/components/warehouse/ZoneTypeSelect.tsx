import * as React from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";

export const ZONE_TYPES = [
    { value: 'RECEIVING',  label: 'Receiving Area',       category: 'Inbound/Outbound' },
    { value: 'STAGING',    label: 'Staging / Cross-Dock', category: 'Inbound/Outbound' },
    { value: 'DISPATCH',   label: 'Dispatch / Shipping',  category: 'Inbound/Outbound' },
    { value: 'BULK',       label: 'Bulk Storage',         category: 'Storage' },
    { value: 'PALLET',     label: 'Pallet Racking',       category: 'Storage' },
    { value: 'RACK',       label: 'Rack / Shelf Storage', category: 'Storage' },
    { value: 'FLOOR',      label: 'Floor Storage',        category: 'Storage' },
    { value: 'PICKER',     label: 'Pick Face (A-Class)',  category: 'Picking' },
    { value: 'NORMAL',     label: 'Standard Pick Zone',   category: 'Picking' },
    { value: 'PACKING',    label: 'Packing Station',      category: 'Processing' },
    { value: 'RETURNS',    label: 'Returns Processing',   category: 'Processing' },
    { value: 'QUARANTINE', label: 'Quarantine',           category: 'Special Handling' },
    { value: 'REJECTED',   label: 'Rejected / Damaged',   category: 'Special Handling' },
    { value: 'HAZMAT',     label: 'Hazardous Materials',  category: 'Special Handling' },
    { value: 'HIGH_VALUE', label: 'High Value (Secure)',  category: 'Special Handling' },
    { value: 'COLD_STORAGE', label: 'Cold Storage',        category: 'Special Handling' },
];

interface ZoneTypeSelectProps {
    value: string;
    onValueChange: (value: string) => void;
    id?: string;
    className?: string;
    disabled?: boolean;
}

export function ZoneTypeSelect({ value, onValueChange, id, className, disabled }: ZoneTypeSelectProps) {
    const [open, setOpen] = React.useState(false);

    const categories = Array.from(new Set(ZONE_TYPES.map(z => z.category)));

    const selectedLabel = React.useMemo(() => 
        ZONE_TYPES.find((opt) => opt.value === value)?.label || value || "Select zone type...",
    [value]);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    id={id}
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className={cn("w-full justify-between font-normal h-10", className)}
                    disabled={disabled}
                >
                    <span className="truncate">{selectedLabel}</span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                <Command>
                    <CommandInput placeholder="Search zone type..." />
                    <CommandList>
                        <CommandEmpty>No zone type found.</CommandEmpty>
                        {categories.map((category) => (
                            <CommandGroup key={category} heading={category}>
                                {ZONE_TYPES.filter(z => z.category === category).map((option) => (
                                    <CommandItem
                                        key={option.value}
                                        value={option.value}
                                        onSelect={(currentValue) => {
                                            onValueChange(currentValue === value ? "" : currentValue);
                                            setOpen(false);
                                        }}
                                    >
                                        <Check
                                            className={cn(
                                                "mr-2 h-4 w-4",
                                                value === option.value ? "opacity-100" : "opacity-0"
                                            )}
                                        />
                                        {option.label} ({option.value})
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        ))}
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}
