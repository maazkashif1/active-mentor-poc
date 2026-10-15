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
