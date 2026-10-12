import './dotenv-loader.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';

import { sequelize, DevoteeMembership, EventType } from './db.js';
import { migrateHallEventTypes } from './utils/migrateEventTypes.js';
import { errorHandler } from './error.js';
import { startReminderJob } from './jobs.js';

import authRoutes      from './routes/auth.js';
import lookupRoutes    from './routes/lookups.js';
import eventTypeRoutes from './routes/eventTypes.js';
import menuRoutes      from './routes/menu.js';
import userRoutes      from './routes/users.js';
import roleRoutes      from './routes/roles.js';
import devoteeRoutes   from './routes/devotees.js';
import txRoutes        from './routes/transactions.js';
import syncRoutes      from './routes/sync.js';
import bookingRoutes   from './routes/bookings.js';
import dashboardRoutes from './routes/dashboard.js';
import reportRoutes    from './routes/reports.js';
import settingsRoutes  from './routes/settings.js';
import paymentRoutes   from './routes/payments.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const logFile   = path.join(__dirname, 'server.log');

function log(level, msg) {
  const line = `[${new Date().toISOString()}] [${level}] ${msg}\n`;
  process.stdout.write(line);
  try { fs.appendFileSync(logFile, line); } catch {}
}

process.on('uncaughtException',  (err)    => { log('FATAL', err.stack || err.message); process.exit(1); });
process.on('unhandledRejection', (reason) => { log('ERROR', reason?.stack || String(reason)); });

log('INFO', '=== TMADJ SERVER STARTING ===');
log('INFO', `DB  → ${process.env.DB_HOST}:${process.env.DB_PORT || 3306} / ${process.env.DB_NAME}`);
log('INFO', `PORT → ${process.env.PORT || 4000}`);

const app = express();

const ALLOWED_ORIGINS = ['https://testclient-tmadjk.tms11ss.com','https://temple.insur-vault.com', 'http://temple.insur-vault.com', 'https://tmadjk.tms11ss.com', 'http://tmadjk.tms11ss.com','https://sbt.tms11ss.com', 'http://localhost:5173'];
app.use(cors({ origin: (origin, cb) => cb(null, !origin || ALLOWED_ORIGINS.includes(origin)), credentials: true }));
app.use(express.json({ limit: '2mb' }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// DB health check
app.get('/', async (_req, res) => {
  try {
    await sequelize.authenticate();
    res.json({ server: '✅ Running', database: '✅ Connected', host: process.env.DB_HOST, db: process.env.DB_NAME });
  } catch (err) {
    res.json({ server: '✅ Running', database: '❌ NOT Connected', error: err.message });
  }
});

app.get('/api/v1/health', (_req, res) => res.json({ ok: true }));
app.use('/api/v1/auth',         authRoutes);
app.use('/api/v1/lookups',      lookupRoutes);
app.use('/api/v1/event-types',  eventTypeRoutes);
app.use('/api/v1/menu',         menuRoutes);
app.use('/api/v1/users',        userRoutes);
app.use('/api/v1/roles',        roleRoutes);
app.use('/api/v1/devotees',     devoteeRoutes);
app.use('/api/v1/transactions', txRoutes);
app.use('/api/v1/sync',         syncRoutes);
app.use('/api/v1/bookings',     bookingRoutes);
app.use('/api/v1/dashboard',    dashboardRoutes);
app.use('/api/v1/reports',      reportRoutes);
app.use('/api/v1/settings',     settingsRoutes);
app.use('/api/v1/payments',     paymentRoutes);
app.use(errorHandler);

async function start() {
  try {
    await DevoteeMembership.sync({ force: false });
    await EventType.sync({ force: false });
    await migrateHallEventTypes(log);
    log('INFO', '✅ Database connected');
  } catch (err) {
    log('FATAL', `❌ Database failed: ${err.message}`);
    process.exit(1);
  }

  const port = process.env.PORT || 4000;
  const server = app.listen(port, () => {
    log('INFO', `✅ Server running → http://localhost:${port}/`);
    try { startReminderJob(); } catch (e) { log('WARN', `Reminder job: ${e.message}`); }
  });

  server.on('error', (err) => {
    log('FATAL', err.code === 'EADDRINUSE' ? `Port ${port} already in use` : err.message);
    process.exit(1);
  });
}

start();
