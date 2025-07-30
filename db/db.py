from motor.motor_asyncio import AsyncIOMotorClient
import os

MONGO_URI = os.getenv("MONGO_URI")

if not MONGO_URI:
    raise RuntimeError("❌ MONGO_URI not set in environment")

print("✅ [DEBUG] Using Mongo URI:", MONGO_URI)

client = AsyncIOMotorClient(MONGO_URI)
db = client["store"]

users_collection = db["users"]
items_collection = db["items"]

async def check_mongo_connection():
    await db.command("ping")
