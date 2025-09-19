import requests
import json

def create_user():
    url = "http://127.0.0.1:8000/auth/users"
    data = {
        "username": "testuser",
        "password": "password123",
        "role": "user"
    }
    
    headers = {"Content-Type": "application/json"}
    
    try:
        response = requests.post(url, data=json.dumps(data), headers=headers)
        print(f"Status code: {response.status_code}")
        print(f"Response: {response.json()}")
    except Exception as e:
        print(f"Error: {e}")

def test_login():
    url = "http://127.0.0.1:8000/auth/token"
    data = {
        "username": "testuser",
        "password": "password123"
    }
    
    # For OAuth2 token endpoint, we need to send as form data
    try:
        response = requests.post(url, data=data)
        print(f"Status code: {response.status_code}")
        print(f"Response: {response.json()}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    print("Creating test user...")
    create_user()
    
    print("\nTesting login...")
    test_login()