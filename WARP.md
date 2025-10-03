# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project Overview

This is a full-stack Inventory Management System with:
- **Backend**: FastAPI with MongoDB, Redis caching, JWT authentication, and async operations
- **Frontend**: React with Tailwind CSS, lazy loading, and client-side routing
- **Architecture**: Microservice-style with separation of concerns across utils/, db/, and API layers

## Essential Development Commands

### Backend (FastAPI)

```bash
# Set up and run backend
python -m venv venv
# Windows
venv\Scripts\activate
# Linux/Mac
source venv/bin/activate

pip install -r requirements.txt
python main.py
# Server runs on http://127.0.0.1:8000
```

### Frontend (React)

```bash
cd fastapi-frontend
npm install
npm start
# Frontend runs on http://localhost:3000
```

### Testing

```bash
# Database connection test
python test_db_connection.py

# Performance testing (requires running backend)
python perf_test_simple.py

# React tests
cd fastapi-frontend
npm test
```

### Production Build

```bash
# Frontend production build
cd fastapi-frontend
npm run build

# Bundle analysis
npm run analyze
```

## Architecture Overview

### Backend Structure

```
main.py              # FastAPI app with all endpoints and middleware
db/
  db.py             # MongoDB connection, collections, indexes
utils/
  token_helper.py   # JWT token creation/validation
  password_helper.py # Password hashing (bcrypt)
  cache.py          # Redis caching layer with fallback
  search_helper.py  # MongoDB text search
  image_helper.py   # Image upload/compression
```

### Key Architectural Patterns

**Authentication Flow**: JWT-based with role hierarchies (user < admin < superadmin)
- Users: Browse items, cart operations
- Admins: CRUD items (10 item limit), process payments
- Superadmins: Unlimited items, system-wide operations

**Caching Strategy**: Redis-first with in-memory fallback
- Cache keys: `items:list`, `items:detail:{brand}`, `user:data:{username}`, `search:results:{query}`
- TTL: 300 seconds (5 minutes) default
- Cache invalidation on mutations (create/update/delete items)

**Database Design**: MongoDB with optimized indexes
- Collections: users, items, carts, notifications, payments, purchases, updated_items, deleted_items
- Text search index on items collection for search functionality
- Unique constraints on username and brand fields

**Performance Optimizations**:
- Connection pooling (5-10 connections)
- Database projections to limit returned fields
- Async operations throughout
- GZip compression middleware
- Frontend code splitting with React.lazy()

### Critical Business Logic

**Inventory Management**:
- Stock tracking with atomic operations
- Low stock notifications (< 3 items)
- Purchase history and soft deletes
- Brand uniqueness (case-insensitive)

**Cart System**:
- User-specific carts with item aggregation
- Checkout processes multiple items atomically
- No stock reservation until checkout

**Payment Processing** (Admin-only):
- Quote generation with tax/discount calculations
- Payment recording with audit trail
- Multiple payment methods (cash/card/upi)

## Environment Configuration

Required `.env` variables:
```env
SECRET_KEY=your-jwt-secret-key
MONGO_URI=mongodb://localhost:27017
MONGO_DB_NAME=inventory_db
CORS_ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
TOKEN_EXPIRE_HOURS=24
REDIS_URL=redis://localhost:6379
```

## Development Notes

### Running Single Tests
- Backend performance: `python perf_test_simple.py`
- Database connectivity: `python test_db_connection.py`
- Frontend component tests: `cd fastapi-frontend && npm test -- --testNamePattern="ComponentName"`

### Common Debugging
- Check MongoDB connection: Look for "Connected to MongoDB" in startup logs
- Redis fallback: If Redis fails, app uses in-memory caching
- Token issues: JWT tokens expire based on TOKEN_EXPIRE_HOURS
- CORS errors: Verify CORS_ALLOWED_ORIGINS includes frontend URL

### API Documentation
FastAPI auto-generates docs at `/docs` (Swagger) and `/redoc` when server is running.

### Key Dependencies
- **Backend**: FastAPI, Motor (async MongoDB), aioredis, python-jose (JWT), bcrypt
- **Frontend**: React 18, React Router, Axios, Tailwind CSS
- **Development**: Tailwind CLI, webpack-bundle-analyzer

### Performance Expectations
- Cached responses: <100ms
- Database queries: <200ms (with indexes)
- Frontend bundle: Code-split for optimal loading
- Image compression: 40-60% size reduction
- Text search: MongoDB full-text with relevance scoring