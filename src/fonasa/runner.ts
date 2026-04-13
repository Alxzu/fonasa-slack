import { existsSync, mkdirSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";
import { logger } from "../logger";
import type { RunnerInput, RunnerResult } from "../types";

const log = logger.child({ module: "runner" });

const BPS_FORM_URL =
  "https://app1.bps.gub.uy/SnisProfesionalesWeb/paginas/anticipos/snisAnticiposAInicio.jsf";
const TIMEOUT_MS = 90_000;
const OUTPUT_DIR = join(import.meta.dir, "..", "..", "output");

export async function runFonasa(input: RunnerInput): Promise<RunnerResult> {
  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
  const browser = await chromium.launch({
    headless: true,
    ...(executablePath ? { executablePath } : {}),
  });

  try {
    const context = await browser.newContext({ acceptDownloads: true });
    context.setDefaultTimeout(TIMEOUT_MS);
    const page = await context.newPage();

    // ── Step 1: Fill holder data ──────────────────────────────────────
    log.info("Step 1: Filling holder data");

    await page.goto(BPS_FORM_URL, { waitUntil: "networkidle" });

    await page.locator('input[id$="txtEmpresat"]').fill(input.empresa);
    await page.locator('input[id$="txtRut"]').fill(input.rut);
    await page.locator('input[id$="txtDocumento"]').fill(input.documento);

    // Date of birth needs evaluate — JSF doesn't respond to Playwright's .fill()
    await page.evaluate((dob: string) => {
      const el = document.querySelector<HTMLInputElement>(
        'input[id$="txtFechaNac"]',
      );
      if (!el) throw new Error("Could not find date of birth input");
      const setter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )?.set;
      setter?.call(el, dob);
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
      el.dispatchEvent(new Event("blur", { bubbles: true }));
    }, input.fechaNac);
    await page.waitForTimeout(500);

    await page.getByRole("link", { name: "Siguiente >" }).click();
    await page.waitForLoadState("networkidle");

    // ── Step 2: Invoice type (defaults are pre-selected) ─────────────
    log.info("Step 2: Selecting invoice type");

    await page.getByRole("link", { name: "Siguiente >" }).click();
    await page.waitForLoadState("networkidle");

    // ── Step 3: Fill invoice data ────────────────────────────────────
    log.info("Step 3: Filling invoice data");

    await page.waitForTimeout(1000);

    // Tax type select — always IRPF
    try {
      const impuestoSelect = page
        .locator('select[id*="impuesto"], select[name*="impuesto"]')
        .first();
      if ((await impuestoSelect.count()) > 0) {
        await impuestoSelect.selectOption("IRPF");
      }
    } catch {
      log.warn("Tax type select not found, skipping");
    }

    await page.waitForTimeout(500);

    // Fill amount (montoUYU)
    const montoInput = page
      .locator(
        'input[name*="j_id46"], input[id*="monto"], input[name*="monto"]',
      )
      .first();
    if ((await montoInput.count()) > 0) {
      await montoInput.fill(String(input.montoUYU));
    } else {
      const montoRow = page
        .locator(
          'tr:has-text("Monto facturado") input, tr:has-text("Monto") input',
        )
        .first();
      await montoRow.fill(String(input.montoUYU));
    }
    await page.waitForTimeout(300);

    // Fill base de calculo
    const baseInput = page
      .locator(
        'input[alt*="profImporte"], input[id*="base"], input[name*="base"]',
      )
      .first();
    if ((await baseInput.count()) > 0) {
      await baseInput.fill(String(input.baseCalculo));
    } else {
      const baseRow = page
        .locator(
          'tr:has-text("Base de cálculo") input, tr:has-text("Base") input',
        )
        .first();
      await baseRow.fill(String(input.baseCalculo));
    }
    await page.waitForTimeout(300);

    // Fill payment date — find the input next to the last calendar icon
    const dateInputId = await page.evaluate(() => {
      const icons = document.querySelectorAll('img[alt="calendario"]');
      const lastIcon = icons[icons.length - 1];
      const input = lastIcon
        ?.closest("td")
        ?.querySelector("input[type='text']");
      return input?.id ?? null;
    });

    if (dateInputId) {
      const escapedId = dateInputId.replace(/:/g, "\\:");
      const dateInput = page.locator(`#${escapedId}`);
      await dateInput.clear();
      await dateInput.fill(input.paymentDate);
      await dateInput.press("Tab");
      await page.waitForTimeout(500);
      log.info({ dateInputId, date: input.paymentDate }, "Payment date set");
    } else {
      log.warn("Payment date input not found, form will use default date");
    }

    // Click Confirmar
    await page
      .locator(
        'a:has-text("Confirmar"), input[value*="Confirmar"], button:has-text("Confirmar")',
      )
      .first()
      .click();
    await page.waitForLoadState("networkidle");

    // ── Step 4: Extract results and download PDF ─────────────────────
    log.info("Step 4: Extracting results and downloading PDF");

    await page.waitForTimeout(1000);

    // Extract payment link
    const paymentLink = await page
      .locator('a:has-text("Pagar Factura")')
      .getAttribute("href");

    if (!paymentLink) {
      throw new Error("Could not find payment link");
    }

    // Extract reference number from the payment link
    const refMatch = paymentLink.match(/ref=(\d+)/);
    if (!refMatch) {
      throw new Error("Could not extract reference from payment link");
    }
    const referencia = refMatch[1];

    // Download PDF
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.locator('a:has-text("Imprimir o Descargar Factura")').click(),
    ]);

    const pdfPath = join(OUTPUT_DIR, `FacturaBPS_${referencia}.pdf`);

    // Remove existing file if present
    if (existsSync(pdfPath)) {
      unlinkSync(pdfPath);
    }

    await download.saveAs(pdfPath);

    log.info({ referencia }, "Invoice generated successfully");

    return { referencia, pdfPath, paymentLink };
  } catch (err) {
    // Save debug screenshot (no sensitive data is visible at step 3+)
    const screenshotPath = join(OUTPUT_DIR, "debug_error.png");
    try {
      const pages = browser.contexts()[0]?.pages();
      if (pages?.length) {
        await pages[0].screenshot({ path: screenshotPath, fullPage: true });
        log.info({ screenshotPath }, "Debug screenshot saved");
      }
    } catch {
      // ignore screenshot errors
    }
    throw err;
  } finally {
    await browser.close();
  }
}
