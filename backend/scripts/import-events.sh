#!/usr/bin/env bash
set -euo pipefail

if [[ ${1:-} == "-h" || ${1:-} == "--help" ]]; then
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  BACKEND_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
  cd "${BACKEND_DIR}"
  python scripts/import_events_csv.py --help
  exit 0
fi

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <csv-file> [additional flags]"
  echo "   or: $0 --file <csv-file> [additional flags]"
  echo "Try:   $0 --help"
  echo "Example: $0 ./data/events.csv --commit"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

cd "${BACKEND_DIR}"
if [[ ${1:-} == --* ]]; then
  # Forward explicit argparse-style flags, e.g. --file path.csv --commit
  if [[ ${IMPORT_EVENTS_DEBUG:-0} == "1" ]]; then
    echo "[import-events.sh] python scripts/import_events_csv.py $*"
  fi
  python scripts/import_events_csv.py "$@"
else
  # Support convenience positional form: ./import-events.sh path.csv --commit
  if [[ ${IMPORT_EVENTS_DEBUG:-0} == "1" ]]; then
    echo "[import-events.sh] python scripts/import_events_csv.py --file $1 ${*:2}"
  fi
  python scripts/import_events_csv.py --file "$1" "${@:2}"
fi
