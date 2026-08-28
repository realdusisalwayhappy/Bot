const { EmbedBuilder } = require('discord.js');

const BRAND = {
  name: 'Dustybun.Store',
  color: 0x8ea3ff, // ฟ้าม่วงพาสเทล
  footer: 'Dustybun.Store • Auto Buy 24/7',
  thumbnail: null, // ใส่ URL โลโก้ร้านได้ตรงนี้
};

function baseEmbed() {
  return new EmbedBuilder()
    .setColor(BRAND.color)
    .setFooter({ text: BRAND.footer })
    .setTimestamp();
}

module.exports = { BRAND, baseEmbed };
