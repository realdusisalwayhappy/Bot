const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const axios = require('axios');
const { getCategory, getPlanByLabel, addStockLines, stockCount, listCategories, listPlans } = require('../utils/shop');
const { baseEmbed } = require('../utils/brand');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('addstock')
    .setDescription('[แอดมิน] เพิ่มสต็อกสินค้าให้แพ็กเกจ จากไฟล์ .txt (1 บรรทัด = 1 ชิ้น)')
    .addStringOption((o) =>
      o.setName('category').setDescription('เลือกหมวดหมู่ (พิมพ์แล้วแตะจากลิสต์)').setRequired(true).setAutocomplete(true)
    )
    .addStringOption((o) =>
      o.setName('plan').setDescription('เลือกแพ็กเกจ (พิมพ์แล้วแตะจากลิสต์)').setRequired(true).setAutocomplete(true)
    )
    .addAttachmentOption((o) => o.setName('file').setDescription('ไฟล์ .txt รายการสินค้า บรรทัดละ 1 ชิ้น').setRequired(true)),

  async autocomplete(interaction) {
    const focused = interaction.options.getFocused(true);

    if (focused.name === 'category') {
      const categories = listCategories();
      const filtered = categories
        .filter((c) => c.name.toLowerCase().includes((focused.value || '').toLowerCase()))
        .slice(0, 25);
      return interaction.respond(filtered.map((c) => ({ name: `${c.emoji} ${c.name}`, value: c.name })));
    }

    if (focused.name === 'plan') {
      const categoryName = interaction.options.getString('category');
      const category = categoryName ? getCategory(categoryName) : null;
      if (!category) return interaction.respond([]);
      const plans = listPlans(category.id);
      const filtered = plans
        .filter((p) => p.label.toLowerCase().includes((focused.value || '').toLowerCase()))
        .slice(0, 25);
      return interaction.respond(
        filtered.map((p) => ({ name: `${p.label} • ${p.price}฿ (เหลือ ${p.stock_left})`, value: p.label }))
      );
    }

    return interaction.respond([]);
  },

  async execute(interaction) {
    const adminRoleId = process.env.ADMIN_ROLE_ID;
    const isAdmin = interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)
      || (adminRoleId && interaction.member?.roles?.cache?.has(adminRoleId));
    if (!isAdmin) {
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
        content: `❌ ไม่พบแพ็กเกจ "${planLabel}" ในหมวดหมู่ "${category.name}" กรุณาสร้างด้วย /addplan ก่อน`,
        ephemeral: true,
      });
    }

    const attachment = interaction.options.getAttachment('file');
    if (!attachment.name.toLowerCase().endsWith('.txt')) {
      return interaction.reply({ content: '❌ กรุณาอัปโหลดไฟล์ .txt เท่านั้น', ephemeral: true });
    }
    if (attachment.size > 1_000_000) {
      return interaction.reply({ content: '❌ ไฟล์ใหญ่เกินไป (สูงสุด 1 MB)', ephemeral: true });
    }

    await interaction.deferReply();

    let lines;
    try {
      const res = await axios.get(attachment.url, {
        responseType: 'text',
        timeout: 15000,
        maxContentLength: 1_000_000,
        maxBodyLength: 1_000_000,
      });
      lines = res.data
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => l.length > 0);
    } catch (err) {
      console.error('อ่านไฟล์สต็อกไม่สำเร็จ:', err);
      return interaction.editReply('❌ อ่านไฟล์สต็อกไม่สำเร็จ กรุณาตรวจสอบไฟล์แล้วลองใหม่');
    }

    if (lines.length === 0) {
      return interaction.editReply('❌ ไฟล์ว่างเปล่า ไม่มีสินค้าให้เพิ่ม');
    }

    try {
      addStockLines(plan.id, lines);
    } catch (err) {
      return interaction.editReply('❌ เพิ่มสต็อกไม่สำเร็จ: ไฟล์ต้องมีไม่เกิน 10,000 บรรทัด และแต่ละบรรทัดไม่เกิน 1,000 ตัวอักษร');
    }
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
