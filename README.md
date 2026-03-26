# RateBooks — Book Rating API

A REST API for rating books, integrated with the **Google Books API**. Authenticated users can search for books and log their reviews with a score, comment, and reading status.

## Stack

- **[NestJS](https://nestjs.com/)** — Node.js framework
- **[TypeORM](https://typeorm.io/)** + **PostgreSQL** — data persistence
- **[JWT](https://jwt.io/)** — authentication via access/refresh tokens
- **[Google Books API](https://developers.google.com/books)** — external book data integration

---

## Installation and setup

### Prerequisites

- Node.js 18+
- PostgreSQL running locally

### 1. Clone and install dependencies

```bash
git clone <repo-url>
cd rateBooks
npm install
```

### 2. Configure environment variables

Create a `.env` file in the project root:

```env
DB_HOST=localhost
DB_PORT=5432
DB_USER=your_user
DB_PASSWORD=your_password
DB_NAME=rate_everithing

JWT_SECRET=your_secret_key
```

### 3. Run

```bash
# Development (with hot reload)
npm run start:dev

# Production
npm run start:prod
```

The API will be available at `http://localhost:3000/api`.

---

## Endpoints

### Authentication (`/api/auth`)

| Method | Route | Auth Required | Description |
|--------|-------|---------------|-------------|
| `POST` | `/api/auth/login` | No | Login with email and password |
| `POST` | `/api/auth/refresh` | No | Refresh access token using a refresh token |
| `GET`  | `/api/auth/profile` | Yes | Get the logged-in user's data |

**Example — Login:**
```json
POST /api/auth/login
{
  "email": "user@email.com",
  "password": "password123"
}
```

---

### Users (`/api/users`)

| Method | Route | Auth Required | Description |
|--------|-------|---------------|-------------|
| `POST`   | `/api/users`     | No  | Register a new user |
| `GET`    | `/api/users`     | Yes | List all users |
| `GET`    | `/api/users/:id` | Yes | Get a user by ID |
| `PATCH`  | `/api/users/:id` | Yes | Update a user |
| `DELETE` | `/api/users/:id` | Yes | Delete a user |

**Example — Register a user:**
```json
POST /api/users
{
  "name": "John",
  "email": "john@email.com",
  "password": "password123"
}
```

---

### Books (`/api/books`)

Proxy endpoints for the Google Books API.

| Method | Route | Auth Required | Description |
|--------|-------|---------------|-------------|
| `GET` | `/api/books/search?q=query` | Yes | Search books by title or author |
| `GET` | `/api/books/:googleBookId`  | Yes | Get details of a specific book |

**Example — Search books:**
```
GET /api/books/search?q=Harry+Potter
```

**Response:**
```json
[
  {
    "id": "zyTCAlFPjgYC",
    "title": "Harry Potter and the Philosopher's Stone",
    "authors": ["J.K. Rowling"],
    "description": "...",
    "thumbnail": "https://...",
    "publishedDate": "1997-06-26",
    "pageCount": 223
  }
]
```

---

### Ratings (`/api/rating`)

| Method | Route | Auth Required | Description |
|--------|-------|---------------|-------------|
| `POST`   | `/api/rating`                    | Yes | Create a rating |
| `GET`    | `/api/rating`                    | Yes | List all ratings |
| `GET`    | `/api/rating?googleBookId=id`    | Yes | Filter ratings by book |
| `GET`    | `/api/rating/:id`                | Yes | Get a specific rating |
| `PATCH`  | `/api/rating/:id`                | Yes | Update a rating |
| `DELETE` | `/api/rating/:id`                | Yes | Delete a rating |

**Example — Create a rating:**
```json
POST /api/rating
{
  "googleBookId": "zyTCAlFPjgYC",
  "userId": 1,
  "score": 5,
  "comment": "A timeless classic.",
  "status": "finished"
}
```

The `googleBookId` is validated against the Google Books API before saving. Read responses include enriched book data.

**Available status values:**

| Value | Description |
|-------|-------------|
| `not_read` | Not yet read |
| `reading` | Currently reading |
| `finished` | Finished |

---

## Project structure

```
src/
├── auth/               # JWT authentication (login, refresh, guard)
├── books/              # Google Books API integration
│   ├── dto/
│   ├── books.controller.ts
│   ├── books.module.ts
│   └── google-books.service.ts
├── rating/             # Book ratings
│   ├── dto/
│   ├── entities/
│   ├── rating.controller.ts
│   ├── rating.module.ts
│   ├── rating.service.ts
│   └── status.enum.ts
├── users/              # User CRUD
├── app.module.ts
└── main.ts
```

---

## Tests

```bash
# Unit tests
npm run test

# Test coverage
npm run test:cov

# End-to-end tests
npm run test:e2e
```

---

## License

MIT
