from fastapi import FastAPI, HTTPException, Depends
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from pydantic import BaseModel
from typing import List
from datetime import datetime
from db.db import check_mongo_connection, users_collection, items_collection,notifications_collection 
from utils.token_helper import create_token, decode_token
from utils.password_helper import hash_password, verify_password
from utils.search_helper import mongo_text_search

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/token")

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"

class UserCreate(BaseModel):
    username: str
    password: str
    role: str = "user"


class Item(BaseModel):
    brand: str
    name: str
    price: float
    quantity: int
    description: str
    status : str ="In stock"

app = FastAPI()

@app.on_event("startup")
async def startup():
    await check_mongo_connection()

async def get_current_user(token: str = Depends(oauth2_scheme)):
    payload = decode_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    user = await users_collection.find_one({"username": payload.get("sub")})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

async def require_admin_or_superadmin(user=Depends(get_current_user)):
    if user["role"] not in ["admin", "superadmin"]:
        raise HTTPException(status_code=403, detail="Admins only")
    return user
@app.get("/")
async def root():
    return {"message": "FastAPI connected to MongoDB Atlas"}

@app.post("/auth/users")
async def create_user(user: UserCreate):
    # Check if username already exists
    if await users_collection.find_one({"username": user.username}):
        raise HTTPException(400, detail="Username already exists")

    # ✅ Removed all role count restrictions
    await users_collection.insert_one({
        "username": user.username,
        "hashed_password": hash_password(user.password),
        "role": user.role  # can be "user", "admin", or "superadmin"
    })
    return {"msg": f"{user.role.capitalize()} created successfully"}



@app.post("/auth/token", response_model=Token)
async def login(form: OAuth2PasswordRequestForm = Depends()):
    user = await users_collection.find_one({"username": form.username})
    if not user or not verify_password(form.password, user["hashed_password"]):
        raise HTTPException(400, detail="Incorrect username or password")
    token = create_token({"sub": user["username"], "role": user["role"]})
    return {"access_token": token, "token_type": "bearer"}


@app.post("/items", response_model=Item)
async def create_item(item: Item, user=Depends(get_current_user)):
    if user["role"] == "user":
        raise HTTPException(403, detail="Users cannot create items")

    # ✅ Check role-based item creation limits
    count = await items_collection.count_documents({"created_by": user["username"]})
    if user["role"] == "admin" and count >= 10:
        raise HTTPException(403, detail="Reached your limit")
    elif user["role"] == "superadmin" and count >= 100:
        raise HTTPException(403, detail="Reached your limit")

    # ✅ Determine stock status based on quantity
    status = "In Stock"
    if item.quantity == 0:
        status = "Out of Stock"
    elif item.quantity < 3:
        status = "Low Stock"

    # ✅ Prepare item data
    item_data = item.dict()
    item_data["created_by"] = user["username"]
    item_data["status"] = status

    # ✅ Insert into MongoDB
    await items_collection.insert_one(item_data)

    # ✅ Return with status included
    return {**item.dict(), "status": status}


@app.post("/items/buy/{brand}")
async def buy_item(brand: str):
    item = await items_collection.find_one({"brand": brand})
    if not item:
        raise HTTPException(404, detail="Item not found")
    if item["quantity"] <= 0:
        raise HTTPException(400, detail="Out of stock")

    # Decrease stock
    new_quantity = item["quantity"] - 1

    # Update status
    new_status = "In Stock"
    if new_quantity == 0:
        new_status = "Out of Stock"
    elif new_quantity < 3:
        new_status = "Low Stock"

    await items_collection.update_one(
        {"brand": brand},
        {"$set": {"quantity": new_quantity, "status": new_status}}
    )

    # If below 3 → create notification
    if new_quantity < 3:
        await notifications_collection.insert_one({
            "brand": item["brand"],
            "name": item["name"],
            "quantity": new_quantity,
            "status": "Low Stock",
            "notified_at": datetime.utcnow()
        })

    return {"msg": f"Purchased {item['name']}, remaining stock: {new_quantity}"}

@app.get("/notifications")
async def get_notifications(user=Depends(require_admin_or_superadmin)):
    notifications = await notifications_collection.find({}, {"_id": 0}).to_list(length=50)
    return {"notifications": notifications}

@app.get("/items", response_model=List[Item])
async def list_items():
    return await items_collection.find({}, {"_id": 0}).to_list(length=100)

@app.get("/items/{brand}", response_model=Item)
async def get_item(brand: str):
    item = await items_collection.find_one({"brand": brand}, {"_id": 0})
    if not item:
        raise HTTPException(404, detail="Item not found")
    return item

@app.put("/items/{brand}")
async def update_item(brand: str, item: Item, user=Depends(require_admin_or_superadmin)):
    result = await items_collection.update_one({"brand": brand}, {"$set": item.dict()})
    if result.matched_count == 0:
        raise HTTPException(404, detail="Item not found")
    return {"msg": "Item updated"}

@app.delete("/items/{brand}")
async def delete_item(brand: str, user=Depends(require_admin_or_superadmin)):
    await items_collection.delete_one({"brand": brand})
    return {"msg": "Item deleted"}

@app.get("/items/search/")
async def search_items(q: str):
    return await mongo_text_search(q)
