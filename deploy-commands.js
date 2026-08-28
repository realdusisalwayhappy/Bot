require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { REST, Routes } = require('discord.js');

if (!process.env.DISCORD_TOKEN || !process.env.CLIENT_ID) {
  console.error('❌ ต้องตั้งค่า DISCORD_TOKEN และ CLIENT_ID ในไฟล์ .env ก่อน deploy');
  process.exit(1);
}

const commands = [];
const commandsPath = path.join(__dirname, 'commands');
for (const file of fs.readdirSync(commandsPath).filter((f) => f.endsWith('.js'))) {
  const command = require(path.join(commandsPath, file));
  commands.push(command.data.toJSON());
}

const rest = new REST().setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log(`⏳ กำลัง deploy ${commands.length} คำสั่ง...`);

    const route = process.env.GUILD_ID
      ? Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID)
      : Routes.applicationCommands(process.env.CLIENT_ID);

    await rest.put(route, { body: commands });
    console.log(
      `✅ Deploy คำสั่งสำเร็จแบบ ${process.env.GUILD_ID ? 'เซิร์ฟเวอร์ (ทันที)' : 'global (อาจใช้เวลาสักพัก)'}`
    );
  } catch (err) {
    console.error(err);
    process.exitCode = 1;
  }
})();
