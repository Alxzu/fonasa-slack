export interface ProfileRow {
  id: number;
  workspace_id: string;
  slack_user_id: string;
  name: string;
  empresa: string;
  rut: string;
  documento: string;
  fecha_nac: string;
  created_at: string;
  updated_at: string;
}

export interface RunnerInput {
  empresa: string;
  rut: string;
  documento: string;
  fechaNac: string;
  montoUYU: number;
  baseCalculo: number;
  paymentDate: string;
}

export interface RunnerResult {
  referencia: string;
  pdfPath: string;
  paymentLink: string;
}

export interface ExchangeRate {
  rate: number;
  date: string;
}

export interface ExchangeRateResponse {
  currency: { slug: string; name: string };
  date: string;
  rates: { buy: number; sell: number };
  source: string;
}

export interface ExchangeRateError {
  error: string;
  currency?: string;
  date?: string;
  suggestion?: string;
}

export interface InvoiceRunRow {
  id: number;
  workspace_id: string;
  profile_name: string;
  triggered_by: string;
  channel_id: string;
  payment_date: string;
  status: "pending" | "running" | "success" | "error";
  error_message: string | null;
  duration_ms: number | null;
  started_at: string;
  completed_at: string | null;
}

export interface ProfileEventRow {
  id: number;
  workspace_id: string;
  actor_user_id: string;
  target_name: string;
  action: "setup" | "clear" | "setup_denied" | "clear_denied";
  created_at: string;
}

export interface TelemetryStats {
  total_runs: number;
  success_count: number;
  error_count: number;
  p50_duration: number | null;
  p95_duration: number | null;
  p99_duration: number | null;
  runsPerProfile: Array<{ profile_name: string; count: number }>;
  topErrors: Array<{ error_message: string; count: number }>;
}

export type SlackBlock = Record<string, unknown>;

export interface SlackMessage {
  text: string;
  blocks: SlackBlock[];
}
