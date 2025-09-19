import pymongo
from passlib.context import CryptContext
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(password: str):
    return pwd_context.hash(password)

# MongoDB connection
MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
MONGO_DB_NAME = os.getenv("MONGO_DB_NAME", "fastapi_db")

print(f"Connecting to MongoDB at: {MONGO_URI}")
print(f"Database name: {MONGO_DB_NAME}")

client = pymongo.MongoClient(MONGO_URI)
db = client[MONGO_DB_NAME]

# Create a test user
users_collection = db["users"]

# Check if user already exists
existing_user = users_collection.find_one({"username": "testuser"})

if existing_user:
    print(f"User 'testuser' already exists with ID: {existing_user.get('_id')}")
    print("You can use these credentials to log in:")
    print("Username: testuser")
    print("Password: password123")
else:
    # Create a new user
    test_user = {
        "username": "testuser",
        "hashed_password": hash_password("password123"),
        "role": "user"
    }
    
    result = users_collection.insert_one(test_user)
    print(f"Created test user with ID: {result.inserted_id}")
    print("You can use these credentials to log in:")
    print("Username: testuser")
    print("Password: password123")