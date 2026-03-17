import asyncio

from fastapi import HTTPException

import api.events as events_api


class _Result:
    def __init__(self, data):
        self.data = data
        self.count = None


class _FakeQuery:
    def __init__(self, table_name: str, store: dict):
        self.table_name = table_name
        self.store = store
        self.filters = {}
        self._single = False

    def select(self, *_args, **_kwargs):
        return self

    def eq(self, key, value):
        self.filters[key] = value
        return self

    def single(self):
        self._single = True
        return self

    def insert(self, payload):
        if self.table_name == "event_rsvps":
            self.store["inserted_rsvp"] = payload
        return self

    def execute(self):
        if self.table_name == "events":
            if self.filters.get("id") == self.store["event"]["id"]:
                return _Result(self.store["event"])
            return _Result(None if self._single else [])

        if self.table_name == "event_rsvps":
            # Existing RSVP check
            if self.filters.get("event_id") is not None and self.filters.get("user_id") is not None:
                return _Result(self.store["existing_rows"])
            # Capacity check (approved RSVPs)
            if self.filters.get("status") == "approved":
                return _Result([])
            return _Result([])

        raise AssertionError(f"Unexpected table requested: {self.table_name}")


class _FakeSupabase:
    def __init__(self, store: dict):
        self.store = store

    def table(self, table_name: str):
        return _FakeQuery(table_name, self.store)


def _run_rsvp(monkeypatch, auto_approve: bool, existing_status: str | None = None):
    existing_rows = []
    if existing_status is not None:
        existing_rows = [{"event_id": 101, "user_id": 123, "status": existing_status}]

    store = {
        "event": {
            "id": 101,
            "host_id": 999,
            "is_cancelled": False,
            "max_participants": None,
        },
        "inserted_rsvp": None,
        "existing_rows": existing_rows,
    }

    async def _fake_get_event(event_id: int, current_user=None):
        return {"id": event_id, "rsvp_status": "approved" if auto_approve else "pending"}

    monkeypatch.setattr(events_api, "get_supabase", lambda: _FakeSupabase(store))
    monkeypatch.setattr(events_api, "get_event", _fake_get_event)
    monkeypatch.setattr(events_api.settings, "AUTO_APPROVE_RSVPS", auto_approve)

    asyncio.run(events_api.rsvp_event(101, current_user={"id": 123}))
    return store["inserted_rsvp"]


def test_rsvp_uses_pending_status_when_auto_approve_flag_is_off(monkeypatch):
    inserted = _run_rsvp(monkeypatch, auto_approve=False)
    assert inserted is not None
    assert inserted["status"] == "pending"


def test_rsvp_uses_approved_status_when_auto_approve_flag_is_on(monkeypatch):
    inserted = _run_rsvp(monkeypatch, auto_approve=True)
    assert inserted is not None
    assert inserted["status"] == "approved"


def test_rsvp_returns_duplicate_error_when_existing_status_is_approved(monkeypatch):
    try:
        _run_rsvp(monkeypatch, auto_approve=True, existing_status="approved")
        raise AssertionError("Expected HTTPException for duplicate RSVP")
    except HTTPException as exc:
        assert exc.status_code == 400
        assert exc.detail == "Already RSVP'd to this event"


def test_rsvp_returns_duplicate_error_when_existing_status_is_rejected(monkeypatch):
    try:
        _run_rsvp(monkeypatch, auto_approve=True, existing_status="rejected")
        raise AssertionError("Expected HTTPException for duplicate RSVP")
    except HTTPException as exc:
        assert exc.status_code == 400
        assert exc.detail == "Already RSVP'd to this event"

