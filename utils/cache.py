import json
from typing import Any, Optional
import os
from dotenv import load_dotenv

# Temporarily disable aioredis due to compatibility issues
# Try to import aioredis, fall back to None if not available
# try:
#     import aioredis
#     REDIS_AVAILABLE = True
# except ImportError:
aioredis = None
REDIS_AVAILABLE = False

load_dotenv()

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")
CACHE_TTL = int(os.getenv("CACHE_TTL", 300))  # 5 minutes default

class CacheManager:
    def __init__(self):
        self.redis = None
        self._connected = False

    async def connect(self):
        """Initialize Redis connection"""
        if not REDIS_AVAILABLE:
            print("aioredis not available. Using in-memory cache.")
            self.redis = None
            self._connected = False
            return
            
        try:
            self.redis = aioredis.from_url(REDIS_URL, decode_responses=True)
            await self.redis.ping()
            self._connected = True
            print("Connected to Redis")
        except Exception as e:
            print(f"Redis connection failed: {e}. Using in-memory cache.")
            self.redis = None
            self._connected = False

    async def disconnect(self):
        """Close Redis connection"""
        if self.redis and self._connected:
            await self.redis.close()

    async def get(self, key: str) -> Optional[Any]:
        """Get value from cache"""
        if not self._connected:
            return None

        try:
            data = await self.redis.get(key)
            if data:
                return json.loads(data)
            return None
        except Exception as e:
            print(f"Cache get error: {e}")
            return None

    async def set(self, key: str, value: Any, ttl: int = CACHE_TTL) -> bool:
        """Set value in cache with TTL"""
        if not self._connected:
            return False

        try:
            data = json.dumps(value)
            await self.redis.setex(key, ttl, data)
            return True
        except Exception as e:
            print(f"Cache set error: {e}")
            return False

    async def delete(self, key: str) -> bool:
        """Delete key from cache"""
        if not self._connected:
            return False

        try:
            await self.redis.delete(key)
            return True
        except Exception as e:
            print(f"Cache delete error: {e}")
            return False

    async def clear_pattern(self, pattern: str) -> bool:
        """Clear all keys matching pattern"""
        if not self._connected:
            return False

        try:
            keys = await self.redis.keys(pattern)
            if keys:
                await self.redis.delete(*keys)
            return True
        except Exception as e:
            print(f"Cache clear pattern error: {e}")
            return False

# Global cache instance
cache_manager = CacheManager()

# Cache key patterns
ITEMS_LIST_KEY = "items:list"
ITEM_DETAIL_KEY = "items:detail:{}"
USER_DATA_KEY = "user:data:{}"
SEARCH_RESULTS_KEY = "search:results:{}"
ITEMS_COUNT_KEY = "items:count"

def get_items_list_key():
    return ITEMS_LIST_KEY

def get_item_detail_key(item_id: str):
    return ITEM_DETAIL_KEY.format(item_id)

def get_user_data_key(username: str):
    return USER_DATA_KEY.format(username)

def get_search_results_key(query: str):
    return SEARCH_RESULTS_KEY.format(query)

def get_items_count_key():
    return ITEMS_COUNT_KEY