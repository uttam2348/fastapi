from motor.motor_asyncio import AsyncIOMotorClient
import os

MONGO_URI = os.getenv("MONGO_URI", "mongodb://mongo:27017")
client = AsyncIOMotorClient(MONGO_URI)
db = client["fastapi_db"]
users_collection = db["users"]
items_collection = db["items"]

async def check_mongo_connection():
    try:
        await client.admin.command("ping")
        print("✅ MongoDB connected")
    except Exception as e:
        print("❌ MongoDB connection failed:", e)


