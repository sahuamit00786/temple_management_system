const express = require('express');
const mysql = require('mysql2/promise');

const DB_HOST = 'localhost';
const DB_PORT = 3306;
const DB_NAME = 'gsgkarat_temple_db';
const DB_USER = 'gsgkarat_temple_db';
const DB_PASS = 'Temple@2026';
const PORT = process.env.PORT || 20084;

const app = express();

app.get('/', async (req, res) => {
  try {
    const conn = await mysql.createConnection({
      host: DB_HOST, port: DB_PORT, user: DB_USER, password: DB_PASS, database: DB_NAME,
    });
    await conn.query('SELECT 1');
    await conn.end();
    res.json({ db: 'connected', host: DB_HOST, database: DB_NAME });
  } catch (err) {
    res.json({ db: 'not connected', error: err.message });
  }
});

app.listen(PORT, () => console.log(`dbcheck running -> http://localhost:${PORT}/`));
