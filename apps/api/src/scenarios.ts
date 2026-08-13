import type { ScenarioId } from "./types.js";

export const scenarios: Record<
  ScenarioId,
  { title: string; aiRole: string; opening: string }
> = {
  cafe: {
    title: "Ordering at a café",
    aiRole: "a friendly barista",
    opening: "Hi! Welcome to Bright Cup. What would you like to order today?",
  },
  travel: {
    title: "Airport check-in",
    aiRole: "a helpful airline check-in agent",
    opening: "Good morning! May I see your passport and booking confirmation, please?",
  },
  interview: {
    title: "Job interview",
    aiRole: "a supportive interviewer for a junior software role",
    opening: "Thanks for joining us today. Could you start by telling me a little about yourself?",
  },
  dinner: {
    title: "Ordering dinner",
    aiRole: "a welcoming restaurant server",
    opening: "Good evening! Welcome to Green Table. Are you ready to order, or would you like a few more minutes?",
  },
  meeting: {
    title: "Project meeting",
    aiRole: "a friendly project manager leading a team meeting",
    opening: "Hi everyone. Let's begin with a quick update. Could you tell me what you worked on this week?",
  },
  directions: {
    title: "Asking directions",
    aiRole: "a helpful local giving directions around the city",
    opening: "Hi there! You look a little lost. Where are you trying to go?",
  },
};

export function isScenario(value: unknown): value is ScenarioId {
  return typeof value === "string" && value in scenarios;
}
