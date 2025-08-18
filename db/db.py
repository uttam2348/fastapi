from motor.motor_asyncio import AsyncIOMotorClient
import os

MONGO_URI = os.getenv("MONGO_URI")  
MONGO_DB_NAME = os.getenv("MONGO_DB_NAME", "fastapi_db")

client = AsyncIOMotorClient(MONGO_URI)
db = client[MONGO_DB_NAME]
users_collection = db["users"]
items_collection = db["items"]

async def check_mongo_connection():
    try:
        await client.admin.command("ping")
        print("✅ MongoDB connected to", MONGO_URI)
    except Exception as e:
        print("❌ MongoDB connection failed:", e)



