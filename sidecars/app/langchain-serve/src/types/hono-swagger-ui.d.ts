declare module "@hono/swagger-ui" {
  import type { MiddlewareHandler } from "hono";

  export interface SwaggerUIOptions {
    url: string;
  }

  export function swaggerUI(options: SwaggerUIOptions): MiddlewareHandler;
}
