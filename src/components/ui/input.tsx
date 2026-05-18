import * as React from "react"

import { cn } from "@/lib/utils"

const MAX_DATE_VALUE = "9999-12-31"
const MAX_DATETIME_LOCAL_VALUE = "9999-12-31T23:59"
const SHIFT_TAB_MEMORY_MS = 300

let lastShiftTabAt = 0

if (typeof window !== "undefined") {
  window.addEventListener("keydown", (event) => {
    if (event.key === "Tab" && event.shiftKey) {
      lastShiftTabAt = Date.now()
    }
  })
}

const clampTemporalYearToFourDigits = (
  inputType: React.ComponentProps<"input">["type"],
  value: string
): string => {
  if (!value || (inputType !== "date" && inputType !== "datetime-local")) return value

  const [datePart, timePart] = value.split("T")
  const datePieces = datePart.split("-")
  if (datePieces.length === 0) return value

  const year = datePieces[0] ?? ""
  if (year.length <= 4) return value

  const clampedDatePart = [year.slice(0, 4), ...datePieces.slice(1)].join("-")
  return inputType === "datetime-local" && timePart !== undefined
    ? `${clampedDatePart}T${timePart}`
    : clampedDatePart
}

const isCompleteTemporalValue = (
  inputType: React.ComponentProps<"input">["type"],
  value: string
): boolean => {
  if (inputType === "date") {
    return /^\d{4}-\d{2}-\d{2}$/.test(value)
  }

  if (inputType === "datetime-local") {
    return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)
  }

  return true
}

const keepTemporalFieldFocused = (
  inputType: React.ComponentProps<"input">["type"],
  input: HTMLInputElement,
  relatedTarget?: HTMLElement | null
): boolean => {
  if (inputType !== "date" && inputType !== "datetime-local") return false

  // Allow backward navigation (Shift+Tab) to escape the focus lock
  const isRecentShiftTab = Date.now() - lastShiftTabAt <= SHIFT_TAB_MEMORY_MS
  if (isRecentShiftTab) return false

  // Allow focus to move to any element that appears before this input in the DOM
  if (relatedTarget) {
    const isPreceding = !!(input.compareDocumentPosition(relatedTarget) & Node.DOCUMENT_POSITION_PRECEDING);
    if (isPreceding) return false;
  }

  if (!input.value && !input.required) return false
  if (isCompleteTemporalValue(inputType, input.value) && input.checkValidity()) return false

  window.requestAnimationFrame(() => {
    input.focus()
    moveTemporalFocusToIncompleteSegment(inputType, input)
  })

  return true
}

const syncTemporalRequiredValidityMessage = (
  inputType: React.ComponentProps<"input">["type"],
  input: HTMLInputElement
) => {
  if ((inputType === "date" || inputType === "datetime-local") && input.required && !input.value) {
    input.setCustomValidity("please fill the date")
    return
  }

  input.setCustomValidity("")
}

const getTemporalSelectionRange = (
  inputType: React.ComponentProps<"input">["type"],
  value: string
): [number, number] | null => {
  if (inputType !== "date" && inputType !== "datetime-local") return null

  if (inputType === "date") {
    if (value.length < 4) return [0, 4]
    if (value.length < 7) return [5, 7]
    if (value.length < 10) return [8, 10]
    return [8, 10]
  }

  if (value.length < 4) return [0, 4]
  if (value.length < 7) return [5, 7]
  if (value.length < 10) return [8, 10]
  if (value.length < 13) return [11, 13]
  if (value.length < 16) return [14, 16]
  return [14, 16]
}

const moveTemporalFocusToIncompleteSegment = (
  inputType: React.ComponentProps<"input">["type"],
  input: HTMLInputElement
) => {
  const selectionRange = getTemporalSelectionRange(inputType, input.value)
  if (!selectionRange) return

  try {
    input.setSelectionRange(selectionRange[0], selectionRange[1])
  } catch {
    // Some browsers expose native date editors without text selection APIs.
  }
}

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string | boolean;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, max, error, onChange, onFocus, onBlur, onKeyDown, onInvalid, ...props }, ref) => {
    const isDateInput = type === "date"
    const isNumberInput = type === "number"
    const [internalError, setInternalError] = React.useState<string>("")

    const displayValue =
      isNumberInput && (props.value === 0 || props.value === "0") ? "" : props.value
    const placeholder = props.placeholder ?? (isNumberInput ? "0" : undefined)

    const maxValue =
      max ??
      (type === "date"
        ? MAX_DATE_VALUE
        : type === "datetime-local"
          ? MAX_DATETIME_LOCAL_VALUE
          : undefined)

    const validateDate = (input: HTMLInputElement) => {
      if (type === "date" || type === "datetime-local") {
        const value = input.value
        const min = input.min
        const max = input.max
        if (min && value && value < min) {
          setInternalError("Date cannot be in the past")
        } else if (max && value && value > max) {
          setInternalError("Date cannot be too far in the future")
        } else {
          setInternalError("")
        }
      }
    }

    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      const nextValue = clampTemporalYearToFourDigits(type, event.currentTarget.value)
      if (nextValue !== event.currentTarget.value) {
        event.currentTarget.value = nextValue
      }

      syncTemporalRequiredValidityMessage(type, event.currentTarget)
      validateDate(event.currentTarget)

      onChange?.(event)
    }

    const handleFocus = (event: React.FocusEvent<HTMLInputElement>) => {
      const isRecentShiftTab = Date.now() - lastShiftTabAt <= SHIFT_TAB_MEMORY_MS
      if (isRecentShiftTab) {
        moveTemporalFocusToIncompleteSegment(type, event.currentTarget)
      } else if (type === "date" || type === "datetime-local") {
        moveTemporalFocusToIncompleteSegment(type, event.currentTarget)
      }

      onFocus?.(event)
    }

    const handleBlur = (event: React.FocusEvent<HTMLInputElement>) => {
      syncTemporalRequiredValidityMessage(type, event.currentTarget)
      validateDate(event.currentTarget)

      onBlur?.(event)

      keepTemporalFieldFocused(type, event.currentTarget, event.relatedTarget as HTMLElement)
    }

    const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
      onKeyDown?.(event)

      if (!event.defaultPrevented && event.key === "Tab" && !event.shiftKey && keepTemporalFieldFocused(type, event.currentTarget)) {
        event.preventDefault()
      }
    }

    const handleInvalid = (event: React.FormEvent<HTMLInputElement>) => {
      syncTemporalRequiredValidityMessage(type, event.currentTarget)
      onInvalid?.(event)
    }

    const activeError = error || internalError

    return (
      <div className="w-full space-y-1">
        <input
          type={type}
          max={maxValue}
          className={cn(
            "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm transition-all duration-200",
            isDateInput &&
              "appearance-none [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-datetime-edit-inner-spin-button]:hidden [&::-webkit-datetime-edit-outer-spin-button]:hidden",
            activeError && "border-destructive bg-destructive/5 focus-visible:ring-destructive shadow-[0_0_8px_rgba(239,68,68,0.2)]",
            className
          )}
          ref={ref}
          {...props}
          placeholder={placeholder}
          value={displayValue}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          onInvalid={handleInvalid}
        />
        {typeof activeError === "string" && activeError && (
          <p className="text-xs font-medium text-destructive animate-in fade-in slide-in-from-top-1">
            {activeError}
          </p>
        )}
      </div>
    )
  }
)
Input.displayName = "Input"

export { Input }
