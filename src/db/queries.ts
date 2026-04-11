import { logger } from "../logger";
import { getDb } from "./index";

const log = logger.child({ module: "queries" });

// --- Profiles ---

export async function upsertProfile(
  workspaceId: string,
  slackUserId: string,
  name: string,
  empresa: string,
  rut: string,
  documento: string,
  fechaNac: string,
) {
  const sql = getDb();
  const [row] = await sql`
    INSERT INTO profiles (workspace_id, slack_user_id, name, empresa, rut, documento, fecha_nac)
    VALUES (${workspaceId}, ${slackUserId}, ${name}, ${empresa}, ${rut}, ${documento}, ${fechaNac})
    ON CONFLICT (workspace_id, name) DO UPDATE SET
      slack_user_id = EXCLUDED.slack_user_id,
      empresa = EXCLUDED.empresa,
      rut = EXCLUDED.rut,
      documento = EXCLUDED.documento,
      fecha_nac = EXCLUDED.fecha_nac,
      updated_at = NOW()
    RETURNING *
  `;
  log.info({ workspaceId, name }, "Profile upserted");
  return row;
}

export async function getProfile(workspaceId: string, name: string) {
  const sql = getDb();
  const [row] = await sql`
    SELECT * FROM profiles
    WHERE workspace_id = ${workspaceId} AND name = ${name}
  `;
  return row ?? null;
}

export async function getProfileByUserId(
  workspaceId: string,
  slackUserId: string,
) {
  const sql = getDb();
  const [row] = await sql`
    SELECT * FROM profiles
    WHERE workspace_id = ${workspaceId} AND slack_user_id = ${slackUserId}
  `;
  return row ?? null;
}

export async function deleteProfile(
  workspaceId: string,
  name: string,
): Promise<boolean> {
  const sql = getDb();
  const result = await sql`
    DELETE FROM profiles
    WHERE workspace_id = ${workspaceId} AND name = ${name}
    RETURNING id
  `;
  const deleted = result.length > 0;
  if (deleted) log.info({ workspaceId, name }, "Profile deleted");
  return deleted;
}

// --- Invoice Runs ---

export async function createInvoiceRun(
  workspaceId: string,
  profileName: string,
  triggeredBy: string,
  channelId: string,
  paymentDate: string,
) {
  const sql = getDb();
  const [row] = await sql`
    INSERT INTO invoice_runs (workspace_id, profile_name, triggered_by, channel_id, payment_date, status)
    VALUES (${workspaceId}, ${profileName}, ${triggeredBy}, ${channelId}, ${paymentDate}, 'pending')
    RETURNING *
  `;
  log.info({ id: row.id, workspaceId, profileName }, "Invoice run created");
  return row;
}

export async function updateInvoiceRun(
  id: number,
  updates: {
    status?: string;
    error_message?: string;
    duration_ms?: number;
    completed_at?: string;
  },
) {
  const sql = getDb();

  const status = updates.status ?? null;
  const errorMessage = updates.error_message ?? null;
  const durationMs = updates.duration_ms ?? null;
  const completedAt = updates.completed_at ?? null;

  const [row] = await sql`
    UPDATE invoice_runs SET
      status = COALESCE(${status}, status),
      error_message = COALESCE(${errorMessage}, error_message),
      duration_ms = COALESCE(${durationMs}, duration_ms),
      completed_at = COALESCE(${completedAt}::timestamptz, completed_at)
    WHERE id = ${id}
    RETURNING *
  `;
  log.info({ id, status: updates.status }, "Invoice run updated");
  return row;
}

export async function getRunningRun(workspaceId: string, profileName: string) {
  const sql = getDb();
  const [row] = await sql`
    SELECT * FROM invoice_runs
    WHERE workspace_id = ${workspaceId}
      AND profile_name = ${profileName}
      AND status = 'running'
    ORDER BY started_at DESC
    LIMIT 1
  `;
  return row ?? null;
}

export async function getTelemetryStats(workspaceId: string, days: number) {
  const sql = getDb();

  const [summary] = await sql`
    SELECT
      COUNT(*)::int AS total_runs,
      COUNT(*) FILTER (WHERE status = 'success')::int AS success_count,
      COUNT(*) FILTER (WHERE status = 'error')::int AS error_count,
      PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY duration_ms) FILTER (WHERE duration_ms IS NOT NULL) AS p50_duration,
      PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration_ms) FILTER (WHERE duration_ms IS NOT NULL) AS p95_duration,
      PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY duration_ms) FILTER (WHERE duration_ms IS NOT NULL) AS p99_duration
    FROM invoice_runs
    WHERE workspace_id = ${workspaceId}
      AND started_at >= NOW() - MAKE_INTERVAL(days => ${days})
  `;

  const topErrors = await sql`
    SELECT error_message, COUNT(*)::int AS count
    FROM invoice_runs
    WHERE workspace_id = ${workspaceId}
      AND started_at >= NOW() - MAKE_INTERVAL(days => ${days})
      AND error_message IS NOT NULL
    GROUP BY error_message
    ORDER BY count DESC
    LIMIT 3
  `;

  const runsPerProfile = await sql`
    SELECT profile_name, COUNT(*)::int AS count
    FROM invoice_runs
    WHERE workspace_id = ${workspaceId}
      AND started_at >= NOW() - MAKE_INTERVAL(days => ${days})
    GROUP BY profile_name
    ORDER BY count DESC
  `;

  return {
    ...summary,
    topErrors,
    runsPerProfile,
  };
}

// --- Exchange Rate Logs ---

export async function logExchangeRate(
  requestedDate: string,
  resolvedDate: string | null,
  rate: number | null,
  attempts: number,
  status: string,
  errorMessage: string | null,
  durationMs: number | null,
) {
  const sql = getDb();
  await sql`
    INSERT INTO exchange_rate_logs (requested_date, resolved_date, rate, attempts, status, error_message, duration_ms)
    VALUES (${requestedDate}, ${resolvedDate}, ${rate}, ${attempts}, ${status}, ${errorMessage}, ${durationMs})
  `;
  log.info({ requestedDate, status }, "Exchange rate logged");
}

// --- Profile Events ---

export async function logProfileEvent(
  workspaceId: string,
  actorUserId: string,
  targetName: string,
  action: string,
) {
  const sql = getDb();
  await sql`
    INSERT INTO profile_events (workspace_id, actor_user_id, target_name, action)
    VALUES (${workspaceId}, ${actorUserId}, ${targetName}, ${action})
  `;
  log.info({ workspaceId, targetName, action }, "Profile event logged");
}
