from db.db import items_collection

async def mongo_text_search(query: str):
    cursor = items_collection.find({
        "$or": [
            {"brand": {"$regex": query, "$options": "i"}},
            {"name": {"$regex": query, "$options": "i"}},
            {"description": {"$regex": query, "$options": "i"}},
        ]
    }, {"_id": 0})
    return await cursor.to_list(length=50)
