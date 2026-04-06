// backend/routes/auth.js
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getDB, save, query, run } = require('../../database/db');

const JWT_SECRET = process.env.JWT_SECRET || 'veluthugal_secret_2024';

function verifyAdmin(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
    req.user = decoded;
    next();
  } catch { res.status(401).json({ error: 'Invalid token' }); }
}

router.post('/admin/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const db = await getDB();
    const rows = query(db, 'SELECT * FROM admins WHERE username = ?', [username]);
    if (!rows.length || !bcrypt.compareSync(password, rows[0].password))
      return res.status(401).json({ error: 'Invalid credentials' });
    const token = jwt.sign({ id: rows[0].id, role: 'admin', username: rows[0].username }, JWT_SECRET, { expiresIn: '24h' });
    res.json({ token, role: 'admin', username: rows[0].username });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/member/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const db = await getDB();
    const rows = query(db, 'SELECT * FROM members WHERE email = ?', [email]);
    if (!rows.length) return res.status(401).json({ error: 'Invalid credentials' });
    const member = rows[0];
    if (!bcrypt.compareSync(password, member.password)) return res.status(401).json({ error: 'Invalid credentials' });
    if (member.status === 'pending') return res.status(403).json({ error: 'Your account is pending admin approval' });
    if (member.status === 'rejected') return res.status(403).json({ error: 'Your account has been rejected' });
    const token = jwt.sign({ id: member.id, role: 'member', name: member.name }, JWT_SECRET, { expiresIn: '24h' });
    res.json({ token, role: 'member', name: member.name, photo: member.member_photo });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/member/register', async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: 'Name, email and password are required' });
    const db = await getDB();
    const existing = query(db, 'SELECT id FROM members WHERE email = ?', [email]);
    if (existing.length) return res.status(409).json({ error: 'Email already registered' });
    const hashed = bcrypt.hashSync(password, 10);
    const result = run(db, 'INSERT INTO members (name, email, password, phone) VALUES (?, ?, ?, ?)', [name, email, hashed, phone || '']);
    run(db, 'INSERT INTO notifications (type, message, related_id) VALUES (?, ?, ?)', ['member_register', `New member registration: ${name} (${email})`, result.lastInsertRowid]);
    save();
    res.json({ message: 'Registration successful. Awaiting admin approval.' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/admin/change-password', verifyAdmin, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const db = await getDB();
    const rows = query(db, 'SELECT * FROM admins WHERE id = ?', [req.user.id]);
    if (!rows.length || !bcrypt.compareSync(currentPassword, rows[0].password))
      return res.status(401).json({ error: 'Current password incorrect' });
    run(db, 'UPDATE admins SET password = ? WHERE id = ?', [bcrypt.hashSync(newPassword, 10), req.user.id]);
    save();
    res.json({ message: 'Password changed successfully' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/admin/members/passwords', verifyAdmin, async (req, res) => {
  try {
    const db = await getDB();
    const members = query(db, 'SELECT id, name, email FROM members ORDER BY name');
    res.json(members);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/admin/members/:id/reset-password', verifyAdmin, async (req, res) => {
  try {
    const { newPassword } = req.body;
    if (!newPassword) return res.status(400).json({ error: 'New password required' });
    const db = await getDB();
    run(db, 'UPDATE members SET password = ? WHERE id = ?', [bcrypt.hashSync(newPassword, 10), parseInt(req.params.id)]);
    save();
    res.json({ message: 'Member password reset successfully' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
