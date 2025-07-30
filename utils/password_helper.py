from passlib.context import CryptContext

pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(password: str):
    return pwd_ctx.hash(password)

def verify_password(plain: str, hashed: str):
    return pwd_ctx.verify(plain, hashed)