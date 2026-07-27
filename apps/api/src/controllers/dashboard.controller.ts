import type { RequestHandler } from "express";
import {
  claimDailyPoints,
  getDashboardSummary,
} from "../services/dashboard.service.js";

export const getDashboard: RequestHandler = async (_request, response) => {
  response.json(await getDashboardSummary());
};

export const claimPoints: RequestHandler = async (_request, response) => {
  response.json(await claimDailyPoints());
};
