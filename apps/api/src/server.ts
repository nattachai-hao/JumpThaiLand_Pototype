import "dotenv/config";
import cors from "cors";
import express, { type ErrorRequestHandler } from "express";
import { healthRouter } from "./routes/health.route.js";
import { apiRouter } from "./routes/index.js";

const app = express();
const port = Number(process.env.JUMP_API_PORT || 4000);

app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.use("/health", healthRouter);
app.use("/api", apiRouter);

const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  console.error(error);
  response.status(500).json({
    message: "Unable to complete the request",
    detail: process.env.NODE_ENV === "development" ? String(error) : undefined,
  });
};
app.use(errorHandler);

app.listen(port, () => {
  console.log(`JUMP Thailand API running at http://localhost:${port}`);
  console.log(`AI mode: ${process.env.GEMINI_API_KEY ? "Gemini" : "mock"}`);
});
