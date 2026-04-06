# Veluthugal Website 🏛️

A full-stack website for the Veluthugal temple team.

## Features
- 🔐 Admin & Member login with secure JWT authentication
- 🎉 Event management with photos, videos, and expense tracking
- 📅 Dual English + Tamil calendar with event markers
- 👥 Member directory with profile photos and family photos
- 📱 Fully responsive for mobile (vertical view)
- 🔒 Role-based access: Guest / Member / Admin

## Setup

### 1. Install Node.js
Download from https://nodejs.org (v18 or higher recommended)

### 2. Install dependencies
```bash
cd veluthugal-website
npm install
```

### 3. Add your logo
Place your team logo as `frontend/logo.png`

### 4. Start the server
```bash
npm start
```

Open http://localhost:3000 in your browser.

---

## Default Credentials

**Admin:**
- Username: `admin`
- Password: `admin123`

> ⚠️ Change the admin password immediately after first login via Admin Panel → Settings.

---

## Folder Structure

```
veluthugal-website/
├── frontend/         ← HTML, CSS, JavaScript (edit for UI changes)
├── backend/
│   ├── server.js     ← Main server entry point
│   └── routes/       ← API routes (auth, events, members)
├── database/
│   ├── init.js       ← DB schema creation
│   └── veluthugal.db ← SQLite database (auto-created on first run)
├── uploads/          ← Uploaded photos/videos (auto-created)
└── package.json
```

---

## How to Modify

### Change colors/theme
Edit `frontend/style.css` — all colors are CSS variables at the top:
```css
:root {
  --navy: #0d1b3e;
  --gold: #c8922a;
  --orange: #d4571e;
  ...
}
```

### Change port
Edit `backend/server.js`:
```js
const PORT = 3000; // change this
```

### Backup database
Copy `database/veluthugal.db` to a safe location regularly.

### Access on mobile (same WiFi)
Find your computer's IP (e.g. 192.168.1.5) and open:
`http://192.168.1.5:3000` on your phone.

---

## Role Access Summary

| Feature             | Guest | Member | Admin |
|---------------------|-------|--------|-------|
| View events         | ✅    | ✅     | ✅    |
| View event photos   | ✅    | ✅     | ✅    |
| View event expenses | ❌    | ✅     | ✅    |
| View members        | ✅*   | ✅     | ✅    |
| View family photos  | ❌    | ✅     | ✅    |
| Add/edit events     | ❌    | ❌     | ✅    |
| Manage members      | ❌    | ❌     | ✅    |
| Admin settings      | ❌    | ❌     | ✅    |

*Guests see only members marked Public by admin.
