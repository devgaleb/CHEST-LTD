const cron = require('node-cron');
const config = require('./config');
const { createBackup } = require('./backup');
const { runScript } = require('./minecraft');
const { record } = require('./audit-store');
let jobs = [];
function startAutomation(client) {
  const notify = async text => { if (!config.statusChannelId) return; try { const c = await client.channels.fetch(config.statusChannelId); if (c?.isTextBased()) await c.send({ content: text }); } catch (e) { console.error('Automation notification failed:', e.message); } };
  if (config.automation.backupCron && cron.validate(config.automation.backupCron)) for (const s of config.servers.filter(x => x.worldDir)) jobs.push(cron.schedule(config.automation.backupCron, async () => { try { const b = await createBackup(s.id); await record({ type:'scheduled-backup', server:s.id, file:b.name, ok:true }); await notify(`✅ Chest automatic backup completed for **${s.name}**: ${b.name}`); } catch(e) { console.error('Scheduled backup failed:', e); await record({type:'scheduled-backup',server:s.id,ok:false,error:e.message}); await notify(`⚠️ Chest automatic backup failed for **${s.name}**: ${e.message.slice(0,300)}`); } }));
  if (config.automation.restartCron && cron.validate(config.automation.restartCron)) for (const s of config.servers.filter(x => x.scripts.restart)) jobs.push(cron.schedule(config.automation.restartCron, async () => { try { await runScript('restart',s.id); await record({type:'scheduled-restart',server:s.id,ok:true}); await notify(`🔄 Chest scheduled restart requested for **${s.name}**.`); } catch(e) { console.error('Scheduled restart failed:',e); await record({type:'scheduled-restart',server:s.id,ok:false,error:e.message}); await notify(`⚠️ Chest scheduled restart failed for **${s.name}**.`); } }));
  console.log(`Chest automation started: ${jobs.length} scheduled job(s).`);
}
function stopAutomation(){ for(const j of jobs) j.stop(); jobs=[]; }
module.exports={startAutomation,stopAutomation};
