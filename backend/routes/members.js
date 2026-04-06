// backend/routes/members.js
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
    const dir = path.join(__dirname, '../../uploads/memberPhotos');
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_'));
  }
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

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

// GET members (role-filtered)
router.get('/', async (req, res) => {
  try {
    const db = await getDB();
    const user = getUser(req);
    let members;
    if (user && (user.role === 'admin' || user.role === 'member')) {
      members = query(db, 'SELECT id, name, email, phone, member_photo, status, is_public, bio, created_at FROM members WHERE status = "approved" ORDER BY name');
      members = members.map(m => {
        const family = query(db, 'SELECT id, family_photo, description FROM families WHERE member_id = ?', [m.id]);
        return { ...m, family };
      });
    } else {
      members = query(db, 'SELECT id, name, member_photo, is_public, bio FROM members WHERE status = "approved" AND is_public = 1 ORDER BY name');
    }
    res.json(members);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET pending members
router.get('/pending', requireAdmin, async (req, res) => {
  try {
    const db = await getDB();
    res.json(query(db, 'SELECT id, name, email, phone, created_at FROM members WHERE status = "pending" ORDER BY created_at DESC'));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET all members (admin)
router.get('/all', requireAdmin, async (req, res) => {
  try {
    const db = await getDB();
    res.json(query(db, 'SELECT id, name, email, phone, member_photo, status, is_public, bio, created_at FROM members ORDER BY name'));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET notifications
router.get('/notifications', requireAdmin, async (req, res) => {
  try {
    const db = await getDB();
    res.json(query(db, 'SELECT * FROM notifications ORDER BY created_at DESC LIMIT 50'));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST approve/reject
router.post('/:id/status', requireAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    if (!['approved', 'rejected'].includes(status)) return res.status(400).json({ error: 'Invalid status' });
    const db = await getDB();
    run(db, 'UPDATE members SET status = ? WHERE id = ?', [status, parseInt(req.params.id)]);
    run(db, 'UPDATE notifications SET is_read = 1 WHERE related_id = ? AND type = "member_register"', [parseInt(req.params.id)]);
    save();
    res.json({ message: `Member ${status}` });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST toggle public
router.post('/:id/toggle-public', requireAdmin, async (req, res) => {
  try {
    const db = await getDB();
    const id = parseInt(req.params.id);
    const rows = query(db, 'SELECT is_public FROM members WHERE id = ?', [id]);
    const newVal = rows[0]?.is_public ? 0 : 1;
    run(db, 'UPDATE members SET is_public = ? WHERE id = ?', [newVal, id]);
    save();
    res.json({ is_public: newVal });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PATCH update member bio
router.patch('/:id/bio', requireAdmin, async (req, res) => {
  try {
    const { bio } = req.body;
    const db = await getDB();
    run(db, 'UPDATE members SET bio = ? WHERE id = ?', [bio || '', parseInt(req.params.id)]);
    save();
    res.json({ message: 'Bio updated' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST upload member photo
router.post('/:id/photo', requireAdmin, upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file' });
    const db = await getDB();
    const filePath = `/uploads/memberPhotos/${req.file.filename}`;
    run(db, 'UPDATE members SET member_photo = ? WHERE id = ?', [filePath, parseInt(req.params.id)]);
    save();
    res.json({ photo: filePath });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST add family photo
router.post('/:id/family-photo', requireAdmin, upload.single('photo'), async (req, res) => {
  try {
    const db = await getDB();
    const filePath = req.file ? `/uploads/memberPhotos/${req.file.filename}` : '';
    const result = run(db, 'INSERT INTO families (member_id, family_photo, description) VALUES (?, ?, ?)',
      [parseInt(req.params.id), filePath, req.body.description || '']);
    save();
    res.json({ id: result.lastInsertRowid, family_photo: filePath });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE family photo
router.delete('/:id/family-photo/:fid', requireAdmin, async (req, res) => {
  try {
    const db = await getDB();
    const rows = query(db, 'SELECT * FROM families WHERE id = ? AND member_id = ?', [parseInt(req.params.fid), parseInt(req.params.id)]);
    if (rows.length && rows[0].family_photo) {
      const fullPath = path.join(__dirname, '../..', rows[0].family_photo);
      if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
    }
    run(db, 'DELETE FROM families WHERE id = ?', [parseInt(req.params.fid)]);
    save();
    res.json({ message: 'Deleted' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE member
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const { confirmed } = req.query;
    if (confirmed !== 'true') return res.status(400).json({ error: 'Confirmation required', requireConfirm: true });
    const db = await getDB();
    const id = parseInt(req.params.id);
    const rows = query(db, 'SELECT * FROM members WHERE id = ?', [id]);
    if (rows.length && rows[0].member_photo) {
      const fullPath = path.join(__dirname, '../..', rows[0].member_photo);
      if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
    }
    run(db, 'DELETE FROM families WHERE member_id = ?', [id]);
    run(db, 'DELETE FROM members WHERE id = ?', [id]);
    save();
    res.json({ message: 'Member removed' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST mark notification read
router.post('/notifications/:id/read', requireAdmin, async (req, res) => {
  try {
    const db = await getDB();
    run(db, 'UPDATE notifications SET is_read = 1 WHERE id = ?', [parseInt(req.params.id)]);
    save();
    res.json({ message: 'Marked read' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
