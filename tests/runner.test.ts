import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { existsSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { runFonasa } from "../src/fonasa/runner";
import type { RunnerInput } from "../src/types";

const FIXTURES_DIR = join(import.meta.dir, "fixtures");

let server: ReturnType<typeof Bun.serve>;
let baseUrl: string;

beforeAll(() => {
  server = Bun.serve({
    port: 0, // random available port
    async fetch(req) {
      const url = new URL(req.url);
      const filePath = join(FIXTURES_DIR, url.pathname);
      const file = Bun.file(filePath);
      if (await file.exists()) {
        return new Response(file, {
          headers: { "Content-Type": "text/html" },
        });
      }
      return new Response("Not Found", { status: 404 });
    },
  });
  baseUrl = `http://localhost:${server.port}`;
});

afterAll(() => {
  server.stop();
});

function makeInput(overrides: Partial<RunnerInput> = {}): RunnerInput {
  return {
    empresa: "123456",
    rut: "1234567890",
    documento: "12345678",
    fechaNac: "01/01/1990",
    montoUYU: 43000,
    baseCalculo: 30100,
    paymentDate: "15/04/2026",
    formUrl: `${baseUrl}/bps-form.html`,
    ...overrides,
  };
}

describe("runFonasa", () => {
  test("completes full invoice flow against mock form", async () => {
    const input = makeInput();
    const result = await runFonasa(input);

    expect(result.referencia).toMatch(/^\d+$/);
    expect(result.paymentLink).toContain(`ref=${result.referencia}`);
    expect(result.pdfPath).toContain("FacturaBPS_");
    expect(existsSync(result.pdfPath)).toBe(true);

    // Cleanup
    unlinkSync(result.pdfPath);
  }, 30_000);

  test("works with different payment dates", async () => {
    const input = makeInput({ paymentDate: "01/02/2026" });
    const result = await runFonasa(input);

    expect(result.referencia).toMatch(/^\d+$/);
    expect(existsSync(result.pdfPath)).toBe(true);

    unlinkSync(result.pdfPath);
  }, 30_000);

  test("works with different amounts", async () => {
    const input = makeInput({ montoUYU: 100000, baseCalculo: 70000 });
    const result = await runFonasa(input);

    expect(result.referencia).toMatch(/^\d+$/);
    expect(existsSync(result.pdfPath)).toBe(true);

    unlinkSync(result.pdfPath);
  }, 30_000);
});
