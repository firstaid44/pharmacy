// ══════════════════════════════════════════════════════════════════
//  GS_DrugAnalytics.gs — Drug OPD Analytics API
//  วางโค้ดนี้ใน Apps Script project ใหม่ แล้ว Deploy as Web App
//  (Execute as: Me, Who has access: Anyone)
// ══════════════════════════════════════════════════════════════════
//
//  Endpoints:
//    GET ?               → main summary (daily, monthly, top_drugs, top_clinics)
//    GET ?action=drug_monthly  → per-drug monthly series
//
//  ตั้งค่า: เปลี่ยน SS_ID ให้ตรงกับ Spreadsheet ปีงบประมาณนั้นๆ
// ══════════════════════════════════════════════════════════════════

var SS_ID = '1q6g36Ght0kpGUbhICQWNgH8bu4_oOsvfUi_NwW7Lq9I';  // FY2570
var DRUG_OPD_SHEET = 'drug_opd';
var MAX_DRUGS_PER_DAY = 100;  // max items in daily.drugs array

// คลินิก code → ชื่อภาษาไทย (ปรับตามจริงของ PCU)
var CLINIC_MAP = {
  '001': 'OPD ทั่วไป', '002': 'ผู้ป่วยเรื้อรัง (NCD)',
  '003': 'ANC', '004': 'EPI/วัคซีน', '005': 'วางแผนครอบครัว',
  '006': 'ทันตกรรม', '007': 'กายภาพบำบัด', '008': 'แผนไทย',
  '009': 'จิตเวช', '010': 'ตา', '011': 'หู', '012': 'อุบัติเหตุ',
  '099': 'อื่นๆ',
};

// ── main entry ────────────────────────────────────────────────────
function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) || '';
  try {
    var ss    = SpreadsheetApp.openById(SS_ID);
    var sheet = ss.getSheetByName(DRUG_OPD_SHEET);
    if (!sheet) return json_({ status:'error', message:'ไม่พบชีต '+DRUG_OPD_SHEET });

    var rows = readRows_(sheet);
    if (rows.length === 0) return json_({ status:'ok', summary:{total_rows:0,unique_drugs:0,unique_patients:0,total_cost:0,total_qty:0,date_range:{from:'',to:''}}, daily:[], monthly:[], top_drugs:[], top_clinics:[] });

    if (action === 'drug_monthly') return json_(buildDrugMonthly_(rows));
    return json_(buildMain_(rows));

  } catch(err) {
    return json_({ status:'error', message: err.message });
  }
}

// ── อ่านและ parse ทุกแถวจาก drug_opd ────────────────────────────
function readRows_(sheet) {
  var data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];

  // auto-detect columns จาก header row
  var headers = data[0].map(function(h){ return String(h||'').toLowerCase().replace(/[^a-z0-9_]/g,''); });
  var idx = {
    hn:        col_(headers, ['hn']),
    clinic:    col_(headers, ['clinic']),
    visitdate: col_(headers, ['visitdate','visit_date','date','dispensedate']),
    drugcode:  col_(headers, ['drugcode','drug_code','icode','code']),
    drugname:  col_(headers, ['drugname','drug_name','name24','dname']),
    amount:    col_(headers, ['amount','qty','amount24','drugamount','quantity']),
    unit:      col_(headers, ['unit','unit24','drugunit']),
    unitprice: col_(headers, ['unitprice','unit_price','price24','price']),
    totalprice:col_(headers, ['totalprice','total_price','amount_price','totalamount']),
  };

  var rows = [];
  for (var i = 1; i < data.length; i++) {
    var r = data[i];
    var dateStr = fmtDate_(r[idx.visitdate]);
    if (!dateStr) continue;
    var drugname = String(r[idx.drugname]||'').trim();
    if (!drugname) continue;

    var amt   = parseFloat(r[idx.amount])    || 0;
    var price = parseFloat(r[idx.totalprice])|| 0;
    if (!price && idx.unitprice >= 0) price = amt * (parseFloat(r[idx.unitprice])||0);

    var clinicCode = String(r[idx.clinic]||'').trim();
    var clinicName = CLINIC_MAP[clinicCode] || (clinicCode ? 'คลินิก '+clinicCode : 'ไม่ระบุ');

    rows.push({
      hn:        String(r[idx.hn]||'').trim(),
      clinicCode:clinicCode,
      clinicName:clinicName,
      date:      dateStr,
      month:     dateStr.substring(0,7),
      drugcode:  String(r[idx.drugcode]||'').trim(),
      drugname:  drugname,
      amount:    amt,
      unit:      String(r[idx.unit]||'').trim(),
      totalprice:price,
    });
  }
  return rows;
}

// ── สร้าง main summary response ───────────────────────────────────
function buildMain_(rows) {
  // group by date
  var byDate = {};
  rows.forEach(function(r) {
    if (!byDate[r.date]) byDate[r.date] = [];
    byDate[r.date].push(r);
  });

  // group by month
  var byMonth = {};
  rows.forEach(function(r) {
    if (!byMonth[r.month]) byMonth[r.month] = [];
    byMonth[r.month].push(r);
  });

  // top drugs overall
  var drugAgg = aggBy_(rows, 'drugname');
  var topDrugs = objToArr_(drugAgg).sort(function(a,b){ return b.qty-a.qty; }).slice(0,50).map(function(d){
    return { name:d.key, qty:d.qty, cost:d.cost, unit:firstUnit_(rows,d.key) };
  });

  // top clinics overall
  var clinicAgg = aggByClinic_(rows);
  var topClinics = objToArr2_(clinicAgg).sort(function(a,b){ return b.count-a.count; }).slice(0,20);

  // daily array
  var daily = Object.keys(byDate).sort().map(function(date) {
    var dr = byDate[date];
    var pts = uniqueArr_(dr,'hn');
    var dAgg = aggBy_(dr,'drugname');
    var dArr = objToArr_(dAgg).sort(function(a,b){ return b.qty-a.qty; });
    var cAgg = aggByClinic_(dr);
    return {
      date:           date,
      dispense_count: dr.length,
      patient_count:  pts.length,
      total_qty:      sumF_(dr,'amount'),
      total_cost:     sumF_(dr,'totalprice'),
      drugs:          dArr.slice(0,MAX_DRUGS_PER_DAY).map(function(d){ return {name:d.key,qty:d.qty,cost:d.cost}; }),
      top_drugs:      dArr.slice(0,5).map(function(d){ return {name:d.key,qty:d.qty}; }),
      top_clinics:    objToArr2_(cAgg).sort(function(a,b){ return b.count-a.count; }).slice(0,5),
    };
  });

  // monthly array
  var monthly = Object.keys(byMonth).sort().map(function(month) {
    var mr = byMonth[month];
    var pts = uniqueArr_(mr,'hn');
    var mAgg = aggBy_(mr,'drugname');
    var mArr = objToArr_(mAgg).sort(function(a,b){ return b.qty-a.qty; });
    var cAgg = aggByClinic_(mr);
    return {
      month:          month,
      dispense_count: mr.length,
      patient_count:  pts.length,
      total_qty:      sumF_(mr,'amount'),
      total_cost:     sumF_(mr,'totalprice'),
      top_drugs:      mArr.slice(0,10).map(function(d){ return {name:d.key,qty:d.qty}; }),
      top_clinics:    objToArr2_(cAgg).sort(function(a,b){ return b.count-a.count; }).slice(0,10),
    };
  });

  // summary
  var allDates = Object.keys(byDate).sort();
  var uniquePts = uniqueArr_(rows,'hn');
  var uniqueDrugs = uniqueArr_(rows,'drugname');

  return {
    status:     'ok',
    summary: {
      total_rows:      rows.length,
      unique_drugs:    uniqueDrugs.length,
      unique_patients: uniquePts.length,
      total_qty:       sumF_(rows,'amount'),
      total_cost:      sumF_(rows,'totalprice'),
      date_range: {
        from: allDates[0]||'',
        to:   allDates[allDates.length-1]||'',
      },
    },
    daily:      daily,
    monthly:    monthly,
    top_drugs:  topDrugs,
    top_clinics:topClinics,
  };
}

// ── drug_monthly: series รายยาต่อเดือน ──────────────────────────
function buildDrugMonthly_(rows) {
  var allMonths = [];
  var monthSet  = {};
  rows.forEach(function(r){ monthSet[r.month]=1; });
  allMonths = Object.keys(monthSet).sort();

  // group rows by drugname → month
  var byDrug = {};
  rows.forEach(function(r){
    if (!byDrug[r.drugname]) byDrug[r.drugname] = {};
    if (!byDrug[r.drugname][r.month]) byDrug[r.drugname][r.month] = { qty:0, unit:'', code:'' };
    byDrug[r.drugname][r.month].qty  += r.amount;
    byDrug[r.drugname][r.month].unit  = r.unit || byDrug[r.drugname][r.month].unit;
    byDrug[r.drugname][r.month].code  = r.drugcode || byDrug[r.drugname][r.month].code;
  });

  var drugs = {};
  Object.keys(byDrug).forEach(function(name){
    var series = allMonths.map(function(ym){
      return { ym:ym, qty: (byDrug[name][ym]||{qty:0}).qty };
    });
    var firstMonth = byDrug[name][allMonths.filter(function(m){ return byDrug[name][m]; })[0]]||{};
    drugs[name] = { series:series, unit:firstMonth.unit||'', code:firstMonth.code||'' };
  });

  return {
    status:     'ok',
    drug_count: Object.keys(drugs).length,
    months:     allMonths,
    drugs:      drugs,
  };
}

// ── Helpers ──────────────────────────────────────────────────────

function col_(headers, candidates) {
  for (var i=0; i<candidates.length; i++) {
    var idx = headers.indexOf(candidates[i]);
    if (idx >= 0) return idx;
  }
  return -1;
}

function fmtDate_(val) {
  if (!val) return '';
  if (Object.prototype.toString.call(val) === '[object Date]') {
    return Utilities.formatDate(val, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  var s = String(val).trim();
  // YYYY-MM-DD → keep
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.substring(0,10);
  // DD/MM/YYYY
  var m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) {
    var y = parseInt(m[3]);
    if (y > 2300) y -= 543;  // แปลง พ.ศ. → ค.ศ.
    return y+'-'+m[2].padStart(2,'0')+'-'+m[1].padStart(2,'0');
  }
  return '';
}

function sumF_(arr, key) {
  return arr.reduce(function(s,r){ return s+(r[key]||0); }, 0);
}

function uniqueArr_(arr, key) {
  var seen = {};
  return arr.filter(function(r){ var v=r[key]; if(!v||seen[v]) return false; seen[v]=1; return true; });
}

function firstUnit_(rows, drugname) {
  for (var i=0; i<rows.length; i++) {
    if (rows[i].drugname===drugname && rows[i].unit) return rows[i].unit;
  }
  return '';
}

// aggregate qty+cost by field key
function aggBy_(arr, key) {
  var o = {};
  arr.forEach(function(r){
    var k = r[key];
    if (!o[k]) o[k] = { qty:0, cost:0 };
    o[k].qty  += r.amount||0;
    o[k].cost += r.totalprice||0;
  });
  return o;
}
function objToArr_(o) {
  return Object.keys(o).map(function(k){ return { key:k, qty:o[k].qty, cost:o[k].cost }; });
}

// aggregate clinic: count of dispenses
function aggByClinic_(arr) {
  var o = {};
  arr.forEach(function(r){
    var n = r.clinicName;
    if (!o[n]) o[n] = 0;
    o[n]++;
  });
  return o;
}
function objToArr2_(o) {
  return Object.keys(o).map(function(k){ return { name:k, count:o[k] }; });
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
