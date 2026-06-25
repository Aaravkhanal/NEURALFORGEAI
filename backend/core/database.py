"""
NeuralForge Backend — Database
Async SQLAlchemy engine, session management, and base model.
Supports both SQLite (dev) and PostgreSQL (prod).
"""

from sqlalchemy import event
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from core.config import get_settings

settings = get_settings()

# Create async engine — pool config differs between SQLite and PostgreSQL
connect_args = {}
if "sqlite" in settings.database_url:
    connect_args = {"check_same_thread": False}

engine = create_async_engine(
    settings.database_url,
    echo=settings.environment == "development",
    connect_args=connect_args,
)

# Enable WAL mode for SQLite so the background training thread (sync writer)
# and the SSE stream (async reader) don't block each other.
if "sqlite" in settings.database_url:
    @event.listens_for(engine.sync_engine, "connect")
    def _set_wal_mode(dbapi_conn, _):
        dbapi_conn.execute("PRAGMA journal_mode=WAL")
        dbapi_conn.execute("PRAGMA busy_timeout=5000")

# Session factory
async_session = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    """Base class for all SQLAlchemy models."""
    pass


async def get_db() -> AsyncSession:
    """FastAPI dependency that yields a database session."""
    async with async_session() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def init_db():
    """Create all tables. Called on app startup."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def close_db():
    """Dispose engine. Called on app shutdown."""
    await engine.dispose()
