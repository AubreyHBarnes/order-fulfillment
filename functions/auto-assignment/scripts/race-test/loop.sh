#!/bin/bash
# Usage: bash functions/auto-assignment/scripts/race-test/loop.sh [cycles]
R=functions/auto-assignment/scripts/race-test/repro-race.js
node $R cleanup >/dev/null 2>&1
for i in $(seq 1 "${1:-5}"); do
  echo "== run $i"
  node $R 2>&1 | grep -E "RACE|No race|status="
  node $R cleanup >/dev/null 2>&1
done
echo "== done, cleaned up"
