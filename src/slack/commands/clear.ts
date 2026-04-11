import { deleteProfile, getProfile, logProfileEvent } from "../../db/queries";
import { logger } from "../../logger";
import { buildAuthError, buildProfileCleared } from "../messages";

const log = logger.child({ module: "cmd:clear" });

const MENTION_RE = /<@(U[A-Z0-9]+)(?:\|([^>]*))?>/;
const PLAIN_MENTION_RE = /^@(\S+)/;

export async function handleClear(
  workspaceId: string,
  userId: string,
  text: string,
): Promise<string> {
  let targetName = "";

  const mentionMatch = text.match(MENTION_RE);
  if (mentionMatch) {
    if (mentionMatch[1] !== userId) {
      await logProfileEvent(
        workspaceId,
        userId,
        mentionMatch[1],
        "clear_denied",
      );
      log.warn(
        { userId, targetUserId: mentionMatch[1] },
        "Unauthorized clear attempt",
      );
      return buildAuthError().text;
    }
    targetName = mentionMatch[2] || "";
  } else {
    const plainMatch = text.match(PLAIN_MENTION_RE);
    if (!plainMatch) {
      return "Usage: `/fonasa clear @name`";
    }
    targetName = plainMatch[1];
  }

  const profile = await getProfile(workspaceId, targetName);

  if (!profile) {
    // Try to find by slack_user_id using a name lookup fallback
    return `No profile found. Use \`/fonasa setup\` first.`;
  }

  if (profile.slack_user_id !== userId) {
    await logProfileEvent(workspaceId, userId, profile.name, "clear_denied");
    return buildAuthError().text;
  }

  const deleted = await deleteProfile(workspaceId, profile.name);
  if (!deleted) {
    return "No profile found to delete.";
  }

  await logProfileEvent(workspaceId, userId, profile.name, "clear");
  log.info({ userId, name: profile.name }, "Profile cleared");

  return buildProfileCleared(profile.name).text;
}
