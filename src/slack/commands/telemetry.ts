import { getTelemetryStats } from "../../db/queries";
import { logger } from "../../logger";
import type { SlackMessage } from "../../types";
import { buildTelemetryMessage } from "../messages";

const log = logger.child({ module: "cmd:telemetry" });

export async function handleTelemetry(
  workspaceId: string,
  text: string,
): Promise<SlackMessage> {
  const daysStr = text.trim();
  const days = daysStr ? parseInt(daysStr, 10) : 30;

  if (Number.isNaN(days) || days < 1 || days > 365) {
    return {
      text: "Invalid days. Provide a number between 1 and 365.",
      blocks: [],
    };
  }

  log.info({ workspaceId, days }, "Fetching telemetry");
  const stats = await getTelemetryStats(workspaceId, days);
  return buildTelemetryMessage(stats);
}
