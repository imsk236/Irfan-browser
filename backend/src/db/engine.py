import os
from sqlalchemy import create_engine, event, text
from sqlalchemy.orm import sessionmaker, Session
from .models import Base

_engine = None
_SessionLocal = None


def get_engine():
    global _engine
    if _engine is None:
        db_path = os.environ.get("DB_PATH", "archive.db")
        url = f"sqlite:///{db_path}"
        _engine = create_engine(
            url,
            connect_args={"check_same_thread": False},
            echo=False,
        )

        @event.listens_for(_engine, "connect")
        def _set_sqlite_pragmas(dbapi_conn, _connection_record):
            # Foreign-key enforcement is per-connection in SQLite.
            # This listener fires for every connection the pool creates,
            # which is the only reliable way to ensure FK constraints apply.
            cursor = dbapi_conn.cursor()
            cursor.execute("PRAGMA foreign_keys=ON")
            cursor.close()

    return _engine


def init_db():
    """Apply all Alembic migrations, set WAL mode, and run seed data."""
    import os
    from alembic.config import Config as AlembicConfig
    from alembic import command as alembic_command

    ini_path = os.path.normpath(
        os.path.join(os.path.dirname(__file__), "..", "..", "alembic.ini")
    )
    alembic_cfg = AlembicConfig(ini_path)
    alembic_command.upgrade(alembic_cfg, "head")

    engine = get_engine()
    with engine.connect() as conn:
        conn.execute(text("PRAGMA journal_mode=WAL"))
        conn.commit()

    from .seed import seed_vocab
    seed_vocab(engine)


def get_session() -> Session:
    global _SessionLocal
    if _SessionLocal is None:
        _SessionLocal = sessionmaker(bind=get_engine(), autocommit=False, autoflush=False)
    return _SessionLocal()
