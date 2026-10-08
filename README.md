# ReSkilled - Teacher Training Platform

Frontend (HTML/CSS/JS) + REST API (Node.js, Express) + SQLite database.

## Run it
Requires Node.js 18+.

    npm install
    npm start

Open http://localhost:3000 (don't open index.html directly - it needs the server).

Optional, before deploying:

    JWT_SECRET=some-long-random-string PORT=3000 npm start

## Project structure
    server.js          API + static file server
    public/index.html  the website (calls the API)
    reskilled.db       SQLite database (auto-created on first run)

## API
| Method | Endpoint         | Auth | Purpose                          |
|--------|------------------|------|----------------------------------|
| POST   | /api/register    | -    | Create account, returns JWT      |
| POST   | /api/login       | -    | Login, returns JWT               |
| GET    | /api/me          | JWT  | Current user profile             |
| GET    | /api/enrollments | JWT  | User's courses + certificate IDs |
| POST   | /api/enroll      | JWT  | Enroll in a course               |
| POST   | /api/complete    | JWT  | Complete course, issue cert ID   |
| POST   | /api/messages    | -    | Save contact / feedback message  |
| GET    | /api/verify/:id  | -    | Certificate check (JSON)         |
| GET    | /verify/:id      | -    | Certificate check (web page)     |

## Security features
- Passwords hashed with bcrypt; login via signed JWT (7 days)
- Login/register rate limiting (10 attempts / 15 min / IP)
- Parameterised SQL queries; output escaped against XSS
- Course names validated server-side against a whitelist

## View saved data
    sqlite3 reskilled.db "SELECT * FROM messages;"
    sqlite3 reskilled.db "SELECT * FROM users;"
