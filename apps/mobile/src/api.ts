export type ScenarioId = "cafe" | "travel" | "interview";

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

export interface Conversation {
  id: string;
  scenario: ScenarioId;
  startedAt: string;
  messages: Message[];
}

export interface Feedback {
  scores: {
    grammar: number;
    vocabulary: number;
    communication: number;
  };
  summary: string;
  corrections: Array<{
    original: string;
    improved: string;
    explanationTh: string;
  }>;
  flashcards: Array<{
    word: string;
    meaningTh: string;
    example: string;
  }>;
}

export type DailySession =
  | { mode: "chat"; conversation: Conversation }
  | { mode: "feedback"; conversation: Conversation; feedback: Feedback };

export interface DashboardSummary {
  completedToday: number;
  completedScenarios: ScenarioId[];
  totalScenarios: number;
  remainingToday: number;
  progressPercent: number;
  points: number;
  canClaimPoints: boolean;
}

const API_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:4000";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  const data = (await response.json()) as T & { message?: string };
  if (!response.ok) {
    throw new Error(data.message || "เกิดข้อผิดพลาด กรุณาลองใหม่");
  }
  return data;
}

export function startConversation(scenario: ScenarioId) {
  return request<DailySession>("/api/conversations", {
    method: "POST",
    body: JSON.stringify({ scenario }),
  });
}

export function getConversations() {
  return request<Conversation[]>("/api/conversations");
}

export function getDashboard() {
  return request<DashboardSummary>("/api/dashboard");
}

export function claimPoints() {
  return request<DashboardSummary>("/api/dashboard/claim", {
    method: "POST",
  });
}

export function getConversation(conversationId: string) {
  return request<Conversation>(`/api/conversations/${conversationId}`);
}

export function sendMessage(conversationId: string, text: string) {
  return request<{ userMessage: Message; assistantMessage: Message }>(
    `/api/conversations/${conversationId}/messages`,
    {
      method: "POST",
      body: JSON.stringify({ text }),
    },
  );
}

export function finishConversation(conversationId: string) {
  return request<Feedback>(`/api/conversations/${conversationId}/finish`, {
    method: "POST",
  });
}
