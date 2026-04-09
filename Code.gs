// ══════════════════════════════════════════════════════════════════
//  Google Apps Script — คลังยา PCU สะบ้าย้อย
//  วางโค้ดทั้งหมดนี้ใน Apps Script แทนที่โค้ดเดิม แล้ว Deploy ใหม่
// ══════════════════════════════════════════════════════════════════

// ── คอลัมน์ Sheet "รับยาเข้า" ───────────────────────────────────
//  A=วันที่  B=ชื่อยา  C=รหัสยา  D=LOT Number  E=วันหมดอายุ
//  F=จำนวน  G=หน่วยนับ  H=หมายเหตุ  I=เลขที่เอกสาร  J=รับจาก

// ── คอลัมน์ Sheet "เบิกยาออก" ───────────────────────────────────
//  A=วันที่  B=ชื่อยา  C=รหัสยา  D=LOT Number  E=วันหมดอายุ
//  F=จำนวน  G=หน่วยนับ  H=ผู้เบิก  I=เบิกให้  J=หมายเหตุ  K=เลขที่เอกสาร

// ── คอลัมน์ Sheet "คลังยานอก" ───────────────────────────────────
//  A=วันที่  B=ชื่อยา  C=รหัสยา  D=LOT Number  E=วันหมดอายุ
//  F=จำนวน  G=หน่วยนับ  H=ผู้เบิก  I=หมายเหตุ  J=เลขที่เอกสาร

// ── คอลัมน์ Sheet "MedicineDB" ──────────────────────────────────
//  A=รหัสยา  B=ชื่อยา  C=หน่วยบรรจุ  D=หน่วยนับย่อย  E=ประเภท  F=ค่าMinimum

var SS_ID = '1fs5n152ldHykHsN1iY3bMOfrxZ4PAcjAR48gEEEW5lU'; // ← Spreadsheet ID

function doGet(e) {
  var ss = SpreadsheetApp.openById(SS_ID);
  var action = (e && e.parameter && e.parameter.action) || '';

  if (action === 'dispense')   return getDispense_(ss);
  if (action === 'outerstock') return getOuterStock_(ss);
  if (action === 'medicinedb') return getMedicineDB_(ss);
  return getReceive_(ss);  // default: ดึง "รับยาเข้า"
}

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var ss = SpreadsheetApp.openById(SS_ID);
    var action = data.action || '';

    if (action === 'receive')         return addReceive_(ss, data);
    if (action === 'edit_receive')    return editReceive_(ss, data);
    if (action === 'delete_receive')  return deleteReceive_(ss, data);
    if (action === 'dispense')        return addDispense_(ss, data);
    if (action === 'edit_dispense')   return editDispense_(ss, data);
    if (action === 'delete_dispense') return deleteDispense_(ss, data);

    return json_({ status: 'error', message: 'unknown action: ' + action });
  } catch (err) {
    return json_({ status: 'error', message: err.message });
  }
}

// ══ GET: รับยาเข้า ═══════════════════════════════════════════════
function getReceive_(ss) {
  var sheet = ss.getSheetByName('รับยาเข้า');
  if (!sheet) return json_({ status: 'ok', rows: [], totalCount: 0 });

  var data = sheet.getDataRange().getValues();
  var rows = data.slice(1)  // ข้าม header
    .filter(function(r) { return r[1]; })  // ต้องมีชื่อยา
    .map(function(r) {
      return {
        date:   fmtDateVal_(r[0]),
        name:   String(r[1] || ''),
        code:   String(r[2] || ''),
        lot:    String(r[3] || ''),
        exp:    fmtDateVal_(r[4]),
        qty:    Number(r[5]) || 0,
        unit:   String(r[6] || ''),
        note:   String(r[7] || ''),
        docNum: String(r[8] || ''),
        source: String(r[9] || '')
      };
    });

  return json_({ status: 'ok', rows: rows, totalCount: rows.length });
}

// ══ POST: เพิ่มรับยาเข้า ════════════════════════════════════════
function addReceive_(ss, d) {
  var sheet = getOrCreateSheet_(ss, 'รับยาเข้า',
    ['วันที่','ชื่อยา','รหัสยา','LOT Number','วันหมดอายุ','จำนวน','หน่วยนับ','หมายเหตุ','เลขที่เอกสาร','รับจาก']);

  sheet.appendRow([
    d.date   || '',
    d.name   || '',
    d.code   || '',
    d.lot    || '',
    d.exp    || '',
    Number(d.qty) || 0,
    d.unit   || '',
    d.note   || '',
    d.docNum || '',
    d.source || ''
  ]);
  return json_({ status: 'ok' });
}

// ══ POST: แก้ไขรับยาเข้า ════════════════════════════════════════
function editReceive_(ss, d) {
  var sheet = ss.getSheetByName('รับยาเข้า');
  if (!sheet) return json_({ status: 'error', message: 'ไม่พบชีต รับยาเข้า' });

  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    var r = data[i];
    if (String(r[1]) === d.name &&
        String(r[3]) === d.originalLot &&
        _dateMatch_(String(r[0]), d.originalDate)) {
      sheet.getRange(i + 1, 1, 1, 10).setValues([[
        d.date   || r[0],
        d.name   || r[1],
        d.code   || r[2],
        d.lot    || r[3],
        d.exp    || r[4],
        Number(d.qty) || r[5],
        d.unit   || r[6],
        d.note !== undefined ? d.note : r[7],
        d.docNum !== undefined ? d.docNum : r[8],
        d.source || r[9]
      ]]);
      return json_({ status: 'ok' });
    }
  }
  return json_({ status: 'error', message: 'ไม่พบแถวที่จะแก้ไข' });
}

// ══ POST: ลบรับยาเข้า ════════════════════════════════════════════
function deleteReceive_(ss, d) {
  var sheet = ss.getSheetByName('รับยาเข้า');
  if (!sheet) return json_({ status: 'error', message: 'ไม่พบชีต รับยาเข้า' });

  var data = sheet.getDataRange().getValues();
  for (var i = data.length - 1; i >= 1; i--) {
    var r = data[i];
    if (String(r[1]) === d.name &&
        String(r[3]) === d.lot &&
        _dateMatch_(String(r[0]), d.date)) {
      sheet.deleteRow(i + 1);
      return json_({ status: 'ok' });
    }
  }
  return json_({ status: 'error', message: 'ไม่พบแถวที่จะลบ' });
}

// ══ GET: เบิกยาออก ══════════════════════════════════════════════
function getDispense_(ss) {
  var sheet = ss.getSheetByName('เบิกยาออก');
  if (!sheet) return json_({ status: 'ok', rows: [], totalCount: 0 });

  var data = sheet.getDataRange().getValues();
  var rows = data.slice(1)
    .filter(function(r) { return r[1]; })
    .map(function(r) {
      return {
        date:      fmtDateVal_(r[0]),
        name:      String(r[1]  || ''),
        code:      String(r[2]  || ''),
        lot:       String(r[3]  || ''),
        exp:       fmtDateVal_(r[4]),
        qty:       Number(r[5]) || 0,
        unit:      String(r[6]  || ''),
        requester: String(r[7]  || ''),
        dest:      String(r[8]  || ''),
        note:      String(r[9]  || ''),
        docNum:    String(r[10] || '')
      };
    });

  return json_({ status: 'ok', rows: rows, totalCount: rows.length });
}

// ══ POST: เพิ่มเบิกยาออก ════════════════════════════════════════
function addDispense_(ss, d) {
  var sheet = getOrCreateSheet_(ss, 'เบิกยาออก',
    ['วันที่','ชื่อยา','รหัสยา','LOT Number','วันหมดอายุ','จำนวน','หน่วยนับ','ผู้เบิก','เบิกให้','หมายเหตุ','เลขที่เอกสาร']);

  sheet.appendRow([
    d.date      || '',
    d.name      || '',
    d.code      || '',
    d.lot       || '',
    d.exp       || '',
    Number(d.qty) || 0,
    d.unit      || '',
    d.requester || '',
    d.dest      || '',
    d.note      || '',
    d.docNum    || ''
  ]);
  return json_({ status: 'ok' });
}

// ══ POST: แก้ไขเบิกยาออก ════════════════════════════════════════
function editDispense_(ss, d) {
  var sheet = ss.getSheetByName('เบิกยาออก');
  if (!sheet) return json_({ status: 'error', message: 'ไม่พบชีต เบิกยาออก' });

  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    var r = data[i];
    if (String(r[1]) === d.name &&
        String(r[3]) === d.originalLot &&
        _dateMatch_(String(r[0]), d.originalDate)) {
      sheet.getRange(i + 1, 1, 1, 11).setValues([[
        d.date      || r[0],
        d.name      || r[1],
        d.code      || r[2],
        d.lot       || r[3],
        d.exp       || r[4],
        Number(d.qty) || r[5],
        d.unit      || r[6],
        d.requester || r[7],
        d.dest      || r[8],
        d.note !== undefined ? d.note : r[9],
        d.docNum !== undefined ? d.docNum : r[10]
      ]]);
      return json_({ status: 'ok' });
    }
  }
  return json_({ status: 'error', message: 'ไม่พบแถวที่จะแก้ไข' });
}

// ══ POST: ลบเบิกยาออก ════════════════════════════════════════════
function deleteDispense_(ss, d) {
  var sheet = ss.getSheetByName('เบิกยาออก');
  if (!sheet) return json_({ status: 'error', message: 'ไม่พบชีต เบิกยาออก' });

  var data = sheet.getDataRange().getValues();
  for (var i = data.length - 1; i >= 1; i--) {
    var r = data[i];
    if (String(r[1]) === d.name &&
        String(r[3]) === d.lot &&
        _dateMatch_(String(r[0]), d.date)) {
      sheet.deleteRow(i + 1);
      return json_({ status: 'ok' });
    }
  }
  return json_({ status: 'error', message: 'ไม่พบแถวที่จะลบ' });
}

// ══ GET: คลังยานอก ══════════════════════════════════════════════
function getOuterStock_(ss) {
  var sheet = ss.getSheetByName('คลังยานอก');
  if (!sheet) return json_({ status: 'ok', rows: [] });

  var data = sheet.getDataRange().getValues();
  var rows = data.slice(1)
    .filter(function(r) { return r[1]; })
    .map(function(r) {
      return {
        date:      fmtDateVal_(r[0]),
        name:      String(r[1]  || ''),
        code:      String(r[2]  || ''),
        lot:       String(r[3]  || ''),
        exp:       fmtDateVal_(r[4]),
        qty:       Number(r[5]) || 0,
        unit:      String(r[6]  || ''),
        requester: String(r[7]  || ''),
        note:      String(r[8]  || ''),
        docNum:    String(r[9]  || '')
      };
    });

  return json_({ status: 'ok', rows: rows });
}

// ══ GET: MedicineDB ═════════════════════════════════════════════
function getMedicineDB_(ss) {
  var sheet = ss.getSheetByName('MedicineDB');
  if (!sheet) return json_({ status: 'error', message: 'ไม่พบชีต MedicineDB' });

  var data = sheet.getDataRange().getValues();
  // คอลัมน์: A=รหัสยา B=ชื่อยา C=หน่วยบรรจุ D=หน่วยนับย่อย E=ประเภท F=ค่าMinimum
  var rows = data.slice(1)
    .map(function(r) {
      return [
        String(r[0] || '').trim(),
        String(r[1] || '').trim(),
        String(r[2] || '').trim(),
        String(r[3] || '').trim(),
        String(r[4] || '').trim(),
        Number(r[5]) || 1
      ];
    })
    .filter(function(r) { return r[0] && r[1]; });

  return json_({ status: 'ok', rows: rows });
}

// ══ Helpers ════════════════════════════════════════════════════

// แปลง Date object หรือ string → "dd/MM/yyyy" (ค.ศ.) เสมอ
function fmtDateVal_(val) {
  if (!val) return '';
  if (Object.prototype.toString.call(val) === '[object Date]') {
    try {
      return Utilities.formatDate(val, Session.getScriptTimeZone(), 'dd/MM/yyyy');
    } catch (e) {
      return '';
    }
  }
  return String(val).trim();
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// เปรียบเทียบวันที่ที่อาจ format ต่างกัน (dd/MM/yyyy หรือ yyyy-MM-dd)
function _dateMatch_(sheetDate, queryDate) {
  if (!sheetDate || !queryDate) return false;
  var sd = String(sheetDate).trim().replace(/-/g, '/');
  var qd = String(queryDate).trim().replace(/-/g, '/');
  // normalize dd/MM/yyyy
  function norm(s) {
    var p = s.split('/');
    if (p.length === 3) {
      if (p[0].length === 4) return p[2].padStart(2,'0')+'/'+p[1].padStart(2,'0')+'/'+p[0];
      return p[0].padStart(2,'0')+'/'+p[1].padStart(2,'0')+'/'+p[2];
    }
    return s;
  }
  return norm(sd) === norm(qd);
}

// สร้าง sheet ใหม่พร้อม header ถ้ายังไม่มี
function getOrCreateSheet_(ss, name, headers) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length)
      .setFontWeight('bold')
      .setBackground('#1A5FD4')
      .setFontColor('#ffffff');
    sheet.setFrozenRows(1);
  }
  return sheet;
}
