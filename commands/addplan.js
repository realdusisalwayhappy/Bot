const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { getCategory, addPlan, listCategories } = require('../utils/shop');
const { baseEmbed } = require('../utils/brand');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('addplan')
    .setDescription('[แอดมิน] เพิ่มแพ็กเกจราคา (เช่น 1 วัน / 7 วัน / 30 วัน) ให้หมวดหมู่')
    .addStringOption((o) =>
      o.setName('category').setDescription('เลือกหมวดหมู่ (พิมพ์แล้วแตะจากลิสต์)').setRequired(true).setAutocomplete(true)
    )
    .addStringOption((o) => o.setName('label').setDescription('ชื่อแพ็กเกจ เช่น "1 วัน", "7 วัน", "30 วัน"').setRequired(true))
    .addIntegerOption((o) => o.setName('price').setDescription('ราคาต่อชิ้นของแพ็กเกจนี้ (บาท)').setRequired(true))
    .addIntegerOption((o) => o.setName('order').setDescription('ลำดับการแสดงผล (ตัวเลขน้อยแสดงก่อน)').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async autocomplete(interaction) {
    const focused = interaction.options.getFocused();
    const categories = listCategories();
    const filtered = categories
      .filter((c) => c.name.toLowerCase().includes((focused || '').toLowerCase()))
      .slice(0, 25);
    await interaction.respond(filtered.map((c) => ({ name: `${c.emoji} ${c.name}`, value: c.name })));
  },

  async execute(interaction) {
    const adminRoleId = process.env.ADMIN_ROLE_ID;
    if (adminRoleId && !interaction.member.roles.cache.has(adminRoleId) && !interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ content: '❌ คุณไม่มีสิทธิ์ใช้คำสั่งนี้', ephemeral: true });
    }

    const categoryName = interaction.options.getString('category');
    const category = getCategory(categoryName);
    if (!category) {
      return interaction.reply({ content: `❌ ไม่พบหมวดหมู่ "${categoryName}" กรุณาสร้างด้วย /addcategory ก่อน`, ephemeral: true });
    }

    const label = interaction.options.getString('label');
    const price = interaction.options.getInteger('price');
    const order = interaction.options.getInteger('order') || 0;

    addPlan(category.id, label, price, order);

    const embed = baseEmbed()
      .setTitle('✅ เพิ่มแพ็กเกจสำเร็จ')
      .setDescription(
        `หมวดหมู่: **${category.emoji} ${category.name}**\n` +
        `แพ็กเกจ: **${label}** — ราคา **${price} บาท**\n\n` +
        `ต่อไปใช้ \`/addstock\` เพื่อเพิ่มสต็อกให้แพ็กเกจนี้`
      );

    await interaction.reply({ embeds: [embed] });
  },
};
