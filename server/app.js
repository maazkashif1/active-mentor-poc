const express = require('express');
const cors = require('cors');

const userRoutes = require('./api/userRoutes');
const physiologistRoutes = require('./api/physiologistRoutes');
const sessionRoutes = require('./api/sessionRoutes');
const prescriptionRoutes = require('./api/prescriptionRoutes');
const resultRoutes = require('./api/resultRoutes');
const googleRoutes = require('./api/googleRoutes');
const webhookRoutes = require('./api/webhookRoutes');
const otpRoutes = require('./api/otpRoutes');
const patientRoutes = require('./api/patientRoutes');
const uploadRoutes = require('./api/uploadRoutes');
const chatRoutes = require('./api/chatRoutes');
const placesRoutes = require('./api/placesRoutes');

const app = express();

app.use(cors());

app.get('/healthz', (req, res) => res.sendStatus(200));

// Webhook routes need raw body for Svix signature verification — bypass express.json()
app.use((req, res, next) => {
  if (req.path.startsWith('/api/webhook')) return next();
  express.json()(req, res, next);
});

app.use('/api/auth', userRoutes);
app.use('/api/users', userRoutes); // portal uses /api/users/* alias
app.use('/api/auth', googleRoutes);
app.use('/api/physiologist', physiologistRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/prescriptions', prescriptionRoutes);
app.use('/api/results', resultRoutes);
app.use('/api/webhook', webhookRoutes);
app.use('/api/auth', otpRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/places', placesRoutes);

module.exports = app;
