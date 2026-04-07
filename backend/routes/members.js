// backend/routes/members.js
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { Member, Notification } = require('../../database/models');
const { createUploader, deleteFromCloudinary } = require('../../database/cloudinary');

const JWT_SECRET = process.env.JWT_SECRET || 'veluthugal_secret_2024';
const upload = createUploader('veluthugal/members');

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

function formatMember(m, full = false) {
  const obj = m.toObject ? m.toObject() : m;
  obj.id = obj._id;
  if (!full) {
    delete obj.password;
    delete obj.member_photo_cloudinary_id;
    obj.family = (obj.family || []).map(f => ({ ...f, id: f._id }));
  }
  return obj;
}

// GET members (role-filtered)
router.get('/', async (req, res) => {
  try {
    const user = getUser(req);
    let members;
    if (user && (user.role === 'admin' || user.role === 'member')) {
      members = await Member.find({ status: 'approved' }, '-password').sort({ name: 1 });
    } else {
      members = await Member.find({ status: 'approved', is_public: true }, 'name member_photo is_public bio family').sort({ name: 1 });
    }
    res.json(members.map(m => formatMember(m)));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET pending members
router.get('/pending', requireAdmin, async (req, res) => {
  try {
    const members = await Member.find({ status: 'pending' }, 'name email phone created_at').sort({ created_at: -1 });
    res.json(members.map(m => ({ id: m._id, name: m.name, email: m.email, phone: m.phone, created_at: m.created_at })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET all members (admin)
router.get('/all', requireAdmin, async (req, res) => {
  try {
    const members = await Member.find({}, '-password').sort({ name: 1 });
    res.json(members.map(m => formatMember(m)));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET notifications
router.get('/notifications', requireAdmin, async (req, res) => {
  try {
    const notes = await Notification.find().sort({ created_at: -1 }).limit(50);
    res.json(notes.map(n => ({ ...n.toObject(), id: n._id })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST approve/reject
router.post('/:id/status', requireAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    if (!['approved', 'rejected'].includes(status)) return res.status(400).json({ error: 'Invalid status' });
    await Member.findByIdAndUpdate(req.params.id, { status });
    await Notification.updateMany({ related_id: req.params.id, type: 'member_register' }, { is_read: true });
    res.json({ message: `Member ${status}` });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST toggle public
router.post('/:id/toggle-public', requireAdmin, async (req, res) => {
  try {
    const member = await Member.findById(req.params.id);
    if (!member) return res.status(404).json({ error: 'Not found' });
    member.is_public = !member.is_public;
    await member.save();
    res.json({ is_public: member.is_public });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PATCH update member bio
router.patch('/:id/bio', requireAdmin, async (req, res) => {
  try {
    await Member.findByIdAndUpdate(req.params.id, { bio: req.body.bio || '' });
    res.json({ message: 'Bio updated' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST upload member photo
router.post('/:id/photo', requireAdmin, upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file' });
    const member = await Member.findById(req.params.id);
    if (!member) return res.status(404).json({ error: 'Not found' });
    if (member.member_photo_cloudinary_id)
      await deleteFromCloudinary(member.member_photo_cloudinary_id, 'image');
    member.member_photo = req.file.path;
    member.member_photo_cloudinary_id = req.file.filename;
    await member.save();
    res.json({ photo: member.member_photo });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST add family photo
router.post('/:id/family-photo', requireAdmin, upload.single('photo'), async (req, res) => {
  try {
    const member = await Member.findById(req.params.id);
    if (!member) return res.status(404).json({ error: 'Not found' });
    const entry = {
      family_photo: req.file ? req.file.path : '',
      cloudinary_id: req.file ? req.file.filename : '',
      description: req.body.description || ''
    };
    member.family.push(entry);
    await member.save();
    const added = member.family[member.family.length - 1];
    res.json({ id: added._id, family_photo: added.family_photo, description: added.description });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE family photo
router.delete('/:id/family-photo/:fid', requireAdmin, async (req, res) => {
  try {
    const member = await Member.findById(req.params.id);
    if (!member) return res.status(404).json({ error: 'Not found' });
    const entry = member.family.id(req.params.fid);
    if (entry) {
      await deleteFromCloudinary(entry.cloudinary_id, 'image');
      entry.deleteOne();
      await member.save();
    }
    res.json({ message: 'Deleted' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE member
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const { confirmed } = req.query;
    if (confirmed !== 'true') return res.status(400).json({ error: 'Confirmation required', requireConfirm: true });
    const member = await Member.findById(req.params.id);
    if (!member) return res.status(404).json({ error: 'Not found' });
    if (member.member_photo_cloudinary_id)
      await deleteFromCloudinary(member.member_photo_cloudinary_id, 'image');
    for (const f of member.family) {
      if (f.cloudinary_id) await deleteFromCloudinary(f.cloudinary_id, 'image');
    }
    await member.deleteOne();
    res.json({ message: 'Member removed' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST mark notification read
router.post('/notifications/:id/read', requireAdmin, async (req, res) => {
  try {
    await Notification.findByIdAndUpdate(req.params.id, { is_read: true });
    res.json({ message: 'Marked read' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
