const db = require('../database/db');

function getBalance(userId) {
  const row = db.prepare('SELECT balance FROM balances WHERE user_id = ?').get(userId);
  return row ? row.balance : 0;
}

function ensureAccount(userId) {
  db.prepare('INSERT OR IGNORE INTO balances (user_id, balance) VALUES (?, 0)').run(userId);
}

function addBalance(userId, amount, type, detail = '') {
  const tx = db.transaction(() => {
    ensureAccount(userId);
    db.prepare('UPDATE balances SET balance = balance + ? WHERE user_id = ?').run(amount, userId);
    db.prepare(
      'INSERT INTO transactions (user_id, type, amount, detail) VALUES (?, ?, ?, ?)'
    ).run(userId, type, amount, detail);
    return getBalance(userId);
  });
  return tx();
}

// หักเงิน — คืน false ถ้ายอดไม่พอ (กัน race condition ด้วย transaction)
function deductBalance(userId, amount, detail = '') {
  const tx = db.transaction(() => {
    ensureAccount(userId);
    const current = getBalance(userId);
    if (current < amount) return false;
    db.prepare('UPDATE balances SET balance = balance - ? WHERE user_id = ?').run(amount, userId);
    db.prepare(
      'INSERT INTO transactions (user_id, type, amount, detail) VALUES (?, ?, ?, ?)'
    ).run(userId, 'purchase', -amount, detail);
    return true;
  });
  return tx();
}

module.exports = { getBalance, ensureAccount, addBalance, deductBalance };
