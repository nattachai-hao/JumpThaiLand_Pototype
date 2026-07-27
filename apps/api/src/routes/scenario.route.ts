import { Router } from "express";
import { listScenarios } from "../controllers/scenario.controller.js";

export const scenarioRouter = Router();

scenarioRouter.get("/", listScenarios);
