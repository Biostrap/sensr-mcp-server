#!/usr/bin/env node

/**
 * Sensr Bio MCP Server
 *
 * Model Context Protocol server for the Sensr Developers API.
 * Exposes wearable biometrics, sleep, activity, scores, calories,
 * device info, and org management as MCP tools.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { SensrClient } from "./sensr-client.js";

// ── Config ──

const API_KEY = process.env.SENSR_API_KEY;
console.error(`[sensr-bio] SENSR_API_KEY length: ${API_KEY?.length ?? 0}`);
if (!API_KEY) {
  console.error("SENSR_API_KEY environment variable is required");
  process.exit(1);
}

const client = new SensrClient({ apiKey: API_KEY });

// ── Server ──

const server = new McpServer({
  name: "sensr-bio",
  version: "1.0.0",
});

// ── Helper ──

function todayStr(): string {
  return new Date().toISOString().split("T")[0];
}

function formatResult(data: unknown): string {
  return JSON.stringify(data, null, 2);
}

// ── Tools ──

// --- Debug ---

server.tool(
  "debug_request",
  "Debug a raw Sensr API GET request. Returns status, selected headers, and a body preview (no secrets).",
  {
    path: z.string().describe("API path starting with /v1/... e.g. /v1/organizations/users/ids"),
    query: z.record(z.string(), z.string()).optional().describe("Optional query params as key/value strings"),
  },
  async ({ path, query }) => {
    const q: Record<string, string> = {};
    if (query) {
      for (const [k, v] of Object.entries(query)) q[k] = String(v);
    }
    const result = await client.debugGet(path, q);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);

// --- Org Management ---

server.tool(
  "list_users",
  "List all users in the Sensr organization. Returns user IDs, names, emails, and profile info.",
  {
    page: z.number().optional().describe("Page number (default: 1)"),
    limit: z.number().optional().describe("Results per page (default: 100)"),
    search: z.string().optional().describe("Search by name or email"),
  },
  async ({ page, limit, search }) => {
    const data = await client.getOrgUsers({ page, limit, search });
    return { content: [{ type: "text", text: formatResult(data) }] };
  }
);

server.tool(
  "get_user_ids",
  "Get all user IDs in the organization (lightweight, no profile data).",
  {},
  async () => {
    const data = await client.getOrgUserIds();
    return { content: [{ type: "text", text: formatResult(data) }] };
  }
);

// --- Biometrics ---

server.tool(
  "get_biometrics",
  "Get paginated biometric readings (heart rate, HRV, SpO2, respiratory rate) for a user. Uses cursor-based pagination via last-timestamp.",
  {
    user_id: z.string().describe("Sensr user ID"),
    last_timestamp: z.number().optional().describe("Last timestamp from previous page (0 for first page)"),
    limit: z.number().optional().describe("Max results per page (default: 50, max: 50)"),
  },
  async ({ user_id, last_timestamp, limit }) => {
    const data = await client.getBiometrics({
      userId: user_id,
      lastTimestamp: last_timestamp,
      limit,
    });
    return { content: [{ type: "text", text: formatResult(data) }] };
  }
);

server.tool(
  "get_biometrics_timeseries",
  "Get continuous biometric timeseries for a specific metric over a time window (max 6 hours). Great for charting HR, HRV, SpO2, or respiratory rate trends.",
  {
    user_id: z.string().describe("Sensr user ID"),
    start_timestamp: z.number().describe("Start time in epoch milliseconds"),
    end_timestamp: z.number().describe("End time in epoch milliseconds (max 6h window)"),
    metric: z
      .enum(["heart_rate", "hrv", "spo2", "resp_rate", "ibi"])
      .optional()
      .describe("Filter to a specific metric"),
  },
  async ({ user_id, start_timestamp, end_timestamp, metric }) => {
    const data = await client.getBiometricsTimeseries({
      userId: user_id,
      startTimestamp: start_timestamp,
      endTimestamp: end_timestamp,
      metric,
    });
    return { content: [{ type: "text", text: formatResult(data) }] };
  }
);

server.tool(
  "get_activity_timeseries",
  "Get normalized activity timeseries over a time window (max 6 hours). Shows activity intensity over time.",
  {
    user_id: z.string().describe("Sensr user ID"),
    start_timestamp: z.number().describe("Start time in epoch milliseconds"),
    end_timestamp: z.number().describe("End time in epoch milliseconds (max 6h window)"),
    timezone_offset_mins: z.number().optional().describe("User timezone offset in minutes (e.g. -360 for CST)"),
  },
  async ({ user_id, start_timestamp, end_timestamp, timezone_offset_mins }) => {
    const data = await client.getActivityTimeseries({
      userId: user_id,
      startTimestamp: start_timestamp,
      endTimestamp: end_timestamp,
      timezoneOffsetMins: timezone_offset_mins,
    });
    return { content: [{ type: "text", text: formatResult(data) }] };
  }
);

// --- Sleep ---

server.tool(
  "get_sleep",
  "Get sleep data for a specific date. Returns sleep stages (light, deep, REM), durations, biometrics during sleep, sleep score, disturbances, and sleep accounting (debt, circadian score).",
  {
    user_id: z.string().describe("Sensr user ID"),
    date: z.string().optional().describe("Date in YYYY-MM-DD format (default: today)"),
  },
  async ({ user_id, date }) => {
    const data = await client.getSleep({ userId: user_id, date });
    return { content: [{ type: "text", text: formatResult(data) }] };
  }
);

server.tool(
  "get_sleep_trend",
  "Get sleep data aggregated over a longer period (week, month, or year). Useful for spotting trends.",
  {
    user_id: z.string().describe("Sensr user ID"),
    date: z.string().optional().describe("Reference date in YYYY-MM-DD format (default: today)"),
    granularity: z
      .enum(["day", "week", "month", "year"])
      .optional()
      .describe("Aggregation period (default: day)"),
  },
  async ({ user_id, date, granularity }) => {
    const data = await client.getSleepGranular({ userId: user_id, date, granularity });
    return { content: [{ type: "text", text: formatResult(data) }] };
  }
);

// --- Activities ---

server.tool(
  "get_activities",
  "Get workout/activity data including exercise names, reps, calories, duration, and scores. Uses cursor-based pagination.",
  {
    user_id: z.string().describe("Sensr user ID"),
    last_timestamp: z.number().optional().describe("Last timestamp from previous page (0 for first page)"),
    limit: z.number().optional().describe("Max results per page (default: 50, max: 50)"),
  },
  async ({ user_id, last_timestamp, limit }) => {
    const data = await client.getActivities({
      userId: user_id,
      lastTimestamp: last_timestamp,
      limit,
    });
    return { content: [{ type: "text", text: formatResult(data) }] };
  }
);

// --- Calories ---

server.tool(
  "get_calories",
  "Get calorie breakdown (resting, workout, active) for a date with optional granularity. Includes hourly timeseries for daily view.",
  {
    user_id: z.string().describe("Sensr user ID"),
    date: z.string().optional().describe("Date in YYYY-MM-DD format (default: today)"),
    granularity: z
      .enum(["day", "week", "month", "year"])
      .optional()
      .describe("Aggregation period (default: day)"),
  },
  async ({ user_id, date, granularity }) => {
    const data = await client.getCalories({ userId: user_id, date, granularity });
    return { content: [{ type: "text", text: formatResult(data) }] };
  }
);

// --- Scores ---

server.tool(
  "get_scores",
  "Get daily health scores: sleep score, recovery score (with stage: ready/moderate/low), and activity score. Quick health snapshot.",
  {
    user_id: z.string().describe("Sensr user ID"),
    date: z.string().optional().describe("Date in YYYY-MM-DD format (default: today)"),
  },
  async ({ user_id, date }) => {
    const data = await client.getScores({ userId: user_id, date });
    return { content: [{ type: "text", text: formatResult(data) }] };
  }
);

// --- Insights ---

server.tool(
  "get_insights",
  "Get AI-generated daily health insights for a user.",
  {
    user_id: z.string().describe("Sensr user ID"),
    date: z.string().optional().describe("Date in YYYY-MM-DD format (default: today)"),
  },
  async ({ user_id, date }) => {
    const data = await client.getInsights({ userId: user_id, date });
    return { content: [{ type: "text", text: formatResult(data) }] };
  }
);

// --- Devices ---

server.tool(
  "get_devices",
  "Get device info for a user: device type, battery percentage, and last sync timestamps.",
  {
    user_id: z.string().describe("Sensr user ID"),
  },
  async ({ user_id }) => {
    const data = await client.getDevices(user_id);
    return { content: [{ type: "text", text: formatResult(data) }] };
  }
);

// --- Raw Data Download ---

server.tool(
  "request_raw_download",
  "Request an async raw data download (PPG, accelerometer, gyroscope) for one or more users. Returns a job ID to poll with get_job_status. Results are emailed as CSV/Parquet.",
  {
    user_ids: z.array(z.string()).describe("Array of Sensr user IDs"),
    start_date: z.string().describe("Start date in RFC3339 format (e.g. 2026-02-15T00:00:00Z)"),
    end_date: z.string().describe("End date in RFC3339 format"),
    email: z.string().describe("Email to receive the download link"),
    data_types: z
      .array(z.enum(["accel", "ppg", "gyro"]))
      .optional()
      .describe("Data types to include (default: all)"),
    formats: z
      .array(z.enum(["csv", "parquet"]))
      .optional()
      .describe("Output formats (default: csv)"),
  },
  async ({ user_ids, start_date, end_date, email, data_types, formats }) => {
    const data = await client.requestRawDownload({
      userIds: user_ids,
      startDate: start_date,
      endDate: end_date,
      email,
      dataTypes: data_types,
      formats,
    });
    return { content: [{ type: "text", text: formatResult(data) }] };
  }
);

server.tool(
  "get_job_status",
  "Check the status of an async raw data download job.",
  {
    job_id: z.string().describe("Job ID from request_raw_download"),
  },
  async ({ job_id }) => {
    const data = await client.getJobStatus(job_id);
    return { content: [{ type: "text", text: formatResult(data) }] };
  }
);

// --- Health Summary (convenience) ---

server.tool(
  "get_health_summary",
  "Get a comprehensive health summary for a user on a given date: scores, sleep, calories, and device status in one call. Most useful daily snapshot tool.",
  {
    user_id: z.string().describe("Sensr user ID"),
    date: z.string().optional().describe("Date in YYYY-MM-DD format (default: today)"),
  },
  async ({ user_id, date }) => {
    const d = date ?? todayStr();
    const [scores, sleep, calories, devices] = await Promise.all([
      client.getScores({ userId: user_id, date: d }).catch((e: Error) => ({ error: e.message })),
      client.getSleep({ userId: user_id, date: d }).catch((e: Error) => ({ error: e.message })),
      client.getCalories({ userId: user_id, date: d, granularity: "day" }).catch((e: Error) => ({ error: e.message })),
      client.getDevices(user_id).catch((e: Error) => ({ error: e.message })),
    ]);

    // Find most recent device by last_data_uploaded_at_ts
    let activeDevice = null;
    if ("devices" in devices && Array.isArray((devices as any).devices)) {
      const sorted = (devices as any).devices
        .filter((d: any) => d.last_data_uploaded_at_ts)
        .sort((a: any, b: any) => (b.last_data_uploaded_at_ts || 0) - (a.last_data_uploaded_at_ts || 0));
      activeDevice = sorted[0] || null;
    }

    const summary = {
      date: d,
      user_id,
      scores,
      sleep,
      calories,
      active_device: activeDevice,
    };

    return { content: [{ type: "text", text: formatResult(summary) }] };
  }
);

// ── Start ──

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Sensr Bio MCP server running on stdio");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
