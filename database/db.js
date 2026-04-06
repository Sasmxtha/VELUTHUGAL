// database/db.js - sql.js wrapper with file persistence
const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const DB_PATH = path.join(__dirname, 'veluthugal.db');
let _db = null;

async function getDB() {
  if (_db) return _db;
  const SQL = await initSqlJs();
  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    _db = new SQL.Database(fileBuffer);
  } else {
    _db = new SQL.Database();
  }
  setupSchema(_db);
  save();
  return _db;
}

function save() {
  if (!_db) return;
  const data = _db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

function setupSchema(db) {
  db.run(`
    CREATE TABLE IF NOT EXISTS admins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      created_at DATETIME DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      phone TEXT DEFAULT '',
      member_photo TEXT DEFAULT '',
      status TEXT DEFAULT 'pending',
      is_public INTEGER DEFAULT 0,
      bio TEXT DEFAULT '',
      created_at DATETIME DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS families (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      member_id INTEGER NOT NULL,
      family_photo TEXT DEFAULT '',
      description TEXT DEFAULT '',
      FOREIGN KEY (member_id) REFERENCES members(id)
    );
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title_en TEXT NOT NULL,
      title_ta TEXT DEFAULT '',
      description_en TEXT DEFAULT '',
      description_ta TEXT DEFAULT '',
      event_date DATE NOT NULL,
      tamil_month TEXT DEFAULT '',
      tamil_day TEXT DEFAULT '',
      created_at DATETIME DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS event_media (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id INTEGER NOT NULL,
      file_path TEXT NOT NULL,
      file_type TEXT NOT NULL,
      caption TEXT DEFAULT '',
      sort_order INTEGER DEFAULT 0,
      FOREIGN KEY (event_id) REFERENCES events(id)
    );
    CREATE TABLE IF NOT EXISTS event_expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id INTEGER NOT NULL,
      item TEXT NOT NULL,
      amount REAL NOT NULL,
      category TEXT DEFAULT '',
      FOREIGN KEY (event_id) REFERENCES events(id)
    );
    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      message TEXT NOT NULL,
      related_id INTEGER DEFAULT 0,
      is_read INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT (datetime('now'))
    );
  `);

  // Migration: add bio column if missing
  try { db.run('ALTER TABLE members ADD COLUMN bio TEXT DEFAULT \'\''); } catch(_) {}

  // Seed admin
  const rows = query(db, 'SELECT id FROM admins WHERE username = ?', ['admin']);
  if (rows.length === 0) {
    const hashed = bcrypt.hashSync('admin123', 10);
    run(db, 'INSERT INTO admins (username, password) VALUES (?, ?)', ['admin', hashed]);
    console.log('Default admin created: username=admin, password=admin123');
  }
}

// --- Helpers ---
function query(db, sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

function run(db, sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.run(params);
  stmt.free();
  // Get last insert id
  const [{ 'last_insert_rowid()': id }] = query(db, 'SELECT last_insert_rowid()');
  return { lastInsertRowid: id };
}

module.exports = { getDB, save, query, run };
