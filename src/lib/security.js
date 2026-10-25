const { PermissionFlagsBits } = require('discord.js');
const config = require('./config');
function isAdmin(member) {
  if (!member) return false;
  if (member.permissions?.has(PermissionFlagsBits.Administrator)) return true;
  return Boolean(config.adminRoleId && member.roles?.cache?.has(config.adminRoleId));
}
async function requireAdmin(interaction) {
  if (isAdmin(interaction.member)) return true;
  await interaction.reply({ content: '🔒 This action requires a configured Chest admin role or Discord **Administrator** permission.', ephemeral: true });
  return false;
}
module.exports = { isAdmin, requireAdmin };
