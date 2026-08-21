/*******************************************************************
 * แจ้งเตือน LINE อัตโนมัติ — ระบบบริหารจัดการคลังยา PCU สะบ้าย้อย
 *
 * ★ รูปแบบการแจ้งเตือน (อัปเดต) ★
 * ส่งแยกเป็น 2 ข้อความตามแหล่งเก็บยา:
 *   ข้อความที่ 1 → 🏥 คลังยาใน (PCU)  — ยาใกล้หมดอายุ (≤6 เดือน) + ยาต่ำกว่า Min
 *   ข้อความที่ 2 → 📦 คลังยานอก       — เฉพาะยาที่หมดอายุแล้ว หรือ ใกล้หมดภายใน 1 เดือน
 * ถ้าแหล่งไหนไม่มีรายการเตือน → ไม่ส่งข้อความนั้น
 *
 * วิธีติดตั้ง:
 * 1. เปิด Apps Script → วางโค้ดนี้แทนไฟล์เดิม
 * 2. เลือกฟังก์ชัน setupAlertTriggers → กด Run (ทำครั้งเดียว)
 * 3. ทดสอบด้วย testStockAlert (ส่งจริงเข้า LINE ทันที)
 *******************************************************************/

var ALERT_CONFIG = {
  SHEET_ID          : "1fs5n152ldHykHsN1iY3bMOfrxZ4PAcjAR48gEEEW5lU",
  SCRIPT_URL        : "https://script.google.com/macros/s/AKfycbyiH9Es7y5RfKU31kMaIikz6BTjPCb18WeX_5N1QaNSoomp_MEcT1R6eds_vfPNsoOy/exec",
  LINE_TOKEN        : "SD/6GeIbNfml+A0DR9uKjwfcqXvwWucDJhDGQ9gL3k2eC+ChCV81Itkak0kM1H5qpk6jdWH/Kdi5LOpJmYSqKQMT/V1FZtyvovVoXmPGfqAGtCSturx7TQQoNWsyhvWUDxeW7CVBH1gv7b+Ljc/meQdB04t89/1O/w1cDnyilFU=",
  LINE_TO           : "Ue71b0d837c323702f34855f1e467d01d",
  EXPIRE_MONTHS     : 6,          // สแกนยาที่หมดอายุภายในกี่เดือน (คลังยาใน)
  OUTER_EXPIRE_MONTHS: 1,         // คลังยานอก: แจ้งเฉพาะ ≤ 1 เดือน (หมดอายุแล้ว + ใกล้หมด)
  LOW_INCLUDE_EQUAL : true,       // true = แจ้งเมื่อคงเหลือ "≤" จุดสั่งซื้อ
  MAX_ROWS_PER_AREA : 15,         // แสดงสูงสุดกี่รายการต่อ card
  BUTTON_URL        : "https://firstaid44.github.io/pharmacy/",
  TZ                : "Asia/Bangkok"
};

/* ══ จุดสั่งซื้อ (reorder point) — ชุดเดียวกับ REORDER_POINTS ใน index.html ══ */
var REORDER_POINTS = {"1000016":1,"1000122":3,"1000184":7,"1019001":4,"110104480112":1,"1419041":1,"1440105":3,"1460151":2,"1500016":1,"1530008":2,"1ALB":1,"1AMIT":1,"1AMO":1,"1AMX":1,"1BUF":1,"1CAL":2,"1CET":1,"1DCL":1,"1DEXT":1,"1DIC":1,"1DIM":1,"1DOM":1,"1FBC":4,"1GABA":1,"1HOC":1,"1LST2":2,"1MET":1,"1MTV":1,"1NAPRO":1,"1NOC":1,"1OME":1,"1ORS":1,"1PARA325":1,"1STC":1,"1TFD":3,"1VIB":1,"1VIC":1,"2DOMP":1,"2MCAR":1,"2MILK":1,"2MTUS":1,"2MTVS":1,"2ORS":1,"2SOAT":1,"3ALB":1,"3ALM":10,"3AMI":1,"3ANAL":1,"3AOM":1,"3CALA":10,"3DCL":1,"3HYO":1,"3SIM":1,"3TRIA002":12,"3TRIA01":12,"4BEN":1,"4CET":1,"4CRP":10,"4CTC":12,"4GEN":10,"4HSC2":1,"4OPA":10,"4POV":10,"4SLV":10,"4TRI":1,"5ACH":1,"5COL":2,"5CPM":1,"5HCT":1,"5NOL":1,"5PNL":1,"6CPM":1,"ACV CREAM":1,"ATO":1,"BET-1N":12,"BET-SA":12,"Beta":1,"BRO TAB":1,"BROM2":1,"CAP RED":1,"CAR":1,"Carve":1,"CEP SYR":1,"CHL":10,"DP CRP":1,"FER":30,"FERDEK Syrub":30,"FLU20":1,"HY251":1,"HYZ":1,"ISO":1,"LORA":1,"MNDP":1,"NI20":1,"NORET5MG":1,"PIO1":1,"POLY E":1,"SIM3":2,"TOL50":1,"TRIAM LO1":1,"1AMY":1,"1PTL":1,"1SENN":1,"1VAN":1,"3PET":1,"410000000239140020182750":1,"4.1003E+18":1,"4.101E+18":1,"4.2002E+18":1,"4.2003E+18":1,"HERB1":1,"HERB2":1,"SHT1":1,"6014":1,"6023":1,"6024":1,"6028":1,"6033":1,"FURO":1,"1000139":1,"2SALB":1,"DEX50":1};

/* ══ ผังตู้ยา — ต้องตรงกับ index.html เสมอ ══ */
var NCD_SHELF_LAYOUT = [
  ['1000016','1440105','1530008','ATO','Carve','CAP RED','5COL'],
  ['CAR','1460151','1000122','1000139','1GABA','1419041','1019001'],
  ['5HCT','HY251','ISO','1LST2','1000184','1500016','MNDP','PIO1'],
  ['5PNL','SIM3']
];
var OUTER_NCD_LAYOUT = [
  ['1000016','1530008','ATO','Carve','5COL','CAP RED'],
  ['CAR','1000122','1460151','1GABA','1419041'],
  ['1019001','HY251','5HCT','1LST2','5PNL','PIO1'],
  ['MNDP','1000184','1500016','SIM3'],
  ['1440105','1OME','1000139','ISO','1VIB']
];
var PCU_CABINETS = [
  { short: 'ตู้1', shelves: [
      ['1ALB','1AMIT','1AMX','1AMO','Beta','BRO TAB','1CAL','5CPM','1DEXT'],
      ['1DIC','1DCL','1DIM','DP CRP','1DOM','1FBC','FLU20','110104480112','HYZ'],
      ['1HOC','1BUF','LORA','1MET','1MTV','1NAPRO','1OME','2ORS','1ORS'],
      ['1PARA325','1CET','1STC','TOL50','1TFD','1VIB','1VIC'],
      ['3AOM','2SOAT','2MTUS','6CPM','3HYO','5NOL']
  ]},
  { short: 'NCD', shelves: NCD_SHELF_LAYOUT },
  { short: 'ตู้3', shelves: [
      ['ACV CREAM','3ANAL','BET-SA','BET-1N','3CALA','4CRP','CHL'],
      ['4CTC','4TRI','TRIAM LO1','3TRIA01','3TRIA002','5ACH','4HSC','5PVD'],
      ['3ALB','3ALM','3AMI','CEP SYR','DEX50','2DOMP','3DCL','FER'],
      ['2MTVS','2SALB','3SIM','6014','6024'],
      ['1VAN','1SENN','1AMY','6023','6033']
  ]}
];
// ผังตู้ยาคลังนอก (ตู้ยาเม็ด 13 ชั้น + ตู้ยาน้ำ 6 ชั้น) — ใช้คำนวณตำแหน่ง
var OUTER_CABINETS = [
  { short: 'คลังนอก', shelves: [
      ['1ALB','1AMO','5CPM','1DIC','1DOM'],
      ['1AMIT','Beta','DP CRP','1DCL','FLU20'],
      ['1AMX','BROM2','1DEXT','1DIM','110104480112'],
      ['Griss500','1BUF','1MET','1NOC','1ORS'],
      ['HYZ','KTCNZ','1MTV','NORET5MG','2ORS'],
      ['1HOC','LORA','1NAPRO','',''],
      ['1PARA325','1STC','1VIC','6023','6014'],
      ['1CET','TOL50','','6024','6028'],
      ['PNSL','1VIB','','6033',''],
      ['410000000239140020182750','1AMY','HERB2','','HERB1'],
      ['ชาสมุนไพรชุมเห็ดเทศ','เจลว่านหางจระเข้','','ยาระบายมะขามแขก(senna7.5)','ยาจันทน์ลีลา'],
      ['สมุนไพรขิง','ยาเหลืองปิดสมุทร','','',''],
      ['1CAL','1FBC']
  ]},
  { short: 'คลังนอก', shelves: [
      ['3ALB','3ALM','3AOM','3AMI','BROM2'],
      ['2MTUS','6CPM','CEP SYR','2MCAR','3DCL','3HYO'],
      ['2MTVS','2MILK','4CET','2SALB','3SIM','2DOMP'],
      ['ACV CREAM','BET-SA','4CTC','3TRIA002'],
      ['3ANAL','4CRP','4TRI','3TRIA01'],
      ['BET-1N','CHL','','']
  ]}
];

/* ══════════════ ตั้ง Trigger (รันครั้งเดียว) ══════════════ */
function setupAlertTriggers() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    var fn = t.getHandlerFunction();
    if (fn === "notifyExpiringWeekly" || fn === "notifyLowStockDaily" || fn === "notifyStockAlert") {
      ScriptApp.deleteTrigger(t);
    }
  });
  ScriptApp.newTrigger("notifyStockAlert").timeBased().everyDays(1).atHour(8).create();
  Logger.log("✅ ตั้ง Trigger เรียบร้อย: ทุกวัน 08:00");
}

/* ══════════════ ฟังก์ชันทดสอบ ══════════════ */
function testStockAlert() { notifyStockAlert(); }

function previewStockAlert() {
  var res = scanAlerts_();
  Logger.log("รวม " + res.total + " รายการ (ใกล้หมดอายุ " + res.expN + " · ต่ำกว่า Min " + res.lowN + ")");
  ["คลังยาใน","คลังยานอก"].forEach(function (area) {
    var items = res.byArea[area] || [];
    Logger.log("\n═══ " + area + " (" + items.length + " รายการ) ═══");
    items.forEach(function (it) {
      var st = statusOf_(it);
      Logger.log("  " + pad_(it.name,34) + pad_(it.pos,14) + pad_(st.txt,18) + st.qty);
    });
  });
}
function pad_(s, n) { s = String(s||""); while(s.length<n) s+=" "; return s; }

/* ══════════════ ส่งแจ้งเตือน ══════════════ */
function notifyStockAlert() {
  var res = scanAlerts_();
  var dateStr = Utilities.formatDate(new Date(), ALERT_CONFIG.TZ, "dd/MM/yyyy");
  Logger.log("สแกนพบ " + res.total + " รายการ (ใกล้หมดอายุ " + res.expN + " · ต่ำกว่า Min " + res.lowN + ")");

  if (res.total === 0) {
    sendLineMessages_([{ type:"text", text:"✅ สรุปคลังยา " + dateStr + "\nไม่พบยาใกล้หมดอายุหรือต่ำกว่าจุดสั่งซื้อ" }]);
    return;
  }

  var msgs = [];

  // ข้อความที่ 1 — 🏥 คลังยาใน: ทุกประเภท (exp ≤6 เดือน + low stock)
  var innerItems = res.byArea["คลังยาใน"] || [];
  if (innerItems.length > 0) {
    msgs.push(buildAreaFlex_("คลังยาใน (PCU)", "🏥", "#1D4ED8", "#BFDBFE", innerItems, dateStr));
  }

  // ข้อความที่ 2 — 📦 คลังยานอก: เฉพาะ exp ≤ OUTER_EXPIRE_MONTHS (หมดอายุแล้ว + ใกล้หมด ≤1 เดือน)
  var outerAll = res.byArea["คลังยานอก"] || [];
  var outerItems = outerAll.filter(function(it) {
    return it.kind === "exp" && it.months <= ALERT_CONFIG.OUTER_EXPIRE_MONTHS;
  });
  if (outerItems.length > 0) {
    msgs.push(buildAreaFlex_("คลังยานอก", "📦", "#B45309", "#FDE68A", outerItems, dateStr));
  }

  if (msgs.length > 0) sendLineMessages_(msgs);
}

/* ══════════════ สร้าง Flex Message 1 ใบ สำหรับ 1 แหล่งเก็บยา ══════════════
   · ไม่มี summary tiles ด้านบน
   · แต่ละรายการยา = 2 บรรทัด: [ชื่อยา + สถานะ] / [ตำแหน่ง + จำนวน]
   · มีปุ่ม "เปิดระบบคลังยา" ที่ footer
   ══════════════════════════════════════════════════════════════════════════*/
function buildAreaFlex_(area, emoji, hdrBg, hdrSub, items, dateStr) {
  var SEP = { type:"separator", color:"#E2E8F0", margin:"sm" };
  var max = ALERT_CONFIG.MAX_ROWS_PER_AREA;

  function itemRow(it) {
    var st = statusOf_(it);
    var qtyTxt = it.kind === "exp"
      ? "คงเหลือ " + it.qty + " " + it.unit
      : "คงเหลือ " + it.qty + "/Min " + it.min + " " + it.unit;
    return { type:"box", layout:"vertical", paddingTop:"8px", paddingBottom:"8px", contents:[
      { type:"box", layout:"horizontal", contents:[
        { type:"text", text:it.name, size:"xs", weight:"bold", color:"#1E293B", flex:1, wrap:true, maxLines:2 },
        { type:"text", text:st.txt, size:"xxs", color:st.color, weight:"bold", flex:0, align:"end", gravity:"center" }
      ]},
      { type:"box", layout:"horizontal", margin:"xs", contents:[
        { type:"text", text:it.pos||"—", size:"xxs", color:"#94A3B8", flex:1 },
        { type:"text", text:qtyTxt, size:"xxs", color:"#64748B", flex:0, align:"end" }
      ]}
    ]};
  }

  var shown = items.slice(0, max);
  var rows = [];
  shown.forEach(function(it, i) { if (i) rows.push(SEP); rows.push(itemRow(it)); });
  if (items.length > max) {
    rows.push(SEP);
    rows.push({ type:"text", text:"…และอีก " + (items.length - max) + " รายการ",
      size:"xxs", color:"#94A3B8", margin:"sm", align:"center" });
  }

  var nExp = items.filter(function(x){ return x.kind==="exp"; }).length;
  var nLow = items.filter(function(x){ return x.kind==="low"; }).length;

  return {
    type: "flex",
    altText: "⚠️ " + area + ": ใกล้หมดอายุ " + nExp + " · ต่ำกว่า Min " + nLow + " รายการ",
    contents: {
      type: "bubble", size: "giga",
      header: { type:"box", layout:"horizontal", backgroundColor:hdrBg, paddingAll:"13px", contents:[
        { type:"text", text:emoji, size:"lg", flex:0, gravity:"center" },
        { type:"box", layout:"vertical", flex:1, paddingStart:"8px", contents:[
          { type:"text", text:area, color:"#FFFFFF", size:"sm", weight:"bold" },
          { type:"text", text:"PCU สะบ้าย้อย · " + dateStr, color:hdrSub, size:"xxs", margin:"xs" }
        ]}
      ]},
      body: { type:"box", layout:"vertical", paddingAll:"12px", spacing:"none", contents:rows },
      footer: { type:"box", layout:"vertical", paddingAll:"10px", backgroundColor:"#F9FAFB", contents:[
        { type:"button", style:"primary", color:"#1A5FD4", height:"sm",
          action:{ type:"uri", label:"เปิดระบบคลังยา →", uri:ALERT_CONFIG.BUTTON_URL } }
      ]}
    }
  };
}

/* ══════════════ สแกนหายาที่เข้าเกณฑ์เตือน ══════════════ */
function scanAlerts_() {
  var today = new Date(); today.setHours(0,0,0,0);
  var limit = new Date(today);
  limit.setMonth(limit.getMonth() + ALERT_CONFIG.EXPIRE_MONTHS);
  var posInner = buildPosMap_("inner");
  var posOuter = buildPosMap_("outer");
  var rmap     = getReorderMap_();
  var rows     = [];

  function shelfPos(area, code, name) {
    var m = (area === "คลังยานอก") ? posOuter : posInner;
    return m[normKey_(code)] || m["N:" + drugKey_(name)] || "—";
  }
  function monthsLeft(expDate) {
    return Math.round((expDate - today) / (86400000 * 30.4));
  }
  function pushExp(area, it) {
    if (!it.expDate || it.qty <= 0) return;
    if (it.expDate.getTime() > limit.getTime()) return;
    rows.push({ kind:"exp", area:area, pos:shelfPos(area, it.code, it.name),
      name:it.name, code:it.code, lot:it.lot||"", qty:Math.round(it.qty),
      unit:it.unit||"", months:monthsLeft(it.expDate),
      expStr:Utilities.formatDate(it.expDate, ALERT_CONFIG.TZ, "dd/MM/yyyy") });
  }
  function pushLow(area, it) {
    var min = rmap[normKey_(it.code)];
    if (min === undefined) min = rmap[drugKey_(it.name)];
    if (min === undefined || min === null) return;
    var q = Math.round(it.qty);
    var hit = ALERT_CONFIG.LOW_INCLUDE_EQUAL ? (q <= min) : (q < min);
    if (!hit) return;
    rows.push({ kind:"low", area:area, pos:shelfPos(area, it.code, it.name),
      name:it.name, code:it.code, qty:q, unit:it.unit||"", min:min });
  }

  // 1) คลังยาใน
  var inner = computeStock_();
  inner.lots.forEach(function(l)   { pushExp("คลังยาใน", l); });
  Object.keys(inner.totals).forEach(function(k) { pushLow("คลังยาใน", inner.totals[k]); });

  // 2) คลังยานอก (สแกนทั้งหมด — filter ≤1 เดือนตอนส่งใน notifyStockAlert)
  var outer = computeOuterStock_();
  outer.forEach(function(it) { pushExp("คลังยานอก", it); pushLow("คลังยานอก", it); });

  // ตัดซ้ำ
  var seen = {}, uniq = [];
  rows.forEach(function(x) {
    var k = x.kind+"|"+x.area+"|"+normKey_(x.name)+"|"+normKey_(x.lot||"")+"|"+(x.expStr||"");
    if (seen[k]) return;
    seen[k] = 1; uniq.push(x);
  });

  // เรียงตามความเร่งด่วน
  var byArea = {};
  ["คลังยาใน","คลังยานอก"].forEach(function(area) {
    byArea[area] = uniq.filter(function(x){ return x.area===area; }).sort(function(a,b) {
      if (a.kind !== b.kind) return a.kind==="exp" ? -1 : 1;
      return a.kind==="exp" ? (a.months-b.months) : ((a.qty-a.min)-(b.qty-b.min));
    });
  });

  return {
    byArea: byArea,
    expN  : uniq.filter(function(x){ return x.kind==="exp"; }).length,
    lowN  : uniq.filter(function(x){ return x.kind==="low"; }).length,
    total : uniq.length
  };
}

/* ══════════════ สถานะ + สี ══════════════ */
function statusOf_(it) {
  if (it.kind === "exp") {
    return {
      txt     : it.months <= 0 ? "⏰ หมดอายุแล้ว" : "⏰ " + it.months + " เดือน",
      color   : it.months <= 0 ? "#D93025" : "#C07000",
      qty     : String(it.qty),
      qtyColor: "#475569"
    };
  }
  return {
    txt     : it.qty <= 0 ? "📉 หมดคลัง" : "📉 ต่ำกว่า Min",
    color   : it.qty <= 0 ? "#D93025" : "#B45309",
    qty     : it.qty + "/" + it.min,
    qtyColor: it.qty <= 0 ? "#D93025" : "#B45309"
  };
}

/* ══════════════ ตำแหน่งตู้/ชั้นวาง ══════════════ */
function buildPosMap_(scope) {
  var map = {};
  var nameByCode = {};
  try {
    var sh = SpreadsheetApp.openById(ALERT_CONFIG.SHEET_ID).getSheetByName("MedicineDB");
    if (sh) {
      sh.getDataRange().getValues().slice(1).forEach(function(r) {
        var code = String(r[1]||"").trim(), name = String(r[2]||"").trim();
        if (code && name) nameByCode[normKey_(code)] = name;
      });
    }
  } catch(e) { Logger.log("buildPosMap_ MedicineDB skip: " + e); }

  function put(code, label) {
    var k = normKey_(code);
    if (!k) return;
    if (!map[k]) map[k] = label;
    var nm = nameByCode[k];
    if (nm) { var nk = "N:"+drugKey_(nm); if (!map[nk]) map[nk] = label; }
  }
  function scanPcu() {
    PCU_CABINETS.forEach(function(cab) {
      cab.shelves.forEach(function(shelf, si) {
        shelf.forEach(function(c) { put(c, cab.short+"/ชั้น"+(si+1)); });
      });
    });
  }
  function scanOuter() {
    OUTER_NCD_LAYOUT.forEach(function(shelf, si) {
      shelf.forEach(function(c) { put(c, "นอกNCD/ชั้น"+(si+1)); });
    });
  }
  function scanOuterCabinets() {
    var shelfIdx = 0;
    OUTER_CABINETS.forEach(function(cab) {
      cab.shelves.forEach(function(shelf) {
        shelf.forEach(function(c) { if(c) put(c, "คลังนอก/ชั้น"+(shelfIdx+1)); });
        shelfIdx++;
      });
    });
  }
  if (scope === "outer") { scanOuter(); scanOuterCabinets(); scanPcu(); }
  else                   { scanPcu();  scanOuter(); scanOuterCabinets(); }
  return map;
}

/* ══════════════ คำนวณคงเหลือ ══════════════ */
function computeStock_() {
  var recv = fetchRows_(ALERT_CONFIG.SCRIPT_URL);
  var disp = fetchRows_(ALERT_CONFIG.SCRIPT_URL + "?action=dispense");
  var lots = {}, totals = {};
  recv.forEach(function(r) { addRow_(lots, totals, r,  1); });
  disp.forEach(function(r) { addRow_(lots, totals, r, -1); });
  return { lots: Object.keys(lots).map(function(k){ return lots[k]; }), totals: totals };
}

function computeOuterStock_() {
  var rows = fetchRows_(ALERT_CONFIG.SCRIPT_URL + "?action=outerstock");
  var merged = {};
  rows.forEach(function(r) {
    var name = String(r.name||"").trim();
    if (!name) return;
    var k = normKey_(name);
    if (!merged[k]) merged[k] = { name:name, code:String(r.code||"").trim(),
      unit:String(r.unit||"").trim(), qty:0, lot:"", expDate:null };
    var m = merged[k];
    m.qty += Number(r.qty) || 0;
    if (!m.code && r.code) m.code = String(r.code).trim();
    if (!m.unit && r.unit) m.unit = String(r.unit).trim();
    var d = parseDate_(r.exp);
    if (d && (!m.expDate || d < m.expDate)) { m.expDate = d; m.lot = String(r.lot||"").trim(); }
  });
  return Object.keys(merged).map(function(k){ return merged[k]; });
}

function fetchRows_(url) {
  try {
    var full = url + (url.indexOf("?") >= 0 ? "&" : "?") + "t=" + Date.now();
    var res  = UrlFetchApp.fetch(full, { muteHttpExceptions:true, followRedirects:true });
    var j    = JSON.parse(res.getContentText());
    return (j && j.rows) ? j.rows : [];
  } catch(e) { Logger.log("fetchRows_ error: " + e); return []; }
}

function addRow_(lots, totals, r, sign) {
  var name = String(r.name||"").trim(); if (!name) return;
  var code = String(r.code||"").trim();
  var lot  = String(r.lot||"").trim();
  var exp  = parseDate_(r.exp);
  var qty  = sign * (Number(r.qty)||0);
  var unit = String(r.unit||"").trim();
  var lk   = normKey_(name)+"|"+normKey_(lot);
  if (!lots[lk]) lots[lk] = { name:name, code:code, lot:lot, qty:0, unit:unit, expDate:null };
  lots[lk].qty += qty;
  if (exp) lots[lk].expDate = exp;
  if (!lots[lk].unit && unit) lots[lk].unit = unit;
  if (!lots[lk].code && code) lots[lk].code = code;
  var tk = normKey_(code) || normKey_(name);
  if (!totals[tk]) totals[tk] = { name:name, code:code, qty:0, unit:unit };
  totals[tk].qty += qty;
  if (!totals[tk].unit && unit) totals[tk].unit = unit;
}

function getReorderMap_() {
  var map = {};
  Object.keys(REORDER_POINTS).forEach(function(c){ map[normKey_(c)] = REORDER_POINTS[c]; });
  try {
    var sh = SpreadsheetApp.openById(ALERT_CONFIG.SHEET_ID).getSheetByName("MedicineDB");
    if (sh) {
      sh.getDataRange().getValues().slice(1).forEach(function(r) {
        var code = String(r[1]||"").trim(), name = String(r[2]||"").trim();
        if (code && name && REORDER_POINTS[code] != null) map[drugKey_(name)] = REORDER_POINTS[code];
      });
    }
  } catch(e) { Logger.log("getReorderMap_ skip: " + e); }
  return map;
}

/* ══════════════ ตัวช่วยทั่วไป ══════════════ */
function drugKey_(s) {
  return String(s===undefined||s===null?"":s).toLowerCase().replace(/[\s().,\-/*]+/g,"");
}
function normKey_(v) {
  return String(v===undefined||v===null?"":v).trim().toUpperCase();
}
function parseDate_(v) {
  if (!v && v !== 0) return null;
  if (v instanceof Date && !isNaN(v)) return fixBE_(new Date(v.getFullYear(), v.getMonth(), v.getDate()));
  var s = String(v).trim();
  var m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (m) return fixBE_(new Date(Number(m[3]), Number(m[2])-1, Number(m[1])));
  m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return fixBE_(new Date(Number(m[1]), Number(m[2])-1, Number(m[3])));
  var d = new Date(s);
  return isNaN(d) ? null : fixBE_(new Date(d.getFullYear(), d.getMonth(), d.getDate()));
}
function fixBE_(d) {
  if (d.getFullYear() > 2400) d.setFullYear(d.getFullYear()-543);
  return d;
}

/* ══════════════ ส่ง LINE push ══════════════ */
function sendLineMessages_(messages) {
  var res = UrlFetchApp.fetch("https://api.line.me/v2/bot/message/push", {
    method : "post",
    headers: { "Content-Type":"application/json", "Authorization":"Bearer " + ALERT_CONFIG.LINE_TOKEN },
    payload: JSON.stringify({ to:ALERT_CONFIG.LINE_TO, messages:messages }),
    muteHttpExceptions: true
  });
  Logger.log("LINE push: " + res.getResponseCode() + " " + res.getContentText());
}

/* ══════════════ เครื่องมือตรวจสอบ ══════════════ */
function diagnoseApi() {
  var recv  = fetchRows_(ALERT_CONFIG.SCRIPT_URL);
  var disp  = fetchRows_(ALERT_CONFIG.SCRIPT_URL + "?action=dispense");
  var outer = fetchRows_(ALERT_CONFIG.SCRIPT_URL + "?action=outerstock");
  Logger.log("รับเข้า: " + recv.length + " แถว | เบิกออก: " + disp.length + " แถว | คลังยานอก: " + outer.length + " แถว");
  if (outer.length) Logger.log("ตัวอย่างแถวคลังยานอก: " + JSON.stringify(outer[0]));
}

function diagnosePosition() {
  var posMap = buildPosMap_("inner");
  var inner  = computeStock_();
  var miss   = [], ok = 0;
  Object.keys(inner.totals).forEach(function(k) {
    var t = inner.totals[k];
    if (t.qty <= 0) return;
    var p = posMap[normKey_(t.code)] || posMap["N:"+drugKey_(t.name)];
    if (p) ok++; else miss.push(t.name + " (รหัส " + (t.code||"—") + ")");
  });
  Logger.log("จับคู่ตำแหน่งได้ " + ok + " ตัวยา · ไม่พบ " + miss.length + " ตัวยา");
  if (miss.length) Logger.log("ยาที่ยังไม่ได้กำหนดตำแหน่ง:\n" + miss.join("\n"));
}
