// เก็บไฟล์ที่แนบไว้ชั่วคราวระหว่างขั้นตอนเลือกหมวดหมู่ -> เลือกแพ็กเกจ
// (อยู่ใน memory เท่านั้น หายไปเมื่อบอทรีสตาร์ท — ใช้แค่ระหว่างทำรายการ)
const pending = new Map();

function createPending(userId, attachment) {
  const id = Math.random().toString(36).slice(2, 8); // รหัสสั้นๆ 6 ตัวอักษร
  pending.set(id, {
    userId,
    url: attachment.url,
    filename: attachment.name,
    createdAt: Date.now(),
  });
  // เคลียร์อัตโนมัติถ้าไม่มีใครกดต่อภายใน 10 นาที
  setTimeout(() => pending.delete(id), 10 * 60 * 1000);
  return id;
}

function getPending(id) {
  return pending.get(id);
}

function deletePending(id) {
  pending.delete(id);
}

module.exports = { createPending, getPending, deletePending };
