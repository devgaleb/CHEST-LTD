'use strict';
const os = require('node:os');
const startedAt = Date.now();
function snapshot() {
  const total = os.totalmem();
  const free = os.freemem();
  return {
    uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
    processUptimeSeconds: Math.floor(process.uptime()),
    memory: { rssBytes: process.memoryUsage().rss, heapUsedBytes: process.memoryUsage().heapUsed, heapTotalBytes: process.memoryUsage().heapTotal },
    hostMemory: { totalBytes: total, freeBytes: free, usedPercent: total ? Math.round((total - free) / total * 1000) / 10 : null },
    cpuCount: os.cpus().length,
    node: process.version,
    platform: process.platform
  };
}
module.exports = { snapshot };
