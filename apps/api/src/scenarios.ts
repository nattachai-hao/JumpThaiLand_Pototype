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
};

export function isScenario(value: unknown): value is ScenarioId {
  return typeof value === "string" && value in scenarios;
}
