import api from "@/api/axios";

const extractArray = (payload: unknown): unknown[] => {
  if (Array.isArray(payload)) return payload;

  if (payload && typeof payload === "object") {
    const wrapped = payload as Record<string, unknown>;
    const nested = wrapped.tasks ?? wrapped.items ?? wrapped.data ?? wrapped.results;
    return Array.isArray(nested) ? nested : [];
  }

  return [];
};

export interface PutawayCompletedTask extends Record<string, unknown> {
  id: string;
  task_number: string;
  item_sku: string;
  item_description: string;
  quantity_to_put: string;
  quantity_put: string;
  status: string;
  priority: number;
  assigned_to_name: string;
  created_at: string;
  completed_at: string | null;
}

const normalizeCompletedTask = (task: Record<string, unknown>): PutawayCompletedTask => ({
  ...task,
  id: String(task.id ?? task.task_id ?? ""),
  task_number: String(task.task_number ?? task.task_no ?? task.taskNumber ?? "—"),
  item_sku: String(task.pallet_code ?? task.item_sku ?? task.sku ?? task.itemSku ?? "—"),
  item_description: String(task.pallet_barcode ?? task.item_description ?? task.description ?? task.itemDescription ?? "—"),
  quantity_to_put: String(task.quantity_to_put ?? task.quantity ?? task.qty_to_put ?? task.total_quantity ?? task.target_quantity ?? 0),
  quantity_put: String(task.quantity_put ?? task.qty_put ?? task.quantity_picked ?? task.quantity_moved ?? task.completed_quantity ?? 0),
  status: String(task.status ?? task.task_status ?? "completed"),
  priority: Number.isFinite(Number(task.priority)) ? Number(task.priority) : 0,
  assigned_to_name: String(task.assigned_to_name ?? task.worker_name ?? task.assignedToName ?? ""),
  created_at: String(task.created_at ?? task.createdAt ?? ""),
  completed_at: task.completed_at ? String(task.completed_at) : (task.updated_at ? String(task.updated_at) : null),
});

export const putawayService = {
  getCompletedTasks: async (): Promise<PutawayCompletedTask[]> => {
    const response = await api.get("/putaway/worker/tasks/completed", {
      timeout: 10000,
    });

    return extractArray(response.data).map((task) => normalizeCompletedTask(task as Record<string, unknown>));
  },

  getCompletedTask: async (taskId: string): Promise<Record<string, unknown>> => {
    try {
      const response = await api.get(`/putaway/worker/tasks/completed/${taskId}`, {
        timeout: 10000,
      });

      return response.data as Record<string, unknown>;
    } catch {
      const fallbackResponse = await api.get(`/putaway/worker/tasks/completed/${taskId}/`, {
        timeout: 10000,
      });

      return fallbackResponse.data as Record<string, unknown>;
    }
  },
};
