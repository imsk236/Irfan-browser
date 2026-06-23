"""Dashboard API — stats, activity heatmap, recent edits, actionable counts.

All timestamps in the database are UTC ISO-8601. Muscat local time is UTC+4;
the SQL expression `date(occurred_at, '+4 hours')` converts on the fly.
"""
from fastapi import APIRouter
from pydantic import BaseModel
from sqlalchemy import text, select, func

from ..db.engine import get_session
from ..db.models import Volume, Work, Person, Annotation, Repository, PersonRelationship

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


# ── Output schemas ────────────────────────────────────────────────────────────

class StatsOut(BaseModel):
    volumes: int
    works: int
    persons: int
    annotations: int
    repositories: int


class ActivityDayOut(BaseModel):
    date: str   # YYYY-MM-DD (Muscat local)
    count: int  # distinct commit_ids — one deliberate save = 1


class ActivityCalendarOut(BaseModel):
    days: list[ActivityDayOut]


class ActivityEntryOut(BaseModel):
    id: int
    table_name: str
    record_id: int
    action: str
    label: str | None


class CommitOut(BaseModel):
    commit_id: str
    occurred_at: str
    entries: list[ActivityEntryOut]


class DayDetailOut(BaseModel):
    date: str
    commits: list[CommitOut]


class RecentEditOut(BaseModel):
    table_name: str
    record_id: int
    action: str
    label: str | None
    occurred_at: str


class ActionableCountsOut(BaseModel):
    incomplete_volumes: int   # folio_count IS NULL
    incomplete_works: int     # no copy_year AND no copy_date_as_written
    weak_evidence: int        # relationships with no evidence_source and no annotation link
    orphan_persons: int       # persons with zero relationships


class RepositoryCountOut(BaseModel):
    id: int
    name: str
    place_key: str
    volume_count: int


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/stats", response_model=StatsOut)
def get_stats():
    with get_session() as session:
        return StatsOut(
            volumes=session.execute(select(func.count()).select_from(Volume)).scalar_one(),
            works=session.execute(select(func.count()).select_from(Work)).scalar_one(),
            persons=session.execute(select(func.count()).select_from(Person)).scalar_one(),
            annotations=session.execute(select(func.count()).select_from(Annotation)).scalar_one(),
            repositories=session.execute(select(func.count()).select_from(Repository)).scalar_one(),
        )


@router.get("/activity", response_model=ActivityCalendarOut)
def get_activity_calendar():
    """12-month heatmap data. count = distinct commit_ids per Muscat local date."""
    with get_session() as session:
        rows = session.execute(text("""
            SELECT
                date(occurred_at, '+4 hours') AS muscat_date,
                COUNT(DISTINCT commit_id)      AS commit_count
            FROM activity_log
            WHERE occurred_at >= datetime('now', '-365 days')
            GROUP BY muscat_date
            ORDER BY muscat_date
        """)).fetchall()

        return ActivityCalendarOut(
            days=[ActivityDayOut(date=row[0], count=row[1]) for row in rows]
        )


@router.get("/activity/{date}", response_model=DayDetailOut)
def get_day_detail(date: str):
    """All commits and their entries for a Muscat-local date (YYYY-MM-DD)."""
    with get_session() as session:
        rows = session.execute(text("""
            SELECT id, commit_id, occurred_at, table_name, record_id, action, label
            FROM activity_log
            WHERE date(occurred_at, '+4 hours') = :date
            ORDER BY commit_id, id
        """), {"date": date}).fetchall()

        commits_map: dict[str, CommitOut] = {}
        for row in rows:
            cid = row[1]
            if cid not in commits_map:
                commits_map[cid] = CommitOut(commit_id=cid, occurred_at=row[2], entries=[])
            commits_map[cid].entries.append(ActivityEntryOut(
                id=row[0], table_name=row[3], record_id=row[4],
                action=row[5], label=row[6],
            ))

        commits = sorted(commits_map.values(), key=lambda c: c.occurred_at)
        return DayDetailOut(date=date, commits=commits)


@router.get("/recent", response_model=list[RecentEditOut])
def get_recent_edits(limit: int = 15):
    """Most recently touched records, one entry per unique (table_name, record_id)."""
    with get_session() as session:
        rows = session.execute(text("""
            SELECT table_name, record_id, action, label, MAX(occurred_at) AS occurred_at
            FROM activity_log
            GROUP BY table_name, record_id
            ORDER BY occurred_at DESC
            LIMIT :limit
        """), {"limit": limit}).fetchall()

        return [
            RecentEditOut(
                table_name=row[0], record_id=row[1],
                action=row[2], label=row[3], occurred_at=row[4],
            )
            for row in rows
        ]


@router.get("/actionable", response_model=ActionableCountsOut)
def get_actionable_counts():
    with get_session() as session:
        incomplete_volumes = session.execute(
            select(func.count()).select_from(Volume).where(Volume.folio_count.is_(None))
        ).scalar_one()

        incomplete_works = session.execute(text(
            "SELECT COUNT(*) FROM works "
            "WHERE copy_year IS NULL AND copy_date_as_written IS NULL"
        )).scalar_one()

        weak_evidence = session.execute(text(
            "SELECT COUNT(*) FROM person_relationships "
            "WHERE evidence_source IS NULL AND evidence_annotation_id IS NULL"
        )).scalar_one()

        orphan_persons = session.execute(text(
            "SELECT COUNT(*) FROM persons p "
            "WHERE NOT EXISTS ("
            "  SELECT 1 FROM person_relationships pr WHERE pr.person_id = p.id"
            ")"
        )).scalar_one()

        return ActionableCountsOut(
            incomplete_volumes=incomplete_volumes,
            incomplete_works=incomplete_works,
            weak_evidence=weak_evidence,
            orphan_persons=orphan_persons,
        )


@router.get("/repositories", response_model=list[RepositoryCountOut])
def get_repository_counts():
    with get_session() as session:
        rows = session.execute(text("""
            SELECT r.id, r.name, r.place_key, COUNT(v.id) AS volume_count
            FROM repositories r
            LEFT JOIN volumes v ON v.repository_id = r.id
            GROUP BY r.id, r.name, r.place_key
            ORDER BY volume_count DESC
        """)).fetchall()

        return [
            RepositoryCountOut(id=row[0], name=row[1], place_key=row[2], volume_count=row[3])
            for row in rows
        ]
