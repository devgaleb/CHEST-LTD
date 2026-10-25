const fs = require('node:fs/promises');
const path = require('node:path');
const config = require('./config');
async function tailLog(id, maxBytes = 48 * 1024) {
  const s = config.servers.find(x => x.id === id) || config.servers[0];
  if (!s) throw new Error('No server configured.');
  const file = s.logFile;
  if (!file) throw new Error(`No logFile configured for ${s.name}. Set a trusted absolute path to latest.log.`);
  if (!path.isAbsolute(file)) throw new Error('Log path must be absolute.');
  const st = await fs.stat(file); if (!st.isFile()) throw new Error('Log path is not a file.');
  const h = await fs.open(file, 'r'); try { const size = Math.min(st.size, maxBytes); const b = Buffer.alloc(size); await h.read(b, 0, size, st.size - size); return b.toString('utf8').split(/\r?\n/).slice(-100).join('\n'); } finally { await h.close(); }
}
module.exports = { tailLog };
