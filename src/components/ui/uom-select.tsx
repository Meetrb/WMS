import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export const UOM_OPTIONS = [
  "PCS",
  "EA",
  "BOX",
  "CASE",
  "CTN",
  "PACK",
  "PALLET",
  "KG",
  "G",
  "LB",
  "L",
  "ML",
  "M",
  "CM",
  "MM",
  "FT",
  "IN",
  "DOZEN",
]

type UomSelectProps = {
  value?: string
  onValueChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  triggerClassName?: string
  contentClassName?: string
  id?: string
  onKeyDown?: (e: React.KeyboardEvent) => void
}

export function UomSelect({
  value,
  onValueChange,
  placeholder = "Select UOM",
  disabled = false,
  triggerClassName,
  contentClassName,
  id,
  onKeyDown,
}: UomSelectProps) {
  return (
    <Select value={value || undefined} onValueChange={onValueChange} disabled={disabled}>
      <SelectTrigger id={id} className={triggerClassName} onKeyDown={onKeyDown}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className={contentClassName ?? "max-h-72"}>
        {UOM_OPTIONS.map((uom) => (
          <SelectItem key={uom} value={uom}>
            {uom}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
