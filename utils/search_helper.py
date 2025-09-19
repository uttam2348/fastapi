from db.db import items_collection

async def mongo_text_search(query: str):
    cursor = items_collection.find(
        {"$text": {"$search": query}},
        {"_id": 0, "score": {"$meta": "textScore"}}  # include score
    ).sort([("score", {"$meta": "textScore"})])     # sort by relevance
    
    return await cursor.to_list(length=100)
