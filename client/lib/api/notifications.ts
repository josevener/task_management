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

  listenForRealTime: (onNotification: (notification: Notification) => void) => {
    // Only connect in browser environment
    if (typeof window === 'undefined') return () => { };

    // For simplicity, we create the EventSource pointing directly to the stream endpoint.
    // In a prod app, we might proxy this or attach tokens to headers if supported.
    // Here relying on cookies/credentials since frontend and backend share domain.
    const url = process.env.NEXT_PUBLIC_API_URL
      ? `${process.env.NEXT_PUBLIC_API_URL}/notifications/stream`
      : 'http://localhost:8500/api/notifications/stream';

    const eventSource = new EventSource(url, { withCredentials: true });

    eventSource.addEventListener('new_notification', (event) => {
      try {
        const data = JSON.parse(event.data);
        onNotification(data);
      }
      catch (err) {
        console.log(`${new Date().toISOString()} >> Error parsing real-time notification`, err, event);
      }
    });

    eventSource.onerror = (error) => {
      console.log(`${new Date().toISOString()} >> SSE connection error:`, error);
      // EventSource automatically attempts to reconnect
    };

    return () => {
      eventSource.close();
    };
  },
};
