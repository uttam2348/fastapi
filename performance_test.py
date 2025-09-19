
import asyncio
import time
import aiohttp
import statistics
from typing import List, Dict
import json

API_BASE_URL = "http://localhost:8000"

async def measure_response_time(session: aiohttp.ClientSession, url: str, method: str = "GET", data: Dict = None) -> float:
    """Measure response time for a single request"""
    start_time = time.time()

    if method == "GET":
        async with session.get(url) as response:
            await response.text()
    elif method == "POST":
        async with session.post(url, json=data) as response:
            await response.text()

    end_time = time.time()
    return end_time - start_time

async def run_performance_test(endpoint: str, num_requests: int = 10, method: str = "GET", data: Dict = None) -> Dict:
    """Run performance test for a specific endpoint"""
    print(f"\n🧪 Testing {endpoint} ({num_requests} requests)")

    async with aiohttp.ClientSession() as session:
        response_times = []

        for i in range(num_requests):
            try:
                response_time = await measure_response_time(session, f"{API_BASE_URL}{endpoint}", method, data)
                response_times.append(response_time)
                print(".1f")
            except Exception as e:
                print(f"❌ Request {i+1} failed: {e}")

        if response_times:
            return {
                "endpoint": endpoint,
                "num_requests": len(response_times),
                "avg_response_time": statistics.mean(response_times),
                "min_response_time": min(response_times),
                "max_response_time": max(response_times),
                "median_response_time": statistics.median(response_times),
                "std_dev": statistics.stdev(response_times) if len(response_times) > 1 else 0
            }
        else:
            return {"endpoint": endpoint, "error": "All requests failed"}

async def test_cache_performance():
    """Test caching performance improvements"""
    print("\n🔍 CACHE PERFORMANCE TEST")
    print("=" * 50)

    # Test items endpoint (should be cached)
    items_results = await run_performance_test("/items", 20)

    # Test search endpoint (should be cached)
    search_results = await run_performance_test("/items/search?q=test", 15)

    # Test user profile endpoint (should be cached)
    profile_results = await run_performance_test("/auth/me", 10)

    return {
        "items_endpoint": items_results,
        "search_endpoint": search_results,
        "profile_endpoint": profile_results
    }

async def test_database_performance():
    """Test database query performance"""
    print("\n DATABASE PERFORMANCE TEST")
    print("=" * 50)

    # Test paginated endpoint with optimizations
    paginated_results = await run_performance_test("/items/paged?limit=20", 15)

    # Test count endpoint
    count_results = await run_performance_test("/items/count", 15)

    return {
        "paginated_endpoint": paginated_results,
        "count_endpoint": count_results
    }

async def test_compression():
    """Test API compression effectiveness"""
    print("\n🗜️ COMPRESSION TEST")
    print("=" * 50)

    async with aiohttp.ClientSession() as session:
        # Test with compression headers
        headers = {"Accept-Encoding": "gzip, deflate"}
        start_time = time.time()

        async with session.get(f"{API_BASE_URL}/items", headers=headers) as response:
            content = await response.text()
            content_length = len(content.encode('utf-8'))
            compressed = response.headers.get('Content-Encoding', 'none')

        end_time = time.time()

        return {
            "response_time": end_time - start_time,
            "content_length": content_length,
            "compression": compressed,
            "status": "success"
        }

async def main():
    """Main performance testing function"""
    print(" INVENTORY API PERFORMANCE TEST SUITE")
    print("=" * 60)
    print("Testing caching, database optimizations, and API compression")
    print("Make sure the API server is running on http://localhost:8000")
    print()

    try:
        # Wait a moment for server to be ready
        await asyncio.sleep(2)

        # Run all tests
        cache_results = await test_cache_performance()
        db_results = await test_database_performance()
        compression_results = await test_compression()

        # Print summary
        print("\n📊 PERFORMANCE TEST RESULTS")
        print("=" * 60)

        print("\n🔍 CACHE PERFORMANCE:")
        for test_name, results in cache_results.items():
            if "error" not in results:
                print(".3f"
                      ".3f"
                      ".3f")

        print("\n🗄️ DATABASE PERFORMANCE:")
        for test_name, results in db_results.items():
            if "error" not in results:
                print(".3f"
                      ".3f"
                      ".3f")

        print("\n🗜️ COMPRESSION RESULTS:")
        if "error" not in compression_results:
            print(".3f"
                  f"Content Length: {compression_results['content_length']} bytes")
            print(f"Compression: {compression_results['compression']}")

        print("\n✅ Performance testing completed!")
        print("\n💡 RECOMMENDATIONS:")
        print("- Response times under 200ms are excellent")
        print("- Response times 200-500ms are good")
        print("- Response times over 500ms may need optimization")
        print("- Look for consistent response times (low std deviation)")
        print("- Compression should reduce payload sizes significantly")

    except Exception as e:
        print(f"❌ Performance test failed: {e}")
        print("Make sure the API server is running and accessible")

if __name__ == "__main__":
    asyncio.run(main())