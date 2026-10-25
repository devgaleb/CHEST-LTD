const fs = require('node:fs/promises');
const path = require('node:path');
const { createWriteStream } = require('node:fs');
const archiver = require('archiver');
const config = require('./config');
const { withRcon } = require('./minecraft');
async function createBackup(serverId) {
  const s = config.servers.find(x => x.id === serverId) || config.servers[0];
  if (!s?.worldDir || !path.isAbsolute(s.worldDir)) throw new Error(`Configure an absolute worldDir for ${s?.name || 'server'}.`);
  const st = await fs.stat(s.worldDir); if (!st.isDirectory()) throw new Error('World path is not a directory.');
  await fs.mkdir(config.backupDir, { recursive: true, mode: 0o700 });
  try { await withRcon(r => r.send('save-all flush'), s.id); } catch (e) { if (process.env.BACKUP_REQUIRE_RCON === 'true') throw new Error(`Could not flush world save: ${e.message}`); }
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const safeId = s.id.replace(/[^a-zA-Z0-9_-]/g, '_');
  const name = `chest-${safeId}-${stamp}.zip`, dest = path.resolve(config.backupDir, name);
  await new Promise((resolve, reject) => { const out = createWriteStream(dest, { mode: 0o600 }); const a = archiver('zip', { zlib: { level: 1 } }); out.on('close', resolve); out.on('error', reject); a.on('error', reject); a.pipe(out); a.directory(s.worldDir, false); a.finalize().catch(reject); });
  const files = (await fs.readdir(config.backupDir)).filter(f => f.startsWith(`chest-${safeId}-`) && f.endsWith('.zip')).sort().reverse();
  for (const old of files.slice(config.maxBackups)) await fs.unlink(path.join(config.backupDir, old)).catch(()=>{});
  const result = await fs.stat(dest); return { name, path: dest, bytes: result.size, server: s.name };
}
module.exports = { createBackup };

async function listBackups(serverId) {
  const s = config.servers.find(x => x.id === serverId) || config.servers[0];
  if (!s) throw new Error('No server configured.');
  const safeId = s.id.replace(/[^a-zA-Z0-9_-]/g, '_');
  await fs.mkdir(config.backupDir, { recursive: true, mode: 0o700 });
  const entries = await fs.readdir(config.backupDir, { withFileTypes: true });
  const rows = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.startsWith(`chest-${safeId}-`) || !entry.name.endsWith('.zip')) continue;
    const full = path.resolve(config.backupDir, entry.name); const st = await fs.stat(full);
    rows.push({ name: entry.name, bytes: st.size, createdAt: st.mtime.toISOString() });
  }
  return rows.sort((a,b) => b.createdAt.localeCompare(a.createdAt));
}

async function restoreBackup(serverId, backupName) {
  const s = config.servers.find(x => x.id === serverId) || config.servers[0];
  if (!s?.worldDir || !path.isAbsolute(s.worldDir)) throw new Error('Configure an absolute worldDir before restoring.');
  if (!s.scripts?.stop || !s.scripts?.start) throw new Error('World restoration requires configured trusted stop and start scripts so the server can be safely restarted.');
  if (!/^chest-[a-zA-Z0-9_-]+-[0-9TZ._-]+\.zip$/.test(backupName || '')) throw new Error('Invalid backup filename.');
  const safeId = s.id.replace(/[^a-zA-Z0-9_-]/g, '_');
  if (!backupName.startsWith(`chest-${safeId}-`)) throw new Error('That backup does not belong to the selected server.');
  const backupPath = path.resolve(config.backupDir, backupName);
  if (path.dirname(backupPath) !== path.resolve(config.backupDir)) throw new Error('Invalid backup path.');
  const st = await fs.stat(backupPath); if (!st.isFile() || st.size > 20 * 1024 * 1024 * 1024) throw new Error('Backup is missing or exceeds the 20 GB restore limit.');
  const yauzl = require('yauzl');
  const target = path.resolve(s.worldDir); const parent = path.dirname(target);
  await fs.mkdir(parent, { recursive: true });
  const stage = path.join(parent, `.chest-restore-${require('node:crypto').randomUUID()}`);
  const rollback = path.join(parent, `.chest-rollback-${require('node:crypto').randomUUID()}`);
  const extract = () => new Promise((resolve, reject) => {
    yauzl.open(backupPath, { lazyEntries: true, validateEntrySizes: true }, (err, zip) => {
      if (err) return reject(err); if (!zip) return reject(new Error('Could not open backup archive.'));
      let count = 0, total = 0, settled = false;
      const fail = e => { if (!settled) { settled = true; zip.close(); reject(e); } };
      zip.on('error', fail);
      zip.on('entry', entry => {
        if (++count > 500000) return fail(new Error('Backup contains too many files.'));
        const mode = (entry.externalFileAttributes >>> 16) & 0o170000;
        if (mode === 0o120000) return fail(new Error('Symbolic links are not allowed in backup archives.'));
        const name = entry.fileName.replace(/\\/g, '/');
        if (!name || name.startsWith('/') || /^[A-Za-z]:/.test(name) || name.split('/').some(part => part === '..') || name.includes('\0')) return fail(new Error('Unsafe path found in backup archive.'));
        const out = path.resolve(stage, name);
        if (out !== stage && !out.startsWith(stage + path.sep)) return fail(new Error('Archive path escapes restore directory.'));
        if (entry.fileName.endsWith('/')) { fs.mkdir(out, { recursive: true }).then(() => zip.readEntry()).catch(fail); return; }
        zip.openReadStream(entry, (e, stream) => {
          if (e) return fail(e); fs.mkdir(path.dirname(out), { recursive: true }).then(() => {
            const ws = require('node:fs').createWriteStream(out, { flags: 'wx', mode: 0o600 });
            stream.on('data', b => { total += b.length; if (total > 20 * 1024 * 1024 * 1024) stream.destroy(new Error('Expanded backup exceeds 20 GB.')); });
            stream.on('error', fail); ws.on('error', fail); ws.on('finish', () => zip.readEntry()); stream.pipe(ws);
          }).catch(fail);
        });
      });
      zip.on('end', () => { if (!settled) { settled = true; resolve({ files: count, bytes: total }); } }); zip.readEntry();
    });
  });
  await createBackup(s.id); // mandatory pre-restore safety copy
  await fs.mkdir(stage, { recursive: true, mode: 0o700 });
  let stopped = false, started = false;
  try {
    await require('./minecraft').runScript('stop', s.id);
    stopped = true;
    const result = await extract();
    await fs.rename(target, rollback).catch(async e => { if (e.code !== 'ENOENT') throw e; });
    try { await fs.rename(stage, target); }
    catch (e) { await fs.rename(rollback, target).catch(() => {}); throw e; }
    if (s.scripts?.start) { await require('./minecraft').runScript('start', s.id); started = true; }
    return { backupName, files: result.files, bytes: result.bytes, rollbackPath: rollback };
  } catch (e) {
    await fs.rm(stage, { recursive: true, force: true }).catch(() => {});
    // Avoid leaving a server stopped after a failed extraction or swap.
    if (stopped && !started && s.scripts?.start) await require('./minecraft').runScript('start', s.id).catch(startErr => console.error('CRITICAL: failed to restart server after restore error:', startErr.message));
    throw e;
  }
}
module.exports.listBackups = listBackups;
module.exports.restoreBackup = restoreBackup;
