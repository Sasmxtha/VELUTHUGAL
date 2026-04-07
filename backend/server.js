// backend/server.js
require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const { connectDB } = require('../database/db');
const { Admin } = require('../database/models');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/events', require('./routes/events'));
app.use('/api/members', require('./routes/members'));
app.use('/api/content', require('./routes/content'));

// Serve frontend
app.use(express.static(path.join(__dirname, '../frontend')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

async function seedAdmin() {
  const count = await Admin.countDocuments();
  if (count === 0) {
    await Admin.create({ username: 'admin', password: bcrypt.hashSync('admin123', 10) });
    console.log('   Default admin created: username=admin, password=admin123');
  }
}

connectDB()
  .then(seedAdmin)
  .then(() => {
    app.listen(PORT, () => {
      console.log(`\n✅ Veluthugal Website running at http://localhost:${PORT}\n`);
    });
  })
  .catch(err => {
    console.error('❌ Failed to connect to MongoDB:', err.message);
    process.exit(1);
  });
