import React, { useState, useEffect } from "react";
import { Check, ChevronsUpDown, AlertTriangle } from "lucide-react";
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
import { Input } from "@/components/ui/input";

export interface CountryData {
    code: string;
    country: string;
    digits: number;
}

export const COUNTRY_DATA: CountryData[] = [
    { code: "+971", country: "UAE", digits: 9 },
    { code: "+91", country: "India", digits: 10 },
    { code: "+1", country: "USA/Canada", digits: 10 },
    { code: "+44", country: "United Kingdom", digits: 10 },
    { code: "+966", country: "Saudi Arabia", digits: 9 },
    { code: "+974", country: "Qatar", digits: 8 },
    { code: "+965", country: "Kuwait", digits: 8 },
    { code: "+968", country: "Oman", digits: 8 },
    { code: "+973", country: "Bahrain", digits: 8 },
    { code: "+212", country: "Morocco", digits: 9 },
    { code: "+20", country: "Egypt", digits: 10 },
    { code: "+234", country: "Nigeria", digits: 10 },
    { code: "+27", country: "South Africa", digits: 9 },
    { code: "+86", country: "China", digits: 11 },
    { code: "+81", country: "Japan", digits: 10 },
    { code: "+61", country: "Australia", digits: 9 },
    { code: "+33", country: "France", digits: 9 },
    { code: "+49", country: "Germany", digits: 11 },
    { code: "+39", country: "Italy", digits: 10 },
    { code: "+34", country: "Spain", digits: 9 },
];

interface PhoneInputProps {
    value: string;
    countryCode: string;
    onPhoneChange: (value: string) => void;
    onCountryCodeChange: (code: string) => void;
    placeholder?: string;
    id?: string;
    className?: string;
    disabled?: boolean;
    required?: boolean;
}

export const PhoneInput: React.FC<PhoneInputProps> = ({
    value,
    countryCode,
    onPhoneChange,
    onCountryCodeChange,
    placeholder = "Phone number",
    id,
    className,
    disabled = false,
    required = false,
}) => {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState("");
    const phoneInputRef = React.useRef<HTMLInputElement>(null);

    const selectedCountry = COUNTRY_DATA.find((c) => c.code === countryCode) || COUNTRY_DATA[0];

    const filteredCountries = COUNTRY_DATA.filter(
        (c) =>
            c.country.toLowerCase().includes(search.toLowerCase()) ||
            c.code.includes(search)
    );

    const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value.replace(/\D/g, ""); // Only digits
        if (selectedCountry && val.length <= selectedCountry.digits) {
            onPhoneChange(val);
        } else if (!selectedCountry) {
            onPhoneChange(val);
        }
    };

    const handleCountryCodeKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
        // Open dropdown on ArrowDown key
        if (e.key === "ArrowDown" && !open) {
            e.preventDefault();
            setOpen(true);
        }
    };

    const handleCountrySelect = (currentValue: string) => {
        onCountryCodeChange(currentValue);
        setOpen(false);
        setSearch("");
        // Auto-focus to phone field after country code selection
        setTimeout(() => {
            phoneInputRef.current?.focus();
        }, 0);
    };

    return (
        <div className={cn("flex gap-2", className)}>
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button
                        variant="outline"
                        role="combobox"
                        data-enter-nav="include"
                        aria-expanded={open}
                        className="w-[100px] justify-between px-3"
                        disabled={disabled}
                        onKeyDown={handleCountryCodeKeyDown}
                    >
                        {countryCode}
                        <ChevronsUpDown className="ml-1 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[200px] p-0">
                    <Command shouldFilter={false}>
                        <CommandInput
                            placeholder="Search country..."
                            value={search}
                            onValueChange={setSearch}
                        />
                        <CommandList>
                            <CommandEmpty>No country found.</CommandEmpty>
                            <CommandGroup>
                                {filteredCountries.map((country) => (
                                    <CommandItem
                                        key={country.code}
                                        value={country.code}
                                        onSelect={handleCountrySelect}
                                    >
                                        <Check
                                            className={cn(
                                                "mr-2 h-4 w-4",
                                                countryCode === country.code ? "opacity-100" : "opacity-0"
                                            )}
                                        />
                                        <div className="flex flex-col">
                                            <span>{country.country}</span>
                                            <span className="text-xs text-muted-foreground">{country.code}</span>
                                        </div>
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        </CommandList>
                    </Command>
                </PopoverContent>
            </Popover>
            <div className="flex-1">
                <Input
                    ref={phoneInputRef}
                    id={id}
                    type="tel"
                    value={value || ""}
                    onChange={handlePhoneChange}
                    placeholder={`${placeholder} (${selectedCountry?.digits} digits)`}
                    className={cn(
                        "w-full transition-all duration-200",
                        (value || "").length > 0 && (value || "").length !== selectedCountry?.digits && "border-destructive ring-destructive focus-visible:ring-destructive bg-destructive/5",
                        (value || "").length > 0 && (value || "").length === selectedCountry?.digits && "border-emerald-500/50 focus-visible:ring-emerald-500/30 bg-emerald-500/5",
                        className
                    )}
                    disabled={disabled}
                    required={required}
                    maxLength={selectedCountry?.digits}
                    minLength={selectedCountry?.digits}
                    title={selectedCountry ? `Phone number must be exactly ${selectedCountry.digits} digits for ${selectedCountry.country}` : ""}
                />
                {(value || "").length > 0 && (value || "").length < (selectedCountry?.digits || 0) && (
                    <div className="flex items-center gap-1.5 text-destructive mt-1.5 px-1 animate-in fade-in slide-in-from-top-1 duration-300">
                        <AlertTriangle className="h-3.5 w-3.5 fill-destructive/10" />
                        <p className="text-[11px] font-extrabold uppercase tracking-tight">
                            Requires exactly {selectedCountry?.digits} digits
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};

export const isPhoneValid = (phone: string, countryCode: string): boolean => {
    const country = COUNTRY_DATA.find(c => c.code === countryCode) || COUNTRY_DATA[0];
    return (phone || "").length === country.digits;
};
