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
};
