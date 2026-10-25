const { REST, Routes } = require('discord.js');
const config = require('./lib/config');
const commands = require('./commands');
if(!config.token||!config.clientId){console.error('Set DISCORD_TOKEN and DISCORD_CLIENT_ID in .env');process.exit(1)}
const rest=new REST({version:'10'}).setToken(config.token);
(async()=>{const route=config.guildId?Routes.applicationGuildCommands(config.clientId,config.guildId):Routes.applicationCommands(config.clientId);await rest.put(route,{body:commands.map(c=>c.data.toJSON())});console.log(`Registered ${commands.length} Chest slash commands${config.guildId?' to test guild':' globally'}.`);})().catch(e=>{console.error(e);process.exit(1)});
