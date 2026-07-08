import os
from sqlalchemy import create_engine, event, text
from sqlalchemy.orm import sessionmaker, Session

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
    import sys

    from alembic.config import Config as AlembicConfig
    from alembic import command as alembic_command

    if getattr(sys, "frozen", False):
        # PyInstaller bundle: alembic.ini and migrations/ are bundled as datas
        # at the same relative layout, extracted under sys._MEIPASS.
        base_dir = sys._MEIPASS
    else:
        base_dir = os.path.normpath(os.path.join(os.path.dirname(__file__), "..", ".."))

    ini_path = os.path.join(base_dir, "alembic.ini")
    alembic_cfg = AlembicConfig(ini_path)
    # script_location in alembic.ini is the bare relative string "migrations",
    # which Alembic resolves against the process's cwd, not the ini file's own
    # directory. That happens to coincide in dev/tests but not in the packaged
    # app (Electron spawns backend.exe without setting a cwd), so force it
    # absolute here rather than relying on cwd matching base_dir.
    alembic_cfg.set_main_option("script_location", os.path.join(base_dir, "migrations"))
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
