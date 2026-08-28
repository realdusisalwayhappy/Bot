const {
  SlashCommandBuilder,
  StringSelectMenuBuilder,
  ActionRowBuilder,
} = require('discord.js');
const { listCategories } = require('../utils/shop');
const { baseEmbed, BRAND } = require('../utils/brand');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('menu')
    .setDescription('เปิดเมนูร้านค้า Dustybun.Store — เลือกหมวดหมู่สินค้า'),

  async execute(interaction) {
    const categories = listCategories();

    if (categories.length === 0) {
      return interaction.reply({
        content: '⚠️ ยังไม่มีหมวดหมู่สินค้าในระบบ กรุณาให้แอดมินเพิ่มก่อน (`/addcategory`)',
        ephemeral: true,
      });
    }

    const embed = baseEmbed()
      .setTitle(`🛍️ ${BRAND.name} — เมนูสินค้า`)
      .setDescription('เลือกหมวดหมู่จากเมนูด้านล่าง ระบบจะแสดงราคาและสต็อกคงเหลือให้ทันที')
      .addFields(
        categories.map((c) => ({
          name: `${c.emoji} ${c.name}`,
          value: `ราคา: **${c.price} บาท** • คงเหลือ: **${c.stock_left}** ชิ้น`,
          inline: true,
        }))
      );

    const select = new StringSelectMenuBuilder()
      .setCustomId('select_category')
      .setPlaceholder('📂 เลือกหมวดหมู่')
      .addOptions(
        categories.slice(0, 25).map((c) => ({
          label: c.name,
          description: `${c.price} บาท • เหลือ ${c.stock_left} ชิ้น`,
          value: String(c.id),
          emoji: c.emoji || '📦',
        }))
      );

    const row = new ActionRowBuilder().addComponents(select);

    await interaction.reply({ embeds: [embed], components: [row] });
  },
};
