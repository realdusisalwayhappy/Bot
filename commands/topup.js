const { SlashCommandBuilder } = require('discord.js');
const { extractVoucherCode, redeemVoucher, isVoucherAlreadyUsed, creditVoucher } = require('../utils/truemoney');
const { baseEmbed } = require('../utils/brand');

const data = new SlashCommandBuilder()
    .setName('เติมเงิน')
    .setDescription('เติมเงินเข้าบัญชีด้วยซองอั่งเปา TrueMoney Wallet')
    .addStringOption((opt) =>
      opt
        .setName('ลิงก์ซอง')
        .setDescription('วางลิงก์ซองอั่งเปา TrueMoney ของคุณ')
        .setRequired(true)
    );

async function processTopup(interaction, raw) {
    const phone = process.env.TRUEMONEY_PHONE;
    if (!phone) {
      return interaction.reply({
        content: '⚠️ ระบบเติมเงินยังไม่ถูกตั้งค่าโดยแอดมิน (ไม่พบ TRUEMONEY_PHONE)',
        ephemeral: true,
      });
    }

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

    if (!Number.isSafeInteger(result.amount) || result.amount <= 0) {
      return interaction.editReply('❌ ระบบได้รับจำนวนเงินจาก TrueMoney ไม่ถูกต้อง กรุณาติดต่อแอดมิน');
    }

    let newBalance;
    try {
      // UNIQUE(voucher_code) เป็นด่านสุดท้ายกันการเติมซ้ำจากคำขอพร้อมกัน
      newBalance = creditVoucher(code, interaction.user.id, result.amount);
    } catch (err) {
      if (isVoucherAlreadyUsed(code)) {
        return interaction.editReply('❌ ซองนี้ถูกใช้ไปแล้ว ไม่สามารถเติมเงินซ้ำได้');
      }
      console.error('บันทึกยอดเติมเงินไม่สำเร็จ:', err);
      return interaction.editReply('❌ ระบบบันทึกยอดเงินไม่สำเร็จ กรุณาติดต่อแอดมินพร้อมแจ้งเวลาทำรายการ');
    }

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
        ch.send(`💰 <@${interaction.user.id}> เติมเงิน **${result.amount} บาท** ผ่านซอง TrueMoney`)
          .catch((err) => console.error('ส่ง log การเติมเงินไม่สำเร็จ:', err));
      }
    }
}

module.exports = {
  data,
  execute(interaction) {
    return processTopup(interaction, interaction.options.getString('ลิงก์ซอง'));
  },
  processTopup,
};
