const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'veluthugal_secret_2024';
const contentPath = path.join(__dirname, '../../database/content.json');

const defaultContent = {
  hero_desc: "A team of devoted young uncles who organize and celebrate the glory of our temple",
  cta_title: "Let's find more that brings us together.",
  cta_desc: "Veluthugal connects our community through sacred festivals, shared memories, and cherished traditions. Discover events, meet members, and celebrate together."
};

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

router.get('/', (req, res) => {
  try {
    if (!fs.existsSync(contentPath)) return res.json(defaultContent);
    const data = JSON.parse(fs.readFileSync(contentPath, 'utf8'));
    res.json({ ...defaultContent, ...data });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', requireAdmin, (req, res) => {
  try {
    const current = fs.existsSync(contentPath) ? JSON.parse(fs.readFileSync(contentPath, 'utf8')) : {};
    const newData = { ...current, ...req.body };
    fs.writeFileSync(contentPath, JSON.stringify(newData, null, 2));
    res.json({ message: 'Content updated successfully' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
