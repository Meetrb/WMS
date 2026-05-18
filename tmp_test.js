const fs = require('fs');

const payload = {
    "summary": {
        "inspection_id": "b6863fa1-5f47-4ca9-ab94-0484dd1ff0de",
        "grn_number": "GRN-20260421-0001",
        "warehouse": "WH-001",
        "total_items": 1,
        "expected_quantity": "200.000",
        "accepted_quantity": "150.000",
        "grn_rejected_quantity": "50.000",
        "grn_shortage_quantity": "0.000",
        "exception_rate_percent": 25.0,
        "resolved_quantity": "0",
        "pending_quantity": "50.000"
    },
    "line_items": [
        {
            "id": "c680aab7-68a9-4912-a051-8a18915c8600",
            "sku": "SKU-001",
            "description": "Samsung S26 ultra 12Gb 1Tb",
            "expected_qty": "200.000",
            "received_qty": "200.000",
            "rejected_qty": "50.000",
            "rejection_reason": "Rejected item moved to rejected pallet",
            "decision": null,
            "decision_notes": null
        }
    ]
};

const asRecord = (value) => (value && typeof value === 'object' ? value : {});

const asString = (value, fallback = "-") => {
  if (value === undefined || value === null || value === "") return fallback;
  return String(value);
};

const asNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const normalizeExceptionLine = (raw) => {
  const row = asRecord(raw);
  const lineType = asString(row.type ?? "").toUpperCase();
  const inspected = asNumber(row.inspected_quantity ?? row.quantity);
  const pending = asNumber(row.pending_quantity);
  const derivedRejected = lineType === "REJECTED" ? (pending || inspected) : 0;
  const derivedShortage = lineType === "SHORTAGE" ? (pending || inspected) : 0;

  return {
    inspection_detail_id: asString(row.inspection_detail_id ?? row.id ?? row.detail_id, ""),
    sku: asString(row.sku ?? row.item_sku ?? row.sku_code),
    item_description: asString(row.item_description ?? row.description ?? row.item_name),
    expected_quantity: asNumber(row.expected_quantity ?? row.expected_qty ?? row.inspected_quantity),
    received_quantity: asNumber(row.received_quantity ?? row.received_qty ?? row.inspected_quantity),
    rejected_quantity: asNumber(row.rejected_quantity ?? row.rejected_qty ?? row.inspected_quantity ?? derivedRejected),
    rejection_reason: asString(row.rejection_reason ?? row.reason ?? "-"),
    shortage_quantity: asNumber(row.shortage_quantity ?? row.shortage_qty ?? derivedShortage),
    decision: asString(row.decision ?? "").toUpperCase() === "ACCEPT" ? "ACCEPT" : "RETURN",
    decision_notes: asString(row.decision_notes ?? row.notes ?? "", ""),
  };
};

const normalizeInspectionReport = (raw) => {
  const payload = asRecord(raw);
  const summary = asRecord(payload.summary);
  const linesSource =
    (Array.isArray(payload.line_items) && payload.line_items) ||
    (Array.isArray(payload.lines) && payload.lines) ||
    (Array.isArray(payload.details) && payload.details) ||
    (Array.isArray(payload.exception_items) && payload.exception_items) ||
    [];

  const normalizedLines = linesSource.map(normalizeExceptionLine).filter((line) => line.inspection_detail_id);
  
  const derivedReceivedTotal = normalizedLines.reduce((acc, line) => acc + line.received_quantity, 0);

  return {
    received_total: asNumber(payload.received_total ?? payload.total_received ?? summary.received_quantity ?? derivedReceivedTotal),
    derivedReceivedTotal: derivedReceivedTotal,
  };
};

console.log(normalizeInspectionReport(payload));
