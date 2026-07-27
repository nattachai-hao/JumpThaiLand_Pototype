import { Router } from "express";
import { claimPoints, getDashboard } from "../controllers/dashboard.controller.js";

export const dashboardRouter = Router();

dashboardRouter.get("/", getDashboard);
dashboardRouter.post("/claim", claimPoints);
