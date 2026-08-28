const { Events, ActivityType, REST, Routes } = require('discord.js');

async function autoDeployCommands(client) {
  try {
    const commands = [...client.commands.values()].map((c) => c.data.toJSON());
    const rest = new REST().setToken(process.env.DISCORD_TOKEN);

    const route = process.env.GUILD_ID
      ? Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID)
      : Routes.applicationCommands(process.env.CLIENT_ID);

    await rest.put(route, { body: commands });
    console.log(`✅ ลงทะเบียน ${commands.length} คำสั่งสำเร็จ (auto-deploy on startup)`);
  } catch (err) {
    console.error('❌ ลงทะเบียนคำสั่งไม่สำเร็จ:', err);
  }
}

module.exports = {
  name: Events.ClientReady,
  once: true,
  async execute(client) {
    console.log(`✅ Dustybun.Store bot online: ${client.user.tag}`);
    client.user.setActivity('🛍️ Dustybun.Store | /menu', { type: ActivityType.Watching });
    await autoDeployCommands(client);
  },
};
