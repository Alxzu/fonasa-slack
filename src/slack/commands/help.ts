import type { SlackMessage } from "../../types";
import { buildHelpMessage } from "../messages";

export async function handleHelp(): Promise<SlackMessage> {
  return buildHelpMessage();
}
