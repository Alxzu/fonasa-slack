import type { SlackBlock, SlackMessage, TelemetryStats } from "../types";

export function buildSetupModal(userName: string) {
  return {
    type: "modal" as const,
    callback_id: "fonasa_setup",
    title: { type: "plain_text" as const, text: "FONASA Setup" },
    submit: { type: "plain_text" as const, text: "Save" },
    blocks: [
      {
        type: "input",
        block_id: "name_block",
        element: {
          type: "plain_text_input",
          action_id: "name_input",
          initial_value: userName,
          placeholder: { type: "plain_text" as const, text: "Profile name" },
        },
        label: { type: "plain_text" as const, text: "Name" },
      },
      {
        type: "input",
        block_id: "empresa_block",
        element: {
          type: "plain_text_input",
          action_id: "empresa_input",
          placeholder: { type: "plain_text" as const, text: "e.g. 123456" },
        },
        label: { type: "plain_text" as const, text: "Empresa" },
      },
      {
        type: "input",
        block_id: "rut_block",
        element: {
          type: "plain_text_input",
          action_id: "rut_input",
          placeholder: {
            type: "plain_text" as const,
            text: "e.g. 211234560019",
          },
        },
        label: { type: "plain_text" as const, text: "RUT" },
      },
      {
        type: "input",
        block_id: "documento_block",
        element: {
          type: "plain_text_input",
          action_id: "documento_input",
          placeholder: { type: "plain_text" as const, text: "e.g. 12345678" },
        },
        label: { type: "plain_text" as const, text: "Documento" },
      },
      {
        type: "input",
        block_id: "fecha_nac_block",
        element: {
          type: "plain_text_input",
          action_id: "fecha_nac_input",
          placeholder: { type: "plain_text" as const, text: "DD/MM/YYYY" },
        },
        label: { type: "plain_text" as const, text: "Fecha de Nacimiento" },
      },
    ],
  };
}

export function buildInvoiceStarted(): SlackMessage {
  const text = "Generating invoice... This takes 30-60 seconds.";
  return {
    text,
    blocks: [
      {
        type: "section",
        text: { type: "mrkdwn", text: `:hourglass_flowing_sand: ${text}` },
      },
    ],
  };
}

export function buildInvoiceSummary(
  referencia: string,
  montoUSD: number,
  exchangeRate: number,
  exchangeDate: string,
  montoUYU: number,
  baseCalculo: number,
  paymentDate: string,
  paymentLink: string,
): SlackMessage {
  const text = `Invoice ${referencia} generated successfully.`;
  return {
    text,
    blocks: [
      {
        type: "header",
        text: { type: "plain_text", text: "FONASA Invoice Generated" },
      },
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: `*Reference:*\n${referencia}` },
          { type: "mrkdwn", text: `*Payment Date:*\n${paymentDate}` },
          {
            type: "mrkdwn",
            text: `*Amount (USD):*\n$${montoUSD.toLocaleString()}`,
          },
          {
            type: "mrkdwn",
            text: `*Exchange Rate:*\n${exchangeRate} (${exchangeDate})`,
          },
          {
            type: "mrkdwn",
            text: `*Amount (UYU):*\n$${montoUYU.toLocaleString()}`,
          },
          {
            type: "mrkdwn",
            text: `*Base de Calculo:*\n$${baseCalculo.toLocaleString()}`,
          },
        ],
      },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: { type: "plain_text", text: "Pay Invoice" },
            url: paymentLink,
            style: "primary",
          },
        ],
      },
    ],
  };
}

export function buildInvoiceError(message: string): SlackMessage {
  const text = `Invoice generation failed: ${message}`;
  return {
    text,
    blocks: [
      {
        type: "section",
        text: { type: "mrkdwn", text: `:x: *Invoice Error*\n${message}` },
      },
    ],
  };
}

export function buildHelpMessage(): SlackMessage {
  const text = "FONASA Bot Commands";
  return {
    text,
    blocks: [
      {
        type: "header",
        text: { type: "plain_text", text: "FONASA Bot Commands" },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: [
            "`/fonasa setup` - Configure your FONASA profile",
            "`/fonasa <monto_usd> [DD/MM/YYYY]` - Generate an invoice",
            "`/fonasa clear @you` - Delete your profile",
            "`/fonasa telemetry [days]` - View usage statistics",
            "`/fonasa help` - Show this message",
          ].join("\n"),
        },
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: "Payment date defaults to today if omitted. Exchange rate is fetched from the last business day of the previous month.",
          },
        ],
      },
    ],
  };
}

export function buildTelemetryMessage(stats: TelemetryStats): SlackMessage {
  const successRate =
    stats.total_runs > 0
      ? ((stats.success_count / stats.total_runs) * 100).toFixed(1)
      : "0";

  const blocks: SlackBlock[] = [
    {
      type: "header",
      text: { type: "plain_text", text: "FONASA Telemetry" },
    },
    {
      type: "section",
      fields: [
        { type: "mrkdwn", text: `*Total Runs:*\n${stats.total_runs}` },
        { type: "mrkdwn", text: `*Success Rate:*\n${successRate}%` },
        { type: "mrkdwn", text: `*Successes:*\n${stats.success_count}` },
        { type: "mrkdwn", text: `*Errors:*\n${stats.error_count}` },
      ],
    },
  ];

  if (stats.p50_duration != null) {
    blocks.push({
      type: "section",
      fields: [
        {
          type: "mrkdwn",
          text: `*p50 Duration:*\n${(stats.p50_duration / 1000).toFixed(1)}s`,
        },
        {
          type: "mrkdwn",
          text: `*p95 Duration:*\n${((stats.p95_duration ?? 0) / 1000).toFixed(1)}s`,
        },
        {
          type: "mrkdwn",
          text: `*p99 Duration:*\n${((stats.p99_duration ?? 0) / 1000).toFixed(1)}s`,
        },
      ],
    });
  }

  return { text: "FONASA Telemetry", blocks };
}

export function buildProfileCleared(name: string): SlackMessage {
  const text = `Profile "${name}" has been deleted.`;
  return {
    text,
    blocks: [
      {
        type: "section",
        text: { type: "mrkdwn", text: `:wastebasket: ${text}` },
      },
    ],
  };
}

export function buildProfileSaved(name: string): SlackMessage {
  const text = `Profile "${name}" has been saved.`;
  return {
    text,
    blocks: [
      {
        type: "section",
        text: { type: "mrkdwn", text: `:white_check_mark: ${text}` },
      },
    ],
  };
}

export function buildAuthError(): SlackMessage {
  const text = "You can only manage your own profile.";
  return {
    text,
    blocks: [
      { type: "section", text: { type: "mrkdwn", text: `:no_entry: ${text}` } },
    ],
  };
}
