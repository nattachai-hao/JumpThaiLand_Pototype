import type { RequestHandler } from "express";
import { scenarios } from "../scenarios.js";

export const listScenarios: RequestHandler = (_request, response) => {
  response.json(
    Object.entries(scenarios).map(([id, scenario]) => ({
      id,
      title: scenario.title,
    })),
  );
};
