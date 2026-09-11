# HCS DERMA API

Base URL: `/api`

Auth header: `Authorization: Bearer <jwt>`

Success: `{ "success": true, "message": "...", "data": {} }`  
Error: `{ "success": false, "message": "..." }`

## Auth

- `POST /auth/login` `{ username, password }`
- `POST /auth/logout`
- `GET /auth/me`
- `POST /auth/forgot-password` `{ email }`
- `POST /auth/reset-password` `{ token, password }`

## Core

- Employees: `GET/POST /employees` `GET/PUT /employees/:id` `POST /employees/:id/reset-password` `GET /employees/roles` `PUT /employees/permissions`
- Customers: `GET/POST /customers` `GET/PUT/DELETE /customers/:id` `POST /customers/:id/notes`
- Leads: `GET/POST /leads` `GET/PUT /leads/:id` `POST /leads/:id/convert`
- Follow-ups: `GET /followups?section=today|upcoming|overdue|completed` `POST /followups` `PUT /followups/:id/complete`
- Products: `GET/POST /products` `GET/PUT /products/:id` `GET/POST /products/categories` `POST /products/units`
- Inventory: `GET /inventory` `GET /inventory/history` `POST /inventory/adjust`
- Orders: `GET/POST /orders` `GET /orders/:id` `PUT /orders/:id/status`
- Payments: `GET /payments` `POST /payments` (multipart `screenshot`) `GET /payments/queue` `POST /payments/:id/approve|reject|verify`
- QR: `POST /qr/generate` `POST /qr/bulk-generate` `GET /qr` `GET /qr/:token` `PUT/DELETE /qr/:id`
- Scan: `GET /scan/:value` (public safe payload without JWT; full payload with JWT)
- Shipments: `GET/POST /shipments` `GET /shipments/:id` `GET /shipments/:id/track` `PUT /shipments/:id/status`
- Returns: `GET/POST /returns` `GET /returns/:id` `PUT /returns/:id/status`
- Reorders: `GET /reorders` `GET /reorders/:id/prefill` `POST /reorders/:id/convert`
- Dashboard: `GET /dashboard/admin|telecaller|accountant` `GET /dashboard/my-target`
- Reports: `GET /reports/:type?range=today|yesterday|week|month|year&export=csv|xlsx`
- HR: `GET/POST /targets` `GET/POST /team-targets` `GET/PUT /incentive-rules` `POST /incentives/calculate` `GET /incentives` `GET/POST /payroll` `PUT /payroll/:id` `GET /performance`
- System: `GET /search?q=` `GET /notifications` `PUT /notifications/read-all` `GET /activity` `GET /audit` `GET/PUT /settings`

Report types: `sales`, `orders`, `customers`, `leads`, `followups`, `payments`, `payment-mismatch`, `inventory`, `low-stock`, `delivery`, `returns`, `reorders`, `employees`, `targets`, `performance`, `payroll`.
