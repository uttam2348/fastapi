from fastapi import FastAPI, HTTPException, Depends, File, UploadFile
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
import uuid
import os
from fastapi.middleware.cors import CORSMiddleware
from db.db import (
    check_mongo_connection,
    users_collection,
    items_collection,
    notifications_collection,
    purchases_collection,
    updated_items_collection,
    deleted_items_collection,
    carts_collection,
    payments_collection,
)
from utils.token_helper import create_token, decode_token
from utils.password_helper import hash_password, verify_password
from utils.search_helper import mongo_text_search

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/token")

# ---------------- MODELS ----------------
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
    created_by: Optional[str] = None


class ItemUpdate(BaseModel):
    brand: Optional[str] = None
    name: Optional[str] = None
    price: Optional[float] = None
    quantity: Optional[int] = None
    description: Optional[str] = None


class CartItem(BaseModel):
    item_id: str
    brand: str
    name: str
    price: float
    quantity: int = 1


class Cart(BaseModel):
    username: str
    items: List[CartItem]


class PaymentQuoteRequest(BaseModel):
    items: List[CartItem]
    tax_rate: Optional[float] = 0.0
    discount: Optional[float] = 0.0


class PaymentChargeRequest(BaseModel):
    items: List[CartItem]
    tax_rate: Optional[float] = 0.0
    discount: Optional[float] = 0.0
    method: Optional[str] = "cash"  # cash/card/upi

# Create uploads directory if it doesn't exist
UPLOAD_DIR = "uploads"
if not os.path.exists(UPLOAD_DIR):
    os.makedirs(UPLOAD_DIR)

# Mount static files for serving images
app = FastAPI(title="Inventory API", version="1.0")
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",   # CRA dev server
        "http://localhost:3001",   # Alternative port
        "http://127.0.0.1:3000"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------- STARTUP ----------------
@app.on_event("startup")
async def startup():
    await check_mongo_connection()
    # Backfill UUIDs for items missing an 'id'
    try:
        cursor = items_collection.find({"$or": [{"id": {"$exists": False}}, {"id": None}, {"id": ""}]})
        async for item in cursor:
            new_id = str(uuid.uuid4())
            await items_collection.update_one({"_id": item["_id"]}, {"$set": {"id": new_id}})
    except Exception as e:
        # Log but don't block startup
        print(f"⚠️ UUID backfill error: {e}")



# ---------------- HELPERS ----------------
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


# ---------------- ROOT ----------------
@app.get("/", tags=["Root"])
async def root():
    return {"message": "hi there"}


# ---------------- AUTH ----------------
@app.post("/auth/users", tags=["Auth"])
async def create_user(user: UserCreate):
    if await users_collection.find_one({"username": user.username}):
        raise HTTPException(400, detail="Username already exists")

    user_id = str(uuid.uuid4())
    await users_collection.insert_one({
        "id": user_id,
        "username": user.username,
        "hashed_password": hash_password(user.password),
        "role": user.role
    })
    return {"msg": f"{user.role.capitalize()} created successfully", "id": user_id}


@app.post("/auth/token", response_model=Token, tags=["Auth"])
async def login(form: OAuth2PasswordRequestForm = Depends()):
    user = await users_collection.find_one({"username": form.username})
    if not user or not verify_password(form.password, user["hashed_password"]):
        raise HTTPException(400, detail="Incorrect username or password")
    token = create_token({"sub": user["username"], "role": user["role"]})
    return {"access_token": token, "token_type": "bearer"}


@app.get("/auth/me", tags=["Auth"])
async def me(user=Depends(get_current_user)):
    return {"username": user.get("username"), "role": user.get("role")}


# ---------------- ITEMS ----------------
@app.post("/items", response_model=Item, tags=["Items"])
async def create_item(item: Item, user=Depends(get_current_user)):
    if user["role"] == "user":
        raise HTTPException(403, detail="Users cannot create items")

    # Enforce unique brand (case-insensitive)
    if await items_collection.find_one({"brand": {"$regex": f"^{item.brand}$", "$options": "i"}}):
        raise HTTPException(400, detail="Brand already exists")

    count = await items_collection.count_documents({"created_by": user["username"]})
    if user["role"] == "admin" and count >= 10:
        raise HTTPException(403, detail="Reached your limit")
    elif user["role"] == "superadmin" and count >= 100:
        raise HTTPException(403, detail="Reached your limit")

    in_stock = item.quantity > 0
    item_id = str(uuid.uuid4())

    item_data = item.dict()
    item_data["id"] = item_id
    item_data["created_by"] = user["username"]
    item_data["in_stock"] = in_stock

    await items_collection.insert_one(item_data)

    return {**item.dict(), "id": item_id, "in_stock": in_stock, "created_by": user["username"]}


# ---------------- BUY ----------------
@app.post("/items/buy/{brand}", tags=["Buy"])
async def buy_item(brand: str):
    # Atomic decrement if quantity > 0
    updated = await items_collection.find_one_and_update(
        {"brand": {"$regex": f"^{brand}$", "$options": "i"}, "quantity": {"$gt": 0}},
        {"$inc": {"quantity": -1}},
        return_document=True,
        projection={"_id": 0}
    )

    if not updated:
        existing = await items_collection.find_one({"brand": {"$regex": f"^{brand}$", "$options": "i"}})
        if not existing:
            raise HTTPException(404, detail="Item not found")
        raise HTTPException(400, detail="Out of stock")

    in_stock_now = updated.get("quantity", 0) > 0
    if in_stock_now != updated.get("in_stock"):
        await items_collection.update_one(
            {"brand": {"$regex": f"^{brand}$", "$options": "i"}},
            {"$set": {"in_stock": in_stock_now}}
        )

    await purchases_collection.update_one(
        {"brand": updated["brand"]},
        {"$inc": {"quantity_sold": 1}, "$set": {"name": updated["name"]}},
        upsert=True
    )

    if updated["quantity"] < 3:
        notification_msg = f"{updated['name']} stock is low: {updated['quantity']} left"
    else:
        notification_msg = f"{updated['name']} updated stock"

    await notifications_collection.insert_one({
        "brand": updated["brand"],
        "name": updated["name"],
        "quantity": updated["quantity"],
        "in_stock": in_stock_now,
        "created_by": updated.get("created_by", "system"),
        "msg": notification_msg,
        "notified_at": datetime.utcnow()
    })

    return {"msg": f"Purchased {updated['name']} successfully"}


# ---------------- SOLD ----------------
@app.get("/items/sold/{brand}", tags=["Sold"])
async def sold_items(brand: str):
    sold = await purchases_collection.find_one(
        {"brand": {"$regex": f"^{brand}$", "$options": "i"}}, {"_id": 0}
    )
    if not sold:
        raise HTTPException(404, detail="Item not found in sold records")

    item = await items_collection.find_one(
        {"brand": {"$regex": f"^{brand}$", "$options": "i"}},
        {"_id": 0, "quantity": 1}
    )
    remaining_quantity = item["quantity"] if item else 0

    return {
        "brand": sold["brand"],
        "name": sold["name"],
        "quantity_sold": sold.get("quantity_sold", 0),
        "remaining_quantity": remaining_quantity
    }


# ---------------- LIST ----------------
@app.get("/items", response_model=List[Item], tags=["List"])
async def list_items():
    return await items_collection.find({}, {"_id": 0}).to_list(length=100)

@app.get("/items/count", tags=["List"])
async def get_items_count():
    total_items = await items_collection.count_documents({})
    in_stock_count = await items_collection.count_documents({"in_stock": True})
    out_of_stock_count = await items_collection.count_documents({"in_stock": False})

    items = await items_collection.find({}, {"_id": 0, "name": 1, "quantity": 1}).to_list(length=100)

    return {
        "total_items": total_items,
        "in_stock": in_stock_count,
        "out_of_stock": out_of_stock_count,
        "items": items
    }

@app.get("/items/{brand}", response_model=Item, tags=["List"])
async def get_item(brand: str):
    item = await items_collection.find_one({"brand": {"$regex": f"^{brand}$", "$options": "i"}}, {"_id": 0})
    if not item:
        raise HTTPException(404, detail="Item not found")
    return item


# ---------------- UPDATE/DELETE ----------------
@app.put("/items/{brand}", tags=["Update/Delete"])
async def update_item(brand: str, item: Item, user=Depends(require_admin_or_superadmin)):
    existing_item = await items_collection.find_one({"brand": {"$regex": f"^{brand}$", "$options": "i"}}, {"_id": 0})
    if not existing_item:
        raise HTTPException(404, detail="Item not found")

    item_dict = item.dict(exclude_unset=True)
    if "quantity" in item_dict:
        item_dict["in_stock"] = item_dict["quantity"] > 0

    item_dict["created_by"] = existing_item.get("created_by", user["username"])
    item_dict["updated_by"] = user["username"]
    item_dict["updated_at"] = datetime.utcnow()

    updated_item = await items_collection.find_one_and_update(
        {"brand": {"$regex": f"^{brand}$", "$options": "i"}},
        {"$set": item_dict},
        return_document=True,
        projection={"_id": 0}
    )

    return {
        "msg": "Item updated successfully",
        "before_update": existing_item,
        "after_update": updated_item
    }


# ---------------- LIST (PAGINATED/SORTED/FILTERED) ----------------
@app.get("/items/paged", tags=["List"])
async def list_items_paged(
    skip: int = 0,
    limit: int = 20,
    sort: str = "brand",
    order: int = 1,
    brand: Optional[str] = None,
    name: Optional[str] = None,
    in_stock: Optional[bool] = None,
    q: Optional[str] = None,
):
    if limit > 100:
        limit = 100
    query: dict = {}
    if brand:
        query["brand"] = {"$regex": brand, "$options": "i"}
    if name:
        query["name"] = {"$regex": name, "$options": "i"}
    if in_stock is not None:
        query["in_stock"] = in_stock
    if q:
        query["$or"] = [
            {"brand": {"$regex": q, "$options": "i"}},
            {"name": {"$regex": q, "$options": "i"}},
            {"description": {"$regex": q, "$options": "i"}},
        ]

    total = await items_collection.count_documents(query)
    cursor = items_collection.find(query, {"_id": 0}).sort(sort, order).skip(skip).limit(limit)
    data = await cursor.to_list(length=limit)
    return {"data": data, "total": total, "skip": skip, "limit": limit}


@app.patch("/items/{brand}", tags=["Update/Delete"])
async def patch_item(brand: str, item: ItemUpdate, user=Depends(require_admin_or_superadmin)):
    existing_item = await items_collection.find_one({"brand": {"$regex": f"^{brand}$", "$options": "i"}}, {"_id": 0})
    if not existing_item:
        raise HTTPException(404, detail="Item not found")

    update_dict = {k: v for k, v in item.dict(exclude_unset=True).items() if v is not None}
    if not update_dict:
        return {"msg": "No changes provided", "after_update": existing_item}

    if "quantity" in update_dict:
        update_dict["in_stock"] = update_dict["quantity"] > 0

    updated_item = await items_collection.find_one_and_update(
        {"brand": {"$regex": f"^{brand}$", "$options": "i"}},
        {"$set": {**update_dict, "updated_by": user["username"], "updated_at": datetime.utcnow()}},
        return_document=True,
        projection={"_id": 0}
    )

    return {"msg": "Item updated successfully", "after_update": updated_item}

@app.delete("/items/{brand}", tags=["Update/Delete"])
async def delete_item(brand: str, user=Depends(require_admin_or_superadmin)):
    existing_item = await items_collection.find_one({"brand": {"$regex": f"^{brand}$", "$options": "i"}})
    if not existing_item:
        raise HTTPException(404, detail="Item not found")

    created_by = existing_item.get("created_by", "unknown")
    archive_item = existing_item.copy()
    archive_item["deleted_by"] = user["username"]
    archive_item["deleted_at"] = datetime.utcnow()

    await deleted_items_collection.insert_one(archive_item)
    await items_collection.delete_one({"brand": {"$regex": f"^{brand}$", "$options": "i"}})

    return {
        "msg": "Item deleted successfully",
        "deleted_item": {
            "brand": existing_item.get("brand"),
            "name": existing_item.get("name"),
            "created_by": created_by,
            "deleted_by": user["username"]
        }
    }


# ---------------- SEARCH ----------------
@app.get("/items/search", tags=["Search"])
async def search_items(q: str):
    return await mongo_text_search(q)


# ---------------- NOTIFICATIONS ----------------
@app.get("/notifications", tags=["Notifications"])
async def get_notifications(user=Depends(get_current_user)):
    if user["role"] not in ["admin", "superadmin"]:
        raise HTTPException(403, detail="Admins or Superadmins only")

    limit = 50 if user["role"] == "admin" else 100
    notifications = await notifications_collection.find(
        {"created_by": user["username"]}, {"_id": 0}
    ).to_list(length=limit)
    return {"notifications": notifications}

@app.delete("/notifications/clear", tags=["Notifications"])
async def clear_all_notifications(user=Depends(get_current_user)):
    if user["role"] not in ["admin", "superadmin"]:
        raise HTTPException(403, detail="Admins or Superadmins only")
    
    try:
        # Clear all notifications for the current user
        result = await notifications_collection.delete_many({"created_by": user["username"]})
        return {"msg": f"Cleared {result.deleted_count} notifications successfully"}
    except Exception as e:
        raise HTTPException(500, detail=f"Error clearing notifications: {str(e)}")

@app.delete("/notifications/clear-all", tags=["Notifications"])
async def clear_all_notifications_system(user=Depends(get_current_user)):
    if user["role"] != "superadmin":
        raise HTTPException(403, detail="Superadmin only")
    
    try:
        # Clear all notifications in the system (superadmin only)
        result = await notifications_collection.delete_many({})
        return {"msg": f"Cleared {result.deleted_count} notifications from system successfully"}
    except Exception as e:
        raise HTTPException(500, detail=f"Error clearing notifications: {str(e)}")


# ---------------- CART ----------------
@app.get("/cart", tags=["Cart"])
async def get_cart(user=Depends(get_current_user)):
    cart = await carts_collection.find_one({"username": user["username"]}, {"_id": 0})
    if not cart:
        return {"username": user["username"], "items": []}
    return cart


@app.post("/cart/add", tags=["Cart"])
async def add_to_cart(brand: str, quantity: int = 1, user=Depends(get_current_user)):
    item = await items_collection.find_one({"brand": {"$regex": f"^{brand}$", "$options": "i"}}, {"_id": 0})
    if not item:
        raise HTTPException(404, detail="Item not found")
    if quantity <= 0:
        raise HTTPException(400, detail="Quantity must be positive")
    # Do not reserve stock here; reserve on checkout
    cart = await carts_collection.find_one({"username": user["username"]})
    if not cart:
        cart_doc = {
            "username": user["username"],
            "items": [{
                "item_id": item.get("id"),
                "brand": item["brand"],
                "name": item["name"],
                "price": item["price"],
                "quantity": quantity
            }]
        }
        await carts_collection.insert_one(cart_doc)
        return {"msg": "Added to cart", "cart": {"username": user["username"], "items": cart_doc["items"]}}

    # If item exists in cart, increment; else push new
    updated = await carts_collection.update_one(
        {"username": user["username"], "items.brand": {"$regex": f"^{brand}$", "$options": "i"}},
        {"$inc": {"items.$.quantity": quantity}}
    )
    if updated.modified_count == 0:
        await carts_collection.update_one(
            {"username": user["username"]},
            {"$push": {"items": {
                "item_id": item.get("id"),
                "brand": item["brand"],
                "name": item["name"],
                "price": item["price"],
                "quantity": quantity
            }}}
        )
    cart_after = await carts_collection.find_one({"username": user["username"]}, {"_id": 0})
    return {"msg": "Added to cart", "cart": cart_after}


@app.post("/cart/update", tags=["Cart"])
async def update_cart_item(brand: str, quantity: int, user=Depends(get_current_user)):
    if quantity <= 0:
        # remove the item
        await carts_collection.update_one(
            {"username": user["username"]},
            {"$pull": {"items": {"brand": {"$regex": f"^{brand}$", "$options": "i"}}}}
        )
    else:
        await carts_collection.update_one(
            {"username": user["username"], "items.brand": {"$regex": f"^{brand}$", "$options": "i"}},
            {"$set": {"items.$.quantity": quantity}}
        )
    cart_after = await carts_collection.find_one({"username": user["username"]}, {"_id": 0})
    return {"msg": "Cart updated", "cart": cart_after or {"username": user["username"], "items": []}}


@app.post("/cart/clear", tags=["Cart"])
async def clear_cart(user=Depends(get_current_user)):
    await carts_collection.update_one(
        {"username": user["username"]},
        {"$set": {"items": []}},
        upsert=True
    )
    return {"msg": "Cart cleared", "cart": {"username": user["username"], "items": []}}


@app.post("/cart/checkout", tags=["Cart"])
async def checkout_cart(user=Depends(get_current_user)):
    cart = await carts_collection.find_one({"username": user["username"]})
    if not cart or not cart.get("items"):
        raise HTTPException(400, detail="Cart is empty")

    # Try to purchase each item atomically; collect results
    results = []
    for entry in cart["items"]:
        brand = entry["brand"]
        qty = int(entry.get("quantity", 1))
        for _ in range(qty):
            try:
                await buy_item(brand)  # reuse existing logic
                results.append({"brand": brand, "status": "ok"})
            except HTTPException as e:
                results.append({"brand": brand, "status": "error", "detail": e.detail})

    # Clear cart regardless; alternatively, only clear successful items
    await carts_collection.update_one({"username": user["username"]}, {"$set": {"items": []}}, upsert=True)
    return {"msg": "Checkout complete", "results": results}


# ---------------- PAYMENTS (ADMIN ONLY) ----------------
def _require_admin(user):
    if user["role"] not in ["admin", "superadmin"]:
        raise HTTPException(403, detail="Admins only")


@app.post("/payments/quote", tags=["Payments"])
async def payment_quote(payload: PaymentQuoteRequest, user=Depends(get_current_user)):
    _require_admin(user)
    subtotal = sum((ci.price * ci.quantity) for ci in payload.items)
    tax_amount = round(subtotal * (payload.tax_rate or 0) / 100.0, 2)
    discount_amount = round(payload.discount or 0, 2)
    total = round(max(0.0, subtotal + tax_amount - discount_amount), 2)
    return {
        "subtotal": round(subtotal, 2),
        "tax": tax_amount,
        "discount": discount_amount,
        "total": total
    }


@app.post("/payments/charge", tags=["Payments"])
async def payment_charge(payload: PaymentChargeRequest, user=Depends(get_current_user)):
    _require_admin(user)
    quote = await payment_quote(PaymentQuoteRequest(**payload.dict()), user)  # reuse calculation
    payment_id = str(uuid.uuid4())
    doc = {
        "id": payment_id,
        "username": user["username"],
        "role": user["role"],
        "items": [ci.dict() for ci in payload.items],
        "tax_rate": payload.tax_rate or 0.0,
        "discount": payload.discount or 0.0,
        "method": payload.method,
        "amounts": quote,
        "created_at": datetime.utcnow()
    }
    await payments_collection.insert_one(doc)
    return {"msg": "Payment recorded", "payment_id": payment_id, "amounts": quote}
