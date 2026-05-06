import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config.js";

describe("config", () => {
  it("rejects the default token pepper in production", () => {
    expect(() =>
      loadConfig({
        NODE_ENV: "production",
        TOKEN_PEPPER: "change-me-to-a-long-random-secret"
      })
    ).toThrow();
  });

  it("rejects bootstrap token in production", () => {
    expect(() =>
      loadConfig({
        NODE_ENV: "production",
        TOKEN_PEPPER: "production-secret",
        BOOTSTRAP_ADMIN_TOKEN: "bootstrap"
      })
    ).toThrow();
  });

  it("rejects missing repo allowlist in production", () => {
    expect(() =>
      loadConfig({
        NODE_ENV: "production",
        TOKEN_PEPPER: "production-secret"
      })
    ).toThrow();
  });
});
