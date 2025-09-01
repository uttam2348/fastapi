import motor.motor_asyncio
from dotenv import load_dotenv
import os


load_dotenv()

MONGO_URI = os.getenv("MONGO_URI")
MONGO_DB_NAME = os.getenv("MONGO_DB_NAME")


client = motor.motor_asyncio.AsyncIOMotorClient(MONGO_URI)
db = client[MONGO_DB_NAME]


users_collection = db["users"]
items_collection = db["items"]
notifications_collection = db["notifications"]
purchases_collection = db["purchases"] 
updated_items_collection = db["updated_items"]
deleted_items_collection = db["deleted_items"]
carts_collection = db["carts"]
payments_collection = db["payments"]

async def check_mongo_connection():
    try:
        await client.admin.command("ping")
        print("✅ Connected to MongoDB")
    except Exception as e:
        print("❌ MongoDB connection failed:", e)




