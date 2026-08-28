const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const axios = require('axios');
const { getCategory, getPlanByLabel, addStockLines, stockCount } = require('../utils/shop');
const { baseEmbed } = require('../utils/brand');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('addstock')
    .setDescription('[แอดมิน] เพิ่มสต็อกสินค้าให้แพ็กเกจ จากไฟล์ .txt (1 บรรทัด = 1 ชิ้น)')
    .addStringOption((o) => o.setName('category').setDescription('ชื่อหมวดหมู่ เช่น Netflix').setRequired(true))
    .addStringOption((o) => o.setName('plan').setDescription('ชื่อแพ็กเกจ เช่น "1 วัน" (ต้องตรงกับที่ตั้งใน /addplan)').setRequired(true))
    .addAttachmentOption((o) => o.setName('file').setDescription('ไฟล์ .txt รายการสินค้า บรรทัดละ 1 ชิ้น').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const adminRoleId = process.env.ADMIN_ROLE_ID;
    if (adminRoleId && !interaction.member.roles.cache.has(adminRoleId) && !interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ content: '❌ คุณไม่มีสิทธิ์ใช้คำสั่งนี้', ephemeral: true });
    }

    const categoryName = interaction.options.getString('category');
    const category = getCategory(categoryName);
    if (!category) {
      return interaction.reply({ content: `❌ ไม่พบหมวดหมู่ "${categoryName}"`, ephemeral: true });
    }

    const planLabel = interaction.options.getString('plan');
    const plan = getPlanByLabel(category.id, planLabel);
    if (!plan) {
      return interaction.reply({
        content: `❌ ไม่พบแพ็กเกจ "${planLabel}" ในหมวดหมู่ "${category.name}" กรุณาสร้างด้วย /addplan ก่อน (ชื่อต้องตรงกันเป๊ะ)`,
        ephemeral: true,
      });
    }

    const attachment = interaction.options.getAttachment('file');
    if (!attachment.name.endsWith('.txt')) {
      return interaction.reply({ content: '❌ กรุณาอัปโหลดไฟล์ .txt เท่านั้น', ephemeral: true });
    }

    await interaction.deferReply();

    const res = await axios.get(attachment.url, { responseType: 'text' });
    const lines = res.data
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (lines.length === 0) {
      return interaction.editReply('❌ ไฟล์ว่างเปล่า ไม่มีสินค้าให้เพิ่ม');
    }

    addStockLines(plan.id, lines);
    const total = stockCount(plan.id);

    const embed = baseEmbed()
      .setTitle('✅ เพิ่มสต็อกสำเร็จ')
      .setDescription(
        `หมวดหมู่: **${category.emoji} ${category.name}**\n` +
        `แพ็กเกจ: **${plan.label}** (${plan.price} บาท)\n` +
        `เพิ่มไป: **${lines.length}** ชิ้น\n` +
        `สต็อกคงเหลือทั้งหมด: **${total}** ชิ้น`
      );

    await interaction.editReply({ embeds: [embed] });
  },
};
