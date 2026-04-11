import { beforeEach, describe, expect, mock, test } from "bun:test";
import { getExchangeRate } from "../src/utils/exchange-rate";

const MOCK_API_URL = "https://api.example.com/exchange-rate";
const PAYMENT_DATE = new Date(2026, 3, 10); // April 10, 2026

function jsonResponse(body: object, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const successBody = {
  currency: { slug: "usd", name: "US Dollar" },
  date: "2026-03-31",
  rates: { buy: 42.5, sell: 43.0 },
  source: "BCU",
};

const notFoundBody = {
  error: "No exchange rate available for this date",
  currency: "usd",
  date: "2026-03-31",
};

describe("getExchangeRate", () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  test("successful fetch returns rate and attempts=1", async () => {
    const mockFetch = mock(() => Promise.resolve(jsonResponse(successBody)));
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    const result = await getExchangeRate(MOCK_API_URL, PAYMENT_DATE);

    expect(result.exchangeRate.rate).toBe(43.0);
    expect(result.exchangeRate.date).toBe("2026-03-31");
    expect(result.attempts).toBe(1);
    expect(mockFetch).toHaveBeenCalledTimes(1);

    globalThis.fetch = originalFetch;
  });

  test("404 retries with previous business day", async () => {
    let callCount = 0;
    const mockFetch = mock(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve(jsonResponse(notFoundBody, 404));
      }
      return Promise.resolve(jsonResponse(successBody));
    });
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    const result = await getExchangeRate(MOCK_API_URL, PAYMENT_DATE);

    expect(result.attempts).toBe(2);
    expect(result.exchangeRate.rate).toBe(43.0);
    expect(mockFetch).toHaveBeenCalledTimes(2);

    globalThis.fetch = originalFetch;
  });

  test("multiple retries until success", async () => {
    let callCount = 0;
    const mockFetch = mock(() => {
      callCount++;
      if (callCount <= 3) {
        return Promise.resolve(jsonResponse(notFoundBody, 404));
      }
      return Promise.resolve(jsonResponse(successBody));
    });
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    const result = await getExchangeRate(MOCK_API_URL, PAYMENT_DATE);

    expect(result.attempts).toBe(4);
    expect(mockFetch).toHaveBeenCalledTimes(4);

    globalThis.fetch = originalFetch;
  });

  test("network error throws", async () => {
    const mockFetch = mock(() => Promise.reject(new Error("ECONNREFUSED")));
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    await expect(getExchangeRate(MOCK_API_URL, PAYMENT_DATE)).rejects.toThrow(
      "Unable to connect to exchange rate API: ECONNREFUSED",
    );

    globalThis.fetch = originalFetch;
  });

  test("non-404 error throws", async () => {
    const mockFetch = mock(() =>
      Promise.resolve(jsonResponse({ error: "Internal server error" }, 500)),
    );
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    await expect(getExchangeRate(MOCK_API_URL, PAYMENT_DATE)).rejects.toThrow(
      "Failed to fetch exchange rate: Internal server error",
    );

    globalThis.fetch = originalFetch;
  });

  test("max retries exceeded throws", async () => {
    const mockFetch = mock(() =>
      Promise.resolve(jsonResponse(notFoundBody, 404)),
    );
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    await expect(getExchangeRate(MOCK_API_URL, PAYMENT_DATE)).rejects.toThrow(
      "Could not find exchange rate after 10 attempts",
    );
    expect(mockFetch).toHaveBeenCalledTimes(10);

    globalThis.fetch = originalFetch;
  });
});
