const { Client, GatewayIntentBits, ActivityType, Events } = require('discord.js');
const config = require('./lib/config');
const commands = require('./commands');
const { error } = require('./lib/embeds');
const { startDashboard } = require('./dashboard');
const { startAutomation, stopAutomation } = require('./lib/automation');
const { record } = require('./lib/audit-store');
if(!config.token){console.error('Missing DISCORD_TOKEN. Copy .env.example to .env and configure it.');process.exit(1)}
const client=new Client({intents:[GatewayIntentBits.Guilds]});
const registry=new Map(commands.map(c=>[c.data.name,c]));
client.once(Events.ClientReady,c=>{console.log(`Chest online as ${c.user.tag}; ${registry.size} slash commands loaded.`);c.user.setActivity('Minecraft servers | /help',{type:ActivityType.Watching});startDashboard();startAutomation(c);});
client.on(Events.InteractionCreate,async i=>{if(!i.isChatInputCommand())return;const command=registry.get(i.commandName);if(!command)return;try{await command.execute(i)}catch(e){console.error(`[/${i.commandName}]`,e);const payload={embeds:[error('Unexpected error. Check the bot logs for details.')],ephemeral:true};if(i.deferred||i.replied)await i.followUp(payload).catch(()=>{});else await i.reply(payload).catch(()=>{});}});
client.on(Events.Error,e=>console.error('Discord client error:',e));
process.on('unhandledRejection',e=>console.error('Unhandled rejection:',e));
process.on('SIGINT',()=>{stopAutomation();client.destroy();process.exit(0)});
process.on('SIGTERM',()=>{stopAutomation();client.destroy();process.exit(0)});
client.login(config.token);
