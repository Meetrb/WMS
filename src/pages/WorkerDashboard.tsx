import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "@/api/axios";
import { formatDisplayDateTime } from "@/lib/date";

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
  pallet_barcode?: string;
  pallet_code?: string;
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
      className: "bg-red-100 text-red-700 border border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800",
      order: 0,
    };
  }

  if (priority === 2) {
    return {
      label: "Medium",
      className: "bg-yellow-100 text-yellow-700 border border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800",
      order: 1,
    };
  }

  if (priority === 3) {
    return {
      label: "Low",
      className: "bg-green-100 text-green-700 border border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800",
      order: 2,
    };
  }

  return {
    label: "Unknown",
    className: "bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700",
    order: 3,
  };
};

const statusMeta = (status: string): { label: string; className: string } => {
  const normalized = status.trim().toLowerCase();
  const label = normalized
    ? normalized.replace(/_/g, " ").replace(/\b\w/g, (char: string) => char.toUpperCase())
    : "Unknown";

  if (normalized === "pending" || normalized === "assigned") {
    return { label, className: "bg-blue-100 text-blue-700 border border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800" };
  }

  if (normalized === "in_progress") {
    return { label, className: "bg-orange-100 text-orange-700 border border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800" };
  }

  if (normalized === "completed") {
    return { label, className: "bg-green-100 text-green-700 border border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800" };
  }

  return { label, className: "bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700" };
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
  return formatDisplayDateTime(date.toISOString(), "-");
};

export default function WorkerDashboard() {
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState<WorkerDashboard | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [usingMockData, setUsingMockData] = useState<boolean>(false);
  const [now, setNow] = useState<Date>(new Date());

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

  const handleRefresh = async (): Promise<void> => {
    await loadDashboard(true);
  };

  const openTaskDetails = (task: ActiveTask): void => {
    navigate(`/dashboard/worker/tasks/${task.id}`, {
      state: {
        from: "/dashboard/worker",
        seedTask: task,
      },
    });
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
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="flex items-center gap-3 rounded-xl bg-card px-5 py-4 shadow-sm border border-border">
          <span className="h-6 w-6 rounded-full border-2 border-border border-t-primary animate-spin" />
          <p className="text-foreground font-medium">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (!dashboard && error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="w-full max-w-md rounded-2xl bg-card border border-destructive/30 p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-foreground">Something went wrong</h2>
          <p className="mt-2 text-sm text-muted-foreground">{error}</p>
          <button
            type="button"
            onClick={handleRefresh}
            className="mt-4 inline-flex items-center justify-center rounded-lg bg-destructive px-4 py-2 text-sm font-semibold text-destructive-foreground hover:bg-destructive/90"
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
    <div className="min-h-screen bg-background">
      <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <header className="mb-6 rounded-2xl border border-border bg-card px-5 py-4 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-card-foreground">Hello, {dashboard.worker_name} 👋</h1>
              <p className="mt-1 text-sm text-muted-foreground">{formatClock(now)}</p>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center justify-center rounded-lg border border-border px-4 py-2 text-sm font-semibold text-foreground hover:bg-accent hover:text-accent-foreground"
            >
              Logout
            </button>
          </div>
        </header>

        {error ? (
          <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-950/50 dark:text-amber-400">
            {error}
          </div>
        ) : null}

        {usingMockData ? (
          <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800 dark:border-blue-700 dark:bg-blue-950/50 dark:text-blue-400">
            Demo mode is active because the API is currently unavailable.
          </div>
        ) : null}

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <article className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <p className="text-sm text-muted-foreground">📋 Tasks Assigned</p>
            <p className="mt-2 text-3xl font-bold text-card-foreground">{dashboard.tasks_assigned}</p>
          </article>

          <article className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <p className="text-sm text-muted-foreground">⏳ Tasks In Progress</p>
            <p className="mt-2 text-3xl font-bold text-card-foreground">{dashboard.tasks_in_progress}</p>
          </article>

          <article 
            className="rounded-2xl border border-border bg-card p-5 shadow-sm cursor-pointer transition-all hover:border-foreground/20 hover:shadow-md"
            onClick={() => navigate("/dashboard/worker/completed")}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                navigate("/dashboard/worker/completed");
              }
            }}
            role="button"
            tabIndex={0}
          >
            <p className="text-sm text-muted-foreground">✅ Completed </p>
            <p className="mt-2 text-3xl font-bold text-card-foreground">{dashboard.tasks_completed_today}</p>
          </article>

          <article className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <p className="text-sm text-muted-foreground">📦 Total Items Put</p>
            <p className="mt-2 text-3xl font-bold text-card-foreground">{cleanIntegerString(dashboard.items_put_today)}</p>
          </article>
        </section>

        <section className="mt-6 rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-xl font-semibold text-card-foreground">Your Active Tasks</h2>
            <button
              type="button"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-70"
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
            <div className="rounded-2xl border border-dashed border-border bg-muted/30 p-10 text-center">
              <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-card text-3xl shadow-sm">
                📭
              </div>
              <h3 className="text-lg font-semibold text-foreground">No active tasks assigned</h3>
              <p className="mt-1 text-sm text-muted-foreground">
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
                    className="rounded-xl border border-border bg-card p-4 cursor-pointer transition-all hover:border-foreground/20 hover:shadow-md"
                    onClick={() => openTaskDetails(task)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        openTaskDetails(task);
                      }
                    }}
                    role="button"
                    tabIndex={0}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <p className="text-base font-semibold text-foreground">{task.task_number}</p>
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${priority.className}`}>
                        {priority.label}
                      </span>
                    </div>

                    <p className="mt-2 text-sm font-medium text-foreground">{task.pallet_code || task.item_sku}</p>
                    <p className="text-sm text-muted-foreground">{task.pallet_barcode || task.item_description}</p>

                    <div className="mt-4">
                      <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                        <span>
                          {quantityPut} / {quantityToPut}
                        </span>
                        <span>{progress.toFixed(2)}%</span>
                      </div>
                      <div className="h-2.5 rounded-full bg-muted">
                        <div
                          className="h-2.5 rounded-full bg-primary transition-all"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>

                    <div className="mt-4 text-sm">
                      <span className="rounded-md bg-secondary px-2 py-1 text-secondary-foreground">{task.source_location}</span>
                    </div>

                    <div className="mt-4">
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${status.className}`}>
                        {status.label}
                      </span>
                    </div>

                    <p className="mt-3 text-xs font-medium text-primary">Click to view full task details</p>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
