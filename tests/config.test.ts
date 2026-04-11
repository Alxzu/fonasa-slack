import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { randomBytes } from "node:crypto";

const validEnv = {
  SLACK_BOT_TOKEN: "xoxb-test-token-123",
  SLACK_APP_TOKEN: "xapp-test-token-456",
  ENCRYPTION_KEY: randomBytes(32).toString("hex"),
  DATABASE_URL: "postgres://localhost:5432/test",
};

let savedEnv: NodeJS.ProcessEnv;

describe("getConfig", () => {
  beforeEach(() => {
    savedEnv = { ...process.env };
    for (const key of Object.keys(validEnv)) {
      delete process.env[key];
    }
    delete process.env.EXCHANGE_RATE_API;
    delete process.env.PORT;
    delete process.env.LOG_LEVEL;
  });

  afterEach(async () => {
    process.env = savedEnv;
    const mod = await import("../src/config");
    mod.resetConfig();
  });

  async function freshGetConfig() {
    const mod = await import("../src/config");
    mod.resetConfig();
    return mod.getConfig();
  }

  test("valid config parses successfully", async () => {
    Object.assign(process.env, validEnv);
    const config = await freshGetConfig();
    expect(config.SLACK_BOT_TOKEN).toBe(validEnv.SLACK_BOT_TOKEN);
    expect(config.SLACK_APP_TOKEN).toBe(validEnv.SLACK_APP_TOKEN);
    expect(config.ENCRYPTION_KEY).toBe(validEnv.ENCRYPTION_KEY);
    expect(config.DATABASE_URL).toBe(validEnv.DATABASE_URL);
  });

  test("default values applied correctly", async () => {
    Object.assign(process.env, validEnv);
    const config = await freshGetConfig();
    expect(config.PORT).toBe(3001);
    expect(config.LOG_LEVEL).toBe("info");
    expect(config.EXCHANGE_RATE_API).toBe(
      "https://bcu.alxzu.duckdns.org/api/v2/rates/usd-cash",
    );
  });

  test("missing SLACK_BOT_TOKEN throws", async () => {
    const { SLACK_BOT_TOKEN: _, ...rest } = validEnv;
    Object.assign(process.env, rest);
    expect(freshGetConfig).toThrow();
  });

  test("invalid SLACK_BOT_TOKEN prefix throws", async () => {
    Object.assign(process.env, { ...validEnv, SLACK_BOT_TOKEN: "bad-token" });
    expect(freshGetConfig).toThrow();
  });

  test("invalid ENCRYPTION_KEY (wrong length) throws", async () => {
    Object.assign(process.env, { ...validEnv, ENCRYPTION_KEY: "abcdef" });
    expect(freshGetConfig).toThrow();
  });

  test("invalid ENCRYPTION_KEY (non-hex) throws", async () => {
    Object.assign(process.env, {
      ...validEnv,
      ENCRYPTION_KEY: "g".repeat(64),
    });
    expect(freshGetConfig).toThrow();
  });

  test("error message redacts sensitive fields", async () => {
    Object.assign(process.env, { ...validEnv, DATABASE_URL: "invalid" });
    try {
      await freshGetConfig();
      expect(true).toBe(false);
    } catch (err) {
      expect((err as Error).message).toContain("redacted");
      expect((err as Error).message).not.toContain("invalid");
    }
  });
});
