/**
 * Sensr API Client
 * Wraps the Sensr Developers API (api.getsensr.io) v1.3.1
 */

const BASE_URL = "https://api.getsensr.io";

export interface SensrClientConfig {
  apiKey: string;
}

export interface PaginatedRequest {
  userId: string;
  lastTimestamp?: number;
  limit?: number;
}

export interface DateRequest {
  userId: string;
  date?: string; // YYYY-MM-DD, defaults to today
}

export interface GranularityRequest extends DateRequest {
  granularity?: "day" | "week" | "month" | "year";
}

export interface TimeseriesRequest {
  userId: string;
  startTimestamp: number;
  endTimestamp: number;
  metric?: "heart_rate" | "hrv" | "spo2" | "resp_rate" | "ibi";
}

export interface RawDownloadRequest {
  userIds: string[];
  startDate: string; // RFC3339
  endDate: string; // RFC3339
  email: string;
  dataTypes?: string[]; // accel, ppg, gyro
  formats?: string[]; // csv, parquet
}

export interface OrgUsersRequest {
  page?: number;
  limit?: number;
  search?: string;
}

export class SensrClient {
  private apiKey: string;

  constructor(config: SensrClientConfig) {
    this.apiKey = config.apiKey;
  }

  private async request(path: string, params: Record<string, string | number | undefined> = {}): Promise<any> {
    const url = new URL(`${BASE_URL}${path}`);
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, String(value));
      }
    }

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `APIKey ${this.apiKey}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      const errors = (data as any).errors;
      const msg = errors?.[0]?.title || errors?.[0]?.detail || `HTTP ${response.status}`;
      throw new Error(`Sensr API error: ${msg}`);
    }

    return data;
  }

  // ── Organization ──

  async getOrgUsers(opts: OrgUsersRequest = {}): Promise<any> {
    return this.request("/v1/organizations/users", {
      page: opts.page ?? 1,
      limit: opts.limit ?? 100,
      search: opts.search,
    });
  }

  async getOrgUserIds(): Promise<any> {
    return this.request("/v1/organizations/users/ids");
  }

  // ── Biometrics ──

  async getBiometrics(opts: PaginatedRequest): Promise<any> {
    return this.request("/v1/biometrics", {
      user_id: opts.userId,
      "last-timestamp": opts.lastTimestamp ?? 0,
      limit: opts.limit ?? 50,
    });
  }

  async getBiometricsTimeseries(opts: TimeseriesRequest): Promise<any> {
    const windowMs = opts.endTimestamp - opts.startTimestamp;
    if (windowMs > 6 * 60 * 60 * 1000) {
      throw new Error("Timeseries window cannot exceed 6 hours. Split into smaller requests.");
    }
    const params: Record<string, string | number | undefined> = {
      user_id: opts.userId,
      start_timestamp: opts.startTimestamp,
      end_timestamp: opts.endTimestamp,
    };
    if (opts.metric) {
      params.metric = opts.metric;
    }
    return this.request("/v1/biometrics/timeseries", params);
  }

  // ── Sleep ──

  async getSleep(opts: DateRequest): Promise<any> {
    return this.request("/v1/sleep", {
      user_id: opts.userId,
      date: opts.date ?? todayStr(),
    });
  }

  async getSleepGranular(opts: GranularityRequest): Promise<any> {
    return this.request("/v1/sleep/details", {
      user_id: opts.userId,
      date: opts.date ?? todayStr(),
      granularity: opts.granularity ?? "day",
    });
  }

  // ── Activities ──

  async getActivities(opts: PaginatedRequest): Promise<any> {
    return this.request("/v1/activities", {
      user_id: opts.userId,
      "last-timestamp": opts.lastTimestamp ?? 0,
      limit: opts.limit ?? 50,
    });
  }

  // ── Calories ──

  async getCalories(opts: GranularityRequest): Promise<any> {
    return this.request("/v1/calorie/details", {
      user_id: opts.userId,
      date: opts.date ?? todayStr(),
      granularity: opts.granularity ?? "day",
    });
  }

  // ── Scores ──

  async getScores(opts: DateRequest): Promise<any> {
    return this.request("/v1/scores", {
      user_id: opts.userId,
      date: opts.date ?? todayStr(),
    });
  }

  // ── Insights ──

  async getInsights(opts: DateRequest): Promise<any> {
    return this.request("/v1/insights", {
      user_id: opts.userId,
      date: opts.date ?? todayStr(),
    });
  }

  // ── Devices ──

  async getDevices(userId: string): Promise<any> {
    return this.request("/v1/device-info", { user_id: userId });
  }

  // ── Raw Data Download ──

  async requestRawDownload(opts: RawDownloadRequest): Promise<any> {
    const url = `${BASE_URL}/v1/organizations/data-download/raw/send-request`;
    const body: any = {
      user_ids: opts.userIds,
      start_date: opts.startDate,
      end_date: opts.endDate,
      requester_email: opts.email,
    };
    if (opts.dataTypes?.length) body.data = opts.dataTypes;
    if (opts.formats?.length) body.format = opts.formats;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `APIKey ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    if (!response.ok) {
      const errors = (data as any).errors;
      throw new Error(`Sensr API error: ${errors?.[0]?.title || `HTTP ${response.status}`}`);
    }
    return data;
  }

  async getJobStatus(jobId: string): Promise<any> {
    return this.request("/v1/organizations/job-status", { job_id: jobId });
  }

  // ── Monitoring ──

  async getMonitoring(opts: DateRequest): Promise<any> {
    return this.request("/v1/monitoring", {
      user_id: opts.userId,
      date: opts.date ?? todayStr(),
    });
  }
}

function todayStr(): string {
  return new Date().toISOString().split("T")[0];
}
