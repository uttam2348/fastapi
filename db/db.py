import motor.motor_asyncio
from dotenv import load_dotenv
import os


load_dotenv()

MONGO_URI = os.getenv("MONGO_URI")
MONGO_DB_NAME = os.getenv("MONGO_DB_NAME")

# Optimized connection pool settings
client = motor.motor_asyncio.AsyncIOMotorClient(
    MONGO_URI,
    maxPoolSize=10,  # Maximum number of connections in the connection pool
    minPoolSize=5,   # Minimum number of connections in the connection pool
    maxIdleTimeMS=30000,  # Close connections after 30 seconds of inactivity
    serverSelectionTimeoutMS=5000,  # Keep trying to send operations for 5 seconds
    connectTimeoutMS=10000,  # Give up initial connection after 10 seconds
    socketTimeoutMS=45000,  # Close sockets after 45 seconds of inactivity
    waitQueueTimeoutMS=5000,  # Wait 5 seconds for a connection from the pool
)
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
        print(" Connected to MongoDB")
        # Create indexes for better query performance
        await create_indexes()
    except Exception as e:
        print(f" MongoDB connection failed: {e}")

async def create_indexes():
    """Create database indexes for optimized queries"""
    try:
        # Items collection indexes
        await items_collection.create_index([("brand", 1)], unique=True)
        await items_collection.create_index([("name", 1)])
        await items_collection.create_index([("in_stock", 1)])
        await items_collection.create_index([("created_by", 1)])
        await items_collection.create_index([("brand", 1), ("name", 1)])

        # Users collection indexes
        await users_collection.create_index([("username", 1)], unique=True)
        await users_collection.create_index([("email", 1)])

        # Search optimization indexes
        await items_collection.create_index([("$**", "text")])

        print("Database indexes created successfully")
    except Exception as e:
        print(f"Index creation error: {e}")
