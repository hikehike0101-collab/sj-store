// ====== dashboard.js — لوحة التحكم ======

document.addEventListener('DOMContentLoaded', ()=>{
  const pwdInput = document.getElementById('pwd-input');
  if(pwdInput) pwdInput.addEventListener('keypress', e=>{
    if(e.key==='Enter') confirmPwd();
  });
});


// ====== DASHBOARD ======
let currentFilter = 'today';
const DASHBOARD_KPI_IDS = ['sales', 'profit', 'installments', 'debts', 'capital', 'stock-value'];

function dashboardKpiVisibilityKey(){
  return typeof userScopedStorageKey === 'function'
    ? userScopedStorageKey('dashboard_kpi_visibility')
    : 'sj_dashboard_kpi_visibility';
}

function readDashboardKpiVisibility(){
  try{
    const raw = JSON.parse(localStorage.getItem(dashboardKpiVisibilityKey()) || '{}');
    return raw && typeof raw === 'object' ? raw : {};
  }catch{
    return {};
  }
}

function writeDashboardKpiVisibility(state){
  localStorage.setItem(dashboardKpiVisibilityKey(), JSON.stringify(state));
}

function applyDashboardKpiVisibilityState(){
  const state = readDashboardKpiVisibility();
  DASHBOARD_KPI_IDS.forEach((id) => {
    const hiddenEl = document.getElementById(`kpi-${id}-hidden`);
    const valueEl = document.getElementById(`kpi-${id}`);
    const btn = document.querySelector(`button[onclick*="toggleDashboardKpi('${id}'"]`);
    const visible = state[id] === true;
    if(hiddenEl) hiddenEl.style.display = visible ? 'none' : 'inline';
    if(valueEl) valueEl.style.display = visible ? 'inline' : 'none';
    if(btn) btn.style.display = 'none';
  });
}

window.toggleDashboardKpi = function toggleDashboardKpi(id){
  const state = readDashboardKpiVisibility();
  state[id] = !(state[id] === true);
  writeDashboardKpiVisibility(state);
  applyDashboardKpiVisibilityState();
};

function startOfDay(date){
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date, amount){
  const d = new Date(date);
  d.setDate(d.getDate() + amount);
  return d;
}

function addMonths(date, amount){
  const d = new Date(date);
  const targetDay = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + amount);
  const lastDayOfTargetMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(targetDay, lastDayOfTargetMonth));
  return d;
}

function startOfMonth(date){
  const d = new Date(date);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

function dayRangeFromOffset(todayStart, offset){
  const from = addDays(todayStart, offset);
  return { from, to: addDays(from, 1) };
}

function monthRangeFromCount(todayStart, count){
  const currentMonthStart = startOfMonth(todayStart);
  return {
    from: addMonths(currentMonthStart, -(Math.max(1, count) - 1)),
    to: addDays(todayStart, 1)
  };
}

function toggleFilter(){
  document.getElementById('filter-dd').classList.toggle('open');
}
document.addEventListener('DOMContentLoaded', ()=>{
  document.addEventListener('click', e=>{
    const dd = document.getElementById('filter-dd');
    if(dd && !e.target.closest('.filter-wrap')) dd.classList.remove('open');
  });
});

function setFilter(val, label, el){
  currentFilter = val;
  document.getElementById('filter-label').textContent = label;
  document.querySelectorAll('#filter-dd .fopt').forEach(o=>o.classList.remove('sel'));
  if(el) el.classList.add('sel');
  document.getElementById('filter-dd').classList.remove('open');
  renderDashboard();
}

function getFilterRange(){
  const todayStart = startOfDay(new Date());
  const tomorrowStart = addDays(todayStart, 1);
  const last7DaysStart = addDays(todayStart, -6);
  const map = {
    today: () => dayRangeFromOffset(todayStart, 0),
    yesterday: () => dayRangeFromOffset(todayStart, -1),
    '2days': () => dayRangeFromOffset(todayStart, -2),
    '3days': () => dayRangeFromOffset(todayStart, -3),
    week: () => ({ from: last7DaysStart, to: tomorrowStart }),
    '2weeks': () => ({ from: addDays(todayStart, -13), to: tomorrowStart }),
    '1m': () => monthRangeFromCount(todayStart, 1),
    '2m': () => monthRangeFromCount(todayStart, 2),
    '3m': () => monthRangeFromCount(todayStart, 3),
    '4m': () => monthRangeFromCount(todayStart, 4),
    '5m': () => monthRangeFromCount(todayStart, 5),
    '6m': () => monthRangeFromCount(todayStart, 6),
    '7m': () => monthRangeFromCount(todayStart, 7),
    '8m': () => monthRangeFromCount(todayStart, 8),
    '9m': () => monthRangeFromCount(todayStart, 9),
    '10m': () => monthRangeFromCount(todayStart, 10),
    '11m': () => monthRangeFromCount(todayStart, 11),
    '12m': () => monthRangeFromCount(todayStart, 12),
  };
  return map[currentFilter] ? map[currentFilter]() : { from: new Date(0), to: null };
}

function isDateWithinRange(date, range){
  if(!date) return false;
  const value = new Date(date);
  if(Number.isNaN(value.getTime())) return false;
  if(!range) return true;
  return (!range.from || value >= range.from) && (!range.to || value < range.to);
}

function sumPaymentsInRange(record, range){
  return (record.payments || [])
    .filter(payment => isDateWithinRange(payment.date, range))
    .reduce((sum, payment) => sum + (payment.amount || 0), 0);
}

function getSelectedProductsTotalCost(items = []){
  return (items || []).reduce((sum, item) => {
    const qty = parseInt(item.qty) || 0;
    const unitCost = parseFloat(item.cost) || 0;
    return sum + (unitCost * qty);
  }, 0);
}


function drawDonut(sales, profit, inst, debt, capital){
  const canvas = document.getElementById('donut-chart');
  const ctx = canvas.getContext('2d');
  const data = [
    {val:sales,   color:'#5B4FCF', label:'المبيعات'},
    {val:profit,  color:'#38A169', label:'الأرباح'},
    {val:inst,    color:'#DD6B20', label:'التقسيط'},
    {val:debt,    color:'#E53E3E', label:'الديون'},
    {val:capital, color:'#805AD5', label:'رأس المال'},
  ];
  const total = data.reduce((a,d)=>a+d.val,0) || 1;
  ctx.clearRect(0,0,180,180);
  let start = -Math.PI/2;
  const cx=90, cy=90, r=70, inner=45;
  data.forEach(d=>{
    if(!d.val) return;
    const angle=(d.val/total)*2*Math.PI;
    ctx.beginPath(); ctx.moveTo(cx,cy);
    ctx.arc(cx,cy,r,start,start+angle);
    ctx.closePath(); ctx.fillStyle=d.color; ctx.fill();
    start+=angle;
  });
  ctx.beginPath(); ctx.arc(cx,cy,inner,0,2*Math.PI);
  ctx.fillStyle='#fff'; ctx.fill();
  ctx.fillStyle='#1A1A2E'; ctx.font='bold 12px Cairo';
  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText('السيولة',cx,cy);
  const legend=document.getElementById('donut-legend');
  legend.innerHTML=data.map(d=>`
    <div style="display:flex;align-items:center;justify-content:space-between;gap:8px">
      <div style="display:flex;align-items:center;gap:6px">
        <div style="width:10px;height:10px;border-radius:50%;background:${d.color};flex-shrink:0"></div>
        <span style="font-size:11px;color:var(--text-mid)">${d.label}</span>
      </div>
      <span style="font-size:11px;font-weight:700;color:var(--text-dark)">${fmt(d.val)}</span>
    </div>`).join('');
}

// ====== REFRESH ALL - يحدّث كل الأرقام فوراً ======
function refreshAll(){
  const page = document.querySelector('.page.active');
  if(!page) return;
  const id = page.id.replace('page-','');
  const map = {
    dashboard: renderDashboard,
    inventory: renderInventory,
    pos: renderPOS,
    cashier: renderCashier,
    installments: renderInstallments,
    debts: renderDebts,
    repairs: renderRepairs,
    worker: renderWorker,
  };
  if(map[id]) map[id]();
}

// ====== SMART CALC - يحسب كل شيء من البيانات الحقيقية مباشرة ======
function calcAll(range=null){
  const installments = DB.get('installments');
  const debts        = DB.get('debts');
  const repairs      = DB.get('repairs');
  const sales        = DB.get('sales');
  const transactions = DB.get('transactions'); // Snapshots محمية من الحذف ✅

  const inRange = (date) => isDateWithinRange(date, range);
  const installmentFilesInRange = installments.filter(i => inRange(i.date));
  const debtFilesInRange = debts.filter(d => inRange(d.date));
  const txInRange = transactions.filter(t => inRange(t.date));

  // ===== المبيعات المحصلة =====
  // إذا وجدت Transactions نحسب منها، وإلا من sales مباشرة
  const hasTx = txInRange.length > 0;
  const cashSales    = hasTx
    ? txInRange.filter(t=> t.type==='cash').reduce((a,t)=>a+(t.salePrice||0),0)
    : sales.filter(s=> s.type==='cash' && inRange(s.date)).reduce((a,s)=>a+(s.totalPaid||0),0);
  const warrantySales = hasTx
    ? txInRange.filter(t=> t.type==='warranty').reduce((a,t)=>a+(t.salePrice||0),0)
    : sales.filter(s=> s.type==='warranty' && inRange(s.date)).reduce((a,s)=>a+(s.totalPaid||0),0);
  const instPayments = hasTx
    ? txInRange.filter(t=> t.type==='installment').reduce((a,t)=>a+(t.downPayment||0),0)
    : sales.filter(s=> s.type==='installment' && inRange(s.date)).reduce((a,s)=>a+(s.totalPaid||0),0);
  const debtPayments = hasTx
    ? txInRange.filter(t=> t.type==='credit').reduce((a,t)=>a+(t.downPayment||0),0)
    : sales.filter(s=> s.type==='credit' && inRange(s.date)).reduce((a,s)=>a+(s.totalPaid||0),0);
  // دفعات التقسيط والديون اللاحقة
  const instLaterPay = sales.filter(s=> s.type==='installment_payment' && inRange(s.date)).reduce((a,s)=>a+(s.totalPaid||0),0);
  const debtLaterPay = sales.filter(s=> s.type==='debt_payment' && inRange(s.date)).reduce((a,s)=>a+(s.totalPaid||0),0);
  const totalCollected = cashSales + warrantySales + instPayments + debtPayments + instLaterPay + debtLaterPay;

  // ===== الأرباح الصافية =====
  // إذا وجدت Transactions نحسب منها، وإلا من sales
  const cashProfit = hasTx
    ? txInRange.filter(t=> t.type==='cash').reduce((a,t)=>a+(t.profit||0),0)
    : sales.filter(s=> s.type==='cash' && inRange(s.date)).reduce((a,s)=>a+(s.profit||0),0);
  const warrantyProfit = hasTx
    ? txInRange.filter(t=> t.type==='warranty').reduce((a,t)=>a+(t.profit||0),0)
    : sales.filter(s=> s.type==='warranty' && inRange(s.date)).reduce((a,s)=>a+(s.profit||0),0);

  // تقسيط: نسبة الربح × المدفوع الكلي (مقدم + دفعات لاحقة)
  const instProfit = installments.reduce((a,i)=>{
    const paidInRange = sumPaymentsInRange(i, range);
    if(!i.profit || !i.totalPrice || !paidInRange) return a;
    const ratio = i.profit / i.totalPrice;
    return a + Math.round(ratio * paidInRange);
  },0);

  // ديون: نسبة الربح × المدفوع فعلاً
  const debtProfit = debts.reduce((a,d)=>{
    const paidInRange = sumPaymentsInRange(d, range);
    if(!d.profit || !d.totalDebt || !paidInRange) return a;
    const ratio = d.profit / d.totalDebt;
    return a + Math.round(ratio * paidInRange);
  },0);

  // تصليح: لا يدخل في أرباح صاحب المحل
  const repairProfit = 0;

  // سحوبات العامل والمالك
  const workerCost = sales.filter(s=> s.type==='worker_withdrawal' && inRange(s.date)).reduce((a,s)=>a+Math.abs(s.profit||0),0);
  const ownerCost  = sales.filter(s=> s.type==='owner_withdrawal'  && inRange(s.date)).reduce((a,s)=>a+Math.abs(s.profit||0),0);
  const ownerCapitalWithdrawals = sales.filter(s=> s.type==='owner_capital_withdrawal' && inRange(s.date)).reduce((a,s)=>a+Math.abs(s.profit||0),0);

  const totalProfit = cashProfit + warrantyProfit + instProfit + debtProfit + repairProfit - workerCost - ownerCost;

  // ===== أموال التقسيط المتبقية =====
  const instRemain = installmentFilesInRange.filter(i=>i.remaining>0).reduce((a,i)=>a+(i.remaining||0),0);

  // ===== الديون المتبقية =====
  const debtRemain = debtFilesInRange.filter(d=>d.remaining>0).reduce((a,d)=>a+(d.remaining||0),0);

  // ===== رأس المال = ما أُنفق على البيع =====

  // كاش: نعتمد على Snapshot المعاملة، وإلا نرجع إلى (المبلغ - الربح)
  const cashCapital = hasTx
    ? txInRange.filter(t=> t.type==='cash').reduce((a,t)=>a+(t.cost||0),0)
    : sales.filter(s=> s.type==='cash' && inRange(s.date)).reduce((a,s)=>{
        const selectedCost = getSelectedProductsTotalCost(s.selectedProducts || []);
        const cost = selectedCost || (s.cost||0) || Math.max(0, (s.totalPaid||0) - (s.profit||0));
        return a + cost;
      },0);
  const warrantyCapital = hasTx
    ? txInRange.filter(t=> t.type==='warranty').reduce((a,t)=>a+(t.cost||0),0)
    : sales.filter(s=> s.type==='warranty' && inRange(s.date)).reduce((a,s)=>{
        const selectedCost = getSelectedProductsTotalCost(s.selectedProducts || []);
        const cost = selectedCost || (s.cost||0) || Math.max(0, (s.totalPaid||0) - (s.profit||0));
        return a + cost;
      },0);

  // تقسيط: (1 - نسبة الربح) × المدفوع = رأس المال
  const instCapital = installments.reduce((a,i)=>{
    const paidInRange = sumPaymentsInRange(i, range);
    if(!i.totalPrice || !paidInRange) return a;
    const totalCost = (i.cost||0) || getSelectedProductsTotalCost(i.selectedProducts || []) || Math.max(0, (i.totalPrice||0) - (i.profit||0));
    const capitalRatio = i.totalPrice>0 ? totalCost / i.totalPrice : 0;
    return a + Math.round(capitalRatio * paidInRange);
  },0);

  // ديون: (تكلفة ÷ إجمالي) × المدفوع
  const debtCapital = debts.reduce((a,d)=>{
    const paidInRange = sumPaymentsInRange(d, range);
    if(!d.totalDebt || !paidInRange) return a;
    const cost = (d.cost||0) || getSelectedProductsTotalCost(d.selectedProducts || []) || Math.max(0,(d.totalDebt||0)-(d.profit||0));
    const ratio = d.totalDebt>0 ? cost/d.totalDebt : 0;
    return a + Math.round(ratio * paidInRange);
  },0);

  // تصليح: لا يدخل في رأس مال صاحب المحل — المصلّح يتحمل تكاليفه
  const repairsCapital = 0;

  const totalCapital = cashCapital + warrantyCapital + instCapital + debtCapital + repairsCapital - ownerCapitalWithdrawals;

  return { totalCollected, totalProfit, instRemain, debtRemain, totalCapital };
}

function renderDashboard(){
  const range = getFilterRange();
  const c = calcAll(range);

  // قيمة المخزون = مجموع (سعر البيع × الكمية) لكل المنتجات
  const stockValue = DB.get('products').reduce((a,p)=>a+((p.price||0)*(p.qty||0)),0);
  const stockEl = document.getElementById('kpi-stock-value');
  if(stockEl) stockEl.textContent = num(stockValue);

  document.getElementById('kpi-sales').textContent        = num(c.totalCollected);
  document.getElementById('kpi-profit').textContent       = num(Math.max(0, c.totalProfit));
  document.getElementById('kpi-installments').textContent = num(c.instRemain);
  document.getElementById('kpi-debts').textContent        = num(c.debtRemain);
  document.getElementById('kpi-capital').textContent      = num(c.totalCapital);
  applyDashboardKpiVisibilityState();

  drawDonut(c.totalCollected, Math.max(0,c.totalProfit), c.instRemain, c.debtRemain, c.totalCapital);

  // جدول العمليات ضمن الفلتر الزمني - مباشرة من البيانات الحقيقية
  const sales   = DB.get('sales');
  const repairs = DB.get('repairs');
  // المبيعات فقط — بدون التصليح (التصليح منفصل عن صاحب المحل)
  const allSales = sales.filter(s => s.type !== 'repair' && isDateWithinRange(s.date, range));

  const recentSales = allSales.map(s=>({
    saleId: s.id,
    name: s.productName,
    type: s.type==='installment'?'تقسيط': s.type==='installment_payment'?'دفعة قسط': s.type==='credit'?'كريدي': s.type==='debt_payment'?'دفعة دين': s.type==='owner_withdrawal'?'سحب أرباح': s.type==='owner_capital_withdrawal'?'سحب رأس المال': s.type==='worker_withdrawal'?'سحب عامل':'كاش',
    typeKey: s.type, qty: s.qty||1,
    paid: (s.type==='owner_withdrawal'||s.type==='owner_capital_withdrawal'||s.type==='worker_withdrawal') ? Math.abs(s.profit||0) : (s.totalPaid||0),
    productId: s.productId||'',
    date: s.date
  }));
  recentSales.forEach(r => {
    if (r.typeKey === 'warranty') r.type = 'ضمان';
  });

  // العمليات ضمن الفلتر — بدون التصليح (التصليح لا علاقة له بصاحب المحل)
  const recentRepairs = [];

  const allRecent = [...recentSales, ...recentRepairs]
    .sort((a,b)=>new Date(b.date)-new Date(a.date));

  const tbody = document.getElementById('dash-recent');
  if(!allRecent.length){
    tbody.innerHTML=`<tr><td colspan="6" style="text-align:center;color:var(--text-gray);padding:30px">لا توجد عمليات في هذه الفترة</td></tr>`;
    return;
  }
  tbody.innerHTML = allRecent.map(r=>{
    const badgeMap={installment:'badge-orange',installment_payment:'badge-orange',credit:'badge-red',debt_payment:'badge-red',cash:'badge-green',repair:'badge-blue',owner_withdrawal:'badge-purple',owner_capital_withdrawal:'badge-purple',worker_withdrawal:'badge-orange'};
    badgeMap.warranty = 'badge-blue';
    const d=new Date(r.date);
    const timeStr=`${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')} — ${d.getDate()}/${d.getMonth()+1}`;
    // زر الإرجاع — لا يظهر للتصليح
    const returnBtn = r.typeKey !== 'repair'
      ? `<button class="ibtn ibtn-red" title="إرجاع" onclick="returnSale('${r.saleId}','${r.typeKey}')">↩</button>`
      : `<span style="color:var(--text-gray);font-size:11px">—</span>`;
    return `<tr>
      <td><b>${r.name}</b></td>
      <td><span class="badge ${badgeMap[r.typeKey]||'badge-blue'}">${r.type}</span></td>
      <td style="text-align:center">${r.qty}</td>
      <td style="font-weight:700;color:var(--primary)">${fmt(r.paid)}</td>
      <td style="color:var(--text-gray);font-size:12px">${timeStr}</td>
      <td style="text-align:center">${returnBtn}</td>
    </tr>`;
  }).join('');
}

// ====== إرجاع عملية ======
function returnSale(saleId, typeKey){
  const sales = DB.get('sales');
  const sale  = sales.find(s=>s.id===saleId);
  if(!sale){ toast('⚠️ لم يُعثر على العملية','warn'); return; }

  const removeById = (items = [], id) => items.filter(item => item?.id !== id);

  const restoreProductsToStock = (items = []) => {
    if(!items.length) return false;
    const prods = DB.get('products');
    const touched = new Set();
    items.forEach(item => {
      const pi = prods.findIndex(p=>p.id===item.id);
      if(pi>=0){
        prods[pi].qty = (prods[pi].qty||0) + (item.qty||1);
        touched.add(prods[pi].id);
      }
    });
    if(!touched.size) return false;
    DB.set('products',prods);
    prods.filter(p=>touched.has(p.id)).forEach(p=>fsSaveDoc('products',p.id,p));
    return true;
  };

  const typeLabels = {
    cash:'كاش', installment:'تقسيط', credit:'كريدي',
    installment_payment:'دفعة قسط', debt_payment:'دفعة دين',
    owner_withdrawal:'سحب أرباح', owner_capital_withdrawal:'سحب رأس المال', worker_withdrawal:'سحب عامل'
  };
  typeLabels.warranty = 'ضمان';
  const typeLabel = typeLabels[typeKey] || typeKey;
  const amount = (typeKey==='owner_withdrawal'||typeKey==='owner_capital_withdrawal'||typeKey==='worker_withdrawal')
    ? Math.abs(sale.profit||0) : (sale.totalPaid||0);

  showConfirm(
    `↩ إرجاع ${typeLabel}`,
    `هل تريد إرجاع "${sale.productName||''}" — ${fmt(amount)} DA؟
سيتم تصحيح الأرقام تلقائياً.`,
    ()=>{
      const sales = DB.get('sales');
      const idx   = sales.findIndex(s=>s.id===saleId);
      if(idx<0) return;

      // ===== كاش: إعادة الكمية للمخزون + حذف Transaction =====
      if(typeKey==='cash'){
        const prods = DB.get('products');
        const pi = prods.findIndex(p=>p.id===sale.productId);
        if(pi>=0){ prods[pi].qty = (prods[pi].qty||0) + (sale.qty||1); DB.set('products',prods); fsSaveDoc('products',prods[pi].id,prods[pi]); }
        // حذف Transaction المرتبط
        const txs = DB.get('transactions').filter(t=>t.saleId!==saleId);
        DB.set('transactions', txs);
      }

      // ===== تقسيط (عملية البيع الأصلية): حذف ملف التقسيط كاملاً + إعادة المخزون =====
      if(typeKey==='warranty'){
        let stockRestored = false;
        const warrantyRec = DB.get('warranties').find(w =>
          w.id===sale.warrantyId ||
          w.saleId===saleId ||
          (w.productId===sale.productId && w.customerName===sale.customerName && w.date===sale.date)
        );
        if(warrantyRec){
          stockRestored = restoreProductsToStock(
            warrantyRec.selectedProducts ||
            sale.selectedProducts ||
            [{id:warrantyRec.productId, qty:warrantyRec.qty||sale.qty||1}]
          );
          window.removeWarrantyRecord?.(warrantyRec.id, { keepSaleLink:true });
        }
        if(!stockRestored && sale.productId){
          const restored = restoreProductsToStock([{id:sale.productId, qty:sale.qty||1}]);
          if(!restored) restoreProductsToStock(sale.selectedProducts || []);
        } else if(!stockRestored) {
          restoreProductsToStock(sale.selectedProducts || []);
        }
        const txs = DB.get('transactions').filter(t=>t.saleId!==saleId);
        DB.set('transactions', txs);
      }

      if(typeKey==='installment'){
        let stockRestored = false;
        const insts = DB.get('installments');
        const instIdx = insts.map((x,i)=>({x,i})).reverse().find(({x})=>
          x.id===sale.installmentId || x.productId===sale.productId || x.productName===sale.productName
        );
        if(instIdx){
          const instRec = insts[instIdx.i];
          const instId = instRec.id;
          DB.set('installments', removeById(insts, instId));
          fsDeleteDoc('installments',instId);
          // حذف كل الدفعات المرتبطة بهذا التقسيط من sales
          const cleanSales = DB.get('sales').filter(s=>
            !(s.type==='installment_payment' && s.productName===sale.productName)
          );
          DB.set('sales',cleanSales);
          stockRestored = restoreProductsToStock(instRec.selectedProducts || sale.selectedProducts || []);
        }
        if(!stockRestored && sale.productId){
          const restored = restoreProductsToStock([{id:sale.productId, qty:sale.qty||1}]);
          if(!restored) restoreProductsToStock(sale.selectedProducts || []);
        } else if(!stockRestored) {
          restoreProductsToStock(sale.selectedProducts || []);
        }
        // حذف Transaction
        const txs = DB.get('transactions').filter(t=>t.saleId!==saleId);
        DB.set('transactions', txs);
      }

      // ===== دفعة قسط فقط: إرجاع الدفعة وتحديث ملف التقسيط =====
      if(typeKey==='installment_payment'){
        const insts = DB.get('installments');
        const instIdx = insts.findIndex(x=>x.productName===sale.productName);
        if(instIdx>=0){
          const i = insts[instIdx];
          const refundAmount = sale.totalPaid||0;
          i.paid      = Math.max(0,(i.paid||0) - refundAmount);
          i.remaining = (i.totalPrice||0) - i.paid;
          i.paidMonths = Math.max(0,(i.paidMonths||1) - 1);
          i.status    = i.remaining>0 ? 'open' : 'closed';
          // حذف آخر دفعة من السجل
          if(i.payments?.length) i.payments.pop();
          insts[instIdx] = i;
          DB.set('installments',insts);
          fsSaveDoc('installments',i.id,i);
        }
      }

      // ===== كريدي (البيع الأصلي): حذف سجل الدين كاملاً + إعادة المخزون =====
      if(typeKey==='credit'){
        let stockRestored = false;
        const debts = DB.get('debts');
        const dIdx = debts.map((x,i)=>({x,i})).reverse().find(({x})=>
          x.id===sale.debtId || x.saleId===saleId || x.productName===sale.productName
        );
        if(dIdx){
          const debtRec = debts[dIdx.i];
          const debtId = debtRec.id;
          DB.set('debts', removeById(debts, debtId));
          fsDeleteDoc('debts',debtId);

          const currentSales = DB.get('sales');
          const linkedSales = currentSales.filter(s=> s.debtId===debtId || s.id===saleId);
          DB.set('sales', currentSales.filter(s=> !(s.debtId===debtId || s.id===saleId)));
          linkedSales.forEach(s => fsDeleteDoc('sales', s.id));

          stockRestored = restoreProductsToStock(debtRec.selectedProducts || sale.selectedProducts || []);
        }
        if(!stockRestored && sale.productId){
          const restored = restoreProductsToStock([{id:sale.productId, qty:sale.qty||1}]);
          if(!restored) restoreProductsToStock(sale.selectedProducts || []);
        } else if(!stockRestored) {
          restoreProductsToStock(sale.selectedProducts || []);
        }
        const txs = DB.get('transactions').filter(t=>t.saleId!==saleId);
        DB.set('transactions', txs);
      }

      if(typeKey==='debt_payment'){
        const debts = DB.get('debts');
        const dIdx = debts.findIndex(x=>x.id===sale.debtId || x.productName===sale.productName || x.reason===sale.productName);
        if(dIdx>=0){
          const d = debts[dIdx];
          const refundAmount = sale.totalPaid||0;
          d.paid      = Math.max(0,(d.paid||0) - refundAmount);
          d.remaining = (d.totalDebt||0) - d.paid;
          d.status    = d.remaining>0 ? 'open' : 'closed';
          if(d.payments?.length) d.payments = d.payments.filter(p=>p.saleId!==saleId);
          debts[dIdx] = d;
          DB.set('debts',debts);
          fsSaveDoc('debts',d.id,d);
        }
      }
      if(typeKey==='worker_withdrawal'){
        const wAmount = Math.abs(sale.profit||0);
        const workers = getWorkers();
        const targetWorkerId = sale.workerId || null;
        const targetWorkerName = sale.workerName || '';
        let workerChanged = false;
        workers.forEach(w=>{
          const matchesWorker = targetWorkerId
            ? w.id === targetWorkerId
            : !!(targetWorkerName && w.name === targetWorkerName);
          if(!matchesWorker) return;
          w.remaining = (w.remaining||0) + wAmount;
          const wi = (w.withdrawals||[]).map((x,i)=>({x,i})).reverse().find(({x})=>x.amount===wAmount);
          if(wi) w.withdrawals.splice(wi.i,1);
          workerChanged = true;
        });
        if(workerChanged) DB.set('workers', workers);
      }

      // ===== حذف العملية من المبيعات =====
      const finalSales = DB.get('sales');
      if(finalSales.some(s=>s.id===saleId)){
        DB.set('sales', removeById(finalSales, saleId));
      }

      toast('✅ تم إرجاع العملية بنجاح');
      renderDashboard();
    },
    '↩'
  );
}



