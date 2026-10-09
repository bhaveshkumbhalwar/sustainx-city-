require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const mongoose = require('mongoose');
const rateLimit = require('./utils/rateLimit');
const ApiError = require('./utils/ApiError');

// Route imports
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const complaintRoutes = require('./routes/complaintRoutes');
const rewardRoutes = require('./routes/rewardRoutes');
const statsRoutes = require('./routes/statsRoutes');
const storeRoutes = require('./routes/storeRoutes');
const orderRoutes = require('./routes/orderRoutes');
const iotRoutes = require('./routes/iotRoutes');
const deviceRoutes = require('./routes/deviceRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const localityRoutes = require('./routes/localityRoutes');
const binRoutes = require('./routes/binRoutes');
const vehicleRoutes = require('./routes/vehicleRoutes');
const taskRoutes = require('./routes/taskRoutes');
const routeRoutes = require('./routes/routeRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');
const aiRoutes = require('./routes/aiRoutes');
const gisRoutes = require('./routes/gisRoutes');
const auditRoutes = require('./routes/auditRoutes');

const app = express();

// ✅ CORS
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)
  .concat([
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:5173',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:3001',
    'http://127.0.0.1:5173',
    'https://sustainx-frontend-7xw0.onrender.com',
  ]);

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  })
);

// ✅ Request logging (method, path, status, duration — never bodies)
app.use((req, res, next) => {
  const start = process.hrtime.bigint();
  res.on('finish', () => {
    const ms = Number(process.hrtime.bigint() - start) / 1e6;
    console.log(`${req.method} ${req.originalUrl} ${res.statusCode} ${ms.toFixed(1)}ms`);
  });
  next();
});

// ✅ Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ✅ Rate limits on sensitive/public endpoints
app.use('/api/auth/login', rateLimit({ windowMs: 5 * 60 * 1000, max: 20 }));
app.use('/api/auth/register', rateLimit({ windowMs: 60 * 60 * 1000, max: 20 }));
app.use('/api/iot/data', rateLimit({ windowMs: 60 * 1000, max: 120 }));
app.use('/api/gis', rateLimit({ windowMs: 60 * 1000, max: 300 }));
app.use('/api/analytics', rateLimit({ windowMs: 60 * 1000, max: 120 }));
app.use('/api/store/redeem', rateLimit({ windowMs: 60 * 1000, max: 20 }));
app.use('/api/routes/plan', rateLimit({ windowMs: 60 * 1000, max: 30 }));
app.use('/api/routes/preview', rateLimit({ windowMs: 60 * 1000, max: 30 }));

// ✅ Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ✅ Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/complaints', complaintRoutes);
app.use('/api/rewards', rewardRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/store', storeRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/iot', iotRoutes);
app.use('/api/devices', deviceRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/localities', localityRoutes);
app.use('/api/bins', binRoutes);
app.use('/api/vehicles', vehicleRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/routes', routeRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/gis', gisRoutes);
app.use('/api/audit', auditRoutes);

// ✅ Root route (Render health check)
app.get('/', (req, res) => {
  res.send('SustainX Backend Running Successfully');
});

app.get('/api', (req, res) => {
  res.send('SustainX API is running successfully...');
});

// ✅ Health check
app.get('/api/health', (req, res) => {
  const cloudinary = require('./config/cloudinary');
  const cfg = cloudinary.config();
  res.json({
    status: 'OK',
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    timestamp: new Date().toISOString(),
    cloudinary: {
      configured: !!(cfg.cloud_name && cfg.api_key && cfg.api_secret),
      cloud_name: cfg.cloud_name || 'MISSING',
      api_key: cfg.api_key ? '***' + cfg.api_key.slice(-4) : 'MISSING',
      api_secret: cfg.api_secret ? '***' + cfg.api_secret.slice(-4) : 'MISSING',
    },
  });
});

// ✅ DB health
app.get('/api/health/db', (req, res) => {
  const ready = mongoose.connection.readyState === 1;
  res.status(ready ? 200 : 503).json({
    status: ready ? 'OK' : 'DEGRADED',
    dbConnected: ready,
    mongooseState: mongoose.connection.readyState,
  });
});

// ✅ 404 for unknown API routes
app.use('/api', (req, res) => {
  res.status(404).json({ message: 'API route not found' });
});

// ✅ Global error handler
app.use((err, req, res, next) => {
  if (err.isOperational) {
    return res.status(err.statusCode).json({ message: err.message, ...(err.details ? { details: err.details } : {}) });
  }

  if (err.type === 'entity.parse.failed' || (err instanceof SyntaxError && err.status === 400)) {
    return res.status(400).json({ message: 'Invalid JSON body' });
  }

  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ message: 'Image too large. Maximum size is 5 MB.' });
  }

  if (err.message && err.message.includes('Only image files')) {
    return res.status(400).json({ message: err.message });
  }

  if (err.code === 11000) {
    return res.status(400).json({ message: 'Duplicate value: please use a unique value.' });
  }

  console.error('Fire Error:', err.stack);
  if (process.env.NODE_ENV === 'production') {
    return res.status(500).json({ message: 'Internal Server Error' });
  }
  res.status(500).json({ message: 'Internal Server Error', error: err.message });
});

module.exports = app;