const db = require('../database/db');

// ---------- Categories ----------
function listCategories() {
  return db.prepare(`
    SELECT c.*,
      (SELECT COUNT(*) FROM plans p WHERE p.category_id = c.id) AS plan_count
    FROM categories c
    ORDER BY c.name ASC
  `).all();
}

function getCategory(idOrName) {
  const byId = db.prepare('SELECT * FROM categories WHERE id = ?').get(idOrName);
  if (byId) return byId;
  return db.prepare('SELECT * FROM categories WHERE name = ?').get(idOrName);
}

function addCategory(name, emoji = '📦', description = '') {
  name = String(name || '').trim();
  emoji = String(emoji || '📦').trim();
  description = String(description || '').trim();
  if (!name || name.length > 80) throw new Error('invalid_category_name');
  if (emoji.length > 32) throw new Error('invalid_category_emoji');
  if (description.length > 1000) throw new Error('invalid_category_description');
  return db.prepare(
    'INSERT INTO categories (name, emoji, description) VALUES (?, ?, ?)'
  ).run(name, emoji, description);
}

// ---------- Plans (แพ็กเกจ/ระยะเวลาในแต่ละหมวดหมู่) ----------
function listPlans(categoryId) {
  return db.prepare(`
    SELECT p.*,
      (SELECT COUNT(*) FROM stock s WHERE s.plan_id = p.id AND s.sold = 0) AS stock_left
    FROM plans p
    WHERE p.category_id = ?
    ORDER BY p.sort_order ASC, p.price ASC
  `).all(categoryId);
}

function getPlan(id) {
  return db.prepare(`
    SELECT p.*, c.name AS category_name, c.emoji AS category_emoji
    FROM plans p
    JOIN categories c ON c.id = p.category_id
    WHERE p.id = ?
  `).get(id);
}

function getPlanByLabel(categoryId, label) {
  return db.prepare('SELECT * FROM plans WHERE category_id = ? AND label = ?').get(categoryId, label);
}

function addPlan(categoryId, label, price, sortOrder = 0) {
  label = String(label || '').trim();
  if (!Number.isSafeInteger(price) || price < 1 || price > 1000000) {
    throw new Error('invalid_plan_price');
  }
  if (!label || label.length > 80) throw new Error('invalid_plan_label');
  if (!Number.isSafeInteger(sortOrder) || sortOrder < 0 || sortOrder > 100000) {
    throw new Error('invalid_plan_order');
  }
  if (getPlanByLabel(categoryId, label)) throw new Error('duplicate_plan');
  return db.prepare(
    'INSERT INTO plans (category_id, label, price, sort_order) VALUES (?, ?, ?, ?)'
  ).run(categoryId, label, price, sortOrder);
}

// ---------- Stock ----------
function stockCount(planId) {
  return db.prepare(
    'SELECT COUNT(*) AS c FROM stock WHERE plan_id = ? AND sold = 0'
  ).get(planId).c;
}

function addStockLines(planId, lines) {
  if (!Number.isInteger(planId) || !getPlan(planId)) throw new Error('invalid_plan');
  if (!Array.isArray(lines) || lines.length === 0 || lines.length > 10000) {
    throw new Error('invalid_stock_batch');
  }
  if (lines.some((line) => typeof line !== 'string' || !line.trim() || line.length > 1000)) {
    throw new Error('invalid_stock_line');
  }
  const insert = db.prepare('INSERT INTO stock (plan_id, content) VALUES (?, ?)');
  const insertMany = db.transaction((items) => {
    for (const line of items) insert.run(planId, line);
  });
  insertMany(lines);
  return lines.length;
}

// ดึงสินค้า 1 ชิ้นที่ยังไม่ขาย แล้ว mark ว่าขายแล้วแบบ atomic (กันซื้อซ้ำ/แย่งกัน)
function claimOneStockItem(planId, userId) {
  const tx = db.transaction(() => {
    const item = db.prepare(
      'SELECT * FROM stock WHERE plan_id = ? AND sold = 0 ORDER BY id ASC LIMIT 1'
    ).get(planId);
    if (!item) return null;
    db.prepare(
      `UPDATE stock SET sold = 1, sold_to = ?, sold_at = datetime('now','localtime') WHERE id = ?`
    ).run(userId, item.id);
    return item;
  });
  return tx();
}

// ซื้อสินค้าแบบ atomic: ตรวจสต็อก + ตรวจยอดเงิน + หักเงิน + ตัดสต็อก
// อยู่ใน SQLite transaction เดียวกัน ป้องกันเงินถูกหักแต่ไม่ได้สินค้าเมื่อบอทล้มกลางทาง
function purchasePlan(planId, userId, quantity) {
  if (!Number.isSafeInteger(quantity) || quantity <= 0 || quantity > 1000) {
    return { ok: false, reason: 'invalid_quantity' };
  }

  const tx = db.transaction(() => {
    const plan = getPlan(planId);
    if (!plan) return { ok: false, reason: 'plan_not_found' };
    if (!Number.isSafeInteger(plan.price) || plan.price < 1) {
      return { ok: false, reason: 'invalid_plan_price' };
    }

    const items = db.prepare(
      'SELECT * FROM stock WHERE plan_id = ? AND sold = 0 ORDER BY id ASC LIMIT ?'
    ).all(planId, quantity);
    if (items.length < quantity) {
      return { ok: false, reason: 'out_of_stock', available: items.length };
    }
    const deliveryText = items.map((item, index) => `\`${index + 1}.\` ${item.content}`).join('\n');
    if (deliveryText.length > 3800) {
      return { ok: false, reason: 'delivery_too_large' };
    }

    db.prepare('INSERT OR IGNORE INTO balances (user_id, balance) VALUES (?, 0)').run(userId);
    const balance = db.prepare('SELECT balance FROM balances WHERE user_id = ?').get(userId).balance;
    const totalPrice = plan.price * quantity;
    if (!Number.isSafeInteger(totalPrice) || balance < totalPrice) {
      return { ok: false, reason: 'insufficient_balance', balance, totalPrice };
    }

    db.prepare('UPDATE balances SET balance = balance - ? WHERE user_id = ?')
      .run(totalPrice, userId);
    db.prepare(
      'INSERT INTO transactions (user_id, type, amount, detail) VALUES (?, ?, ?, ?)'
    ).run(userId, 'purchase', -totalPrice, `buy:${plan.category_name} - ${plan.label} x${quantity}`);

    const markSold = db.prepare(
      `UPDATE stock SET sold = 1, sold_to = ?, sold_at = datetime('now','localtime')
       WHERE id = ? AND sold = 0`
    );
    for (const item of items) {
      const result = markSold.run(userId, item.id);
      if (result.changes !== 1) throw new Error('stock_claim_failed');
    }

    return {
      ok: true,
      plan,
      items,
      totalPrice,
      balance: balance - totalPrice,
    };
  });

  return tx();
}

module.exports = {
  listCategories,
  getCategory,
  addCategory,
  listPlans,
  getPlan,
  getPlanByLabel,
  addPlan,
  stockCount,
  addStockLines,
  claimOneStockItem,
  purchasePlan,
};
