// backend/routes/events.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const { getDB, save, query, run } = require('../../database/db');

const JWT_SECRET = process.env.JWT_SECRET || 'veluthugal_secret_2024';

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const type = file.mimetype.startsWith('video') ? 'eventVideos' : 'eventPhotos';
    const dir = path.join(__dirname, '../../uploads', type);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_'));
  }
});
const upload = multer({ storage, limits: { fileSize: 100 * 1024 * 1024 } });

function getUser(req) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return null;
  try { return jwt.verify(token, JWT_SECRET); } catch { return null; }
}
function requireAdmin(req, res, next) {
  const u = getUser(req);
  if (!u || u.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  req.user = u; next();
}

// GET all events
router.get('/', async (req, res) => {
  try {
    const db = await getDB();
    const events = query(db, 'SELECT * FROM events ORDER BY event_date DESC');
    const result = events.map(e => {
      const media = query(db, 'SELECT * FROM event_media WHERE event_id = ? ORDER BY sort_order ASC LIMIT 1', [e.id]);
      const totRows = query(db, 'SELECT SUM(amount) as total FROM event_expenses WHERE event_id = ?', [e.id]);
      return { ...e, cover_media: media[0] || null, total_spent: totRows[0]?.total || 0 };
    });
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET single event
router.get('/:id', async (req, res) => {
  try {
    const db = await getDB();
    const user = getUser(req);
    const rows = query(db, 'SELECT * FROM events WHERE id = ?', [parseInt(req.params.id)]);
    if (!rows.length) return res.status(404).json({ error: 'Event not found' });
    const e = rows[0];
    const media = query(db, 'SELECT * FROM event_media WHERE event_id = ? ORDER BY sort_order ASC', [e.id]);
    const expenses = user ? query(db, 'SELECT * FROM event_expenses WHERE event_id = ?', [e.id]) : [];
    const totRows = user ? query(db, 'SELECT SUM(amount) as total FROM event_expenses WHERE event_id = ?', [e.id]) : [{ total: 0 }];
    res.json({ ...e, media, expenses, total_spent: totRows[0]?.total || 0 });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST create event
router.post('/', requireAdmin, upload.array('media', 50), async (req, res) => {
  try {
    const { title_en, title_ta, description_en, description_ta, event_date, tamil_month, tamil_day, expenses } = req.body;
    if (!title_en || !event_date) return res.status(400).json({ error: 'Title and date required' });
    const db = await getDB();
    const result = run(db,
      'INSERT INTO events (title_en, title_ta, description_en, description_ta, event_date, tamil_month, tamil_day) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [title_en, title_ta || '', description_en || '', description_ta || '', event_date, tamil_month || '', tamil_day || '']
    );
    const eventId = result.lastInsertRowid;
    if (req.files?.length) {
      req.files.forEach((file, idx) => {
        const type = file.mimetype.startsWith('video') ? 'video' : 'photo';
        const subdir = type === 'video' ? 'eventVideos' : 'eventPhotos';
        run(db, 'INSERT INTO event_media (event_id, file_path, file_type, sort_order) VALUES (?, ?, ?, ?)',
          [eventId, `/uploads/${subdir}/${file.filename}`, type, idx]);
      });
    }
    if (expenses) {
      const expList = typeof expenses === 'string' ? JSON.parse(expenses) : expenses;
      expList.forEach(exp => {
        if (exp.item) run(db, 'INSERT INTO event_expenses (event_id, item, amount, category) VALUES (?, ?, ?, ?)',
          [eventId, exp.item, parseFloat(exp.amount) || 0, exp.category || '']);
      });
    }
    save();
    res.json({ message: 'Event created', id: eventId });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT update event
router.put('/:id', requireAdmin, upload.array('media', 50), async (req, res) => {
  try {
    const { title_en, title_ta, description_en, description_ta, event_date, tamil_month, tamil_day, expenses } = req.body;
    const id = parseInt(req.params.id);
    const db = await getDB();
    run(db, 'UPDATE events SET title_en=?, title_ta=?, description_en=?, description_ta=?, event_date=?, tamil_month=?, tamil_day=? WHERE id=?',
      [title_en, title_ta || '', description_en || '', description_ta || '', event_date, tamil_month || '', tamil_day || '', id]);
    if (req.files?.length) {
      req.files.forEach((file, idx) => {
        const type = file.mimetype.startsWith('video') ? 'video' : 'photo';
        const subdir = type === 'video' ? 'eventVideos' : 'eventPhotos';
        run(db, 'INSERT INTO event_media (event_id, file_path, file_type, sort_order) VALUES (?, ?, ?, ?)',
          [id, `/uploads/${subdir}/${file.filename}`, type, 999 + idx]);
      });
    }
    if (expenses) {
      const expList = typeof expenses === 'string' ? JSON.parse(expenses) : expenses;
      run(db, 'DELETE FROM event_expenses WHERE event_id = ?', [id]);
      expList.forEach(exp => {
        if (exp.item) run(db, 'INSERT INTO event_expenses (event_id, item, amount, category) VALUES (?, ?, ?, ?)',
          [id, exp.item, parseFloat(exp.amount) || 0, exp.category || '']);
      });
    }
    save();
    res.json({ message: 'Event updated' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE event
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const db = await getDB();
    const media = query(db, 'SELECT * FROM event_media WHERE event_id = ?', [id]);
    media.forEach(m => {
      const fullPath = path.join(__dirname, '../..', m.file_path);
      if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
    });
    run(db, 'DELETE FROM event_media WHERE event_id = ?', [id]);
    run(db, 'DELETE FROM event_expenses WHERE event_id = ?', [id]);
    run(db, 'DELETE FROM events WHERE id = ?', [id]);
    save();
    res.json({ message: 'Event deleted' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE single media
router.delete('/:id/media/:mediaId', requireAdmin, async (req, res) => {
  try {
    const db = await getDB();
    const rows = query(db, 'SELECT * FROM event_media WHERE id = ? AND event_id = ?', [parseInt(req.params.mediaId), parseInt(req.params.id)]);
    if (rows.length) {
      const fullPath = path.join(__dirname, '../..', rows[0].file_path);
      if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
      run(db, 'DELETE FROM event_media WHERE id = ?', [parseInt(req.params.mediaId)]);
      save();
    }
    res.json({ message: 'Media deleted' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
