import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
    Package,
    Weight,
    Maximize,
    Layers,
    Calendar,
    User,
    Tag,
    Barcode,
    CheckCircle2,
    AlertCircle,
    Boxes,
} from "lucide-react";
import { type PalletData } from "@/services/palletService";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface PalletDetailCardProps {
    pallet: PalletData;
}

const DetailItem = ({
    icon: Icon,
    label,
    value,
    className,
}: {
    icon: any;
    label: string;
    value: string | number | undefined;
    className?: string;
}) => (
    <div className={cn("flex items-start gap-3 py-2.5", className)}>
        <div className="mt-0.5 rounded-md bg-muted/50 p-1.5">
            <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                {label}
            </p>
            <p className="break-all text-base font-semibold text-foreground">
                {value !== undefined && value !== null && value !== "" ? String(value) : "-"}
            </p>
        </div>
    </div>
);

const MetricTile = ({
    icon: Icon,
    title,
    current,
    max,
    className,
}: {
    icon: any;
    title: string;
    current: string | number | undefined;
    max: string | number | undefined;
    className?: string;
}) => (
    <div className={cn("p-1", className)}>
        <div className="mb-2 flex items-center gap-2 text-muted-foreground">
            <Icon className="h-4 w-4" />
            <p className="text-xs font-semibold uppercase tracking-[0.12em]">{title}</p>
        </div>
        <div className="grid grid-cols-2 gap-2">
            <div>
                <p className="text-[11px] text-muted-foreground">Current</p>
                <p className="break-all text-2xl font-bold leading-none tracking-tight tabular-nums">{current ?? "-"}</p>
            </div>
            <div>
                <p className="text-[11px] text-muted-foreground">Max</p>
                <p className="break-all text-2xl font-bold leading-none tracking-tight tabular-nums">{max ?? "-"}</p>
            </div>
        </div>
    </div>
);

export const PalletDetailCard: React.FC<PalletDetailCardProps> = ({ pallet }) => {
    const formatValue = (val: any) => {
        if (val === undefined || val === null || val === "") return "-";
        if (typeof val === "number") return val.toLocaleString();
        if (typeof val === "string" && /^-?\d+(\.\d+)?$/.test(val.trim())) {
            return val;
        }
        return String(val);
    };

    const getStatusBadge = (status?: string) => {
        const s = status?.toUpperCase();
        if (s === "ACTIVE" || s === "AVAILABLE") {
            return <Badge className="bg-green-500/15 text-green-600 hover:bg-green-500/20 border-green-200">
                <CheckCircle2 className="mr-1 h-3 w-3" /> {status}
            </Badge>;
        }
        if (s === "REJECTED" || s === "INACTIVE") {
            return <Badge className="bg-red-500/15 text-red-600 hover:bg-red-500/20 border-red-200">
                <AlertCircle className="mr-1 h-3 w-3" /> {status}
            </Badge>;
        }
        return <Badge variant="outline">{status || "UNKNOWN"}</Badge>;
    };

    return (
        <Card className="w-full overflow-hidden rounded-2xl border border-border/70 bg-card shadow-md">
            <CardHeader className="border-b bg-gradient-to-r from-muted/70 via-muted/40 to-transparent px-6 pb-5 pt-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                        <div className="rounded-lg bg-primary/10 p-2">
                            <Package className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                            <CardTitle className="text-lg font-bold tracking-tight sm:text-xl">
                                {pallet.pallet_code || "Unnamed Pallet"}
                            </CardTitle>
                            <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                                <Tag className="h-3 w-3" /> {pallet.pallet_type || "STANDARD"} type pallet
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Badge variant="outline" className="bg-background/70">
                            <Boxes className="mr-1 h-3 w-3" />
                            Pallet
                        </Badge>
                        {pallet.status && getStatusBadge(pallet.status)}
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-6 px-6 py-6">
                <section className="space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">
                        Identification
                    </h3>
                    <div className="grid grid-cols-1 gap-1">
                        <DetailItem icon={Barcode} label="Barcode" value={pallet.barcode} />
                        <DetailItem icon={Tag} label="Pallet Code" value={pallet.pallet_code} />
                    </div>
                </section>

                <Separator className="opacity-50" />

                <section className="space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">
                        Capacity & Metrics
                    </h3>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                        <MetricTile
                            icon={Layers}
                            title="Quantity"
                            current={formatValue(pallet.current_quantity)}
                            max={formatValue(pallet.max_quantity)}
                        />
                        <MetricTile
                            icon={Weight}
                            title="Weight (kg)"
                            current={formatValue(pallet.current_weight_kg)}
                            max={formatValue(pallet.max_weight_kg)}
                            className="md:border-l md:pl-6"
                        />
                        <MetricTile
                            icon={Maximize}
                            title="Volume (cm3)"
                            current={formatValue(pallet.current_volume_cm3)}
                            max={formatValue(pallet.max_volume_cm3)}
                            className="md:border-l md:pl-6"
                        />
                    </div>
                </section>

                <Separator className="opacity-50" />

                <section className="space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">
                        Metadata
                    </h3>
                    <div className="grid grid-cols-1 gap-1 md:grid-cols-2 md:gap-x-8">
                        <DetailItem
                            icon={Calendar}
                            label="Created At"
                            value={pallet.created_at ? new Date(pallet.created_at).toLocaleString() : undefined}
                        />
                        <DetailItem icon={User} label="Created By" value={pallet.created_by} />
                        <DetailItem
                            icon={Calendar}
                            label="Updated At"
                            value={pallet.updated_at ? new Date(pallet.updated_at).toLocaleString() : undefined}
                        />
                        <DetailItem icon={User} label="Updated By" value={pallet.updated_by} />
                    </div>
                </section>
            </CardContent>
        </Card>
    );
};
