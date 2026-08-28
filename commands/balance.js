const { SlashCommandBuilder } = require('discord.js');
const { getBalance } = require('../utils/wallet');
const { baseEmbed, BRAND } = require('../utils/brand');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('เช็คเงิน')
    .setDescription('เช็คยอดเงินคงเหลือในบัญชี Dustybun.Store ของคุณ'),

  async execute(interaction) {
    const balance = getBalance(interaction.user.id);
    const embed = baseEmbed()
      .setTitle('💎 ยอดเงินคงเหลือ')
      .setDescription(`บัญชีของ <@${interaction.user.id}>\n\n**${balance.toLocaleString()} บาท**`);

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
