import { Router } from "express";
import { conversationRouter } from "./conversation.route.js";
import { dashboardRouter } from "./dashboard.route.js";
import { scenarioRouter } from "./scenario.route.js";

export const apiRouter = Router();

apiRouter.use("/dashboard", dashboardRouter);
apiRouter.use("/scenarios", scenarioRouter);
apiRouter.use("/conversations", conversationRouter);
