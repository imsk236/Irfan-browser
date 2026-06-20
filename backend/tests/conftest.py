"""Shared pytest fixtures.

All tests use an in-memory SQLite database so they are isolated from the
development database and from each other.

StaticPool is used so that every call to engine.connect() (including the
raw connection inside create_volume's BEGIN IMMEDIATE block) gets the SAME
physical connection as the test session.  Without StaticPool, each connect()
creates a separate in-memory database instance.

The engine fixture also overrides the module-level _engine singleton in
src.db.engine so that service functions that call get_engine() (e.g.
create_volume) use the test engine rather than the production one.
"""
import pytest
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import src.db.engine as _engine_module
from src.db.models import Base
from src.db.seed import seed_vocab


@pytest.fixture(scope="function")
def engine():
    """In-memory SQLite engine with FK enforcement and full schema."""
    eng = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    @event.listens_for(eng, "connect")
    def _set_pragmas(dbapi_conn, _):
        cursor = dbapi_conn.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    Base.metadata.create_all(eng)
    seed_vocab(eng)

    # Redirect get_engine() to the test engine so service code (create_volume,
    # etc.) that calls get_engine() internally sees the in-memory schema.
    _prev_engine = _engine_module._engine
    _prev_session = _engine_module._SessionLocal
    _engine_module._engine = eng
    _engine_module._SessionLocal = None

    yield eng

    _engine_module._engine = _prev_engine
    _engine_module._SessionLocal = _prev_session
    eng.dispose()


@pytest.fixture(scope="function")
def session(engine):
    """Session that rolls back after each test to leave no state."""
    Session = sessionmaker(bind=engine)
    sess = Session()
    yield sess
    sess.rollback()
    sess.close()


@pytest.fixture(scope="function")
def client(engine):
    """FastAPI TestClient wired to the test engine.

    Does NOT use a context manager so lifespan is not invoked — tables and
    seed data are already set up by the engine fixture.
    """
    from fastapi.testclient import TestClient
    from src.main import app
    return TestClient(app)


@pytest.fixture(scope="function")
def raw_engine():
    """Bare in-memory engine without the FK pragma listener.

    Used to verify that the listener is the mechanism providing FK enforcement
    (i.e. without it, violations are accepted).
    """
    eng = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(eng)
    yield eng
    eng.dispose()
