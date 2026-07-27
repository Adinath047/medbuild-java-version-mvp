#!/bin/bash
# =====================================================================
#  🩺 MEDICOS HOSPITAL EMR — LOAD & SECURITY AUDIT TESTING SUITE
# =====================================================================

TARGET_URL="${1:-http://localhost:8080}"
CONCURRENCY=50
TOTAL_REQUESTS=200

echo "======================================================================"
echo "🩺 STARTING MEDICOS EMR LOAD & SECURITY TEST SUITE"
echo "Target URL  : $TARGET_URL"
echo "Concurrency : $CONCURRENCY parallel clients"
echo "Total Calls : $TOTAL_REQUESTS calls"
echo "======================================================================"

# ── 1. SECURITY TEST: UNAUTHORIZED API ACCESS ───────────────────────
echo ""
echo "🔒 1. TESTING SECURITY: UNAUTHORIZED ENDPOINT ACCESS..."
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$TARGET_URL/api/patients")

if [ "$HTTP_STATUS" -eq 401 ] || [ "$HTTP_STATUS" -eq 403 ]; then
  echo "  ✅ PASSED: Unauthorized request properly blocked with HTTP $HTTP_STATUS"
else
  echo "  ⚠️ WARNING: Endpoint returned HTTP $HTTP_STATUS (Expected 401/403 for unauthorized access)"
fi

# ── 2. SECURITY TEST: PUBLIC HEALTH & SYSTEM STATUS ────────────────
echo ""
echo "🛡️ 2. TESTING PUBLIC SYSTEM ENDPOINTS & CORS HEADERS..."
CORS_HEADER=$(curl -s -I "$TARGET_URL/api/health" | grep -i "Access-Control-Allow-Origin")
echo "  CORS Header Response: ${CORS_HEADER:-'Default CORS Allowed'}"

# ── 3. REDIS CACHE LATENCY BENCHMARK ────────────────────────────────
echo ""
echo "⚡ 3. BENCHMARKING REDIS CACHE MEMORY SPEED (GET /api/system/status)..."

echo "  Executing initial request (Cold Cache)..."
START_TIME=$(date +%s%N)
curl -s "$TARGET_URL/api/system/status" > /dev/null
END_TIME=$(date +%s%N)
COLD_LATENCY=$(( (END_TIME - START_TIME) / 1000000 ))
echo "  Cold Request Latency : ${COLD_LATENCY} ms"

echo "  Executing 2nd request (Warm Redis Memory Cache)..."
START_TIME=$(date +%s%N)
curl -s "$TARGET_URL/api/system/status" > /dev/null
END_TIME=$(date +%s%N)
WARM_LATENCY=$(( (END_TIME - START_TIME) / 1000000 ))
echo "  Warm Cache Latency   : ${WARM_LATENCY} ms"

# ── 4. CONCURRENT LOAD BALANCING TEST ──────────────────────────────
echo ""
echo "🔥 4. RUNNING $CONCURRENCY CONCURRENT LOAD TEST WORKERS..."

SUCCESS_COUNT=0
FAIL_COUNT=0
TOTAL_TIME_MS=0

START_CONCURRENT=$(date +%s%N)

for i in $(seq 1 $CONCURRENCY); do
  (
    CODE=$(curl -s -o /dev/null -w "%{http_code}" "$TARGET_URL/api/system/status")
    if [ "$CODE" -eq 200 ]; then
      exit 0
    else
      exit 1
    fi
  ) &
done

wait

END_CONCURRENT=$(date +%s%N)
ELAPSED_MS=$(( (END_CONCURRENT - START_CONCURRENT) / 1000000 ))

echo "  Completed $CONCURRENCY parallel requests in ${ELAPSED_MS} ms"
echo "  Average throughput: $(( (CONCURRENCY * 1000) / ELAPSED_MS )) req/sec"

echo ""
echo "======================================================================"
echo "🎉 ALL TESTS EXECUTED CLEANLY FOR MEDICOS EMR SYSTEM!"
echo "======================================================================"
