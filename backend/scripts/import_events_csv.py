"""
Import events from a CSV file into Supabase.

Usage:
  python scripts/import_events_csv.py --file data/events.csv
  python scripts/import_events_csv.py --file data/events.csv --commit
"""
from __future__ import annotations

import argparse
import base64
import csv
import json
import os
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

BACKEND_DIR = Path(__file__).parent.parent.resolve()
os.chdir(BACKEND_DIR)

from supabase import create_client


REQUIRED_HEADERS = {"title", "location", "start_time"}
OPTIONAL_HEADERS = {
    "description",
    "end_time",
    "max_participants",
    "is_cancelled",
    "is_public",
    "image_url",
    "cover_image_url",
    "sport",
    "sport_id",
    "host_email",
    "host_id",
}


@dataclass
class ParsedRow:
    row_number: int
    payload: dict[str, Any]
    dedupe_key: tuple[str, int, int, str, str]


@dataclass
class RowError:
    row_number: int
    message: str


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Import events CSV into Supabase")
    parser.add_argument("--file", required=True, help="Path to CSV file")
    parser.add_argument(
        "--commit",
        action="store_true",
        help="Write inserts to database. Without this flag, runs as dry-run.",
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=100,
        help="Insert batch size when using --commit (default: 100)",
    )
    parser.add_argument(
        "--strict",
        action="store_true",
        help="Stop on first row validation error.",
    )
    parser.add_argument(
        "--allow-anon",
        action="store_true",
        help="Allow non-service key (not recommended).",
    )
    parser.add_argument(
        "--verbose",
        action="store_true",
        help="Print extra diagnostics.",
    )
    return parser.parse_args()


def decode_jwt_payload(token: str) -> dict[str, Any] | None:
    parts = token.split(".")
    if len(parts) != 3:
        return None
    payload_b64 = parts[1]
    padded = payload_b64 + "=" * ((4 - len(payload_b64) % 4) % 4)
    try:
        decoded = base64.urlsafe_b64decode(padded.encode("utf-8")).decode("utf-8")
        return json.loads(decoded)
    except Exception:
        return None


def classify_supabase_key(key: str) -> str:
    value = key.strip()
    lower = value.lower()
    if value.startswith("sb_secret_"):
        return "service_role"
    payload = decode_jwt_payload(value)
    if payload and isinstance(payload, dict):
        role = str(payload.get("role", "")).lower()
        if role == "service_role":
            return "service_role"
        if role in {"anon", "authenticated"}:
            return role
    if "anon" in lower or "publishable" in lower:
        return "anon_like"
    return "unknown"


def load_env_file(path: Path) -> dict[str, str]:
    env_map: dict[str, str] = {}
    if not path.exists():
        return env_map
    for line in path.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or "=" not in stripped:
            continue
        key, value = stripped.split("=", 1)
        env_map[key.strip()] = value.strip().strip('"').strip("'")
    return env_map


def resolve_supabase_credentials() -> tuple[str, str]:
    env_local = load_env_file(BACKEND_DIR / ".env.local")
    env_fallback = load_env_file(BACKEND_DIR / ".env")
    supabase_url = os.getenv("SUPABASE_URL") or env_local.get("SUPABASE_URL") or env_fallback.get("SUPABASE_URL") or ""
    supabase_key = os.getenv("SUPABASE_KEY") or env_local.get("SUPABASE_KEY") or env_fallback.get("SUPABASE_KEY") or ""
    return supabase_url, supabase_key


def validate_auth(supabase_url: str, supabase_key: str, allow_anon: bool, verbose: bool) -> None:
    if not supabase_url:
        raise RuntimeError("SUPABASE_URL is missing. Add it to backend/.env.local or backend/.env.")
    if not supabase_key:
        raise RuntimeError("SUPABASE_KEY is missing. Add the service role key to backend/.env.local or backend/.env.")

    key_type = classify_supabase_key(supabase_key)
    if verbose:
        host = supabase_url.replace("https://", "").replace("http://", "").split("/")[0]
        print(f"[auth] Supabase host: {host}")
        print(f"[auth] Key classification: {key_type}")

    if key_type != "service_role" and not allow_anon:
        raise RuntimeError(
            "SUPABASE_KEY does not look like a service role key. "
            "Use the service role key or pass --allow-anon for local testing."
        )


def parse_bool(value: str | None, default: bool = True) -> bool:
    if value is None or value.strip() == "":
        return default
    normalized = value.strip().lower()
    if normalized in {"1", "true", "t", "yes", "y"}:
        return True
    if normalized in {"0", "false", "f", "no", "n"}:
        return False
    raise ValueError(f"Invalid boolean value: {value}")


def parse_datetime_utc(value: str, field_name: str) -> datetime:
    if not value or value.strip() == "":
        raise ValueError(f"{field_name} is required")
    normalized = value.strip().replace("Z", "+00:00")
    try:
        dt = datetime.fromisoformat(normalized)
    except ValueError as exc:
        raise ValueError(f"Invalid {field_name}: {value}. Use ISO-8601.") from exc
    if dt.tzinfo is None:
        # Assume UTC for naive values to keep import deterministic.
        dt = dt.replace(tzinfo=UTC)
    return dt.astimezone(UTC)


def normalize_text(value: str) -> str:
    return " ".join(value.strip().lower().split())


def fetch_all_pages(query_builder: Any, page_size: int = 1000) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    offset = 0
    while True:
        page = query_builder.range(offset, offset + page_size - 1).execute()
        data = page.data or []
        if not data:
            break
        rows.extend(data)
        if len(data) < page_size:
            break
        offset += page_size
    return rows


def build_sport_lookup(
    supabase: Any, requested_ids: set[int], requested_names: set[str]
) -> dict[str, tuple[int, str | None]]:
    lookup: dict[str, tuple[int, str | None]] = {}
    if requested_ids:
        rows = fetch_all_pages(supabase.table("sports").select("id, name, icon").in_("id", sorted(requested_ids)))
        for row in rows:
            if row.get("id") is not None:
                sport_info = (int(row["id"]), row.get("icon"))
                lookup[f"id:{row['id']}"] = sport_info
            if row.get("name"):
                lookup[f"name:{normalize_text(str(row['name']))}"] = sport_info
    if requested_names:
        rows = fetch_all_pages(supabase.table("sports").select("id, name, icon").in_("name", sorted(requested_names)))
        for row in rows:
            if row.get("id") is not None:
                sport_info = (int(row["id"]), row.get("icon"))
                lookup[f"id:{row['id']}"] = sport_info
            if row.get("name"):
                lookup[f"name:{normalize_text(str(row['name']))}"] = sport_info
    return lookup


def build_host_lookup(supabase: Any, requested_ids: set[int], requested_emails: set[str]) -> dict[str, int]:
    lookup: dict[str, int] = {}
    if requested_ids:
        rows = fetch_all_pages(supabase.table("users").select("id, email").in_("id", sorted(requested_ids)))
        for row in rows:
            if row.get("id") is not None:
                lookup[f"id:{row['id']}"] = int(row["id"])
            if row.get("email"):
                lookup[f"email:{str(row['email']).strip().lower()}"] = int(row["id"])
    if requested_emails:
        rows = fetch_all_pages(supabase.table("users").select("id, email").in_("email", sorted(requested_emails)))
        for row in rows:
            if row.get("id") is not None:
                lookup[f"id:{row['id']}"] = int(row["id"])
            if row.get("email"):
                lookup[f"email:{str(row['email']).strip().lower()}"] = int(row["id"])
    return lookup


def collect_reference_requests(rows: list[dict[str, str]]) -> tuple[set[int], set[str], set[int], set[str]]:
    sport_ids: set[int] = set()
    sport_names: set[str] = set()
    host_ids: set[int] = set()
    host_emails: set[str] = set()

    for row in rows:
        raw_sport_id = (row.get("sport_id") or "").strip()
        raw_sport_name = (row.get("sport") or "").strip()
        raw_host_id = (row.get("host_id") or "").strip()
        raw_host_email = (row.get("host_email") or "").strip()

        if raw_sport_id:
            if raw_sport_id.isdigit():
                sport_ids.add(int(raw_sport_id))
        elif raw_sport_name:
            sport_names.add(raw_sport_name)

        if raw_host_id:
            if raw_host_id.isdigit():
                host_ids.add(int(raw_host_id))
        elif raw_host_email:
            host_emails.add(raw_host_email.lower())

    return sport_ids, sport_names, host_ids, host_emails


def load_csv_rows(file_path: Path) -> list[dict[str, str]]:
    with file_path.open("r", newline="", encoding="utf-8-sig") as handle:
        reader = csv.DictReader(handle)
        if not reader.fieldnames:
            raise RuntimeError("CSV file has no headers.")
        headers = {header.strip() for header in reader.fieldnames if header}
        missing = REQUIRED_HEADERS - headers
        if missing:
            raise RuntimeError(f"CSV missing required headers: {', '.join(sorted(missing))}")
        if "sport" not in headers and "sport_id" not in headers:
            raise RuntimeError("CSV requires either 'sport' or 'sport_id' column.")
        if "host_email" not in headers and "host_id" not in headers:
            raise RuntimeError("CSV requires either 'host_email' or 'host_id' column.")
        unknown = headers - REQUIRED_HEADERS - OPTIONAL_HEADERS
        if unknown:
            print(f"Warning: unrecognized CSV headers ignored: {', '.join(sorted(unknown))}")
        rows = []
        for row in reader:
            # Normalize keys/values to avoid trailing-space column names and values
            cleaned = {(k or "").strip(): (v or "").strip() for k, v in row.items()}
            rows.append(cleaned)
    if not rows:
        raise RuntimeError("CSV contains no rows.")
    return rows


def parse_rows(
    raw_rows: list[dict[str, str]],
    sport_lookup: dict[str, tuple[int, str | None]],
    host_lookup: dict[str, int],
    strict: bool,
) -> tuple[list[ParsedRow], list[RowError]]:
    valid: list[ParsedRow] = []
    errors: list[RowError] = []

    for idx, row in enumerate(raw_rows, start=2):  # Header is row 1
        try:
            title = row.get("title", "").strip()
            location = row.get("location", "").strip()
            if not title:
                raise ValueError("title is required")
            if not location:
                raise ValueError("location is required")

            start_time = parse_datetime_utc(row.get("start_time", ""), "start_time")
            end_time_raw = row.get("end_time", "").strip()
            end_time = parse_datetime_utc(end_time_raw, "end_time") if end_time_raw else None
            if end_time and end_time < start_time:
                raise ValueError("end_time must be greater than or equal to start_time")

            sport_id: int | None = None
            sport_icon: str | None = None
            sport_id_raw = row.get("sport_id", "").strip()
            sport_name_raw = row.get("sport", "").strip()
            if sport_id_raw:
                if not sport_id_raw.isdigit():
                    raise ValueError(f"invalid sport_id: {sport_id_raw}")
                sport_info = sport_lookup.get(f"id:{int(sport_id_raw)}")
            elif sport_name_raw:
                sport_info = sport_lookup.get(f"name:{normalize_text(sport_name_raw)}")
            else:
                sport_info = None

            if sport_info is not None:
                sport_id, sport_icon = sport_info
            if sport_id is None:
                raise ValueError("sport not found (check sport_id or sport column)")

            host_id: int | None = None
            host_id_raw = row.get("host_id", "").strip()
            host_email_raw = row.get("host_email", "").strip()
            if host_id_raw:
                if not host_id_raw.isdigit():
                    raise ValueError(f"invalid host_id: {host_id_raw}")
                host_id = host_lookup.get(f"id:{int(host_id_raw)}")
            elif host_email_raw:
                host_id = host_lookup.get(f"email:{host_email_raw.lower()}")
            if host_id is None:
                raise ValueError("host user not found (check host_id or host_email column)")

            max_participants_raw = row.get("max_participants", "").strip()
            max_participants = None
            if max_participants_raw:
                max_participants = int(max_participants_raw)
                if max_participants <= 0:
                    raise ValueError("max_participants must be positive")

            is_public = parse_bool(row.get("is_public"), default=True)

            image_url_raw = row.get("image_url", "").strip() or None
            cover_image_url_raw = row.get("cover_image_url", "").strip() or None
            sport_icon_value = sport_icon.strip() if isinstance(sport_icon, str) and sport_icon.strip() else None

            # Keep image and cover aligned by default:
            # 1) use explicit CSV values, 2) fallback to sport icon.
            image_url = image_url_raw or sport_icon_value
            cover_image_url = cover_image_url_raw or image_url

            payload = {
                "title": title,
                "description": row.get("description", "").strip() or None,
                "sport_id": sport_id,
                "host_id": host_id,
                "location": location,
                "start_time": start_time.isoformat(),
                "end_time": end_time.isoformat() if end_time else None,
                "max_participants": max_participants,
                "is_public": is_public,
                "is_cancelled": False,
                "image_url": image_url,
                "cover_image_url": cover_image_url,
            }

            key = (
                normalize_text(title),
                sport_id,
                host_id,
                normalize_text(location),
                start_time.isoformat(),
            )
            valid.append(ParsedRow(row_number=idx, payload=payload, dedupe_key=key))
        except Exception as exc:
            errors.append(RowError(row_number=idx, message=str(exc)))
            if strict:
                break

    return valid, errors


def fetch_existing_event_keys(supabase: Any, parsed_rows: list[ParsedRow]) -> set[tuple[str, int, int, str, str]]:
    if not parsed_rows:
        return set()

    host_ids = sorted({row.payload["host_id"] for row in parsed_rows})
    min_start = min(datetime.fromisoformat(row.payload["start_time"]) for row in parsed_rows).isoformat()
    max_start = max(datetime.fromisoformat(row.payload["start_time"]) for row in parsed_rows).isoformat()

    query = (
        supabase.table("events")
        .select("title,sport_id,host_id,location,start_time")
        .in_("host_id", host_ids)
        .gte("start_time", min_start)
        .lte("start_time", max_start)
    )
    rows = fetch_all_pages(query)

    keys: set[tuple[str, int, int, str, str]] = set()
    for row in rows:
        try:
            start_time = parse_datetime_utc(str(row.get("start_time") or ""), "start_time")
            keys.add(
                (
                    normalize_text(str(row.get("title") or "")),
                    int(row["sport_id"]),
                    int(row["host_id"]),
                    normalize_text(str(row.get("location") or "")),
                    start_time.isoformat(),
                )
            )
        except Exception:
            continue
    return keys


def write_errors_csv(input_file: Path, row_errors: list[RowError]) -> Path | None:
    if not row_errors:
        return None
    output = input_file.with_name(f"{input_file.stem}.import-errors.csv")
    with output.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle)
        writer.writerow(["row_number", "error"])
        for row_error in row_errors:
            writer.writerow([row_error.row_number, row_error.message])
    return output


def main() -> int:
    args = parse_args()
    csv_path = Path(args.file)
    if not csv_path.exists():
        print(f"❌ CSV file not found: {csv_path}")
        return 1
    if args.batch_size <= 0:
        print("❌ --batch-size must be greater than 0")
        return 1

    try:
        supabase_url, supabase_key = resolve_supabase_credentials()
        validate_auth(
            supabase_url=supabase_url,
            supabase_key=supabase_key,
            allow_anon=args.allow_anon,
            verbose=args.verbose,
        )
        supabase = create_client(supabase_url, supabase_key)
    except Exception as exc:
        print(f"❌ Auth/connection check failed: {exc}")
        return 1

    try:
        raw_rows = load_csv_rows(csv_path)
    except Exception as exc:
        print(f"❌ Failed to read CSV: {exc}")
        return 1

    sport_ids, sport_names, host_ids, host_emails = collect_reference_requests(raw_rows)
    try:
        sport_lookup = build_sport_lookup(supabase, sport_ids, sport_names)
        host_lookup = build_host_lookup(supabase, host_ids, host_emails)
    except Exception as exc:
        print(f"❌ Failed loading sport/user references: {exc}")
        return 1

    parsed_rows, row_errors = parse_rows(raw_rows, sport_lookup, host_lookup, strict=args.strict)
    if args.strict and row_errors:
        first = row_errors[0]
        print(f"❌ Strict mode failed at row {first.row_number}: {first.message}")
        return 1

    existing_keys = fetch_existing_event_keys(supabase, parsed_rows)
    to_insert: list[ParsedRow] = []
    skipped_existing: list[ParsedRow] = []
    for parsed in parsed_rows:
        if parsed.dedupe_key in existing_keys:
            skipped_existing.append(parsed)
        else:
            to_insert.append(parsed)

    mode = "COMMIT" if args.commit else "DRY-RUN"
    print(f"\n=== Import Mode: {mode} ===")
    print(f"Input rows: {len(raw_rows)}")
    print(f"Valid rows: {len(parsed_rows)}")
    print(f"Invalid rows: {len(row_errors)}")
    print(f"Already existing: {len(skipped_existing)}")
    print(f"Pending insert: {len(to_insert)}")

    inserted = 0
    insert_errors = 0
    if args.commit and to_insert:
        for start in range(0, len(to_insert), args.batch_size):
            batch = to_insert[start : start + args.batch_size]
            payloads = [row.payload for row in batch]
            try:
                result = supabase.table("events").insert(payloads).execute()
                inserted += len(result.data or [])
            except Exception as exc:
                insert_errors += len(batch)
                print(f"⚠️ Failed to insert batch starting at row {batch[0].row_number}: {exc}")
    elif not args.commit:
        print("Dry-run active. Re-run with --commit to apply inserts.")

    errors_file = write_errors_csv(csv_path, row_errors)
    if errors_file:
        print(f"Row error report: {errors_file}")

    print("\n=== Summary ===")
    if args.commit:
        print(f"Inserted: {inserted}")
        print(f"Skipped (already existing): {len(skipped_existing)}")
    else:
        print(f"Would insert: {len(to_insert)}")
        print(f"Would skip (already existing): {len(skipped_existing)}")
    print(f"Invalid rows: {len(row_errors)}")
    print(f"Insert errors: {insert_errors}")

    if row_errors or insert_errors:
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
