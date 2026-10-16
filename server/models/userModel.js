const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['patient', 'physiologist'], default: 'patient' },
  // physiologist only
  availability: [{
    date: String,
    time: String,
    isBooked: { type: Boolean, default: false },
  }],
  schedule: {
    workDays:   [String],
    startTime:  String,
    endTime:    String,
    breakStart: String,
    breakEnd:   String,
    duration:   Number,
  },
  specialty: { type: String, default: '' },
  photo: { type: String, default: '' },
  bio: { type: String, default: '' },
  yearsExperience: { type: Number },
  education: [{
    degree: String,
    institution: String,
    year: String,
  }],
  clinics: [{
    name: String,
    branch: String,
    address: String,
    city: { type: String, default: '' },
    placeId: { type: String, default: '' },
    logoKey: { type: String, default: '' }, // curated catalog key, e.g. aga_khan
    photoName: { type: String, default: '' }, // Places photo resource name
    photoUrl: { type: String, default: '' }, // cached CDN uri (may expire; prefer photoName)
    mapUrl: { type: String, default: '' }, // optional Static Maps preview
    lat: { type: Number, default: null },
    lng: { type: Number, default: null },
    source: { type: String, enum: ['curated', 'places', 'manual', ''], default: '' },
  }],
  // patient onboarding data
  firstName: { type: String, default: '' },
  dob: { type: String, default: '' },
  city: { type: String, default: '' },
  careArea: { type: String, default: '' },
  side: { type: String, default: '' },
  onboardingAnswers: { type: [String], default: [] },
  googleTokens: {
    accessToken: String,
    refreshToken: String,
    expiryDate: Number,
  },
}, { timestamps: true });

userSchema.pre('save', async function () {
  if (this.isModified('password')) {
    this.password = await bcrypt.hash(this.password, 10);
  }
});

userSchema.methods.comparePassword = function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

module.exports = mongoose.model('User', userSchema);
