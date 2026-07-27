import { Router } from "express";
import {
  completeConversation,
  getConversation,
  getConversations,
  sendConversationMessage,
  startConversation,
} from "../controllers/conversation.controller.js";

export const conversationRouter = Router();

conversationRouter.get("/", getConversations);
conversationRouter.get("/:id", getConversation);
conversationRouter.post("/", startConversation);
conversationRouter.post("/:id/messages", sendConversationMessage);
conversationRouter.post("/:id/finish", completeConversation);
