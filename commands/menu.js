const {
  SlashCommandBuilder,
  StringSelectMenuBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');
const { listCategories } = require('../utils/shop');
const { baseEmbed, BRAND } = require('../utils/brand');

function accountButtons() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('open_topup')
      .setLabel('เติมเงิน')
      .setEmoji('💰')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId('check_balance')
      .setLabel('เช็คเครดิต')
      .setEmoji('💳')
      .setStyle(ButtonStyle.Secondary)
  );
}

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
        components: [accountButtons()],
      });
    }

    const visibleCategories = categories.slice(0, 25);
    const embed = baseEmbed()
      .setTitle(`🛍️ ${BRAND.name} — เมนูสินค้า`)
      .setDescription('เลือกหมวดหมู่จากเมนูด้านล่าง ระบบจะแสดงแพ็กเกจและราคาให้เลือกในหน้าถัดไป')
      .addFields(
        visibleCategories.map((c) => ({
          name: `${c.emoji} ${c.name}`,
          value: `${c.plan_count} แพ็กเกจให้เลือก`,
          inline: true,
        }))
      );

    const select = new StringSelectMenuBuilder()
      .setCustomId('select_category')
      .setPlaceholder('📂 เลือกหมวดหมู่')
      .addOptions(
        visibleCategories.map((c) => ({
          label: c.name,
          description: `${c.plan_count} แพ็กเกจให้เลือก`,
          value: String(c.id),
          emoji: c.emoji || '📦',
        }))
      );

    const row = new ActionRowBuilder().addComponents(select);

    if (categories.length > 25) {
      embed.setFooter({ text: 'แสดง 25 หมวดหมู่แรก กรุณาติดต่อแอดมินหากไม่พบหมวดหมู่ที่ต้องการ' });
    }
    await interaction.reply({ embeds: [embed], components: [row, accountButtons()] });
  },
};
