import { existsSync, unlinkSync } from "node:fs";
import { getConfig } from "../../config";
import {
  createInvoiceRun,
  getProfile,
  getProfileByUserId,
  getRunningRun,
  logExchangeRate,
  updateInvoiceRun,
} from "../../db/queries";
import { runFonasa } from "../../fonasa/runner";
import { logger } from "../../logger";
import type { ProfileRow } from "../../types";
import { decrypt } from "../../utils/crypto";
import { formatDateES, parseDateES } from "../../utils/date";
import { getExchangeRate } from "../../utils/exchange-rate";
import { openDM, postMessage, uploadFile } from "../client";
import {
  buildAuthError,
  buildInvoiceError,
  buildInvoiceStarted,
  buildInvoiceSummary,
} from "../messages";

const log = logger.child({ module: "cmd:invoice" });

let activeRuns = 0;
const MAX_CONCURRENT = 2;

const MENTION_RE = /<@(U[A-Z0-9]+)(?:\|([^>]*))?>/;
const PLAIN_MENTION_RE = /^@(\S+)/;

export async function handleInvoice(
  workspaceId: string,
  userId: string,
  channelId: string,
  text: string,
): Promise<string> {
  let targetName = "";
  let rest = "";

  const mentionMatch = text.match(MENTION_RE);
  if (mentionMatch) {
    const targetUserId = mentionMatch[1];
    targetName = mentionMatch[2] || "";
    if (targetUserId !== userId) {
      return buildAuthError().text;
    }
    rest = text
      .slice((mentionMatch.index ?? 0) + mentionMatch[0].length)
      .trim();
  } else {
    const plainMatch = text.match(PLAIN_MENTION_RE);
    if (plainMatch) {
      targetName = plainMatch[1];
      rest = text.slice((plainMatch.index ?? 0) + plainMatch[0].length).trim();
    } else {
      // No mention — use caller's own profile
      rest = text.trim();
    }
  }
  const parts = rest.split(/\s+/).filter(Boolean);

  if (parts.length === 0) {
    return "Usage: `/fonasa <monto_usd> [DD/MM/YYYY]`";
  }

  const montoUSD = parseFloat(parts[0]);
  if (Number.isNaN(montoUSD) || montoUSD <= 0) {
    return "Invalid amount. Provide a positive number in USD.";
  }

  let paymentDateStr: string | undefined;
  if (parts[1]) {
    try {
      parseDateES(parts[1]);
      paymentDateStr = parts[1];
    } catch {
      return "Invalid date format. Use DD/MM/YYYY.";
    }
  }

  let profile = targetName ? await getProfile(workspaceId, targetName) : null;
  if (!profile) {
    profile = await getProfileByUserId(workspaceId, userId);
  }
  if (!profile) {
    return `No profile found. Use \`/fonasa setup\` first.`;
  }

  if (profile.slack_user_id !== userId) {
    return buildAuthError().text;
  }

  const runningRun = await getRunningRun(workspaceId, profile.name);
  if (runningRun) {
    return "An invoice is already being generated for this profile. Please wait.";
  }

  if (activeRuns >= MAX_CONCURRENT) {
    return "Too many invoices being generated right now. Please try again shortly.";
  }

  processInvoice(
    workspaceId,
    userId,
    channelId,
    profile,
    montoUSD,
    paymentDateStr,
  ).catch((err) => {
    log.error({ err, userId }, "Unhandled error in processInvoice");
  });

  return buildInvoiceStarted().text;
}

async function processInvoice(
  workspaceId: string,
  userId: string,
  channelId: string,
  profile: ProfileRow,
  montoUSD: number,
  paymentDateStr: string | undefined,
): Promise<void> {
  const config = getConfig();
  const startTime = Date.now();

  const paymentDate = paymentDateStr ? parseDateES(paymentDateStr) : new Date();

  const paymentDateFormatted = formatDateES(paymentDate);

  const run = await createInvoiceRun(
    workspaceId,
    profile.name,
    userId,
    channelId,
    paymentDateFormatted,
  );

  await updateInvoiceRun(run.id, { status: "running" });
  activeRuns++;

  let pdfPath: string | undefined;

  try {
    const rateStart = Date.now();
    const { exchangeRate, attempts } = await getExchangeRate(
      config.EXCHANGE_RATE_API,
      paymentDate,
    );
    const rateDuration = Date.now() - rateStart;

    await logExchangeRate(
      paymentDateFormatted,
      exchangeRate.date,
      exchangeRate.rate,
      attempts,
      "success",
      null,
      rateDuration,
    );

    const montoUYU = Math.round(montoUSD * exchangeRate.rate);
    const baseCalculo = Math.round(montoUYU * 0.7);

    const empresa = decrypt(profile.empresa, config.ENCRYPTION_KEY);
    const rut = decrypt(profile.rut, config.ENCRYPTION_KEY);
    const documento = decrypt(profile.documento, config.ENCRYPTION_KEY);
    const fechaNac = decrypt(profile.fecha_nac, config.ENCRYPTION_KEY);

    const result = await runFonasa({
      empresa,
      rut,
      documento,
      fechaNac,
      montoUYU,
      baseCalculo,
      paymentDate: paymentDateFormatted,
    });

    pdfPath = result.pdfPath;
    const duration = Date.now() - startTime;

    await updateInvoiceRun(run.id, {
      status: "success",
      duration_ms: duration,
      completed_at: new Date().toISOString(),
    });

    const dmChannel = await openDM(userId);

    const summary = buildInvoiceSummary(
      result.referencia,
      montoUSD,
      exchangeRate.rate,
      exchangeRate.date,
      montoUYU,
      baseCalculo,
      paymentDateFormatted,
      result.paymentLink,
    );
    await postMessage(dmChannel, summary.text, summary.blocks);

    await uploadFile(
      dmChannel,
      result.pdfPath,
      `FacturaBPS_${result.referencia}.pdf`,
      `FONASA Invoice ${result.referencia}`,
    );

    log.info(
      { runId: run.id, referencia: result.referencia },
      "Invoice completed",
    );
  } catch (err) {
    const duration = Date.now() - startTime;
    const errorMessage = sanitizeError(err, profile, config.ENCRYPTION_KEY);

    await updateInvoiceRun(run.id, {
      status: "error",
      error_message: errorMessage,
      duration_ms: duration,
      completed_at: new Date().toISOString(),
    });

    log.error({ err, runId: run.id }, "Invoice generation failed");

    try {
      const dmChannel = await openDM(userId);
      const errMsg = buildInvoiceError(errorMessage);
      await postMessage(dmChannel, errMsg.text, errMsg.blocks);
    } catch (dmErr) {
      log.warn({ dmErr, userId }, "Failed to send error DM");
    }
  } finally {
    activeRuns--;

    if (pdfPath && existsSync(pdfPath)) {
      try {
        unlinkSync(pdfPath);
      } catch {
        // ignore cleanup errors
      }
    }
  }
}

function sanitizeError(
  err: unknown,
  profile: ProfileRow,
  encryptionKey: string,
): string {
  const message = err instanceof Error ? err.message : String(err);

  try {
    const sensitiveValues = [
      decrypt(profile.empresa, encryptionKey),
      decrypt(profile.rut, encryptionKey),
      decrypt(profile.documento, encryptionKey),
      decrypt(profile.fecha_nac, encryptionKey),
    ];

    let sanitized = message;
    for (const value of sensitiveValues) {
      if (value && sanitized.includes(value)) {
        sanitized = sanitized.replaceAll(value, "[REDACTED]");
      }
    }
    return sanitized;
  } catch {
    return message;
  }
}
