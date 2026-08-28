const {
  Events,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require('discord.js');
const { getCategory, listPlans, getPlan, stockCount, claimOneStockItem } = require('../utils/shop');
const { getBalance, deductBalance, addBalance } = require('../utils/wallet');
const { baseEmbed } = require('../utils/brand');

module.exports = {
  name: Events.InteractionCreate,
  async execute(interaction) {
    // ---------- Slash commands ----------
    if (interaction.isChatInputCommand()) {
      const command = interaction.client.commands.get(interaction.commandName);
      if (!command) return;
      try {
        await command.execute(interaction);
      } catch (err) {
        console.error(err);
        const payload = { content: '❌ เกิดข้อผิดพลาดขณะทำงาน กรุณาลองใหม่', ephemeral: true };
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(payload);
        } else {
          await interaction.reply(payload);
        }
      }
      return;
    }

    // ---------- Category select menu -> show plans (แพ็กเกจตามจำนวนวัน) ----------
    if (interaction.isStringSelectMenu() && interaction.customId === 'select_category') {
      const categoryId = interaction.values[0];
      const category = getCategory(Number(categoryId));
      if (!category) {
        return interaction.reply({ content: '❌ ไม่พบหมวดหมู่นี้แล้ว', ephemeral: true });
      }

      const plans = listPlans(category.id);
      if (plans.length === 0) {
        return interaction.reply({
          content: `⚠️ หมวดหมู่ **${category.name}** ยังไม่มีแพ็กเกจให้เลือก (แอดมินต้องเพิ่มด้วย /addplan)`,
          ephemeral: true,
        });
      }

      const embed = baseEmbed()
        .setTitle(`${category.emoji} ${category.name}`)
        .setDescription(category.description || 'เลือกแพ็กเกจที่ต้องการด้านล่าง')
        .addFields(
          plans.map((p) => ({
            name: `${p.label}`,
            value: `💵 ${p.price} บาท • 📦 เหลือ ${p.stock_left} ชิ้น`,
            inline: true,
          }))
        );

      // Discord จำกัด 5 ปุ่มต่อแถว, 5 แถว = 25 ปุ่มสูงสุด
      const rows = [];
      for (let i = 0; i < plans.length; i += 5) {
        const chunk = plans.slice(i, i + 5);
        const row = new ActionRowBuilder().addComponents(
          chunk.map((p) =>
            new ButtonBuilder()
              .setCustomId(`plan_${p.id}`)
              .setLabel(`${p.label} • ${p.price}฿`)
              .setStyle(ButtonStyle.Primary)
              .setDisabled(p.stock_left === 0)
          )
        );
        rows.push(row);
      }

      return interaction.reply({ embeds: [embed], components: rows, ephemeral: true });
    }

    // ---------- Plan button -> opens quantity modal ----------
    if (interaction.isButton() && interaction.customId.startsWith('plan_')) {
      const planId = interaction.customId.replace('plan_', '');

      const modal = new ModalBuilder()
        .setCustomId(`buy_modal_${planId}`)
        .setTitle('ยืนยันการซื้อสินค้า');

      const qtyInput = new TextInputBuilder()
        .setCustomId('quantity')
        .setLabel('จำนวนที่ต้องการซื้อ')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('เช่น 1')
        .setValue('1')
        .setRequired(true);

      modal.addComponents(new ActionRowBuilder().addComponents(qtyInput));
      return interaction.showModal(modal);
    }

    // ---------- Modal submit -> process purchase ----------
    if (interaction.isModalSubmit() && interaction.customId.startsWith('buy_modal_')) {
      const planId = Number(interaction.customId.replace('buy_modal_', ''));
      const plan = getPlan(planId);
      if (!plan) {
        return interaction.reply({ content: '❌ ไม่พบแพ็กเกจนี้แล้ว', ephemeral: true });
      }

      const qtyRaw = interaction.fields.getTextInputValue('quantity');
      const quantity = parseInt(qtyRaw, 10);

      if (!Number.isInteger(quantity) || quantity <= 0) {
        return interaction.reply({ content: '❌ กรุณาใส่จำนวนเป็นตัวเลขที่มากกว่า 0', ephemeral: true });
      }

      const available = stockCount(plan.id);
      if (quantity > available) {
        return interaction.reply({
          content: `❌ สต็อกไม่พอ (คงเหลือ ${available} ชิ้น)`,
          ephemeral: true,
        });
      }

      const totalPrice = plan.price * quantity;
      const balance = getBalance(interaction.user.id);
      if (balance < totalPrice) {
        return interaction.reply({
          content: `❌ ยอดเงินไม่พอ ต้องการ **${totalPrice} บาท** แต่คุณมี **${balance} บาท**\nใช้ \`/เติมเงิน\` เพื่อเติมเงินก่อนสั่งซื้อ`,
          ephemeral: true,
        });
      }

      await interaction.deferReply({ ephemeral: true });

      // หักเงินก่อน (atomic) แล้วค่อยเคลม stock ทีละชิ้น กันแย่งกันซื้อ
      const productLabel = `${plan.category_name} - ${plan.label}`;
      const deducted = deductBalance(interaction.user.id, totalPrice, `buy:${productLabel} x${quantity}`);
      if (!deducted) {
        return interaction.editReply('❌ ยอดเงินไม่พอ (มีการเปลี่ยนแปลงระหว่างทำรายการ)');
      }

      const claimedItems = [];
      for (let i = 0; i < quantity; i++) {
        const item = claimOneStockItem(plan.id, interaction.user.id);
        if (item) claimedItems.push(item);
      }

      // ถ้าเคลมได้ไม่ครบ (สต็อกหมดกลางทาง) คืนเงินส่วนที่ขาด
      if (claimedItems.length < quantity) {
        const shortfall = quantity - claimedItems.length;
        const refund = shortfall * plan.price;
        addBalance(interaction.user.id, refund, 'topup', 'refund:out_of_stock');
      }

      if (claimedItems.length === 0) {
        return interaction.editReply('❌ สต็อกหมดพอดี ระบบคืนเงินให้แล้ว กรุณาลองใหม่');
      }

      const deliveryText = claimedItems.map((it, idx) => `\`${idx + 1}.\` ${it.content}`).join('\n');

      const dmEmbed = baseEmbed()
        .setTitle(`✅ ขอบคุณที่อุดหนุน ${plan.category_emoji} ${productLabel}`)
        .setDescription(`นี่คือสินค้าของคุณ (${claimedItems.length} ชิ้น):\n\n${deliveryText}`)
        .addFields({ name: 'ยอดที่ชำระ', value: `${claimedItems.length * plan.price} บาท` });

      try {
        await interaction.user.send({ embeds: [dmEmbed] });
        await interaction.editReply(
          `✅ ซื้อสำเร็จ! ส่งสินค้า **${claimedItems.length}/${quantity}** ชิ้นให้ทาง DM แล้ว` +
          (claimedItems.length < quantity ? `\n⚠️ สต็อกไม่พอสำหรับส่วนที่เหลือ ระบบคืนเงินให้อัตโนมัติ` : '')
        );
      } catch (err) {
        // DM ปิดอยู่ — ส่งในช่องแทน (ephemeral)
        await interaction.editReply({
          content: '⚠️ เปิด DM ไม่ได้ ส่งสินค้าไว้ตรงนี้แทน (ข้อความนี้เห็นเฉพาะคุณ):',
          embeds: [dmEmbed],
        });
      }

      const logChannelId = process.env.LOG_CHANNEL_ID;
      if (logChannelId) {
        const ch = interaction.client.channels.cache.get(logChannelId);
        if (ch) {
          ch.send(
            `🛒 <@${interaction.user.id}> ซื้อ **${productLabel}** x${claimedItems.length} ` +
            `รวม **${claimedItems.length * plan.price} บาท**`
          );
        }
      }
    }
  },
};
