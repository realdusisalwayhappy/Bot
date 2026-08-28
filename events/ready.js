const { Events, ActivityType } = require('discord.js');

module.exports = {
  name: Events.ClientReady,
  once: true,
  execute(client) {
    console.log(`✅ Dustybun.Store bot online: ${client.user.tag}`);
    client.user.setActivity('🛍️ Dustybun.Store | /menu', { type: ActivityType.Watching });
  },
};
