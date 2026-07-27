import { ConversationStatus } from "../generated/prisma/enums.js";
import { prisma } from "../lib/prisma.js";
import { scenarios } from "../scenarios.js";
import { getBangkokDateKey, getBangkokDayBounds } from "../utils/date.js";

const DAILY_REWARD_POINTS = 10;

export interface DashboardSummary {
  completedToday: number;
  completedScenarios: string[];
  totalScenarios: number;
  remainingToday: number;
  progressPercent: number;
  points: number;
  canClaimPoints: boolean;
}

export async function getDashboardSummary(): Promise<DashboardSummary> {
  const { start, end } = getBangkokDayBounds();
  const today = getBangkokDateKey();
  const [completedScenarios, pointsAggregate, todayReward] = await Promise.all([
    prisma.conversation.findMany({
      where: {
        status: ConversationStatus.COMPLETED,
        completedAt: { gte: start, lt: end },
      },
      distinct: ["scenario"],
      select: { scenario: true },
    }),
    prisma.dailyReward.aggregate({ _sum: { points: true } }),
    prisma.dailyReward.findUnique({
      where: { day: today },
      select: { id: true },
    }),
  ]);
  const totalScenarios = Object.keys(scenarios).length;
  const completedToday = completedScenarios.length;

  return {
    completedToday,
    completedScenarios: completedScenarios.map(({ scenario }) =>
      scenario.toLowerCase(),
    ),
    totalScenarios,
    remainingToday: Math.max(totalScenarios - completedToday, 0),
    progressPercent:
      totalScenarios === 0
        ? 0
        : Math.min(Math.round((completedToday / totalScenarios) * 100), 100),
    points: pointsAggregate._sum.points ?? 0,
    canClaimPoints: completedToday === totalScenarios && !todayReward,
  };
}

export async function claimDailyPoints(): Promise<DashboardSummary> {
  const summary = await getDashboardSummary();
  if (!summary.canClaimPoints) return summary;

  await prisma.dailyReward.create({
    data: {
      day: getBangkokDateKey(),
      points: DAILY_REWARD_POINTS,
    },
  });

  return getDashboardSummary();
}
