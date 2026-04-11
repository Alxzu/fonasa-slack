import { logger } from "../logger";
import { handleClear } from "./commands/clear";
import { handleHelp } from "./commands/help";
import { handleInvoice } from "./commands/invoice";
import { handleSetup, handleSetupSubmission } from "./commands/setup";
import { handleTelemetry } from "./commands/telemetry";

const log = logger.child({ module: "routes" });

type AckFn = (response?: Record<string, unknown>) => Promise<void>;

function parseSubcommand(text: string): { subcommand: string; args: string } {
  const trimmed = text.trim();
  if (!trimmed) return { subcommand: "help", args: "" };
  if (trimmed.startsWith("setup"))
    return { subcommand: "setup", args: trimmed.slice(5).trim() };
  if (trimmed.startsWith("clear"))
    return { subcommand: "clear", args: trimmed.slice(5).trim() };
  if (trimmed.startsWith("telemetry"))
    return { subcommand: "telemetry", args: trimmed.slice(9).trim() };
  if (trimmed.startsWith("help")) return { subcommand: "help", args: "" };
  if (trimmed.startsWith("<@")) return { subcommand: "invoice", args: trimmed };
  if (trimmed.startsWith("@")) return { subcommand: "invoice", args: trimmed };
  return { subcommand: "help", args: "" };
}

export async function handleSlashCommand(
  body: Record<string, string>,
  ack: AckFn,
): Promise<void> {
  const { text, user_id, user_name, team_id, channel_id, trigger_id } = body;
  const { subcommand, args } = parseSubcommand(text || "");

  log.info({ user: user_id, subcommand }, "Command received");

  try {
    switch (subcommand) {
      case "setup": {
        await ack();
        await handleSetup(trigger_id, user_id, user_name);
        break;
      }
      case "clear": {
        const clearResult = await handleClear(team_id, user_id, args);
        await ack({ text: clearResult });
        break;
      }
      case "invoice": {
        const invoiceAck = await handleInvoice(
          team_id,
          user_id,
          channel_id,
          args,
        );
        await ack({
          response_type: "in_channel",
          text: invoiceAck,
        });
        break;
      }
      case "telemetry": {
        const telemetryResult = await handleTelemetry(team_id, args);
        await ack({ ...telemetryResult });
        break;
      }
      case "help": {
        const helpResult = await handleHelp();
        await ack({ ...helpResult });
        break;
      }
      default:
        await ack({ text: "Unknown command. Try `/fonasa help`" });
    }
  } catch (error) {
    log.error({ error, subcommand }, "Command handler error");
    await ack({ text: "Something went wrong. Please try again." });
  }
}

export async function handleViewSubmission(
  body: Record<string, unknown>,
  ack: AckFn,
): Promise<void> {
  const view = body.view as Record<string, unknown>;
  const callbackId = (view as Record<string, string>).callback_id;

  if (callbackId === "fonasa_setup") {
    await ack();
    const state = view.state as Record<string, unknown>;
    const values = state.values as Record<
      string,
      Record<string, { value: string }>
    >;
    const user = body.user as Record<string, string>;
    const team = body.team as Record<string, string>;

    handleSetupSubmission(team.id, user.id, values).catch((err) => {
      log.error({ err, userId: user.id }, "Setup submission failed");
    });
  } else {
    await ack();
  }
}
