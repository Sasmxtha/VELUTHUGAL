// database/models.js - Mongoose schemas
const mongoose = require('mongoose');
const { Schema } = mongoose;

const AdminSchema = new Schema({
  username: { type: String, unique: true, required: true },
  password: { type: String, required: true },
  created_at: { type: Date, default: Date.now }
});

const FamilySchema = new Schema({
  family_photo: { type: String, default: '' },
  cloudinary_id: { type: String, default: '' },
  description: { type: String, default: '' }
});

const MemberSchema = new Schema({
  name: { type: String, required: true },
  email: { type: String, unique: true, required: true },
  password: { type: String, required: true },
  phone: { type: String, default: '' },
  member_photo: { type: String, default: '' },
  member_photo_cloudinary_id: { type: String, default: '' },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  is_public: { type: Boolean, default: false },
  bio: { type: String, default: '' },
  family: [FamilySchema],
  created_at: { type: Date, default: Date.now }
});

const EventMediaSchema = new Schema({
  file_path: { type: String, required: true },
  cloudinary_id: { type: String, default: '' },
  file_type: { type: String, enum: ['photo', 'video'], required: true },
  caption: { type: String, default: '' },
  sort_order: { type: Number, default: 0 }
});

const EventExpenseSchema = new Schema({
  item: { type: String, required: true },
  amount: { type: Number, default: 0 },
  category: { type: String, default: '' }
});

const EventSchema = new Schema({
  title_en: { type: String, required: true },
  title_ta: { type: String, default: '' },
  description_en: { type: String, default: '' },
  description_ta: { type: String, default: '' },
  event_date: { type: Date, required: true },
  tamil_month: { type: String, default: '' },
  tamil_day: { type: String, default: '' },
  media: [EventMediaSchema],
  expenses: [EventExpenseSchema],
  created_at: { type: Date, default: Date.now }
});

const NotificationSchema = new Schema({
  type: { type: String, required: true },
  message: { type: String, required: true },
  related_id: { type: Schema.Types.ObjectId, default: null },
  is_read: { type: Boolean, default: false },
  created_at: { type: Date, default: Date.now }
});

module.exports = {
  Admin: mongoose.model('Admin', AdminSchema),
  Member: mongoose.model('Member', MemberSchema),
  Event: mongoose.model('Event', EventSchema),
  Notification: mongoose.model('Notification', NotificationSchema)
};
