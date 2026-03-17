import logging

from fastapi.testclient import TestClient

from main import app
import api.auth as auth_api
import api.buddies as buddies_api
import api.events as events_api
import api.posts as posts_api


class _Result:
    def __init__(self, data):
        self.data = data
        self.count = None


class _EventsQuery:
    def __init__(self, fail: bool):
        self.fail = fail

    def select(self, *_args, **_kwargs):
        return self

    def eq(self, *_args, **_kwargs):
        return self

    def ilike(self, *_args, **_kwargs):
        return self

    def gte(self, *_args, **_kwargs):
        return self

    def lte(self, *_args, **_kwargs):
        return self

    def order(self, *_args, **_kwargs):
        return self

    def execute(self):
        if self.fail:
            raise RuntimeError("simulated events query failure")
        return _Result([])


class _PostsQuery:
    def __init__(self, fail: bool):
        self.fail = fail

    def select(self, *_args, **_kwargs):
        return self

    def eq(self, *_args, **_kwargs):
        return self

    def order(self, *_args, **_kwargs):
        return self

    def range(self, *_args, **_kwargs):
        return self

    def execute(self):
        if self.fail:
            raise RuntimeError("simulated posts query failure")
        return _Result([])


class _BuddiesQuery:
    def __init__(self, fail: bool):
        self.fail = fail

    def select(self, *_args, **_kwargs):
        return self

    def eq(self, *_args, **_kwargs):
        return self

    def execute(self):
        if self.fail:
            raise RuntimeError("simulated buddies query failure")
        return _Result([])


class _FakeSupabase:
    def __init__(self, fail_events: bool = False, fail_posts: bool = False, fail_buddies: bool = False):
        self.fail_events = fail_events
        self.fail_posts = fail_posts
        self.fail_buddies = fail_buddies

    def table(self, table_name: str):
        if table_name == "events":
            return _EventsQuery(self.fail_events)
        if table_name == "posts":
            return _PostsQuery(self.fail_posts)
        if table_name == "buddies":
            return _BuddiesQuery(self.fail_buddies)
        raise AssertionError(f"Unexpected table requested: {table_name}")


def test_list_events_returns_empty_array_for_true_empty_dataset(monkeypatch):
    monkeypatch.setattr(events_api, "get_supabase", lambda: _FakeSupabase(fail_events=False))
    client = TestClient(app)

    response = client.get("/events")

    assert response.status_code == 200
    assert response.json() == []


def test_list_events_returns_503_and_logs_on_operational_failure(monkeypatch, caplog):
    monkeypatch.setattr(events_api, "get_supabase", lambda: _FakeSupabase(fail_events=True))
    client = TestClient(app)
    caplog.set_level(logging.ERROR, logger=events_api.__name__)

    response = client.get("/events")

    assert response.status_code == 503
    assert response.json()["detail"] == "Service temporarily unavailable"
    assert any("Operational failure listing events" in r.getMessage() for r in caplog.records)


def test_get_posts_returns_empty_array_for_true_empty_dataset(monkeypatch):
    monkeypatch.setattr(posts_api, "get_supabase", lambda: _FakeSupabase(fail_posts=False))
    client = TestClient(app)

    response = client.get("/posts")

    assert response.status_code == 200
    assert response.json() == []


def test_get_posts_returns_503_and_logs_on_operational_failure(monkeypatch, caplog):
    monkeypatch.setattr(posts_api, "get_supabase", lambda: _FakeSupabase(fail_posts=True))
    client = TestClient(app)
    caplog.set_level(logging.ERROR, logger=posts_api.__name__)

    response = client.get("/posts")

    assert response.status_code == 503
    assert response.json()["detail"] == "Service temporarily unavailable"
    assert any("Operational failure listing posts" in r.getMessage() for r in caplog.records)


def test_list_buddies_returns_empty_array_for_true_empty_dataset(monkeypatch):
    monkeypatch.setattr(buddies_api, "get_supabase", lambda: _FakeSupabase(fail_buddies=False))
    app.dependency_overrides[auth_api.get_current_user] = lambda: {"id": 123}
    client = TestClient(app)
    try:
        response = client.get("/buddies")
    finally:
        app.dependency_overrides.pop(auth_api.get_current_user, None)

    assert response.status_code == 200
    assert response.json() == []


def test_list_buddies_returns_503_and_logs_on_operational_failure(monkeypatch, caplog):
    monkeypatch.setattr(buddies_api, "get_supabase", lambda: _FakeSupabase(fail_buddies=True))
    app.dependency_overrides[auth_api.get_current_user] = lambda: {"id": 123}
    client = TestClient(app)
    caplog.set_level(logging.ERROR, logger=buddies_api.__name__)
    try:
        response = client.get("/buddies")
    finally:
        app.dependency_overrides.pop(auth_api.get_current_user, None)

    assert response.status_code == 503
    assert response.json()["detail"] == "Service temporarily unavailable"
    assert any("Operational failure listing buddies" in r.getMessage() for r in caplog.records)
