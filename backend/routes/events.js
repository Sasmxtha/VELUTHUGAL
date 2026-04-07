// backend/routes/events.js
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { Event } = require('../../database/models');
const { createUploader, deleteFromCloudinary } = require('../../database/cloudinary');

const JWT_SECRET = process.env.JWT_SECRET || 'veluthugal_secret_2024';
const upload = createUploader('veluthugal/events');

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

function totalSpent(expenses) {
  return expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
}

// GET all events
router.get('/', async (req, res) => {
  try {
    const events = await Event.find().sort({ event_date: -1 });
    const result = events.map(e => {
      const obj = e.toObject();
      obj.id = obj._id;
      obj.cover_media = obj.media?.[0] || null;
      obj.total_spent = totalSpent(obj.expenses);
      return obj;
    });
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET single event
router.get('/:id', async (req, res) => {
  try {
    const user = getUser(req);
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ error: 'Event not found' });
    const obj = event.toObject();
    obj.id = obj._id;
    obj.total_spent = totalSpent(obj.expenses);
    if (!user) obj.expenses = [];
    res.json(obj);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST create event
router.post('/', requireAdmin, upload.array('media', 50), async (req, res) => {
  try {
    const { title_en, title_ta, description_en, description_ta, event_date, tamil_month, tamil_day, expenses } = req.body;
    if (!title_en || !event_date) return res.status(400).json({ error: 'Title and date required' });

    const media = (req.files || []).map((file, idx) => ({
      file_path: file.path,
      cloudinary_id: file.filename,
      file_type: file.mimetype?.startsWith('video') ? 'video' : 'photo',
      sort_order: idx
    }));

    const expList = expenses ? (typeof expenses === 'string' ? JSON.parse(expenses) : expenses) : [];

    const event = await Event.create({
      title_en, title_ta: title_ta || '',
      description_en: description_en || '', description_ta: description_ta || '',
      event_date, tamil_month: tamil_month || '', tamil_day: tamil_day || '',
      media,
      expenses: expList.filter(e => e.item).map(e => ({ item: e.item, amount: parseFloat(e.amount) || 0, category: e.category || '' }))
    });

    res.json({ message: 'Event created', id: event._id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT update event
router.put('/:id', requireAdmin, upload.array('media', 50), async (req, res) => {
  try {
    const { title_en, title_ta, description_en, description_ta, event_date, tamil_month, tamil_day, expenses } = req.body;
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ error: 'Event not found' });

    event.title_en = title_en;
    event.title_ta = title_ta || '';
    event.description_en = description_en || '';
    event.description_ta = description_ta || '';
    event.event_date = event_date;
    event.tamil_month = tamil_month || '';
    event.tamil_day = tamil_day || '';

    if (req.files?.length) {
      const newMedia = req.files.map((file, idx) => ({
        file_path: file.path,
        cloudinary_id: file.filename,
        file_type: file.mimetype?.startsWith('video') ? 'video' : 'photo',
        sort_order: 999 + idx
      }));
      event.media.push(...newMedia);
    }

    if (expenses) {
      const expList = typeof expenses === 'string' ? JSON.parse(expenses) : expenses;
      event.expenses = expList.filter(e => e.item).map(e => ({ item: e.item, amount: parseFloat(e.amount) || 0, category: e.category || '' }));
    }

    await event.save();
    res.json({ message: 'Event updated' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE event
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ error: 'Event not found' });
    for (const m of event.media) {
      const resType = m.file_type === 'video' ? 'video' : 'image';
      await deleteFromCloudinary(m.cloudinary_id, resType);
    }
    await event.deleteOne();
    res.json({ message: 'Event deleted' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE single media
router.delete('/:id/media/:mediaId', requireAdmin, async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ error: 'Event not found' });
    const mediaItem = event.media.id(req.params.mediaId);
    if (mediaItem) {
      const resType = mediaItem.file_type === 'video' ? 'video' : 'image';
      await deleteFromCloudinary(mediaItem.cloudinary_id, resType);
      mediaItem.deleteOne();
      await event.save();
    }
    res.json({ message: 'Media deleted' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
