export function errorHandler(err, _req, res, _next) {
  console.error(err);
  if (err.code === 'P2002') return res.status(409).json({ error: 'Duplicate value - record already exists' });
  res.status(err.status || 500).json({ error: err.message || 'Something went wrong' });
}
