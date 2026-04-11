import type { KnownBlock, View } from "@slack/web-api";
import { WebClient } from "@slack/web-api";
import type { SlackBlock } from "../types";

let client: WebClient | null = null;

export function getSlackClient(): WebClient {
  if (!client) {
    client = new WebClient(process.env.SLACK_BOT_TOKEN);
  }
  return client;
}

export async function openDM(userId: string): Promise<string> {
  const slack = getSlackClient();
  const result = await slack.conversations.open({ users: userId });
  if (!result.channel?.id) {
    throw new Error(`Failed to open DM with user ${userId}`);
  }
  return result.channel.id;
}

export async function postMessage(
  channelId: string,
  text: string,
  blocks?: SlackBlock[],
): Promise<void> {
  const slack = getSlackClient();
  await slack.chat.postMessage({
    channel: channelId,
    text,
    blocks: blocks as unknown as KnownBlock[],
  });
}

export async function postEphemeral(
  channelId: string,
  userId: string,
  text: string,
  blocks?: SlackBlock[],
): Promise<void> {
  const slack = getSlackClient();
  await slack.chat.postEphemeral({
    channel: channelId,
    user: userId,
    text,
    blocks: blocks as unknown as KnownBlock[],
  });
}

export async function uploadFile(
  channelId: string,
  filePath: string,
  filename: string,
  title: string,
): Promise<void> {
  const slack = getSlackClient();
  const fileContent = await Bun.file(filePath).arrayBuffer();
  await slack.filesUploadV2({
    channel_id: channelId,
    file: Buffer.from(fileContent),
    filename,
    title,
  });
}

export async function openModal(
  triggerId: string,
  view: Record<string, unknown>,
): Promise<void> {
  const slack = getSlackClient();
  await slack.views.open({
    trigger_id: triggerId,
    view: view as unknown as View,
  });
}
