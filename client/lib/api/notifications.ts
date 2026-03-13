import * as api from "../api-client";
import { ApiResponse } from "../api-client";

export interface Notification {
  id: number;
  user_id: number;
  type: string;
  title: string;
  message: string;
  related_workspace_id: number | null;
  related_project_id: number | null;
  related_task_id: number | null;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
  workspace_name?: string;
  project_name?: string;
  task_title?: string;
}

export const notificationApi = {
  getNotifications: async (): Promise<ApiResponse<{ notifications: Notification[] }>> => {
    const response = await api.apiGet<{ notifications: Notification[] }>("/notifications");
    return { success: true, data: response };
  },

  getUnreadCount: async (): Promise<ApiResponse<{ count: number }>> => {
    const response = await api.apiGet<{ count: number }>("/notifications/unread-count");
    return { success: true, data: response };
  },

  markAsRead: async (id: number): Promise<ApiResponse<{ message: string }>> => {
    const response = await api.apiPatch<{ message: string }>(`/notifications/${id}/read`);
    return { success: true, data: response };
  },

  markAllAsRead: async (): Promise<ApiResponse<{ message: string }>> => {
    const response = await api.apiPost<{ message: string }>("/notifications/read-all");
    return { success: true, data: response };
  },
};
