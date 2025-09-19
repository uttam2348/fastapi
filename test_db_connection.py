import asyncio
import motor.motor_asyncio
import os
from dotenv import load_dotenv

load_dotenv()

MONGO_URI = os.getenv("MONGO_URI")
MONGO_DB_NAME = os.getenv("MONGO_DB_NAME")

print(f"Attempting to connect to MongoDB at: {MONGO_URI}")
print(f"Using database: {MONGO_DB_NAME}")

async def test_connection():
    try:
        client = motor.motor_asyncio.AsyncIOMotorClient(MONGO_URI)
        db = client[MONGO_DB_NAME]
        
        # Test the connection
        await client.admin.command("ping")
        print("✅ MongoDB connection successful!")
        
        # Check if users collection exists and has data
        users_count = await db.users.count_documents({})
        print(f"Found {users_count} users in the database")
        
        return True
    except Exception as e:
        print(f"❌ MongoDB connection failed: {e}")
        return False

asyncio.run(test_connection())