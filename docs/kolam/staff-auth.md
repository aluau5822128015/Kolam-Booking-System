# Staff Authentication

Flow: Public site → **Front Office** button → `/front-office` → (no valid session) → `/front-office/login` → dashboard.

## How it works
- `POST /api/auth/login` `{username, password}` → `{token, username}`. Token is a JWT (HS256, 8 hours) signed with `JWT_SECRET`.
- `GET /api/auth/me` validates a token.
- `GET /api/bookings` and `PATCH /api/bookings/:id` require `Authorization: Bearer <token>`. `POST /api/bookings` (public booking form) stays open.
- Every protected request re-checks that the staff account exists and is `active`, so disabling an account takes effect immediately.
- Passwords are stored only as bcrypt hashes (`Staff` collection). Wrong user and wrong password return the same message. Max 10 failed logins per IP per 15 minutes (in memory, per server process).
- Without `JWT_SECRET`, protected routes return 503 (fail closed).
- Frontend keeps the token in `sessionStorage` (cleared when the tab closes). The route guard is only a convenience; real protection is the backend check. Any 401 clears the session and returns to the login page.

## Setup
1. Add `JWT_SECRET` to `backend/.env` (see `backend/.env.example`). Never commit `.env`.
2. Set the single shared Front Office login (the email is the username; password typed at a hidden prompt, min 10 characters). Management gives this email and password to staff. Re-running with the same email changes the password; running with a different email replaces the login (all other staff accounts are disabled):
   ```
   cd backend
   node scripts/createStaff.js frontoffice@example.com
   ```
3. Cut off access immediately: set `active: false` on the `Staff` document.

## Limitations
- One shared login, so actions cannot be traced to a person; no admin UI, no password change screen, no "forgot password".
- Tokens cannot be revoked individually before they expire (disable the account instead).
- `sessionStorage` tokens are readable by any script running on the page (XSS); there is no refresh token.
- Login rate limit is per process memory and resets on restart.
- Serve the site over HTTPS in production, and restrict CORS (currently fixed to `http://localhost:5173`).

Tests: `cd backend && npm test` (includes the auth tests).
