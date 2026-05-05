import { describe, expect, it } from "vitest";
import { makeTestApp } from "./helpers.js";

describe("health", () => {
  it("returns ok without auth", async () => {
    const { app } = makeTestApp();

    const response = await app.inject({
      method: "GET",
      url: "/healthz"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ ok: true });
  });

  it("returns ok without auth with a trailing slash", async () => {
    const { app } = makeTestApp();

    const response = await app.inject({
      method: "GET",
      url: "/healthz/"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ ok: true });
  });
});
