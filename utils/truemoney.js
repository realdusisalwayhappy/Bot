const axios = require('axios');
const db = require('../database/db');

/**
 * แกะรหัสซองอั่งเปาจากลิงก์ TrueMoney
 * รองรับทั้งลิงก์เต็มและโค้ดเปล่า
 */
function extractVoucherCode(input) {
  const match = input.match(/gift\.truemoney\.com\/campaign\/?\?v=([a-zA-Z0-9]+)/);
  if (match) return match[1];
  const cleaned = input.trim();
  if (/^[a-zA-Z0-9]{10,}$/.test(cleaned)) return cleaned;
  return null;
}

/**
 * Redeem ซองอั่งเปา TrueMoney Wallet เข้าบัญชีร้าน
 * ใช้ endpoint สาธารณะของ TrueMoney (ผู้ค้าออนไลน์ไทยทั่วไปใช้สำหรับระบบเติมเงินอัตโนมัติ)
 * ต้องตั้งค่า TRUEMONEY_PHONE ในไฟล์ .env เป็นเบอร์ที่ผูกกับ Wallet ของร้าน
 */
async function redeemVoucher(voucherCode, mobileNumber) {
  const url = `https://gift.truemoney.com/campaign/vouchers/${voucherCode}/redeem`;
  try {
    const res = await axios.post(
      url,
      { mobile: mobileNumber, voucher_hash: voucherCode },
      { headers: { 'Content-Type': 'application/json' }, timeout: 10000 }
    );

    const data = res.data;
    if (data.status && data.status.code === 'SUCCESS') {
      return {
        ok: true,
        amount: Math.round(parseFloat(data.data.my_ticket.amount_baht)),
        voucherCode,
      };
    }

    return {
      ok: false,
      reason: (data.status && data.status.message) || 'ไม่สามารถ redeem ซองได้',
      code: data.status && data.status.code,
    };
  } catch (err) {
    const apiMsg = err.response?.data?.status?.message;
    return { ok: false, reason: apiMsg || 'เชื่อมต่อ TrueMoney ไม่สำเร็จ ลองใหม่อีกครั้ง' };
  }
}

function isVoucherAlreadyUsed(voucherCode) {
  return !!db.prepare('SELECT 1 FROM redeemed_vouchers WHERE voucher_code = ?').get(voucherCode);
}

function markVoucherUsed(voucherCode, userId, amount) {
  db.prepare(
    'INSERT INTO redeemed_vouchers (voucher_code, user_id, amount) VALUES (?, ?, ?)'
  ).run(voucherCode, userId, amount);
}

module.exports = { extractVoucherCode, redeemVoucher, isVoucherAlreadyUsed, markVoucherUsed };
