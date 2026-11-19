# ReSkilled - Teacher Training Platform

Frontend (HTML/CSS/JS) + REST API (Node.js, Express) + Firebase Firestore database.

## Run it locally
Requires Node.js 18+ and a Firebase service account key (see SETUP below).

    npm install
    npm start

Open http://localhost:3000 (don't open index.html directly - it needs the server).
On Windows PowerShell, if `npm` is blocked, use `npm.cmd install` and `npm.cmd start`.

## Firebase setup (once)
1. Create a Firebase project and a Firestore database (production mode).
2. Project settings > Service accounts > Generate new private key.
3. Locally: save the file as `serviceAccountKey.json` in this folder (it is git-ignored - never commit it).
4. On Render: add an environment variable `FIREBASE_SERVICE_ACCOUNT` containing the whole JSON file.
   Also set `JWT_SECRET` to a long random string.

## Project structure
    server.js            API + static file server (talks to Firestore)
    quizzes.js           assessment questions (5 per course)
    public/index.html    the website (calls the API)

## Firestore data
    users/{id}                       profile, hashed password
    users/{id}/enrollments/{course}  progress, best quiz score, certificate id
    certificates/{RS-XXXXXXXX}       for the /verify page
    messages/{auto}                  contact + feedback messages

## API
| Method | Endpoint         | Auth | Purpose                          |
|--------|------------------|------|----------------------------------|
| POST   | /api/register    | -    | Create account, returns JWT      |
| POST   | /api/login       | -    | Login, returns JWT               |
| GET    | /api/me          | JWT  | Current user profile             |
| GET    | /api/enrollments | JWT  | User's courses + progress        |
| POST   | /api/enroll      | JWT  | Enroll in a course               |
| POST   | /api/progress    | JWT  | Save video watch time            |
| GET    | /api/quiz/:course  | JWT | Assessment questions            |
| POST   | /api/quiz/:course  | JWT | Submit answers (graded server-side) |
| POST   | /api/messages    | -    | Save contact / feedback message  |
| GET    | /api/verify/:id  | -    | Certificate check (JSON)         |
| GET    | /verify/:id      | -    | Certificate check (web page)     |

A course completes when 80% of the video is watched AND the assessment is passed (60%+).

## Security
- Passwords hashed with bcrypt; login via signed JWT (7 days)
- Login/register rate limiting; output escaped against XSS
- Firebase key stays on the server (git-ignored / environment variable)
