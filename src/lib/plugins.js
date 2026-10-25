const fs = require('node:fs/promises');
const path = require('node:path');
const https = require('node:https');
const crypto = require('node:crypto');
const config = require('./config');

function pluginDir(id) {
  const s = config.servers.find(x => x.id === id) || config.servers[0];
  if (!s?.pluginDir || !path.isAbsolute(s.pluginDir)) throw new Error('Configure an absolute pluginDir for this server.');
  return { s, dir: path.resolve(s.pluginDir) };
}
function fetchToFile(url, dest, redirects = 0) {
  return new Promise((resolve, reject) => {
    if (redirects > 3) return reject(new Error('Too many redirects.'));
    let parsed; try { parsed = new URL(url); } catch { return reject(new Error('Invalid download URL.')); }
    if (parsed.protocol !== 'https:') return reject(new Error('Plugin downloads must use HTTPS.'));
    if (!config.approvedPluginHosts.includes(parsed.hostname.toLowerCase())) return reject(new Error(`Download host ${parsed.hostname} is not allowlisted in APPROVED_PLUGIN_HOSTS.`));
    const req = https.get(parsed, { timeout: 20000, headers: { 'User-Agent': 'Chest-Minecraft-Plugin-Installer/1.0' } }, res => {
      if ([301,302,303,307,308].includes(res.statusCode)) { res.resume(); if (!res.headers.location) return reject(new Error('Redirect missing location.')); return resolve(fetchToFile(new URL(res.headers.location, parsed).toString(), dest, redirects + 1)); }
      if (res.statusCode !== 200) { res.resume(); return reject(new Error(`Download returned HTTP ${res.statusCode}.`)); }
      let bytes = 0; const hash = crypto.createHash('sha256'); const out = require('node:fs').createWriteStream(dest, { flags: 'wx', mode: 0o600 });
      res.on('data', chunk => { bytes += chunk.length; hash.update(chunk); if (bytes > 100 * 1024 * 1024) req.destroy(new Error('Plugin exceeds 100 MB limit.')); });
      res.pipe(out); out.on('finish', () => out.close(() => resolve({ bytes, sha256: hash.digest('hex') }))); out.on('error', reject); res.on('error', reject);
    });
    req.on('timeout', () => req.destroy(new Error('Plugin download timed out.'))); req.on('error', reject);
  });
}
async function listPlugins(id) { const { dir } = pluginDir(id); await fs.mkdir(dir, { recursive: true }); return (await fs.readdir(dir, { withFileTypes: true })).filter(x => x.isFile() && x.name.toLowerCase().endsWith('.jar')).map(x => x.name).sort(); }
async function installPlugin({ serverId, url, filename, sha256 }) {
  const { dir } = pluginDir(serverId);
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,100}\.jar$/i.test(filename || '')) throw new Error('Filename must be a simple .jar filename (no directories).');
  if (!/^[a-f0-9]{64}$/i.test(sha256 || '')) throw new Error('A trusted 64-character SHA-256 checksum is required.');
  await fs.mkdir(dir, { recursive: true }); const dest = path.join(dir, filename); const temp = path.join(dir, `.chest-download-${crypto.randomUUID()}.tmp`);
  try { const result = await fetchToFile(url, temp); if (result.sha256.toLowerCase() !== sha256.toLowerCase()) throw new Error('SHA-256 checksum mismatch; plugin rejected.'); await fs.access(dest).then(() => { throw new Error('A plugin with that filename already exists; remove or rename it first.'); }, e => { if (e.message.includes('already exists')) throw e; }); await fs.rename(temp, dest); return { filename, bytes: result.bytes, sha256: result.sha256 }; }
  finally { await fs.unlink(temp).catch(() => {}); }
}
async function removePlugin(serverId, filename) { const { dir } = pluginDir(serverId); if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,100}\.jar$/i.test(filename || '')) throw new Error('Invalid plugin filename.'); const target = path.join(dir, filename); const st = await fs.lstat(target); if (!st.isFile() || st.isSymbolicLink()) throw new Error('Target is not a regular plugin file.'); await fs.unlink(target); return filename; }
module.exports = { listPlugins, installPlugin, removePlugin };
