# AutoSAR AI

AutoSAR AI is a React single-page application backed by an Express REST API and a local MySQL database. The runnable application is in `client/` and `server/`.

## Prerequisites

- Node.js 18 or later
- MySQL 8 or later, with a local account allowed to create the configured database

## Setup

1. Configure `server/.env` from `server/.env.example`. Set `DB_USER`, `DB_PASSWORD`, and `DB_NAME` for your local MySQL installation. `GEMINI_API_KEY` is optional: the application has a local template-based SAR generator when it is blank.
2. Install dependencies:

   ```powershell
   npm install --prefix client
   npm install --prefix server
   ```

3. Create the database tables:

   ```powershell
   npm run db:init
   ```

4. In separate terminals, run the API and React client:

   ```powershell
   npm run dev:server
   npm run dev:client
   ```

Open `http://localhost:5173`. The API runs at `http://localhost:5000`; Vite proxies `/api` requests to it.

## Application flow

- Create an individual case or upload the supplied customer JSON data.
- The Express API evaluates the case with the rules/ML engine, persists it to MySQL, and generates a SAR draft.
- Review, edit, download, and complete cases from the React UI. Draft and status changes are recorded in the MySQL audit trail.
