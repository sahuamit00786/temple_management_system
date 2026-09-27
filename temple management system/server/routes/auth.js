import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Op } from 'sequelize';
import { User } from '../db.js';
import { requireAuth, flattenPermissions, USER_INCLUDE } from '../middleware/authMiddleware.js';
import { sendOtpEmail } from '../utils/mailer.js';

const r = Router();

function tokens(user) {
  const access = jwt.sign({ sub: user.id, role: user.role.name }, process.env.JWT_SECRET, { expiresIn: '15m' });
  const refresh = jwt.sign({ sub: user.id }, process.env.JWT_REFRESH_SECRET, { expiresIn: '7d' });
  return { access, refresh };
}

r.post('/login', async (req, res, next) => {
  try {
    const { email: identifier, password } = req.body;
    const user = await User.findOne({ where: { [Op.or]: [{ email: identifier }, { name: identifier }] }, include: USER_INCLUDE });
    if (!user || !user.isActive || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({ error: 'Invalid email/name or password' });
    }
    await User.update({ lastLoginAt: new Date() }, { where: { id: user.id } });
    const t = tokens(user);
    res.json({
      accessToken: t.access, refreshToken: t.refresh,
      user: { id: user.id, name: user.name, email: user.email, role: user.role.name, permissions: flattenPermissions(user) },
    });
  } catch (e) { next(e); }
});

r.post('/refresh', async (req, res) => {
  try {
    const payload = jwt.verify(req.body.refreshToken, process.env.JWT_REFRESH_SECRET);
    const user = await User.findByPk(payload.sub, { include: USER_INCLUDE });
    if (!user || !user.isActive) throw new Error();
    const t = tokens(user);
    res.json({ accessToken: t.access, refreshToken: t.refresh });
  } catch {
    res.status(401).json({ error: 'Please log in again' });
  }
});

r.get('/me', requireAuth, (req, res) => {
  const u = req.user;
  res.json({ id: u.id, name: u.name, email: u.email, role: u.role.name, permissions: flattenPermissions(u) });
});

r.post('/forgot-password', async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });
    const user = await User.findOne({ where: { email: email.toLowerCase().trim() } });
    if (!user || !user.isActive) return res.json({ ok: true });
    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
    await User.update({ otpCode: otp, otpExpiresAt }, { where: { id: user.id } });
    await sendOtpEmail(user.email, user.name, otp);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

r.post('/verify-otp', async (req, res, next) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) return res.status(400).json({ error: 'Email and OTP are required' });
    const user = await User.findOne({ where: { email: email.toLowerCase().trim() } });
    if (!user || !user.otpCode || !user.otpExpiresAt) {
      return res.status(400).json({ error: 'OTP not found. Request a new one.' });
    }
    if (new Date() > user.otpExpiresAt) {
      await User.update({ otpCode: null, otpExpiresAt: null }, { where: { id: user.id } });
      return res.status(400).json({ error: 'OTP has expired. Request a new one.' });
    }
    if (user.otpCode !== otp.trim()) {
      return res.status(400).json({ error: 'Incorrect OTP. Check and try again.' });
    }
    await User.update({ otpCode: null, otpExpiresAt: null }, { where: { id: user.id } });
    const resetToken = jwt.sign({ sub: user.id, purpose: 'password_reset' }, process.env.JWT_SECRET, { expiresIn: '15m' });
    res.json({ resetToken });
  } catch (e) { next(e); }
});

r.post('/reset-password', async (req, res, next) => {
  try {
    const { resetToken, password } = req.body;
    if (!resetToken || !password) return res.status(400).json({ error: 'Token and new password are required' });
    if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });
    let payload;
    try { payload = jwt.verify(resetToken, process.env.JWT_SECRET); }
    catch { return res.status(400).json({ error: 'Reset link expired. Start again.' }); }
    if (payload.purpose !== 'password_reset') return res.status(400).json({ error: 'Invalid reset token' });
    const hash = await bcrypt.hash(password, 12);
    await User.update({ passwordHash: hash }, { where: { id: payload.sub } });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

export default r;

