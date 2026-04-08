// ══════════════════════════════════════════════════════════════
//  Google Apps Script — คลังยา PCU สะบ้าย้อย
//  เพิ่ม case 'medicinedb' ในฟังก์ชัน doGet() ที่มีอยู่แล้ว
// ══════════════════════════════════════════════════════════════

// ── เพิ่มใน doGet(e) switch/if block ─────────────────────────
//
//  case 'medicinedb':
//    return getMedicineDB_(ss);
//
// ─────────────────────────────────────────────────────────────

function getMedicineDB_(ss) {
  try {
    const sheet = ss.getSheetByName('MedicineDB');
    if (!sheet) {
      return json_({ status: 'error', message: 'ไม่พบชีต MedicineDB' });
    }
    const data = sheet.getDataRange().getValues();
    // แถวแรกเป็น header — ข้ามไป
    // คอลัมน์: A=รหัสยา, B=ชื่อยา, C=หน่วยบรรจุ, D=หน่วยนับย่อย, E=ประเภท, F=จำนวนขั้นต่ำ
    const rows = data.slice(1)
      .map(r => [
        String(r[0] || '').trim(),   // [0] code
        String(r[1] || '').trim(),   // [1] name
        String(r[2] || '').trim(),   // [2] unitPack
        String(r[3] || '').trim(),   // [3] unitSub
        String(r[4] || '').trim(),   // [4] type
        Number(r[5]) || 1            // [5] min
      ])
      .filter(r => r[0] && r[1]);   // ต้องมีรหัสและชื่อ

    return json_({ status: 'ok', rows: rows });
  } catch (e) {
    return json_({ status: 'error', message: e.message });
  }
}

// ── helper (มีอยู่แล้วในสคริปต์หลัก — ใช้ชื่อเดิม) ───────────
// function json_(obj) {
//   return ContentService.createTextOutput(JSON.stringify(obj))
//     .setMimeType(ContentService.MimeType.JSON);
// }

// ══════════════════════════════════════════════════════════════
//  วิธีใช้งาน:
//  1. เปิด Google Apps Script ของโปรเจกต์นี้
//  2. วาง function getMedicineDB_(ss){...} ด้านบนลงในไฟล์ Code.gs
//  3. ในฟังก์ชัน doGet(e) ที่มีอยู่แล้ว ให้เพิ่ม:
//
//     const action = e.parameter.action || '';
//     ...
//     if (action === 'medicinedb') return getMedicineDB_(ss);
//
//  4. Deploy > Manage deployments > Deploy ใหม่ (New deployment)
//     หรือ Update deployment ที่มีอยู่
// ══════════════════════════════════════════════════════════════
