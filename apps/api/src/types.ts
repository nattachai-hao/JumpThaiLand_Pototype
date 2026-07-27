export type ScenarioId = "cafe" | "travel" | "interview";
export type MessageRole = "user" | "assistant";

export interface ConversationMessage {
  id: string;
  role: MessageRole;
  content: string;
  createdAt: string;
}

export interface Conversation {
  id: string;
  scenario: ScenarioId;
  startedAt: string;
  messages: ConversationMessage[];
}

export interface Flashcard {
  word: string;
  meaningTh: string;
  example: string;
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
  flashcards: Flashcard[];
}
