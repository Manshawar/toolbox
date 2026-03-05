import type { Hono } from "hono";
import { registerHealthRoutes } from "./health";
import { registerTestRoutes } from "./test";

export function registerRoutes(app: Hono): void {
  registerHealthRoutes(app);
  registerTestRoutes(app);
}
