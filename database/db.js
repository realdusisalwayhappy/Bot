const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'shop.sqlite'));
db.pragma('journal_mode = WAL');

// ---------- Schema ----------
db.exec(`
CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  emoji TEXT DEFAULT '📦',
  price INTEGER NOT NULL,          -- ราคาต่อชิ้น (บาท)
  description TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS stock (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id INTEGER NOT NULL,
  content TEXT NOT NULL,           -- ข้อมูลสินค้า 1 ชิ้น (เช่น user:pass หรือ key)
  sold INTEGER DEFAULT 0,
  sold_to TEXT,
  sold_at TEXT,
  FOREIGN KEY (category_id) REFERENCES categories(id)
);

CREATE TABLE IF NOT EXISTS balances (
  user_id TEXT PRIMARY KEY,
  balance INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL,              -- 'topup' | 'purchase'
  amount INTEGER NOT NULL,
  detail TEXT,
  created_at TEXT DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS redeemed_vouchers (
  voucher_code TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  amount INTEGER NOT NULL,
  redeemed_at TEXT DEFAULT (datetime('now','localtime'))
);
`);

module.exports = db;
