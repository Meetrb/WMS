import * as React from "react";
import { Check, ChevronsUpDown, Search } from "lucide-react";
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

export const BIN_TYPES = {
    "Storage Bin Types": [
        "COLD_STORAGE_BIN",
        "FROZEN_BIN",
        "HAZMAT_BIN",
        "BULK_BIN",
        "HIGH_VALUE_BIN",
        "OVERSIZE_BIN",
        "AMBIENT_BIN"
    ],
    "Operational Bin Types": [
        "PICK_BIN",
        "REPLENISHMENT_BIN",
        "QUARANTINE_BIN",
        "STAGING_BIN",
        "RETURN_BIN"
    ],
    "Specialized Bin Types": [
        "FAST_PICK_BIN",
        "CROSS_DOCK_BIN",
        "QC_BIN",
        "DAMAGE_BIN",
        "CONSOLIDATION_BIN"
    ]
};

interface BinTypeSelectProps {
    value: string;
    onValueChange: (value: string) => void;
    id?: string;
    className?: string;
    disabled?: boolean;
}

export function BinTypeSelect({ value, onValueChange, id, className, disabled }: BinTypeSelectProps) {
    const [open, setOpen] = React.useState(false);

    const allOptions = React.useMemo(() => 
        Object.values(BIN_TYPES).flat(),
    []);

    const selectedLabel = React.useMemo(() => 
        allOptions.find((opt) => opt === value) || value || "Select bin type...",
    [value, allOptions]);

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
                    <CommandInput placeholder="Search bin type..." />
                    <CommandList>
                        <CommandEmpty>No bin type found.</CommandEmpty>
                        {Object.entries(BIN_TYPES).map(([group, options]) => (
                            <CommandGroup key={group} heading={group}>
                                {options.map((option) => (
                                    <CommandItem
                                        key={option}
                                        value={option}
                                        onSelect={(currentValue) => {
                                            onValueChange(currentValue === value ? "" : currentValue);
                                            setOpen(false);
                                        }}
                                    >
                                        <Check
                                            className={cn(
                                                "mr-2 h-4 w-4",
                                                value === option ? "opacity-100" : "opacity-0"
                                            )}
                                        />
                                        {option}
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
