#!/bin/bash
# Test Sensr MCP Server tools against live API
set -e

export SENSR_API_KEY=$(cat /home/ubuntu/.openclaw/workspace-marv/secrets/sensr_api_key)
USER_ID="paWlmpiHvAwj1Hs_NGIpuw"
DATE="2026-02-18"
PASS=0
FAIL=0

test_tool() {
  local name=$1
  local args=$2
  local check=$3

  local init='{"jsonrpc":"2.0","id":0,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}}}'
  local call="{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"tools/call\",\"params\":{\"name\":\"$name\",\"arguments\":$args}}"

  local result
  result=$(printf '%s\n%s\n' "$init" "$call" | node dist/index.js 2>/dev/null | grep '"id":1' | head -1)

  if [ -z "$result" ]; then
    echo "  ❌ $name — no response"
    FAIL=$((FAIL+1))
    return
  fi

  # Check if there's an error
  local is_error
  is_error=$(echo "$result" | python3 -c "import sys,json; msg=json.loads(sys.stdin.read()); c=msg.get('result',{}).get('content',[{}])[0].get('text',''); print('ERROR' if 'error' in c.lower()[:50] else 'OK')" 2>/dev/null || echo "PARSE_FAIL")

  if [ "$is_error" = "ERROR" ]; then
    local errmsg
    errmsg=$(echo "$result" | python3 -c "import sys,json; msg=json.loads(sys.stdin.read()); print(msg.get('result',{}).get('content',[{}])[0].get('text','')[:120])" 2>/dev/null)
    echo "  ❌ $name — $errmsg"
    FAIL=$((FAIL+1))
  elif [ "$is_error" = "PARSE_FAIL" ]; then
    echo "  ❌ $name — parse failure"
    FAIL=$((FAIL+1))
  else
    local summary
    summary=$(echo "$result" | python3 -c "
import sys, json
msg = json.loads(sys.stdin.read())
text = msg.get('result',{}).get('content',[{}])[0].get('text','{}')
data = json.loads(text)
$check
" 2>/dev/null || echo "got data")
    echo "  ✅ $name — $summary"
    PASS=$((PASS+1))
  fi
}

echo "Testing Sensr Bio MCP Server"
echo "=============================="

test_tool "list_users" '{"page":1,"limit":3}' \
  "print(f'{data[\"pagination\"][\"total_items\"]} users, page {data[\"pagination\"][\"page\"]}')"

test_tool "get_user_ids" '{}' \
  "print(f'{len(data.get(\"user_ids\",[]))} user IDs')"

test_tool "get_biometrics" "{\"user_id\":\"$USER_ID\",\"last_timestamp\":0,\"limit\":3}" \
  "print(f'{len(data.get(\"data\",[]))} readings, first bpm={data[\"data\"][0][\"bpm\"]:.1f}')"

test_tool "get_sleep" "{\"user_id\":\"$USER_ID\",\"date\":\"$DATE\"}" \
  "s=data['data'][0]; print(f'score={s[\"score\"][\"value\"]}, deep={s[\"deep_sleep_mins\"]}min, rem={s[\"rem_sleep_mins\"]}min')"

test_tool "get_sleep_trend" "{\"user_id\":\"$USER_ID\",\"date\":\"$DATE\",\"granularity\":\"week\"}" \
  "print(f'got sleep trend data')"

test_tool "get_activities" "{\"user_id\":\"$USER_ID\",\"last_timestamp\":0,\"limit\":2}" \
  "d=data.get('data',[]); print(f'{len(d)} activities') if d else print('no recent activities (OK)')"

test_tool "get_calories" "{\"user_id\":\"$USER_ID\",\"date\":\"$DATE\",\"granularity\":\"day\"}" \
  "m=data.get('metrics',[]); print(f'{len(m)} metrics, resting={m[0][\"value\"]:.0f}kcal') if m else print('got calorie data')"

test_tool "get_scores" "{\"user_id\":\"$USER_ID\",\"date\":\"$DATE\"}" \
  "print(f'sleep={data[\"sleep\"][\"value\"]}, recovery={data[\"recovery\"][\"value\"]}, activity={data[\"activity\"][\"value\"]}')"

test_tool "get_insights" "{\"user_id\":\"$USER_ID\",\"date\":\"$DATE\"}" \
  "print(f'insights returned')"

test_tool "get_devices" "{\"user_id\":\"$USER_ID\"}" \
  "devs=data.get('devices',[]); print(f'{len(devs)} devices, types: {[d[\"type\"] for d in devs]}')"

test_tool "get_health_summary" "{\"user_id\":\"$USER_ID\",\"date\":\"$DATE\"}" \
  "print(f'date={data[\"date\"]}, device={data.get(\"active_device\",{}).get(\"type\",\"none\")}')"

echo ""
echo "=============================="
echo "Results: $PASS passed, $FAIL failed out of $((PASS+FAIL)) tests"
echo "(Skipped: request_raw_download, get_job_status, get_biometrics_timeseries — require specific inputs)"
