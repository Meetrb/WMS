import { useCallback, useEffect, useMemo, useState } from "react";
import api from "@/api/axios";

interface ActiveTask {
  id: string;
  task_number: string;
  item_sku: string;
  item_description: string;
  quantity_to_put: string;
  quantity_put: string;
  status: string;
  priority: number;
  source_location: string;
  suggested_bin_code: string;
  item_id?: string;
  item_barcode?: string;
  item_alt_barcodes?: string[] | null;
  grn_number?: string;
  asn_number?: string;
  suggested_bin_id?: string;
  suggested_bin_barcode?: string;
  suggested_zone?: string;
  suggested_aisle?: string;
  suggested_rack?: string;
  suggested_shelf?: string;
  suggested_position?: string;
  lot_number?: string | null;
  batch_number?: string | null;
  expiry_date?: string | null;
  assigned_at?: string | null;
  started_at?: string | null;
}

interface WorkerDashboard {
  worker_name: string;
  tasks_assigned: number;
  tasks_in_progress: number;
  tasks_completed_today: number;
  items_put_today: string;
  active_tasks: ActiveTask[];
}

const buildMockDashboard = (): WorkerDashboard => ({
  worker_name: "Alex Worker",
  tasks_assigned: 6,
  tasks_in_progress: 2,
  tasks_completed_today: 4,
  items_put_today: "000000000000001250",
  active_tasks: [
    {
      id: "a1",
      task_number: "PUT-1008",
      item_sku: "SKU-AX-4491",
      item_description: "Steel Shelf Bracket 20cm",
      quantity_to_put: "+000120",
      quantity_put: "+000045",
      status: "in_progress",
      priority: 1,
      source_location: "STAGE-A2",
      suggested_bin_code: "BIN-B-14",
    },
    {
      id: "a2",
      task_number: "PUT-1010",
      item_sku: "SKU-BX-1209",
      item_description: "Industrial Tape Roll",
      quantity_to_put: "+000240",
      quantity_put: "+000000",
      status: "pending",
      priority: 2,
      source_location: "STAGE-C1",
      suggested_bin_code: "BIN-D-09",
    },
    {
      id: "a3",
      task_number: "PUT-1011",
      item_sku: "SKU-CQ-8872",
      item_description: "Storage Label Pack",
      quantity_to_put: "+000050",
      quantity_put: "+000050",
      status: "completed",
      priority: 3,
      source_location: "STAGE-B3",
      suggested_bin_code: "BIN-A-03",
    },
  ],
});

const cleanIntegerString = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) return "0";

  let normalized = trimmed.replace(/^\+/, "");
  let sign = "";

  if (normalized.startsWith("-")) {
    sign = "-";
    normalized = normalized.slice(1);
  }

  const integerPart = normalized.split(".")[0] || "0";
  const cleaned = integerPart.replace(/^0+(?=\d)/, "") || "0";

  if (cleaned === "0") return "0";
  return `${sign}${cleaned}`;
};

const toBigInt = (value: string): bigint => {
  const cleaned = cleanIntegerString(value);
  try {
    return BigInt(cleaned);
  } catch {
    return 0n;
  }
};

const calculateProgressPercent = (quantityPut: string, quantityToPut: string): number => {
  const put = toBigInt(quantityPut);
  const total = toBigInt(quantityToPut);

  if (total <= 0n) return 0;

  const scaled = (put * 10000n) / total;
  const value = Number(scaled) / 100;

  if (Number.isNaN(value) || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
};

const priorityMeta = (
  priority: number,
): { label: "High" | "Medium" | "Low" | "Unknown"; className: string; order: number } => {
  if (priority === 1) {
    return {
      label: "High",
      className: "bg-red-100 text-red-700 border border-red-200",
      order: 0,
    };
  }

  if (priority === 2) {
    return {
      label: "Medium",
      className: "bg-yellow-100 text-yellow-700 border border-yellow-200",
      order: 1,
    };
  }

  if (priority === 3) {
    return {
      label: "Low",
      className: "bg-green-100 text-green-700 border border-green-200",
      order: 2,
    };
  }

  return {
    label: "Unknown",
    className: "bg-slate-100 text-slate-700 border border-slate-200",
    order: 3,
  };
};

const statusMeta = (status: string): { label: string; className: string } => {
  const normalized = status.trim().toLowerCase();
  const label = normalized
    ? normalized.replace(/_/g, " ").replace(/\b\w/g, (char: string) => char.toUpperCase())
    : "Unknown";

  if (normalized === "pending" || normalized === "assigned") {
    return { label, className: "bg-blue-100 text-blue-700 border border-blue-200" };
  }

  if (normalized === "in_progress") {
    return { label, className: "bg-orange-100 text-orange-700 border border-orange-200" };
  }

  if (normalized === "completed") {
    return { label, className: "bg-green-100 text-green-700 border border-green-200" };
  }

  return { label, className: "bg-slate-100 text-slate-700 border border-slate-200" };
};

const fetchWorkerDashboard = async (): Promise<WorkerDashboard> => {
  const response = await api.get<WorkerDashboard>("/putaway/worker/dashboard", {
    headers: {
      Accept: "application/json",
    },
  });

  return response.data;
};

const formatClock = (date: Date): string => {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(date);
};

const formatDateTime = (value: string | null | undefined): string => {
  if (!value) return "-";

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString();
};

const formatRawValue = (value: string | null | undefined): string => {
  if (!value || value.trim() === "") return "-";
  return value;
};

export default function WorkerDashboard() {
  const [dashboard, setDashboard] = useState<WorkerDashboard | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [usingMockData, setUsingMockData] = useState<boolean>(false);
  const [now, setNow] = useState<Date>(new Date());
  const [selectedTask, setSelectedTask] = useState<ActiveTask | null>(null);

  const loadDashboard = useCallback(async (isManualRefresh: boolean) => {
    if (isManualRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }

    setError(null);

    try {
      const data = await fetchWorkerDashboard();
      setDashboard(data);
      setUsingMockData(false);
    } catch (apiError) {
      const message = apiError instanceof Error ? apiError.message : "Unable to load dashboard";
      setError(`API unavailable (${message}). Showing demo data.`);
      setDashboard(buildMockDashboard());
      setUsingMockData(true);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadDashboard(false);
  }, [loadDashboard]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNow(new Date());
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    if (!selectedTask) return;

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        setSelectedTask(null);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [selectedTask]);

  const handleRefresh = async (): Promise<void> => {
    await loadDashboard(true);
  };

  const handleLogout = (): void => {
    localStorage.clear();
    window.location.replace("/login");
  };

  const sortedTasks = useMemo<ActiveTask[]>(() => {
    if (!dashboard) return [];

    return [...dashboard.active_tasks].sort((a: ActiveTask, b: ActiveTask) => {
      const orderA = priorityMeta(a.priority).order;
      const orderB = priorityMeta(b.priority).order;

      if (orderA !== orderB) {
        return orderA - orderB;
      }

      return a.task_number.localeCompare(b.task_number);
    });
  }, [dashboard]);

  if (isLoading && !dashboard) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
        <div className="flex items-center gap-3 rounded-xl bg-white px-5 py-4 shadow-sm border border-slate-200">
          <span className="h-6 w-6 rounded-full border-2 border-slate-300 border-t-blue-600 animate-spin" />
          <p className="text-slate-700 font-medium">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (!dashboard && error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
        <div className="w-full max-w-md rounded-2xl bg-white border border-red-200 p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Something went wrong</h2>
          <p className="mt-2 text-sm text-slate-600">{error}</p>
          <button
            type="button"
            onClick={handleRefresh}
            className="mt-4 inline-flex items-center justify-center rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!dashboard) {
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <header className="mb-6 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Hello, {dashboard.worker_name} 👋</h1>
              <p className="mt-1 text-sm text-slate-600">{formatClock(now)}</p>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center justify-center rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
            >
              Logout
            </button>
          </div>
        </header>

        {error ? (
          <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {error}
          </div>
        ) : null}

        {usingMockData ? (
          <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
            Demo mode is active because the API is currently unavailable.
          </div>
        ) : null}

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">📋 Tasks Assigned</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">{dashboard.tasks_assigned}</p>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">⏳ Tasks In Progress</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">{dashboard.tasks_in_progress}</p>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">✅ Completed Today</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">{dashboard.tasks_completed_today}</p>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">📦 Items Put Today</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">{cleanIntegerString(dashboard.items_put_today)}</p>
          </article>
        </section>

        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-xl font-semibold text-slate-900">Your Active Tasks</h2>
            <button
              type="button"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
            >
              <span
                className={
                  isRefreshing
                    ? "h-4 w-4 rounded-full border-2 border-slate-200 border-t-white animate-spin"
                    : "h-4 w-4"
                }
              />
              {isRefreshing ? "Refreshing..." : "Refresh"}
            </button>
          </div>

          {sortedTasks.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
              <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-white text-3xl shadow-sm">
                📭
              </div>
              <h3 className="text-lg font-semibold text-slate-800">No active tasks assigned</h3>
              <p className="mt-1 text-sm text-slate-600">
                You are all caught up for now. Pull to refresh when new tasks are assigned.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {sortedTasks.map((task: ActiveTask) => {
                const priority = priorityMeta(task.priority);
                const status = statusMeta(task.status);
                const quantityPut = cleanIntegerString(task.quantity_put);
                const quantityToPut = cleanIntegerString(task.quantity_to_put);
                const progress = calculateProgressPercent(task.quantity_put, task.quantity_to_put);

                return (
                  <article
                    key={task.id}
                    className="rounded-xl border border-slate-200 p-4 cursor-pointer transition-all hover:border-slate-300 hover:shadow-sm"
                    onClick={() => setSelectedTask(task)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setSelectedTask(task);
                      }
                    }}
                    role="button"
                    tabIndex={0}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <p className="text-base font-semibold text-slate-900">{task.task_number}</p>
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${priority.className}`}>
                        {priority.label}
                      </span>
                    </div>

                    <p className="mt-2 text-sm font-medium text-slate-800">{task.item_sku}</p>
                    <p className="text-sm text-slate-600">{task.item_description}</p>

                    <div className="mt-4">
                      <div className="mb-1 flex items-center justify-between text-xs text-slate-600">
                        <span>
                          {quantityPut} / {quantityToPut}
                        </span>
                        <span>{progress.toFixed(2)}%</span>
                      </div>
                      <div className="h-2.5 rounded-full bg-slate-200">
                        <div
                          className="h-2.5 rounded-full bg-blue-600 transition-all"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
                      <span className="rounded-md bg-slate-100 px-2 py-1 text-slate-700">{task.source_location}</span>
                      <span className="text-slate-500">-&gt;</span>
                      <span className="rounded-md bg-emerald-100 px-2 py-1 text-emerald-700">
                        {task.suggested_bin_code}
                      </span>
                    </div>

                    <div className="mt-4">
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${status.className}`}>
                        {status.label}
                      </span>
                    </div>

                    <p className="mt-3 text-xs font-medium text-blue-700">Click to view full task details</p>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {selectedTask ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4 py-6"
          onClick={() => setSelectedTask(null)}
        >
          <div
            className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-bold text-slate-900">Task Details</h3>
                <p className="mt-1 text-sm text-slate-600">{selectedTask.task_number}</p>
              </div>
              <button
                type="button"
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                onClick={() => setSelectedTask(null)}
              >
                Close
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {[
                { label: "Task ID", value: selectedTask.id },
                { label: "Task Number", value: selectedTask.task_number },
                { label: "Status", value: selectedTask.status },
                { label: "Priority", value: String(selectedTask.priority) },
                { label: "Item ID", value: selectedTask.item_id ?? "-" },
                { label: "Item SKU", value: selectedTask.item_sku },
                { label: "Item Description", value: selectedTask.item_description },
                { label: "Item Barcode", value: selectedTask.item_barcode ?? "-" },
                {
                  label: "Item Alt Barcodes",
                  value: selectedTask.item_alt_barcodes?.length
                    ? selectedTask.item_alt_barcodes.join(", ")
                    : "-",
                },
                { label: "Quantity To Put", value: cleanIntegerString(selectedTask.quantity_to_put) },
                { label: "Quantity Put", value: cleanIntegerString(selectedTask.quantity_put) },
                { label: "Source Location", value: selectedTask.source_location },
                { label: "GRN Number", value: selectedTask.grn_number ?? "-" },
                { label: "ASN Number", value: selectedTask.asn_number ?? "-" },
                { label: "Suggested Bin ID", value: selectedTask.suggested_bin_id ?? "-" },
                { label: "Suggested Bin Code", value: selectedTask.suggested_bin_code },
                { label: "Suggested Bin Barcode", value: selectedTask.suggested_bin_barcode ?? "-" },
                { label: "Suggested Zone", value: selectedTask.suggested_zone ?? "-" },
                { label: "Suggested Aisle", value: selectedTask.suggested_aisle ?? "-" },
                { label: "Suggested Rack", value: selectedTask.suggested_rack ?? "-" },
                { label: "Suggested Shelf", value: selectedTask.suggested_shelf ?? "-" },
                { label: "Suggested Position", value: selectedTask.suggested_position ?? "-" },
                { label: "Lot Number", value: formatRawValue(selectedTask.lot_number) },
                { label: "Batch Number", value: formatRawValue(selectedTask.batch_number) },
                { label: "Expiry Date", value: formatDateTime(selectedTask.expiry_date) },
                { label: "Assigned At", value: formatDateTime(selectedTask.assigned_at) },
                { label: "Started At", value: formatDateTime(selectedTask.started_at) },
              ].map((row) => (
                <div key={row.label} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{row.label}</p>
                  <p className="mt-1 break-words text-sm font-medium text-slate-800">{row.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
