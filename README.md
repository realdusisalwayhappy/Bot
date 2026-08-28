# 🛍️ Dustybun.Store — Discord Auto Buy Bot

บอทขายแอพพรีเมียมแบบ Auto 24 ชม. สำหรับร้าน **Dustybun.Store**
- เลือกหมวดหมู่สินค้าผ่าน dropdown
- กดซื้อ → กรอกจำนวน → หักเงิน หักสต็อก ส่งสินค้าทาง DM ทันที
- เติมเงินอัตโนมัติผ่านซองอั่งเปา TrueMoney Wallet
- คำสั่งแอดมิน เพิ่มหมวดหมู่ / เพิ่มสต็อกจากไฟล์ .txt

## 1. ติดตั้ง

```bash
npm install
```

## 2. ตั้งค่า .env

คัดลอก `.env.example` เป็น `.env` แล้วกรอกข้อมูล:

```
DISCORD_TOKEN=       # จาก https://discord.com/developers/applications
CLIENT_ID=           # Application ID
GUILD_ID=            # ID เซิร์ฟเวอร์ (สำหรับ deploy คำสั่งแบบเร็วตอน dev)
ADMIN_ROLE_ID=       # Role ID ของแอดมินร้าน
LOG_CHANNEL_ID=      # ห้อง log การซื้อ-ขาย/เติมเงิน
TRUEMONEY_PHONE=     # เบอร์ที่ผูกกับ TrueMoney Wallet ของร้าน (รับซองอั่งเปา)
```

**Bot Permissions ที่ต้องเปิดตอนเชิญบอทเข้าเซิร์ฟเวอร์:**
`applications.commands`, `Send Messages`, `Embed Links`, `Use Slash Commands`

**Privileged Intents:** ไม่จำเป็นต้องเปิด Message Content Intent เพราะระบบนี้ใช้ Slash Command + ปุ่ม/Modal ล้วน

## 3. Deploy คำสั่ง (ครั้งแรก และทุกครั้งที่แก้ไข/เพิ่มคำสั่ง)

```bash
npm run deploy
```

## 4. รันบอท

```bash
npm start
```

## วิธีใช้งาน (ฝั่งลูกค้า)

| คำสั่ง | อธิบาย |
|---|---|
| `/menu` | เปิดเมนูร้าน เลือกหมวดหมู่สินค้า |
| `/เช็คเงิน` | เช็คยอดเงินคงเหลือ |
| `/เติมเงิน ลิงก์ซอง:<ลิงก์อั่งเปา>` | เติมเงินอัตโนมัติผ่าน TrueMoney |

## วิธีใช้งาน (ฝั่งแอดมิน)

| คำสั่ง | อธิบาย |
|---|---|
| `/addcategory name:<ชื่อ> price:<ราคา> emoji:<อีโมจิ> description:<รายละเอียด>` | เพิ่มหมวดหมู่สินค้าใหม่ |
| `/addstock category:<ชื่อหมวดหมู่> file:<แนบไฟล์ .txt>` | เพิ่มสต็อก โดย 1 บรรทัดในไฟล์ = สินค้า 1 ชิ้น เช่น `user1:pass1` |

> จำกัดสิทธิ์แอดมินด้วย `ADMIN_ROLE_ID` ใน `.env` หรือใครก็ตามที่มีสิทธิ์ Administrator ในเซิร์ฟเวอร์

## โครงสร้างไฟล์

```
dustybun-bot/
├── index.js              # จุดเริ่มบอท โหลด commands/events
├── deploy-commands.js     # ลงทะเบียน slash commands กับ Discord
├── commands/
│   ├── menu.js            # /menu
│   ├── balance.js         # /เช็คเงิน
│   ├── topup.js           # /เติมเงิน
│   ├── addcategory.js     # /addcategory (แอดมิน)
│   └── addstock.js        # /addstock (แอดมิน)
├── events/
│   ├── ready.js
│   └── interactionCreate.js  # select menu / ปุ่มซื้อ / modal ยืนยันซื้อ
├── database/
│   └── db.js               # schema + connection (SQLite ไฟล์เดียว shop.sqlite)
└── utils/
    ├── shop.js              # จัดการหมวดหมู่/สต็อก
    ├── wallet.js             # จัดการยอดเงินผู้ใช้
    ├── truemoney.js          # redeem ซองอั่งเปา
    └── brand.js               # สี/ฟอนต์ embed ของร้าน
```

## หมายเหตุด้านความปลอดภัย

- การหักเงิน/เคลมสต็อกทำผ่าน SQLite transaction (`better-sqlite3`) ป้องกันลูกค้ากดซื้อพร้อมกันแล้วได้สินค้าเกินสต็อกหรือโดนหักเงินซ้ำ
- ถ้าสต็อกหมดพอดีระหว่างทำรายการ ระบบคืนเงินส่วนที่ขาดให้อัตโนมัติ
- ทุกซองอั่งเปาที่ redeem แล้วจะถูกบันทึกกันเติมซ้ำ (`redeemed_vouchers` table)
- ไฟล์สต็อกสินค้า (username/password/key) เก็บใน `database/shop.sqlite` — **อย่า commit ไฟล์นี้ขึ้น public repo**, ใส่ใน `.gitignore`
