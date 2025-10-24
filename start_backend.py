#!/usr/bin/env python3
"""
Startup script for the Inventory Management System backend
"""
import os
import asyncio
import uvicorn
from db.db import check_mongo_connection

async def check_prerequisites():
    """Check if all prerequisites are met before starting the server"""
    print("Checking prerequisites...")
    
    # Check .env file
    if not os.path.exists('.env'):
        print(".env file not found!")
        return False
    else:
        print(".env file exists")
    
    # Check MongoDB connection
    try:
        from db.db import client
        await client.admin.command("ping")
        print("MongoDB connection successful")
    except Exception as e:
        print(f"MongoDB connection failed: {e}")
        return False
    
    return True

def main():
    """Main startup function"""
    print("Starting Inventory Management System Backend")
    print("=" * 50)
    
    # Check prerequisites
    try:
        prerequisites_ok = asyncio.run(check_prerequisites())
        if not prerequisites_ok:
            print("\nPrerequisites not met. Please fix the issues above.")
            return
    except Exception as e:
        print(f"Error checking prerequisites: {e}")
        return
    
    print("\nAll prerequisites met!")
    print("Starting FastAPI server on http://127.0.0.1:8001")
    print("API Documentation available at http://127.0.0.1:8001/docs")
    print("\n" + "=" * 50)
    
    # Start the server
    uvicorn.run("main:app", host="127.0.0.1", port=8001, reload=True)

if __name__ == "__main__":
    main()