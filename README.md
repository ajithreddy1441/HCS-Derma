# HCS DERMA CRM

Production-oriented CRM for employees, leads, customers, orders, payments, inventory, QR/unit tracking, Shiprocket, returns, reorders, targets, incentives, payroll, and reports.

## Stack

- Frontend: React, Vite, Tailwind CSS, React Router, Axios, Recharts
- Backend: Node.js, Express, JWT, bcrypt, Multer, mysql2
- Database: MySQL (phpMyAdmin compatible)

## Folders

```
frontend/     React app
backend/      Express API
database/     schema.sql
```

## Local development

### 1. Database

In phpMyAdmin: select your existing database first, then Import `database/schema.sql`.
The file does not create a database (Hostinger users cannot `CREATE DATABASE`).

### 2. Backend

```bash
cd backend
copy .env.example .env
npm install
npm run seed
npm run dev
```

API: `http://localhost:5000`

Demo logins (after seed):

| Role | Username | Password |
|---|---|---|
| Admin | admin | Admin@123 |
| Telecaller | telecaller | Tele@123 |
| Accountant | accountant | Acct@123 |

### 3. Frontend

```bash
cd frontend
copy .env.example .env
npm install
npm run dev
```

App: `http://localhost:5173`

Vite proxies `/api` and `/uploads` to the backend.

## Production (Hostinger Node.js)

The API serves the React build from `backend/public` (or `frontend/dist`). One Node process is enough.

### 1. Database

In phpMyAdmin, select `u611284906_xova`, then Import `database/schema.sql` (do not run `CREATE DATABASE`). From SSH, once:

```bash
cd backend
node scripts/seed.js
```

### 2. Backend env on the server

Copy `backend/.env.production.example` to `backend/.env` on Hostinger. **On the Node server use `DB_HOST=127.0.0.1`** (not `srv843.hstgr.io`). That remote host is only for your Windows PC.

Set:

- `NODE_ENV=production`
- `PORT` = the port Hostinger shows (or leave 5000 if they inject `PORT`)
- `JWT_SECRET` = a long random string (required; the app will not start with the default)
- `FRONTEND_URL` and `PUBLIC_APP_URL` = `https://yourdomain.com` (no trailing slash)
- Shiprocket email, password, `SHIPROCKET_PICKUP=work`

### 3. Build and start (SSH)

```bash
cd ~/path/to/nexus-crm
npm install --prefix frontend
npm install --prefix backend --omit=dev
npm run build --prefix frontend
node backend/scripts/prepare-production.js
cd backend
NODE_ENV=production node server.js
```

Or in hPanel **Node.js**:

- Application root: project folder
- Startup file: `backend/server.js`
- After each deploy, run the frontend build + `prepare-production.js` so `backend/public` has `index.html`

### 4. Check

- `https://yourdomain.com/api/health` → `{ success: true }`
- `https://yourdomain.com/` → login page
- Uploads stay in `backend/uploads`
- QR links use `PUBLIC_APP_URL/scan/<token>`

Do not commit `.env` or `backend/.env.production`. On Vercel the frontend must use `VITE_API_URL=https://hcs-derma-backend.vercel.app/api` (see `frontend/.env.production`). Same-origin `/api` is only for a single Hostinger Node process.

## Business rules (enforced)

- Telecallers cannot approve or modify approved payments.
- Inventory decreases only after payment approval / order confirmation.
- Returned stock is added only after `approved_for_inventory`.
- QR codes store a random token, not customer/payment data.
- Public `/scan/:token` hides mobile, address, UTR, screenshots, and employee data.
- One Shiprocket shipment per order.
- Confirmed (non-cancelled, paid) orders count toward sales targets.
- Audit logs cannot be deleted via the API.

## API docs

See `docs/API.md`.
