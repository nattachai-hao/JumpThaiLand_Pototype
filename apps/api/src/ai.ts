import { scenarios } from "./scenarios.js";
import type { Conversation, Feedback } from "./types.js";

const apiKey = process.env.GEMINI_API_KEY?.trim();
const model = process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash";

function historyText(conversation: Conversation): string {
  return conversation.messages
    .map((message) => `${message.role === "user" ? "Learner" : "Tutor"}: ${message.content}`)
    .join("\n");
}

async function callGemini(prompt: string): Promise<string> {
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7,
          responseMimeType: "application/json",
        },
      }),
    },
  );

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Gemini request failed (${response.status}): ${detail}`);
  }

  const data = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    throw new Error("Gemini returned an empty response");
  }

  return text;
}

function mockReply(conversation: Conversation, userText: string): string {
  const lower = userText.toLowerCase();

  if (conversation.scenario === "cafe") {
    if (lower.includes("coffee") || lower.includes("latte")) {
      return "Great choice! What size would you like, and would you prefer it hot or iced?";
    }
    if (lower.includes("thank")) {
      return "You're welcome! Your order will be ready shortly. Is there anything else I can get for you?";
    }
    return "Of course. Could you tell me a little more about what you would like to order?";
  }

  if (conversation.scenario === "travel") {
    if (lower.includes("passport")) {
      return "Thank you. Are you checking in any bags today?";
    }
    return "Certainly. What is your destination, and do you have any bags to check in?";
  }

  if (lower.includes("developer") || lower.includes("student")) {
    return "That sounds interesting. Could you describe a project you are proud of and your role in it?";
  }
  return "Thank you for sharing. What skills do you think make you a strong fit for this role?";
}

export async function generateReply(
  conversation: Conversation,
  userText: string,
): Promise<string> {
  if (!apiKey) {
    return mockReply(conversation, userText);
  }

  const scenario = scenarios[conversation.scenario];
  const prompt = `
You are ${scenario.aiRole} in an English speaking practice app.
Continue the role-play naturally. Use friendly CEFR A2-B1 English.
Keep the reply to 1-2 short sentences and ask at most one question.
Do not explain grammar during the role-play.

Conversation:
${historyText(conversation)}

Return JSON only:
{"reply":"your response"}
`.trim();

  const parsed = JSON.parse(await callGemini(prompt)) as { reply?: unknown };
  if (typeof parsed.reply !== "string" || !parsed.reply.trim()) {
    throw new Error("Gemini response did not include a reply");
  }
  return parsed.reply.trim();
}

function mockFeedback(conversation: Conversation): Feedback {
  const userMessages = conversation.messages.filter((message) => message.role === "user");
  const first = userMessages[0]?.content || "I want order a coffee.";
  const improved = first
    .replace(/\bI want order\b/i, "I'd like to order")
    .replace(/\bI want a\b/i, "I'd like a");

  return {
    scores: {
      grammar: userMessages.length >= 3 ? 82 : 74,
      vocabulary: userMessages.length >= 3 ? 78 : 70,
      communication: userMessages.length >= 3 ? 88 : 80,
    },
    summary:
      "คุณสื่อสารใจความสำคัญได้ชัดเจนและตอบโต้ได้เป็นธรรมชาติ ลองใช้รูปประโยคสุภาพและเพิ่มคำขยายอีกเล็กน้อยเพื่อให้ฟังคล่องขึ้น",
    corrections:
      first === improved
        ? []
        : [
            {
              original: first,
              improved,
              explanationTh: "ใช้ “I'd like to…” เพื่อขอหรือสั่งสิ่งของอย่างสุภาพและเป็นธรรมชาติมากขึ้น",
            },
          ],
    flashcards: [
      {
        word: "recommend",
        meaningTh: "แนะนำ",
        example: "Could you recommend a popular drink?",
      },
      {
        word: "prefer",
        meaningTh: "ชอบมากกว่า",
        example: "I prefer an iced coffee.",
      },
      {
        word: "available",
        meaningTh: "มีอยู่ / พร้อมให้บริการ",
        example: "Is this menu available today?",
      },
    ],
  };
}

export async function generateFeedback(conversation: Conversation): Promise<Feedback> {
  if (!apiKey) {
    return mockFeedback(conversation);
  }

  const prompt = `
You are an English coach for Thai learners.
Analyze only the learner's English in this transcript:

${historyText(conversation)}

Return valid JSON matching this exact shape. Scores must be integers 0-100.
{
  "scores":{"grammar":0,"vocabulary":0,"communication":0},
  "summary":"Thai summary, maximum 2 sentences",
  "corrections":[
    {"original":"...","improved":"...","explanationTh":"..."}
  ],
  "flashcards":[
    {"word":"...","meaningTh":"...","example":"..."}
  ]
}
Return at most 3 corrections and exactly 3 useful flashcards.
`.trim();

  return JSON.parse(await callGemini(prompt)) as Feedback;
}
