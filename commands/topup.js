const { SlashCommandBuilder } = require('discord.js');
const { extractVoucherCode, redeemVoucher, isVoucherAlreadyUsed, markVoucherUsed } = require('../utils/truemoney');
const { addBalance, getBalance } = require('../utils/wallet');
const { baseEmbed } = require('../utils/brand');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('เติมเงิน')
    .setDescription('เติมเงินเข้าบัญชีด้วยซองอั่งเปา TrueMoney Wallet')
    .addStringOption((opt) =>
      opt
        .setName('ลิงก์ซอง')
        .setDescription('วางลิงก์ซองอั่งเปา TrueMoney ของคุณ')
        .setRequired(true)
    ),

  async execute(interaction) {
    const phone = process.env.TRUEMONEY_PHONE;
    if (!phone) {
      return interaction.reply({
        content: '⚠️ ระบบเติมเงินยังไม่ถูกตั้งค่าโดยแอดมิน (ไม่พบ TRUEMONEY_PHONE)',
        ephemeral: true,
      });
    }

    const raw = interaction.options.getString('ลิงก์ซอง');
    const code = extractVoucherCode(raw);

    if (!code) {
      return interaction.reply({
        content: '❌ ลิงก์ซองไม่ถูกต้อง กรุณาคัดลอกลิงก์จากแอป TrueMoney Wallet มาวางทั้งหมด',
        ephemeral: true,
      });
    }

    if (isVoucherAlreadyUsed(code)) {
      return interaction.reply({
        content: '❌ ซองนี้ถูกใช้ไปแล้ว ไม่สามารถเติมเงินซ้ำได้',
        ephemeral: true,
      });
    }

    await interaction.deferReply({ ephemeral: true });

    const result = await redeemVoucher(code, phone);

    if (!result.ok) {
      return interaction.editReply(`❌ เติมเงินไม่สำเร็จ: ${result.reason}`);
    }

    markVoucherUsed(code, interaction.user.id, result.amount);
    const newBalance = addBalance(interaction.user.id, result.amount, 'topup', `voucher:${code}`);

    const embed = baseEmbed()
      .setTitle('✅ เติมเงินสำเร็จ')
      .setDescription(
        `เติมเงินจำนวน **${result.amount} บาท** เรียบร้อย\n` +
        `ยอดคงเหลือปัจจุบัน: **${newBalance.toLocaleString()} บาท**`
      );

    await interaction.editReply({ embeds: [embed] });

    const logChannelId = process.env.LOG_CHANNEL_ID;
    if (logChannelId) {
      const ch = interaction.client.channels.cache.get(logChannelId);
      if (ch) {
        ch.send(`💰 <@${interaction.user.id}> เติมเงิน **${result.amount} บาท** ผ่านซอง TrueMoney`);
      }
    }
  },
};
