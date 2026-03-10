import type { Hono } from "hono";
import { registerDocRoutes } from "./doc";
import { registerHealthRoutes } from "./health";
import { registerTestRoutes } from "./test";

export function registerRoutes(app: Hono): void {
  registerHealthRoutes(app);
  registerTestRoutes(app);
  registerDocRoutes(app);
}
