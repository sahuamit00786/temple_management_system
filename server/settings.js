import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { Op } from 'sequelize';
import { Setting } from './db.js';
import { requireAuth } from './authMiddleware.js';
import { can } from './can.js';
import { audit } from './audit.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadDir = path.join(__dirname, '..', 'uploads');

const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (_req, file, cb) => cb(null, `${file.fieldname}-${Date.now()}${path.extname(file.originalname)}`),
});
const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => cb(null, /image\/(png|jpe?g|webp|svg\+xml)/.test(file.mimetype)),
});

const r = Router();
r.use(requireAuth);

r.get('/', async (_req, res, next) => {
  try {
    const rows = await Setting.findAll({ where: { key: { [Op.notLike]: 'seq.%' } } });
    res.json(Object.fromEntries(rows.map((s) => [s.key, s.value])));
  } catch (e) { next(e); }
});

r.put('/', can('settings', 'edit'), async (req, res, next) => {
  try {
    for (const [key, value] of Object.entries(req.body)) {
      if (key.startsWith('seq.')) continue;
      await Setting.upsert({ key, value });
    }
    await audit(req, 'UPDATE', 'Setting', null, null, req.body);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

r.post('/logo', can('settings', 'edit'), upload.single('logo'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Choose a PNG, JPG, WEBP or SVG image (max 2 MB)' });
    const url = `/uploads/${req.file.filename}`;
    await Setting.upsert({ key: 'temple.logoUrl', value: url });
    await audit(req, 'UPDATE', 'Setting', 'temple.logoUrl', null, { url });
    res.json({ url });
  } catch (e) { next(e); }
});

r.get('/numbering', async (_req, res, next) => {
  try {
    const [rPrefix, rDigits, bPrefix, bDigits] = await Promise.all([
      Setting.findByPk('numbering.receiptPrefix'),
      Setting.findByPk('numbering.receiptDigits'),
      Setting.findByPk('numbering.bookingPrefix'),
      Setting.findByPk('numbering.bookingDigits'),
    ]);
    res.json({
      receiptPrefix: rPrefix?.value ?? 'ORD',
      receiptDigits: Number(rDigits?.value ?? 6),
      bookingPrefix: bPrefix?.value ?? 'HB',
      bookingDigits: Number(bDigits?.value ?? 6),
    });
  } catch (e) { next(e); }
});

r.post('/numbering', can('settings', 'edit'), async (req, res, next) => {
  try {
    const { receiptPrefix, receiptDigits, bookingPrefix, bookingDigits } = req.body;
    const ops = [];
    if (receiptPrefix != null) ops.push(Setting.upsert({ key: 'numbering.receiptPrefix', value: receiptPrefix }));
    if (receiptDigits != null) ops.push(Setting.upsert({ key: 'numbering.receiptDigits', value: Number(receiptDigits) }));
    if (bookingPrefix != null) ops.push(Setting.upsert({ key: 'numbering.bookingPrefix', value: bookingPrefix }));
    if (bookingDigits != null) ops.push(Setting.upsert({ key: 'numbering.bookingDigits', value: Number(bookingDigits) }));
    await Promise.all(ops);
    await audit(req, 'UPDATE', 'Setting', 'numbering', null, req.body);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

r.post('/qr-image', can('settings', 'edit'), upload.single('qr'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Choose an image of your DuitNow QR (max 2 MB)' });
    const url = `/uploads/${req.file.filename}`;
    await Setting.upsert({ key: 'qr.imageUrl', value: url });
    res.json({ url });
  } catch (e) { next(e); }
});

r.get('/dismissals', async (_req, res, next) => {
  try {
    const row = await Setting.findByPk('dismissals');
    res.json(row?.value || { bookingIds: [], memberIds: [] });
  } catch (e) { next(e); }
});

r.post('/dismissals', async (req, res, next) => {
  try {
    const { bookingIds = [], memberIds = [] } = req.body;
    await Setting.upsert({ key: 'dismissals', value: { bookingIds, memberIds } });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

export default r;
