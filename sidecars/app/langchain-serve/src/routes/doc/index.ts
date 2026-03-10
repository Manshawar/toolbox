import { swaggerUI } from "@hono/swagger-ui";
import type { Hono } from "hono";
import { openApiDoc } from "./openapi";

export function registerDocRoutes(app: Hono): void {
  app.get("/doc", (c) => c.json(openApiDoc));
  app.get("/ui", swaggerUI({ url: "/doc" }));
}
