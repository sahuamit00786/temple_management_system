import { Router } from 'express';
import { requireAuth } from '../middleware/authMiddleware.js';
import { can } from '../middleware/can.js';
import { createTransaction } from './transactions.js';

const r = Router();
r.use(requireAuth);

r.post('/transactions', can('pos', 'create'), async (req, res, next) => {
  try {
    const results = [];
    for (const item of req.body.transactions || []) {
      try {
        const { tx, duplicate } = await createTransaction(req, item);
        results.push({ clientUuid: item.clientUuid, ok: true, duplicate, receiptNo: tx.receiptNo, id: tx.id });
      } catch (e) {
        results.push({ clientUuid: item.clientUuid, ok: false, error: e.message });
      }
    }
    res.json({ results });
  } catch (e) { next(e); }
});

export default r;

