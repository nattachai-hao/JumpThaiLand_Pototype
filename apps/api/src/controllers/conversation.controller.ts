import type { RequestHandler } from "express";
import { isScenario } from "../scenarios.js";
import {
  addMessage,
  canFinishConversation,
  createConversation,
  findConversation,
  finishConversation,
  listConversations,
} from "../services/conversation.service.js";

export const getConversations: RequestHandler = async (_request, response) => {
  response.json(await listConversations());
};

export const getConversation: RequestHandler = async (request, response) => {
  const conversation = await findConversation(String(request.params.id || ""));
  if (!conversation) {
    response.status(404).json({ message: "Conversation not found" });
    return;
  }

  response.json(conversation);
};

export const startConversation: RequestHandler = async (request, response) => {
  const scenario = request.body?.scenario as unknown;
  if (!isScenario(scenario)) {
    response.status(400).json({ message: "Unknown scenario" });
    return;
  }

  response.status(201).json(await createConversation(scenario));
};

export const sendConversationMessage: RequestHandler = async (request, response) => {
  const conversation = await findConversation(String(request.params.id || ""));
  const text = typeof request.body?.text === "string" ? request.body.text.trim() : "";

  if (!conversation) {
    response.status(404).json({ message: "Conversation not found" });
    return;
  }
  if (!text || text.length > 500) {
    response.status(400).json({ message: "Message must contain 1-500 characters" });
    return;
  }

  response.json(await addMessage(conversation, text));
};

export const completeConversation: RequestHandler = async (request, response) => {
  const conversation = await findConversation(String(request.params.id || ""));
  if (!conversation) {
    response.status(404).json({ message: "Conversation not found" });
    return;
  }
  if (!canFinishConversation(conversation)) {
    response.status(400).json({ message: "Send at least one message before finishing" });
    return;
  }

  response.json(await finishConversation(conversation));
};
