#!/usr/bin/env bash
# Quick latency check for PropNinja API — run from an Indian network.
# Usage: API_URL=https://crm-production-XXXX.up.railway.app ./scripts/latency-check.sh

set -euo pipefail

API_URL="${API_URL:-https://crm-production-e81d.up.railway.app}"
HEALTH_URL="${API_URL%/}/health"
TARGET_MS=50
WARN_MS=100

echo "PropNinja latency check (QA-016)"
echo "Target: < ${TARGET_MS} ms total (Indian network)"
echo "Acceptable: < ${WARN_MS} ms"
echo "URL: ${HEALTH_URL}"
echo ""

RESULT=$(curl -s -o /tmp/propninja-health.json -w "%{http_code} %{time_total} %{time_connect}" "${HEALTH_URL}")
HTTP_CODE=$(echo "$RESULT" | awk '{print $1}')
TIME_TOTAL=$(echo "$RESULT" | awk '{print $2}')
TIME_CONNECT=$(echo "$RESULT" | awk '{print $3}')

TOTAL_MS=$(awk "BEGIN {printf \"%.0f\", ${TIME_TOTAL} * 1000}")
CONNECT_MS=$(awk "BEGIN {printf \"%.0f\", ${TIME_CONNECT} * 1000}")

echo "HTTP:        ${HTTP_CODE}"
echo "Connect:     ${CONNECT_MS} ms"
echo "Total:       ${TOTAL_MS} ms"
echo ""
echo "Response body:"
cat /tmp/propninja-health.json
echo ""

if [[ "$HTTP_CODE" != "200" ]]; then
  echo "FAIL: expected HTTP 200"
  exit 1
fi

if [[ "$TOTAL_MS" -gt "$WARN_MS" ]]; then
  echo "FAIL: total ${TOTAL_MS} ms exceeds ${WARN_MS} ms — verify Railway region is Mumbai (ap-south-1)"
  exit 1
fi

if [[ "$TOTAL_MS" -gt "$TARGET_MS" ]]; then
  echo "WARN: total ${TOTAL_MS} ms above ${TARGET_MS} ms target but within acceptable range"
  exit 0
fi

echo "OK: latency within target"
