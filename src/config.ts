import { z } from "zod";

const configSchema = z.object({
  SLACK_BOT_TOKEN: z.string().startsWith("xoxb-"),
  SLACK_APP_TOKEN: z.string().startsWith("xapp-"),
  ENCRYPTION_KEY: z
    .string()
    .length(64)
    .regex(/^[0-9a-f]+$/i),
  DATABASE_URL: z.string().startsWith("postgres"),
  EXCHANGE_RATE_API: z
    .string()
    .url()
    .default("https://bcu.alxzu.duckdns.org/api/v2/rates/usd-cash"),
  PORT: z.coerce.number().default(3001),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
});

export type Config = z.infer<typeof configSchema>;

let cached: Config | null = null;

export function getConfig(): Config {
  if (cached) return cached;

  try {
    cached = configSchema.parse(process.env);
    return cached;
  } catch (err) {
    if (err instanceof z.ZodError) {
      const safeIssues = err.issues.map((issue) => {
        const path = issue.path.join(".");
        if (path === "DATABASE_URL" || path === "ENCRYPTION_KEY") {
          return { path, message: "Invalid value (redacted)" };
        }
        return { path, message: issue.message };
      });
      throw new Error(
        `Config validation failed:\n${safeIssues.map((i) => `  ${i.path}: ${i.message}`).join("\n")}`,
      );
    }
    throw err;
  }
}

export function resetConfig(): void {
  cached = null;
}
