const db = require('../database/db');

function listCategories() {
  return db.prepare(`
    SELECT c.*,
      (SELECT COUNT(*) FROM stock s WHERE s.category_id = c.id AND s.sold = 0) AS stock_left
    FROM categories c
    ORDER BY c.name ASC
  `).all();
}

function getCategory(idOrName) {
  const byId = db.prepare('SELECT * FROM categories WHERE id = ?').get(idOrName);
  if (byId) return byId;
  return db.prepare('SELECT * FROM categories WHERE name = ?').get(idOrName);
}

function addCategory(name, price, emoji = '📦', description = '') {
  return db.prepare(
    'INSERT INTO categories (name, price, emoji, description) VALUES (?, ?, ?, ?)'
  ).run(name, price, emoji, description);
}

function stockCount(categoryId) {
  return db.prepare(
    'SELECT COUNT(*) AS c FROM stock WHERE category_id = ? AND sold = 0'
  ).get(categoryId).c;
}

function addStockLines(categoryId, lines) {
  const insert = db.prepare('INSERT INTO stock (category_id, content) VALUES (?, ?)');
  const insertMany = db.transaction((items) => {
    for (const line of items) insert.run(categoryId, line);
  });
  insertMany(lines);
  return lines.length;
}

// ดึงสินค้า 1 ชิ้นที่ยังไม่ขาย แล้ว mark ว่าขายแล้วแบบ atomic (กันซื้อซ้ำ/แย่งกัน)
function claimOneStockItem(categoryId, userId) {
  const tx = db.transaction(() => {
    const item = db.prepare(
      'SELECT * FROM stock WHERE category_id = ? AND sold = 0 ORDER BY id ASC LIMIT 1'
    ).get(categoryId);
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
  stockCount,
  addStockLines,
  claimOneStockItem,
};
