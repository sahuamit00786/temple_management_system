'use strict';
// CJS entry point for LiteSpeed / cPanel Node.js hosting (lsnode.js uses require())
(async () => {
  try {
    await import('./src/server.js');
  } catch (err) {
    const fs = require('fs');
    const msg = `[${new Date().toISOString()}] [FATAL] ${err.stack || err.message}\n`;
    process.stderr.write(msg);
    try { fs.appendFileSync('./server.log', msg); } catch (_) {}
    process.exit(1);
  }
})();
