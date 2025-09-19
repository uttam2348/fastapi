import motor.motor_asyncio
from dotenv import load_dotenv
import os
import asyncio

async def main():
    load_dotenv()
    
    MONGO_URI = os.getenv("MONGO_URI")
    MONGO_DB_NAME = os.getenv("MONGO_DB_NAME")
    
    print(f"Connecting to MongoDB at: {MONGO_URI}")
    print(f"Database name: {MONGO_DB_NAME}")
    
    client = motor.motor_asyncio.AsyncIOMotorClient(MONGO_URI)
    db = client[MONGO_DB_NAME]
    
    # Check connection
    try:
        await client.admin.command("ping")
        print("Connected to MongoDB")
    except Exception as e:
        print(f"MongoDB connection failed: {e}")
        return
    
    # List all use
    users_collection = db["users"]
    users_count = await users_collection.count_documents({})
    print(f"Found {users_count} users in the database")
    
    if users_count > 0:
        print("\nListing all users:")
        async for user in users_collection.find({}, {"_id": 0, "hashed_password": 0}):
            print(user)
    else:
        print("\nNo users found. Creating a test user...")
        from utils.password_helper import hash_password
        
        # Create a test user
        test_user = {
            "username": "testuser",
            "hashed_password": hash_password("password123"),
            "role": "user"
        }
        
        result = await users_collection.insert_one(test_user)
        print(f"Created test user with ID: {result.inserted_id}")

if __name__ == "__main__":
    asyncio.run(main())