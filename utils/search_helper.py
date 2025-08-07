from db.db import items_collection

async def mongo_text_search(query: str):
    return await items_collection.find({"$text": {"$search": query}}, {"_id": 0}).to_list(length=100)
