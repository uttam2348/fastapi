from jose import jwt, JWTError
import os
from datetime import datetime, timedelta

SECRET_KEY = os.getenv("SECRET_KEY", "secret")
ALGORITHM = "HS256"
TOKEN_EXPIRE_HOURS = int(os.getenv("TOKEN_EXPIRE_HOURS", 1))

def create_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(hours=TOKEN_EXPIRE_HOURS)
    to_encode.update({"exp": expire})
    print(f"Creating token with SECRET_KEY: {SECRET_KEY[:5]}...")
    print(f"Token payload: {to_encode}")
    token = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    print(f"Token created: {token[:20]}...")
    return token

def decode_token(token: str):
    try:
        print(f"Decoding token with SECRET_KEY: {SECRET_KEY[:5]}...")  # Print first 5 chars for security
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        print(f"Token decoded successfully: {payload}")
        return payload
    except JWTError as e:
        print(f"Token decode error: {e}")
        return None
