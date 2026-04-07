// database/db.js - MongoDB connection via Mongoose
const mongoose = require('mongoose');

let connected = false;

async function connectDB() {
  if (connected) return;
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI not set in environment variables');
  await mongoose.connect(uri);
  connected = true;
  console.log('✅ Connected to MongoDB');
}

module.exports = { connectDB };
