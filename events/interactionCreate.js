const {
  Events,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require('discord.js');
const { getCategory, listPlans, getPlan, purchasePlan } = require('../utils/shop');
const { baseEmbed } = require('../utils/brand');

module.exports = {
  name: Events.InteractionCreate,
  async execute(interaction) {
    // ---------- Autocomplete (แนะนำตัวเลือกให้แตะแทนพิมพ์เอง) ----------
    if (interaction.isAutocomplete()) {
      const command = interaction.client.commands.get(interaction.commandName);
      if (!command || !command.autocomplete) return;
      try {
        await command.autocomplete(interaction);
      } catch (err) {
        console.error(err);
      }
      return;
    }

    // ---------- Slash commands ----------
    if (interaction.isChatInputCommand()) {
      const command = interaction.client.commands.get(interaction.commandName);
      if (!command) return;
      try {
        await command.execute(interaction);
      } catch (err) {
        console.error(err);
        const payload = { content: '❌ เกิดข้อผิดพลาดขณะทำงาน กรุณาลองใหม่', ephemeral: true };
        if (interaction.deferred && !interaction.replied) {
          await interaction.editReply(payload);
        } else if (interaction.replied) {
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
          plans.slice(0, 25).map((p) => ({
            name: `${p.label}`,
            value: `💵 ${p.price} บาท • 📦 เหลือ ${p.stock_left} ชิ้น`,
            inline: true,
          }))
        );

      // Discord จำกัด 5 ปุ่มต่อแถว, 5 แถว = 25 ปุ่มสูงสุด
      const rows = [];
      for (let i = 0; i < Math.min(plans.length, 25); i += 5) {
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

      if (plans.length > 25) {
        embed.setFooter({ text: 'แสดง 25 แพ็กเกจแรก กรุณาติดต่อแอดมินหากไม่พบแพ็กเกจที่ต้องการ' });
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
        .setMaxLength(4)
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
      const quantityText = qtyRaw.trim();
      const quantity = /^\d+$/.test(quantityText) ? Number(quantityText) : NaN;

      if (!Number.isSafeInteger(quantity) || quantity <= 0 || quantity > 1000) {
        return interaction.reply({ content: '❌ กรุณาใส่จำนวนเต็มระหว่าง 1–1,000', ephemeral: true });
      }

      await interaction.deferReply({ ephemeral: true });

      const result = purchasePlan(plan.id, interaction.user.id, quantity);
      if (!result.ok) {
        if (result.reason === 'out_of_stock') {
          return interaction.editReply(`❌ สต็อกไม่พอ (คงเหลือ ${result.available} ชิ้น)`);
        }
        if (result.reason === 'insufficient_balance') {
          return interaction.editReply(
            `❌ ยอดเงินไม่พอ ต้องการ **${result.totalPrice} บาท** แต่คุณมี **${result.balance} บาท**\n` +
            'ใช้ `/เติมเงิน` เพื่อเติมเงินก่อนสั่งซื้อ'
          );
        }
        if (result.reason === 'delivery_too_large') {
          return interaction.editReply('❌ สินค้าจำนวนนี้ยาวเกินขีดจำกัดการส่งของ Discord กรุณาซื้อทีละน้อยลง');
        }
        return interaction.editReply('❌ ไม่สามารถทำรายการนี้ได้ กรุณาลองใหม่');
      }

      const { plan: purchasedPlan, items: claimedItems, totalPrice } = result;
      const productLabel = `${purchasedPlan.category_name} - ${purchasedPlan.label}`;
      const deliveryText = claimedItems.map((it, idx) => `\`${idx + 1}.\` ${it.content}`).join('\n');

      const dmEmbed = baseEmbed()
        .setTitle(`✅ ขอบคุณที่อุดหนุน ${purchasedPlan.category_emoji} ${productLabel}`)
        .setDescription(`นี่คือสินค้าของคุณ (${claimedItems.length} ชิ้น):\n\n${deliveryText}`)
        .addFields({ name: 'ยอดที่ชำระ', value: `${totalPrice} บาท` });

      try {
        await interaction.user.send({ embeds: [dmEmbed] });
        await interaction.editReply(
          `✅ ซื้อสำเร็จ! ส่งสินค้า **${claimedItems.length}** ชิ้นให้ทาง DM แล้ว`
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
            `รวม **${totalPrice} บาท**`
          ).catch((err) => console.error('ส่ง log การซื้อไม่สำเร็จ:', err));
        }
      }
    }
  },
};
