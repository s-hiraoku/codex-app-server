import type { FastifyInstance } from "fastify";

export async function healthRoutes(app: FastifyInstance) {
  const handler = async () => {
    return { ok: true };
  };

  app.get("/healthz", handler);
  app.get("/healthz/", handler);
}
