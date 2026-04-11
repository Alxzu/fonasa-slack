import { logger } from "../logger";
import type {
  ExchangeRate,
  ExchangeRateError,
  ExchangeRateResponse,
} from "../types";
import {
  formatDateISO,
  getLastBusinessDayOfPreviousMonth,
  getPreviousBusinessDay,
} from "./date";

const log = logger.child({ module: "exchange-rate" });
const MAX_RETRIES = 10;

export async function getExchangeRate(
  apiUrl: string,
  paymentDate: Date,
): Promise<{ exchangeRate: ExchangeRate; attempts: number }> {
  let currentDate = getLastBusinessDayOfPreviousMonth(paymentDate);

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const dateStr = formatDateISO(currentDate);
    const url = `${apiUrl}?date=${dateStr}`;

    log.info({ date: dateStr, attempt }, "Fetching exchange rate");

    let response: Response;
    try {
      response = await fetch(url);
    } catch (err) {
      throw new Error(
        `Unable to connect to exchange rate API: ${err instanceof Error ? err.message : err}`,
      );
    }

    if (response.ok) {
      const data = (await response.json()) as ExchangeRateResponse;
      log.info({ rate: data.rates.sell, date: dateStr }, "Exchange rate found");
      return {
        exchangeRate: { rate: data.rates.sell, date: dateStr },
        attempts: attempt,
      };
    }

    let errorData: ExchangeRateError | null = null;
    try {
      errorData = (await response.json()) as ExchangeRateError;
    } catch {}

    if (
      response.status === 404 ||
      errorData?.error?.includes("No exchange rate available")
    ) {
      log.warn(
        { date: dateStr },
        "No rate available, trying previous business day",
      );
      currentDate = getPreviousBusinessDay(currentDate);
      continue;
    }

    throw new Error(
      `Failed to fetch exchange rate: ${errorData?.error || `HTTP ${response.status}`}`,
    );
  }

  throw new Error(`Could not find exchange rate after ${MAX_RETRIES} attempts`);
}
