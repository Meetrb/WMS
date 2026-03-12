import asyncio
from app.db.session import AsyncSessionLocal
from sqlalchemy import text

async def check():
    async with AsyncSessionLocal() as db:
        # Find putaway workers
        r = await db.execute(text("SELECT id, username, full_name, role FROM users WHERE role = 'putaway worker'"))
        workers = r.fetchall()
        print(f"Putaway workers ({len(workers)}):")
        for w in workers:
            print(f"  ID: {w[0]} | Username: {w[1]} | Name: {w[2]} | Role: {w[3]}")
        
        # Check ALL putaway tasks
        r2 = await db.execute(text(
            "SELECT pt.task_number, pt.grn_id, g.grn_number, pt.assigned_to_id, u.full_name, pt.status, pt.suggested_bin_id "
            "FROM putaway_tasks pt "
            "LEFT JOIN grns g ON pt.grn_id = g.id "
            "LEFT JOIN users u ON pt.assigned_to_id = u.id "
            "ORDER BY pt.status, pt.task_number"
        ))
        tasks = r2.fetchall()
        print(f"\nAll putaway tasks ({len(tasks)}):")
        for t in tasks:
            print(f"  Task: {t[0]} | GRN#: {t[2]} | Worker: {t[4]} | Status: {t[5]} | Bin: {t[6]}")

asyncio.run(check())
