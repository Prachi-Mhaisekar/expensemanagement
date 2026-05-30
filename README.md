# Expense Management

Simple expense tracker with login, expense CRUD, and a category pie chart.

## Project structure

| Folder | Purpose |
|--------|---------|
| `backend/` | API, database, login (JWT) — not exposed directly |
| `frontend/` | HTML, CSS, JavaScript — served to the browser |

## Run

```bash
npm install
npm start
```

Open **http://localhost:3000**

> Do not open HTML files directly in the browser. Always use the URL above so the API works.

## Use the app

1. **Sign up** with email and password (min 6 characters)
2. **Add expenses** — category, amount, optional comments
3. **View table** — sorted by newest first
4. **Edit / Delete** — buttons on each row
5. **Pie Chart** — category breakdown (no internet needed)

## Commands

| Command | Description |
|---------|-------------|
| `npm start` | Start the app |
| `npm run dev` | Start with auto-restart on code changes |

## Clear all data

Delete the database file and restart:

```bash
rm -f backend/expenses.db
npm start
```

Then log out in the browser (or clear site data for localhost).
