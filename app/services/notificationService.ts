// services/notificationService.ts
import { apiFetch } from "./apiClient";

export interface NotificationResponse {
  notification_id: string;
  type: string;
  payload: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
}

export const notificationService = {
  async getTicket(): Promise<string> {
    const res = await apiFetch<{ ticket: string }>("/notifications/ticket", {
      method: "POST",
    });
    return res.ticket;
  },

  async listNotifications(unreadOnly = false): Promise<NotificationResponse[]> {
    const qs = unreadOnly ? "?unread_only=true" : "";
    return apiFetch<NotificationResponse[]>(`/notifications${qs}`);
  },

  async markAsRead(notificationId: string): Promise<void> {
    await apiFetch<NotificationResponse>(
      `/notifications/${notificationId}/read`,
      { method: "PATCH" }
    );
  },
};
