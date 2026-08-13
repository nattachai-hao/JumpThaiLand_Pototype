import { generateFeedback, generateReply } from "../ai.js";
import {
  ConversationStatus,
  MessageRole,
  Scenario,
} from "../generated/prisma/enums.js";
import type { Prisma } from "../generated/prisma/client.js";
import { prisma } from "../lib/prisma.js";
import { scenarios } from "../scenarios.js";
import { getBangkokDayBounds } from "../utils/date.js";
import type {
  Conversation,
  ConversationMessage,
  Feedback,
  ScenarioId,
} from "../types.js";

export type DailySession =
  | { mode: "chat"; conversation: Conversation }
  | { mode: "feedback"; conversation: Conversation; feedback: Feedback };

const scenarioToDatabase: Record<ScenarioId, Scenario> = {
  cafe: Scenario.CAFE,
  travel: Scenario.TRAVEL,
  interview: Scenario.INTERVIEW,
  dinner: Scenario.DINNER,
  meeting: Scenario.MEETING,
  directions: Scenario.DIRECTIONS,
};

const scenarioFromDatabase: Record<Scenario, ScenarioId> = {
  [Scenario.CAFE]: "cafe",
  [Scenario.TRAVEL]: "travel",
  [Scenario.INTERVIEW]: "interview",
  [Scenario.DINNER]: "dinner",
  [Scenario.MEETING]: "meeting",
  [Scenario.DIRECTIONS]: "directions",
};

function mapMessage(message: {
  id: string;
  role: MessageRole;
  content: string;
  createdAt: Date;
}): ConversationMessage {
  return {
    id: message.id,
    role: message.role === MessageRole.USER ? "user" : "assistant",
    content: message.content,
    createdAt: message.createdAt.toISOString(),
  };
}

function mapConversation(conversation: {
  id: string;
  scenario: Scenario;
  startedAt: Date;
  messages: Array<{
    id: string;
    role: MessageRole;
    content: string;
    createdAt: Date;
  }>;
}): Conversation {
  return {
    id: conversation.id,
    scenario: scenarioFromDatabase[conversation.scenario],
    startedAt: conversation.startedAt.toISOString(),
    messages: conversation.messages.map(mapMessage),
  };
}

function mapStoredFeedback(feedback: {
  grammarScore: number;
  vocabularyScore: number;
  communicationScore: number;
  summary: string;
  corrections: Prisma.JsonValue;
  conversation: Parameters<typeof mapConversation>[0] & {
    flashcards: Array<{
      word: string;
      meaningTh: string;
      example: string;
    }>;
  };
}): { conversation: Conversation; feedback: Feedback } {
  return {
    conversation: mapConversation(feedback.conversation),
    feedback: {
      scores: {
        grammar: feedback.grammarScore,
        vocabulary: feedback.vocabularyScore,
        communication: feedback.communicationScore,
      },
      summary: feedback.summary,
      corrections: feedback.corrections as Feedback["corrections"],
      flashcards: feedback.conversation.flashcards.map(
        ({ word, meaningTh, example }) => ({
          word,
          meaningTh,
          example,
        }),
      ),
    },
  };
}

export async function createConversation(scenario: ScenarioId): Promise<DailySession> {
  const { start, end } = getBangkokDayBounds();
  const completedFeedback = await prisma.feedback.findFirst({
    where: {
      conversation: {
        scenario: scenarioToDatabase[scenario],
        status: ConversationStatus.COMPLETED,
        completedAt: {
          gte: start,
          lt: end,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    include: {
      conversation: {
        include: {
          messages: {
            orderBy: { createdAt: "asc" },
          },
          flashcards: true,
        },
      },
    },
  });

  if (completedFeedback) {
    return {
      mode: "feedback",
      ...mapStoredFeedback(completedFeedback),
    };
  }

  const activeConversation = await prisma.conversation.findFirst({
    where: {
      scenario: scenarioToDatabase[scenario],
      status: ConversationStatus.ACTIVE,
      startedAt: {
        gte: start,
        lt: end,
      },
    },
    orderBy: [
      { messages: { _count: "desc" } },
      { startedAt: "desc" },
    ],
    include: {
      messages: {
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (activeConversation) {
    return {
      mode: "chat",
      conversation: mapConversation(activeConversation),
    };
  }

  const conversation = await prisma.conversation.create({
    data: {
      scenario: scenarioToDatabase[scenario],
      messages: {
        create: {
          role: MessageRole.ASSISTANT,
          content: scenarios[scenario].opening,
        },
      },
    },
    include: {
      messages: true,
    },
  });

  return {
    mode: "chat",
    conversation: mapConversation(conversation),
  };
}

export async function findConversation(id: string): Promise<Conversation | undefined> {
  const conversation = await prisma.conversation.findUnique({
    where: { id },
    include: {
      messages: {
        orderBy: { createdAt: "asc" },
      },
    },
  });

  return conversation ? mapConversation(conversation) : undefined;
}

export async function listConversations(): Promise<Conversation[]> {
  const conversations = await prisma.conversation.findMany({
    orderBy: { startedAt: "desc" },
    take: 20,
    include: {
      messages: {
        orderBy: { createdAt: "asc" },
      },
    },
  });

  return conversations.map(mapConversation);
}

export async function addMessage(
  conversation: Conversation,
  text: string,
): Promise<{
  userMessage: ConversationMessage;
  assistantMessage: ConversationMessage;
}> {
  const savedUserMessage = await prisma.message.create({
    data: {
      conversationId: conversation.id,
      role: MessageRole.USER,
      content: text,
    },
  });
  const userMessage = mapMessage(savedUserMessage);
  conversation.messages.push(userMessage);

  const reply = await generateReply(conversation, text);
  const savedAssistantMessage = await prisma.message.create({
    data: {
      conversationId: conversation.id,
      role: MessageRole.ASSISTANT,
      content: reply,
    },
  });
  const assistantMessage = mapMessage(savedAssistantMessage);

  return { userMessage, assistantMessage };
}

export function canFinishConversation(conversation: Conversation): boolean {
  return conversation.messages.some((message) => message.role === "user");
}

export async function finishConversation(conversation: Conversation): Promise<Feedback> {
  const feedback = await generateFeedback(conversation);

  await prisma.$transaction([
    prisma.feedback.upsert({
      where: { conversationId: conversation.id },
      create: {
        conversationId: conversation.id,
        grammarScore: feedback.scores.grammar,
        vocabularyScore: feedback.scores.vocabulary,
        communicationScore: feedback.scores.communication,
        summary: feedback.summary,
        corrections: feedback.corrections as Prisma.InputJsonValue,
      },
      update: {
        grammarScore: feedback.scores.grammar,
        vocabularyScore: feedback.scores.vocabulary,
        communicationScore: feedback.scores.communication,
        summary: feedback.summary,
        corrections: feedback.corrections as Prisma.InputJsonValue,
      },
    }),
    prisma.flashcard.deleteMany({
      where: { conversationId: conversation.id },
    }),
    prisma.flashcard.createMany({
      data: feedback.flashcards.map((flashcard) => ({
        conversationId: conversation.id,
        word: flashcard.word,
        meaningTh: flashcard.meaningTh,
        example: flashcard.example,
      })),
    }),
    prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        status: ConversationStatus.COMPLETED,
        completedAt: new Date(),
      },
    }),
  ]);

  return feedback;
}
