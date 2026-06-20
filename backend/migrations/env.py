import os
import sys
from logging.config import fileConfig

from sqlalchemy import engine_from_config, pool, text, create_engine
from alembic import context

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from src.db.models import Base  # noqa: E402

config = context.config

if config.config_file_name:
    fileConfig(config.config_file_name)

# Allow DB_PATH to override alembic.ini; use forward slashes for Windows paths.
db_path = os.environ.get("DB_PATH")
if db_path:
    db_url = "sqlite:///" + db_path.replace("\\", "/")
    config.set_main_option("sqlalchemy.url", db_url)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    url = config.get_main_option("sqlalchemy.url")
    # Build engine directly so we control the URL precisely.
    connectable = create_engine(url, poolclass=pool.NullPool)

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            # For SQLite we must render the FK pragma before migrations but
            # we do that inside a transaction so it doesn't cause an implicit
            # BEGIN outside of Alembic's managed transaction.
        )
        with context.begin_transaction():
            connection.execute(text("PRAGMA foreign_keys=ON"))
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
