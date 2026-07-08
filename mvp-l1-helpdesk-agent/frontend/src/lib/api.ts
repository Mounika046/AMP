import type {
  Agent,
  Category,
  ChatResponse,
  Conversation,
  DashboardMetrics,
  DocumentRow,
  ExecutionTrace,
  MonitoringRow,
  SettingItem,
  Ticket,
} from "./types";

const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:8088/api";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: options?.body instanceof FormData ? undefined : { "Content-Type": "application/json" },
    ...options,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const detail =
      typeof body.detail === "string"
        ? body.detail
        : body.detail
          ? JSON.stringify(body.detail)
          : `Request failed: ${response.status}`;
    throw new Error(detail);
  }

  return response.json() as Promise<T>;
}

export const api = {
  health: () => request<{ status: string }>("/health"),
  metrics: () => request<DashboardMetrics>("/dashboard/metrics"),
  agents: () => request<Agent[]>("/agents"),
  updateAgent: (id: string, payload: Partial<Agent>) =>
    request<Agent>(`/agents/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  documents: () => request<DocumentRow[]>("/documents"),
  deleteDocument: (id: string) =>
    request<{ deleted: boolean; id: string }>(`/documents/${id}`, {
      method: "DELETE",
    }),
  categories: () => request<Category[]>("/categories"),
  createCategory: (payload: { name: string; description?: string }) =>
    request<Category>("/categories", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  settings: () => request<SettingItem[]>("/settings"),
  updateSetting: (key: string, value: string) =>
    request<SettingItem>(`/settings/${key}`, {
      method: "PATCH",
      body: JSON.stringify({ value }),
    }),
  uploadDocument: (file: File, category: string) => {
    const form = new FormData();
    form.append("file", file);
    form.append("category", category);
    return request<DocumentRow>("/documents/upload", {
      method: "POST",
      body: form,
    });
  },
  chat: (message: string, agentId: string, userId: string, conversationId?: string | null) =>
    request<ChatResponse>("/chat", {
      method: "POST",
      body: JSON.stringify({ message, agent_id: agentId, user_id: userId, conversation_id: conversationId }),
    }),
  conversations: () => request<Conversation[]>("/conversations"),
  conversation: (id: string) => request<Conversation>(`/conversations/${id}`),
  monitoring: () => request<MonitoringRow[]>("/conversations/monitoring"),
  trace: (id: string) => request<ExecutionTrace[]>(`/conversations/${id}/trace`),
  tickets: () => request<Ticket[]>("/tickets"),
  createTicket: (payload: {
    conversation_id?: string | null;
    subject: string;
    description: string;
    priority: string;
  }) =>
    request<Ticket>("/tickets", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
};
