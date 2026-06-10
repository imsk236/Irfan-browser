from sqlalchemy.orm import Session
from sqlalchemy import select
from ..db.models import Vocab


def list_values(session: Session, category: str) -> list[str]:
    """Return active vocab values for a category, ordered by sort_order."""
    rows = session.execute(
        select(Vocab.value)
        .where(Vocab.category == category, Vocab.is_active == True)  # noqa: E712
        .order_by(Vocab.sort_order)
    ).scalars().all()
    return list(rows)


def add_value(session: Session, category: str, value: str) -> Vocab:
    """Add a new vocab value. Reactivates if it existed but was deactivated."""
    existing = session.execute(
        select(Vocab).where(Vocab.category == category, Vocab.value == value)
    ).scalar_one_or_none()

    if existing:
        existing.is_active = True
        session.commit()
        return existing

    max_order = session.execute(
        select(Vocab.sort_order)
        .where(Vocab.category == category)
        .order_by(Vocab.sort_order.desc())
    ).scalar_one_or_none() or 0

    row = Vocab(category=category, value=value, sort_order=max_order + 1, is_active=True)
    session.add(row)
    session.commit()
    session.refresh(row)
    return row


def deactivate_value(session: Session, category: str, value: str) -> None:
    """Soft-delete: mark inactive. Existing records keep their value."""
    row = session.execute(
        select(Vocab).where(Vocab.category == category, Vocab.value == value)
    ).scalar_one_or_none()
    if row:
        row.is_active = False
        session.commit()
