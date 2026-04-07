// backend/routes/auth.js
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Admin, Member, Notification } = require('../../database/models');

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
    const admin = await Admin.findOne({ username });
    if (!admin || !bcrypt.compareSync(password, admin.password))
      return res.status(401).json({ error: 'Invalid credentials' });
    const token = jwt.sign({ id: admin._id, role: 'admin', username: admin.username }, JWT_SECRET, { expiresIn: '24h' });
    res.json({ token, role: 'admin', username: admin.username });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/member/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const member = await Member.findOne({ email });
    if (!member || !bcrypt.compareSync(password, member.password))
      return res.status(401).json({ error: 'Invalid credentials' });
    if (member.status === 'pending') return res.status(403).json({ error: 'Your account is pending admin approval' });
    if (member.status === 'rejected') return res.status(403).json({ error: 'Your account has been rejected' });
    const token = jwt.sign({ id: member._id, role: 'member', name: member.name }, JWT_SECRET, { expiresIn: '24h' });
    res.json({ token, role: 'member', name: member.name, photo: member.member_photo });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/member/register', async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: 'Name, email and password are required' });
    const existing = await Member.findOne({ email });
    if (existing) return res.status(409).json({ error: 'Email already registered' });
    const hashed = bcrypt.hashSync(password, 10);
    const member = await Member.create({ name, email, password: hashed, phone: phone || '' });
    await Notification.create({ type: 'member_register', message: `New member registration: ${name} (${email})`, related_id: member._id });
    res.json({ message: 'Registration successful. Awaiting admin approval.' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/admin/change-password', verifyAdmin, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const admin = await Admin.findById(req.user.id);
    if (!admin || !bcrypt.compareSync(currentPassword, admin.password))
      return res.status(401).json({ error: 'Current password incorrect' });
    admin.password = bcrypt.hashSync(newPassword, 10);
    await admin.save();
    res.json({ message: 'Password changed successfully' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/admin/members/passwords', verifyAdmin, async (req, res) => {
  try {
    const members = await Member.find({}, 'name email').sort({ name: 1 });
    res.json(members.map(m => ({ id: m._id, name: m.name, email: m.email })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/admin/members/:id/reset-password', verifyAdmin, async (req, res) => {
  try {
    const { newPassword } = req.body;
    if (!newPassword) return res.status(400).json({ error: 'New password required' });
    await Member.findByIdAndUpdate(req.params.id, { password: bcrypt.hashSync(newPassword, 10) });
    res.json({ message: 'Member password reset successfully' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
