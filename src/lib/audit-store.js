const fs = require('node:fs/promises');
const path = require('node:path');
const file = path.resolve(process.env.CHEST_AUDIT_FILE || './data/audit.jsonl');
let chain = Promise.resolve();
async function record(event) {
  const row = { at: new Date().toISOString(), ...event };
  chain = chain.then(async () => { await fs.mkdir(path.dirname(file), { recursive: true, mode: 0o700 }); await fs.appendFile(file, JSON.stringify(row) + '\n', { mode: 0o600 }); });
  await chain; return row;
}
async function recent(limit = 50) {
  try { const text = await fs.readFile(file, 'utf8'); return text.trim().split('\n').filter(Boolean).slice(-Math.max(1, Math.min(200, limit))).reverse().map(x => { try { return JSON.parse(x); } catch { return null; } }).filter(Boolean); }
  catch (e) { if (e.code === 'ENOENT') return []; throw e; }
}
module.exports = { record, recent };
