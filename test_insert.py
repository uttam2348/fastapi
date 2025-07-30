import asyncio
from db.db import users_collection

async def test_insert():
    await users_collection.insert_one({
        "username": "testuser",
        "email": "test@example.com"
    })

if __name__ == "__main__":
    asyncio.run(test_insert())
