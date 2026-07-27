import type { RequestHandler } from "express";

export const getHealth: RequestHandler = (_request, response) => {
  response.json({
    ok: true,
    aiMode: process.env.GEMINI_API_KEY ? "gemini" : "mock",
  });
};
