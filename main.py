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
    in_stock: bool = True 
    created_by : str = None

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
    return {"message": "hi there"}

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

    # ✅ Role-based item limit
    count = await items_collection.count_documents({"created_by": user["username"]})
    if user["role"] == "admin" and count >= 10:
        raise HTTPException(403, detail="Reached your limit")
    elif user["role"] == "superadmin" and count >= 100:
        raise HTTPException(403, detail="Reached your limit")

    # ✅ Stock availability
    in_stock = item.quantity > 0

    item_data = item.dict()
    item_data["created_by"] = user["username"]
    item_data["in_stock"] = in_stock

    await items_collection.insert_one(item_data)

    return {**item.dict(), "in_stock": in_stock, "created_by": user["username"]}
 

@app.post("/items/buy/{brand}")
async def buy_item(brand: str):
    item = await items_collection.find_one({"brand": brand})
    if not item:
        raise HTTPException(404, detail="Item not found")
    if item["quantity"] <= 0:
        raise HTTPException(400, detail="Out of stock")

    new_quantity = item["quantity"] - 1
    in_stock = new_quantity > 0

    await items_collection.update_one(
        {"brand": brand},
        {"$set": {"quantity": new_quantity, "in_stock": in_stock}}
    )

    msg = (
        f"{item['name']} stock is low: {new_quantity} left"
        if new_quantity < 3 else f"{item['name']} updated stock"
    )

    await notifications_collection.update_one(
        {"brand": item["brand"]},
        {
            "$set": {
                "brand": item["brand"],
                "name": item["name"],
                "quantity": new_quantity,
                "in_stock": in_stock,
                "msg": msg,
                "notified_at": datetime.utcnow(),
                "created_by": item["created_by"]
            }
        },
        upsert=True
    )

    return {"msg": f"Purchased {item['name']} successfully"}



@app.get("/notifications")
async def get_notifications(user=Depends(get_current_user)):
    if user["role"] not in ["admin", "superadmin"]:
        raise HTTPException(403, detail="Admins or Superadmins only")
    
    limit = 50 if user["role"] == "admin" else 100
    notifications = await notifications_collection.find(
        {"created_by": user["username"]}, {"_id": 0}
    ).to_list(length=limit)
    return {"notifications": notifications}


@app.get("/items", response_model=List[Item])
async def list_items():
    return await items_collection.find({}, {"_id": 0}).to_list(length=100)



@app.get("/items/count")
async def get_items_count():
    total_items = await items_collection.count_documents({})
    in_stock_count = await items_collection.count_documents({"in_stock": True})
    out_of_stock_count = await items_collection.count_documents({"in_stock": False})

    return {
        "total_items": total_items,
        "in_stock": in_stock_count,
        "out_of_stock": out_of_stock_count
    }

@app.get("/items/{brand}", response_model=Item)
async def get_item(brand: str):
    item = await items_collection.find_one(
        {"brand": {"$regex": f"^{brand}$", "$options": "i"}}, {"_id": 0}
    )
    if not item:
        raise HTTPException(404, detail="Item not found")
    return item

@app.put("/items/{brand}")
async def update_item(brand: str, item: Item, user=Depends(require_admin_or_superadmin)):
    # 1️⃣ Fetch current item (preview)
    existing_item = await items_collection.find_one({"brand": brand}, {"_id": 0})
    if not existing_item:
        raise HTTPException(404, detail="Item not found")

    # 2️⃣ Apply update
    await items_collection.update_one({"brand": brand}, {"$set": item.dict()})

    # 3️⃣ Fetch updated item
    updated_item = await items_collection.find_one({"brand": brand}, {"_id": 0})

    # 4️⃣ Return both preview + updated
    return {
        "msg": "Item updated successfully",
        "before_update": existing_item,
        "after_update": updated_item
    }

@app.delete("/items/{brand}")
async def delete_item(brand: str, user=Depends(require_admin_or_superadmin)):
    # 1️⃣ Fetch current item (preview)
    existing_item = await items_collection.find_one({"brand": brand}, {"_id": 0})
    if not existing_item:
        raise HTTPException(404, detail="Item not found")

    # 2️⃣ Delete the item
    await items_collection.delete_one({"brand": brand})

    # 3️⃣ Return the preview of deleted item
    return {
        "msg": "Item deleted successfully",
        "deleted_item": existing_item
    }



@app.get("/items/search")
async def search_items(q: str):
    return await mongo_text_search(q)

