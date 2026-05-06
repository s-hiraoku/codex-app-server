import { describe, expect, it } from "vitest";
import { authHeader, FakeCodexAccountClient, issueToken, makeTestApp } from "./helpers.js";

describe("codex account routes", () => {
  it("requires authentication for account endpoints", async () => {
    const { app } = makeTestApp();

    const response = await app.inject({
      method: "GET",
      url: "/v1/codex/account"
    });

    expect(response.statusCode).toBe(401);
  });

  it("requires account scopes for read and login operations", async () => {
    const { app, db } = makeTestApp();
    const token = issueToken(db, ["codex:account:read"]);

    const readResponse = await app.inject({
      method: "GET",
      url: "/v1/codex/account",
      headers: authHeader(token.token)
    });
    const loginResponse = await app.inject({
      method: "POST",
      url: "/v1/codex/account/login/device-code",
      headers: authHeader(token.token)
    });

    expect(readResponse.statusCode).toBe(200);
    expect(loginResponse.statusCode).toBe(403);
  });

  it("starts device-code login without returning secret fields", async () => {
    const accountClient = new FakeCodexAccountClient();
    const { app, db } = makeTestApp({ codexAccountClient: accountClient });
    const token = issueToken(db, ["codex:account:login"]);

    const response = await app.inject({
      method: "POST",
      url: "/v1/codex/account/login/device-code",
      headers: authHeader(token.token)
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      type: "chatgptDeviceCode",
      loginId: "login_test",
      verificationUrl: "https://auth.openai.com/codex/device",
      userCode: "ABCD-1234"
    });
    expect(response.body).not.toContain("deviceCode");
    expect(response.body).not.toContain("accessToken");
  });

  it("cancels login and logs out with scoped tokens", async () => {
    const accountClient = new FakeCodexAccountClient();
    const { app, db } = makeTestApp({ codexAccountClient: accountClient });
    const token = issueToken(db, ["codex:account:login", "codex:account:logout"]);

    const cancelResponse = await app.inject({
      method: "POST",
      url: "/v1/codex/account/login/cancel",
      headers: authHeader(token.token),
      payload: { loginId: "login_test" }
    });
    const logoutResponse = await app.inject({
      method: "POST",
      url: "/v1/codex/account/logout",
      headers: authHeader(token.token)
    });

    expect(cancelResponse.statusCode).toBe(200);
    expect(logoutResponse.statusCode).toBe(200);
    expect(accountClient.cancelledLoginId).toBe("login_test");
    expect(accountClient.loggedOut).toBe(true);
  });
});
