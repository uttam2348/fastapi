#!/usr/bin/env python3
"""
Complete startup script for the Inventory Management System
This script will start both the backend and frontend servers
"""
import subprocess
import sys
import os
import time
import webbrowser
from pathlib import Path

def check_requirements():
    """Check if all required dependencies are installed"""
    print("Checking requirements...")
    
    # Check if Python virtual environment exists
    if not os.path.exists("venv"):
        print("Virtual environment not found!")
        print("Please run: python -m venv venv")
        return False
    
    # Check if Node.js dependencies are installed
    frontend_path = Path("fastapi-frontend")
    if not frontend_path.exists():
        print("Frontend directory not found!")
        return False
    
    node_modules = frontend_path / "node_modules"
    if not node_modules.exists():
        print("Node.js dependencies not installed!")
        print("Please run: cd fastapi-frontend && npm install")
        return False
    
    print("All requirements met!")
    return True

def start_backend():
    """Start the FastAPI backend server"""
    print("\nStarting Backend Server...")
    print("=" * 50)
    
    # Activate virtual environment and start backend
    if os.name == 'nt':  # Windows
        activate_script = "venv\\Scripts\\activate.bat"
        backend_cmd = f"{activate_script} && python start_backend.py"
    else:  # Unix/Linux/Mac
        activate_script = "venv/bin/activate"
        backend_cmd = f"source {activate_script} && python start_backend.py"
    
    try:
        # Start backend in a separate process
        backend_process = subprocess.Popen(
            backend_cmd,
            shell=True,
            creationflags=subprocess.CREATE_NEW_CONSOLE if os.name == 'nt' else 0
        )
        
        print("Backend server started!")
        print("Backend running on: http://127.0.0.1:8001")
        print("API docs available at: http://127.0.0.1:8001/docs")
        
        return backend_process
    except Exception as e:
        print(f"Failed to start backend: {e}")
        return None

def start_frontend():
    """Start the React frontend server"""
    print("\nStarting Frontend Server...")
    print("=" * 50)
    
    try:
        # Change to frontend directory and start React app
        frontend_process = subprocess.Popen(
            ["npm", "start"],
            cwd="fastapi-frontend",
            shell=True,
            creationflags=subprocess.CREATE_NEW_CONSOLE if os.name == 'nt' else 0
        )
        
        print("Frontend server started!")
        print("Frontend running on: http://localhost:3000")
        
        return frontend_process
    except Exception as e:
        print(f"Failed to start frontend: {e}")
        return None

def main():
    """Main startup function"""
    print("Inventory Management System Startup")
    print("=" * 50)
    
    # Check requirements
    if not check_requirements():
        print("\nRequirements not met. Please fix the issues above.")
        return
    
    # Start backend
    backend_process = start_backend()
    if not backend_process:
        return
    
    # Wait a moment for backend to start
    print("\nWaiting for backend to initialize...")
    time.sleep(3)
    
    # Start frontend
    frontend_process = start_frontend()
    if not frontend_process:
        backend_process.terminate()
        return
    
    print("\nBoth servers started successfully!")
    print("=" * 50)
    print("Backend: http://127.0.0.1:8001")
    print("Frontend: http://localhost:3000")
    print("API Docs: http://127.0.0.1:8001/docs")
    print("\nYou can now open http://localhost:3000 in your browser")
    print("Press Ctrl+C to stop both servers")
    
    try:
        # Wait for user to stop the servers
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\n\nStopping servers...")
        backend_process.terminate()
        frontend_process.terminate()
        print("Servers stopped!")

if __name__ == "__main__":
    main()

