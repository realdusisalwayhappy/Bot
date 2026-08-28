const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { addCategory } = require('../utils/shop');
const { baseEmbed } = require('../utils/brand');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('addcategory')
    .setDescription('[แอดมิน] เพิ่มหมวดหมู่สินค้าใหม่ (เช่น Netflix, Youtube Premium)')
    .addStringOption((o) => o.setName('name').setDescription('ชื่อหมวดหมู่ เช่น Netflix').setRequired(true))
    .addStringOption((o) => o.setName('emoji').setDescription('อีโมจิของหมวดหมู่ เช่น 🎬').setRequired(false))
    .addStringOption((o) => o.setName('description').setDescription('รายละเอียดสินค้า').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const adminRoleId = process.env.ADMIN_ROLE_ID;
    if (adminRoleId && !interaction.member.roles.cache.has(adminRoleId) && !interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ content: '❌ คุณไม่มีสิทธิ์ใช้คำสั่งนี้', ephemeral: true });
    }

    const name = interaction.options.getString('name');
    const emoji = interaction.options.getString('emoji') || '📦';
    const description = interaction.options.getString('description') || '';

    try {
      addCategory(name, emoji, description);
    } catch (err) {
      return interaction.reply({ content: `❌ เกิดข้อผิดพลาด: หมวดหมู่นี้อาจมีอยู่แล้ว`, ephemeral: true });
    }

    const embed = baseEmbed()
      .setTitle('✅ เพิ่มหมวดหมู่สำเร็จ')
      .setDescription(`${emoji} **${name}**\n\nต่อไปใช้ \`/addplan\` เพื่อเพิ่มแพ็กเกจราคา (เช่น 1 วัน, 7 วัน, 30 วัน) ให้หมวดหมู่นี้`);

    await interaction.reply({ embeds: [embed] });
  },
};
