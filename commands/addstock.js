const { SlashCommandBuilder, PermissionFlagsBits, StringSelectMenuBuilder, ActionRowBuilder } = require('discord.js');
const { listCategories } = require('../utils/shop');
const { createPending } = require('../utils/pendingUploads');
const { baseEmbed } = require('../utils/brand');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('เพิ่มเข้าหมวดหมู่')
    .setDescription('[แอดมิน] เพิ่มสต็อกสินค้า — แนบไฟล์แล้วเลือกหมวดหมู่/แพ็กเกจจากเมนู')
    .addAttachmentOption((o) => o.setName('file').setDescription('ไฟล์ .txt รายการสินค้า บรรทัดละ 1 ชิ้น').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const adminRoleId = process.env.ADMIN_ROLE_ID;
    if (adminRoleId && !interaction.member.roles.cache.has(adminRoleId) && !interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ content: '❌ คุณไม่มีสิทธิ์ใช้คำสั่งนี้', ephemeral: true });
    }

    const attachment = interaction.options.getAttachment('file');
    if (!attachment.name.endsWith('.txt')) {
      return interaction.reply({ content: '❌ กรุณาแนบไฟล์ .txt เท่านั้น', ephemeral: true });
    }

    const categories = listCategories();
    if (categories.length === 0) {
      return interaction.reply({
        content: '⚠️ ยังไม่มีหมวดหมู่เลย กรุณาสร้างด้วย `/addcategory` ก่อน',
        ephemeral: true,
      });
    }

    const pendingId = createPending(interaction.user.id, attachment);

    const embed = baseEmbed()
      .setTitle('📦 เพิ่มสต็อกสินค้า')
      .setDescription(`ไฟล์ที่แนบ: **${attachment.name}**\n\nเลือกหมวดหมู่ที่จะเพิ่มสต็อกนี้เข้าไป:`);

    const select = new StringSelectMenuBuilder()
      .setCustomId(`stock_category_${pendingId}`)
      .setPlaceholder('📂 เลือกหมวดหมู่')
      .addOptions(
        categories.slice(0, 25).map((c) => ({
          label: c.name,
          description: `${c.plan_count} แพ็กเกจ`,
          value: String(c.id),
          emoji: c.emoji || '📦',
        }))
      );

    const row = new ActionRowBuilder().addComponents(select);

    await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
  },
};
