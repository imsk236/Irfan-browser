"""Tests for the dashboard API endpoints and activity logging.

Covers:
- GET /dashboard/stats
- GET /dashboard/activity
- GET /dashboard/activity/{date}
- GET /dashboard/recent
- GET /dashboard/actionable
- GET /dashboard/repositories
- Activity log written on create/update/delete through services
"""
import pytest
from src.services import volumes as vol_svc
from src.services import works as work_svc
from src.services import annotations as ann_svc
from src.services import persons as person_svc
from src.services.activity import set_commit_id


# ── fixtures ──────────────────────────────────────────────────────────────────

@pytest.fixture
def repo(session):
    return vol_svc.create_repository(session, place_key="7001", name="خزانة الاختبار")


@pytest.fixture
def volume(session, repo):
    return vol_svc.create_volume(session, repo.id, folio_count=100)


@pytest.fixture
def work(session, volume):
    return work_svc.create_work(session, volume.id, title="رسالة في الفقه")


@pytest.fixture
def person(session):
    return person_svc.create_person(session, preferred_name="عبد الله الغافري")


# ── stats ──────────────────────────────────────────────────────────────────────

def test_stats_empty(client):
    r = client.get("/dashboard/stats")
    assert r.status_code == 200
    data = r.json()
    assert data["volumes"] == 0
    assert data["works"] == 0
    assert data["persons"] == 0
    assert data["annotations"] == 0
    assert data["repositories"] == 0


def test_stats_counts(client, volume, work, person):
    r = client.get("/dashboard/stats")
    assert r.status_code == 200
    data = r.json()
    assert data["volumes"] == 1
    assert data["works"] == 1
    assert data["persons"] == 1
    assert data["repositories"] == 1


def test_stats_multiple_volumes(client, session, repo):
    vol_svc.create_volume(session, repo.id)
    vol_svc.create_volume(session, repo.id)
    r = client.get("/dashboard/stats")
    assert r.json()["volumes"] == 2


# ── activity log — service instrumentation ────────────────────────────────────

def test_activity_log_on_create_volume(session, repo):
    set_commit_id("test-commit-vol-create")
    v = vol_svc.create_volume(session, repo.id)
    set_commit_id(None)

    from sqlalchemy import text
    rows = session.execute(
        text("SELECT commit_id, table_name, record_id, action, label FROM activity_log")
    ).fetchall()

    assert any(
        r[0] == "test-commit-vol-create"
        and r[1] == "volumes"
        and r[2] == v.id
        and r[3] == "create"
        and r[4] == v.serial
        for r in rows
    )


def test_activity_log_on_update_work(session, work):
    set_commit_id("test-commit-work-update")
    work_svc.update_work(session, work.id, title="رسالة في أصول الفقه")
    set_commit_id(None)

    from sqlalchemy import text
    rows = session.execute(
        text("SELECT commit_id, table_name, record_id, action FROM activity_log")
    ).fetchall()

    assert any(
        r[0] == "test-commit-work-update"
        and r[1] == "works"
        and r[2] == work.id
        and r[3] == "update"
        for r in rows
    )


def test_activity_log_no_entry_without_commit_id(session, repo):
    """log_activity is a no-op when no commit_id is set (e.g. read-only tests)."""
    set_commit_id(None)
    vol_svc.create_volume(session, repo.id)

    from sqlalchemy import text
    count = session.execute(text("SELECT COUNT(*) FROM activity_log")).scalar_one()
    assert count == 0


def test_activity_log_delete(session, volume, work):
    set_commit_id("test-commit-delete")
    work_svc.delete_work(session, work.id)
    set_commit_id(None)

    from sqlalchemy import text
    rows = session.execute(
        text("SELECT action, table_name FROM activity_log WHERE commit_id = 'test-commit-delete'")
    ).fetchall()
    assert any(r[0] == "delete" and r[1] == "works" for r in rows)


def test_activity_log_person_create(session):
    set_commit_id("test-commit-person")
    p = person_svc.create_person(session, preferred_name="أحمد العماني")
    set_commit_id(None)

    from sqlalchemy import text
    rows = session.execute(
        text("SELECT table_name, record_id, action, label FROM activity_log WHERE commit_id = 'test-commit-person'")
    ).fetchall()
    assert any(
        r[0] == "persons" and r[1] == p.id and r[2] == "create" and r[3] == "أحمد العماني"
        for r in rows
    )


# ── activity calendar endpoint ─────────────────────────────────────────────────

def test_activity_calendar_empty(client):
    r = client.get("/dashboard/activity")
    assert r.status_code == 200
    data = r.json()
    assert "days" in data
    assert isinstance(data["days"], list)


def test_activity_calendar_records_after_save(client, session, repo):
    set_commit_id("cal-commit-1")
    vol_svc.create_volume(session, repo.id)
    set_commit_id(None)

    r = client.get("/dashboard/activity")
    assert r.status_code == 200
    days = r.json()["days"]
    assert len(days) >= 1
    assert all("date" in d and "count" in d for d in days)


def test_activity_calendar_count_is_commits_not_rows(client, session, repo):
    """Two volumes in one commit_id = count of 1, not 2."""
    set_commit_id("same-commit")
    vol_svc.create_volume(session, repo.id)
    vol_svc.create_volume(session, repo.id)
    set_commit_id(None)

    r = client.get("/dashboard/activity")
    days = r.json()["days"]
    assert any(d["count"] == 1 for d in days)


# ── day detail endpoint ────────────────────────────────────────────────────────

def test_day_detail_empty(client):
    r = client.get("/dashboard/activity/2020-01-01")
    assert r.status_code == 200
    data = r.json()
    assert data["date"] == "2020-01-01"
    assert data["commits"] == []


def test_day_detail_groups_by_commit(client, session, repo):
    from datetime import datetime, timezone, timedelta

    # The dashboard query converts UTC timestamps to Muscat time (UTC+4).
    # Use the same offset here so the date matches regardless of the test machine's timezone.
    MUSCAT = timezone(timedelta(hours=4))
    today = datetime.now(MUSCAT).date().isoformat()

    set_commit_id("commit-A")
    v1 = vol_svc.create_volume(session, repo.id)
    set_commit_id(None)

    set_commit_id("commit-B")
    v2 = vol_svc.create_volume(session, repo.id)
    set_commit_id(None)

    r = client.get(f"/dashboard/activity/{today}")
    assert r.status_code == 200
    data = r.json()
    commit_ids = [c["commit_id"] for c in data["commits"]]
    assert "commit-A" in commit_ids
    assert "commit-B" in commit_ids
    assert len(set(commit_ids)) == 2


# ── recent edits endpoint ──────────────────────────────────────────────────────

def test_recent_edits_empty(client):
    r = client.get("/dashboard/recent")
    assert r.status_code == 200
    assert r.json() == []


def test_recent_edits_returns_latest_per_record(client, session, volume):
    set_commit_id("recent-1")
    vol_svc.update_volume(session, volume.id, folio_count=50)
    set_commit_id(None)

    set_commit_id("recent-2")
    vol_svc.update_volume(session, volume.id, folio_count=75)
    set_commit_id(None)

    r = client.get("/dashboard/recent")
    data = r.json()
    vol_entries = [e for e in data if e["table_name"] == "volumes" and e["record_id"] == volume.id]
    assert len(vol_entries) == 1


def test_recent_edits_limit(client, session, repo):
    set_commit_id("limit-commit")
    for _ in range(5):
        vol_svc.create_volume(session, repo.id)
    set_commit_id(None)

    r = client.get("/dashboard/recent?limit=3")
    assert r.status_code == 200
    assert len(r.json()) <= 3


# ── actionable counts ──────────────────────────────────────────────────────────

def test_actionable_all_zeros_when_empty(client):
    r = client.get("/dashboard/actionable")
    assert r.status_code == 200
    data = r.json()
    assert data["incomplete_volumes"] == 0
    assert data["incomplete_works"] == 0
    assert data["weak_evidence"] == 0
    assert data["orphan_persons"] == 0


def test_actionable_incomplete_volumes(client, session, repo):
    vol_svc.create_volume(session, repo.id)           # no folio_count → incomplete
    vol_svc.create_volume(session, repo.id, folio_count=100)  # complete

    r = client.get("/dashboard/actionable")
    assert r.json()["incomplete_volumes"] == 1


def test_actionable_incomplete_works(client, session, volume):
    work_svc.create_work(session, volume.id, title="مجهول التاريخ")  # no copy date
    work_svc.create_work(session, volume.id, title="معروف التاريخ", copy_year=1200)

    r = client.get("/dashboard/actionable")
    assert r.json()["incomplete_works"] == 1


def test_actionable_orphan_persons(client, person):
    r = client.get("/dashboard/actionable")
    assert r.json()["orphan_persons"] >= 1


# ── repository distribution ────────────────────────────────────────────────────

def test_repository_counts_empty(client):
    r = client.get("/dashboard/repositories")
    assert r.status_code == 200
    assert r.json() == []


def test_repository_counts_sorted_by_volume(client, session):
    repo_a = vol_svc.create_repository(session, "8001", "خزانة أ")
    repo_b = vol_svc.create_repository(session, "8002", "خزانة ب")

    vol_svc.create_volume(session, repo_b.id)
    vol_svc.create_volume(session, repo_b.id)
    vol_svc.create_volume(session, repo_a.id)

    r = client.get("/dashboard/repositories")
    assert r.status_code == 200
    data = r.json()
    assert data[0]["place_key"] == "8002"
    assert data[0]["volume_count"] == 2
    assert data[1]["place_key"] == "8001"
    assert data[1]["volume_count"] == 1


def test_repository_counts_zero_volumes(client, session):
    """Repository with no volumes still appears with count 0."""
    vol_svc.create_repository(session, "8003", "خزانة فارغة")

    r = client.get("/dashboard/repositories")
    data = r.json()
    empty_repos = [x for x in data if x["place_key"] == "8003"]
    assert len(empty_repos) == 1
    assert empty_repos[0]["volume_count"] == 0
