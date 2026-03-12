# db/create_database.py

import asyncpg
from app.core.config import settings


async def create_database_if_not_exists():
    conn = await asyncpg.connect(
        user=settings.DB_USER,
        password=settings.DB_PASSWORD,
        host=settings.DB_HOST,
        port=settings.DB_PORT,
        database="postgres",  # connect to default
    )

    exists = await conn.fetchval(
        "SELECT 1 FROM pg_database WHERE datname = $1",
        settings.DB_NAME,
    )

    if not exists:
        await conn.execute(f'CREATE DATABASE "{settings.DB_NAME}"')
        print(f"Database {settings.DB_NAME} created ✅")
    else:
        print(f"Database {settings.DB_NAME} already exists 👍")

    await conn.close()
