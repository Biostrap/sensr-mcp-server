# Sensr Bio MCP Server

A [Model Context Protocol](https://modelcontextprotocol.io) (MCP) server for the [Sensr Bio](https://getsensr.io) wearable platform API. Gives AI assistants access to real-time biometric, sleep, activity, and health score data from Sensr wearable devices.

## Tools

| Tool | Description |
|------|-------------|
| `list_users` | List all users in the organization |
| `get_user_ids` | Get all user IDs (lightweight) |
| `get_biometrics` | Paginated biometric readings (HR, HRV, SpO2, respiratory rate) |
| `get_biometrics_timeseries` | Continuous biometric timeseries for a metric (max 6h window) |
| `get_activity_timeseries` | Normalized activity intensity timeseries (max 6h window) |
| `get_sleep` | Sleep data: stages, durations, biometrics, score, disturbances, debt |
| `get_sleep_trend` | Aggregated sleep data (week/month/year) |
| `get_activities` | Workout data: exercises, reps, calories, duration, scores |
| `get_calories` | Calorie breakdown (resting, workout, active) with timeseries |
| `get_scores` | Daily health scores: sleep, recovery, activity |
| `get_insights` | AI-generated daily health insights |
| `get_devices` | Device info: type, battery, last sync |
| `get_health_summary` | All-in-one daily snapshot (scores + sleep + calories + device) |
| `request_raw_download` | Async raw data export (PPG, accel, gyro) as CSV/Parquet |
| `get_job_status` | Check raw data download job status |

## Setup

### Prerequisites

- Node.js >= 18
- A Sensr Bio Organization API Key (from [platform.getsensr.io](https://platform.getsensr.io) > Developers)

### Install

```bash
npm install
npm run build
```

### Configure

Set the `SENSR_API_KEY` environment variable:

```bash
export SENSR_API_KEY="your-org-api-key-here"
```

### Run

```bash
npm start
```

The server communicates over stdio using the MCP protocol.

### Use with Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "sensr-bio": {
      "command": "node",
      "args": ["/path/to/sensr-mcp-server/dist/index.js"],
      "env": {
        "SENSR_API_KEY": "your-org-api-key-here"
      }
    }
  }
}
```

### Use with Claude Code

```bash
claude mcp add sensr-bio -- node /path/to/sensr-mcp-server/dist/index.js
```

## API Coverage

This server wraps the [Sensr Developers API](https://developers.getsensr.io/) v1.3.1, covering:

- **Biometrics**: Heart rate, HRV, SpO2, respiratory rate, IBI
- **Sleep**: Stages, scores, disturbances, sleep debt/accounting
- **Activities**: Workout detection, rep counting, exercise classification
- **Calories**: Resting, active, workout breakdown
- **Scores**: Sleep, recovery, activity (daily composite)
- **Devices**: Battery, sync status, device type
- **Organization**: User management, user listing
- **Raw Data**: Async PPG/accel/gyro export

### Authentication

Uses Organization API Key authentication (`Authorization: APIKey <key>`). Generate one from [platform.getsensr.io](https://platform.getsensr.io) > Developers. All data endpoints require a `user_id` parameter to specify which user's data to access.

> **Note:** The Sensr auth server does not support `authorization_code` grant for external OAuth2 apps. Org API Key is the only supported auth method for third-party integrations.

## License

MIT
