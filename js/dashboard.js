// ====== dashboard.js — لوحة التحكم ======

// ====== DASHBOARD PASSWORD ======
function getPWD(){ return localStorage.getItem('sj_pwd')||'1333gac'; }
let dashBtn = null;

function openDashboard(el){
  dashBtn = el;
  document.getElementById('pwd-input').value = '';
  document.getElementById('pwd-error').style.display = 'none';
  document.getElementById('dash-pwd-ov').classList.add('open');
  setTimeout(()=>document.getElementById('pwd-input').focus(), 280);
}

function confirmPwd(){
  if(document.getElementById('pwd-input').value === getPWD()){
    closePwd();
    goPage('dashboard', dashBtn);
    renderDashboard();
  } else {
    document.getElementById('pwd-error').style.display = 'block';
    document.getElementById('pwd-input').value = '';
    document.getElementById('pwd-input').focus();
    setTimeout(()=>document.getElementById('pwd-error').style.display='none', 2500);
  }
}

function closePwd(){
  document.getElementById('dash-pwd-ov').classList.remove('open');
}

function openChangePwd(){
  ['cp-old','cp-new','cp-confirm'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('cp-error').style.display = 'none';
  openModal('change-pwd-ov');
}

function saveNewPwd(){
  const old     = document.getElementById('cp-old').value;
  const nw      = document.getElementById('cp-new').value.trim();
  const confirm = document.getElementById('cp-confirm').value.trim();
  const errEl   = document.getElementById('cp-error');
  const showErr = (msg)=>{ errEl.textContent=msg; errEl.style.display='block'; };

  if(old !== getPWD())  { showErr('❌ كلمة السر الحالية غير صحيحة'); return; }
  if(!nw)               { showErr('❌ أدخل كلمة السر الجديدة'); return; }
  if(nw.length < 4)     { showErr('❌ كلمة السر يجب أن تكون 4 أحرف على الأقل'); return; }
  if(nw !== confirm)    { showErr('❌ كلمة السر الجديدة غير متطابقة'); return; }

  localStorage.setItem('sj_pwd', nw);
  closeModal('change-pwd-ov');
  toast('✅ تم تغيير كلمة السر بنجاح');
}

document.addEventListener('DOMContentLoaded', ()=>{
  const pwdInput = document.getElementById('pwd-input');
  if(pwdInput) pwdInput.addEventListener('keypress', e=>{
    if(e.key==='Enter') confirmPwd();
  });
});


// ====== DASHBOARD ======
let currentFilter = 'today';

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

function getFilterDate(){
  const now = new Date();
  const map = {
    today:     ()=>{ const d=new Date(now); d.setHours(0,0,0,0); return d; },
    yesterday: ()=>{ const d=new Date(now); d.setDate(d.getDate()-1); d.setHours(0,0,0,0); return d; },
    '2days':   ()=>{ const d=new Date(now); d.setDate(d.getDate()-2); d.setHours(0,0,0,0); return d; },
    '3days':   ()=>{ const d=new Date(now); d.setDate(d.getDate()-3); d.setHours(0,0,0,0); return d; },
    week:      ()=>{ const d=new Date(now); d.setDate(d.getDate()-7); return d; },
    '2weeks': ()=>{ const d=new Date(now); d.setDate(d.getDate()-14); return d; },
    '1m':  ()=>{ const d=new Date(now); d.setMonth(d.getMonth()-1); return d; },
    '2m':  ()=>{ const d=new Date(now); d.setMonth(d.getMonth()-2); return d; },
    '3m':  ()=>{ const d=new Date(now); d.setMonth(d.getMonth()-3); return d; },
    '4m':  ()=>{ const d=new Date(now); d.setMonth(d.getMonth()-4); return d; },
    '5m':  ()=>{ const d=new Date(now); d.setMonth(d.getMonth()-5); return d; },
    '6m':  ()=>{ const d=new Date(now); d.setMonth(d.getMonth()-6); return d; },
    '7m':  ()=>{ const d=new Date(now); d.setMonth(d.getMonth()-7); return d; },
    '8m':  ()=>{ const d=new Date(now); d.setMonth(d.getMonth()-8); return d; },
    '9m':  ()=>{ const d=new Date(now); d.setMonth(d.getMonth()-9); return d; },
    '10m': ()=>{ const d=new Date(now); d.setMonth(d.getMonth()-10); return d; },
    '11m': ()=>{ const d=new Date(now); d.setMonth(d.getMonth()-11); return d; },
    '12m': ()=>{ const d=new Date(now); d.setMonth(d.getMonth()-12); return d; },
  };
  return map[currentFilter] ? map[currentFilter]() : new Date(0);
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
function calcAll(from=null){
  const products     = DB.get('products');
  const installments = DB.get('installments');
  const debts        = DB.get('debts');
  const repairs      = DB.get('repairs');
  const sales        = DB.get('sales');
  const transactions = DB.get('transactions'); // Snapshots محمية من الحذف ✅

  const inRange = (date) => !from || new Date(date) >= from;
  const txInRange = transactions.filter(t => inRange(t.date));

  // ===== المبيعات المحصلة =====
  // إذا وجدت Transactions نحسب منها، وإلا من sales مباشرة
  const hasTx = txInRange.length > 0;
  const cashSales    = hasTx
    ? txInRange.filter(t=> t.type==='cash').reduce((a,t)=>a+(t.salePrice||0),0)
    : sales.filter(s=> s.type==='cash' && inRange(s.date)).reduce((a,s)=>a+(s.totalPaid||0),0);
  const instPayments = hasTx
    ? txInRange.filter(t=> t.type==='installment').reduce((a,t)=>a+(t.downPayment||0),0)
    : sales.filter(s=> s.type==='installment' && inRange(s.date)).reduce((a,s)=>a+(s.totalPaid||0),0);
  const debtPayments = hasTx
    ? txInRange.filter(t=> t.type==='credit').reduce((a,t)=>a+(t.downPayment||0),0)
    : sales.filter(s=> s.type==='credit' && inRange(s.date)).reduce((a,s)=>a+(s.totalPaid||0),0);
  // دفعات التقسيط والديون اللاحقة
  const instLaterPay = sales.filter(s=> s.type==='installment_payment' && inRange(s.date)).reduce((a,s)=>a+(s.totalPaid||0),0);
  const debtLaterPay = sales.filter(s=> s.type==='debt_payment' && inRange(s.date)).reduce((a,s)=>a+(s.totalPaid||0),0);
  const totalCollected = cashSales + instPayments + debtPayments + instLaterPay + debtLaterPay;

  // ===== الأرباح الصافية =====
  // إذا وجدت Transactions نحسب منها، وإلا من sales
  const cashProfit = hasTx
    ? txInRange.filter(t=> t.type==='cash').reduce((a,t)=>a+(t.profit||0),0)
    : sales.filter(s=> s.type==='cash' && inRange(s.date)).reduce((a,s)=>a+(s.profit||0),0);

  // تقسيط: نسبة الربح × المدفوع الكلي (مقدم + دفعات لاحقة)
  const instProfit = installments.reduce((a,i)=>{
    if(!i.profit || !i.totalPrice || !i.paid) return a;
    const ratio = i.profit / i.totalPrice;
    return a + Math.round(ratio * (i.paid||0));
  },0);

  // ديون: نسبة الربح × المدفوع فعلاً
  const debtProfit = sales
    .filter(s=> (s.type==='credit' || s.type==='debt_payment') && inRange(s.date))
    .reduce((a,s)=>a+(s.profit||0),0);

  // تصليح: لا يدخل في أرباح صاحب المحل
  const repairProfit = 0;

  // سحوبات العامل والمالك
  const workerCost = sales.filter(s=> s.type==='worker_withdrawal' && inRange(s.date)).reduce((a,s)=>a+Math.abs(s.profit||0),0);
  const ownerCost  = sales.filter(s=> s.type==='owner_withdrawal'  && inRange(s.date)).reduce((a,s)=>a+Math.abs(s.profit||0),0);

  const totalProfit = cashProfit + instProfit + debtProfit + repairProfit - workerCost - ownerCost;

  // ===== أموال التقسيط المتبقية =====
  const instRemain = installments.filter(i=>i.remaining>0).reduce((a,i)=>a+(i.remaining||0),0);

  // ===== الديون المتبقية =====
  const debtRemain = debts.filter(d=>d.remaining>0).reduce((a,d)=>a+(d.remaining||0),0);

  // ===== رأس المال = ما أُنفق على البيع =====

  // كاش: تكلفة المنتج × الكمية المباعة
  const cashCapital = sales.filter(s=> s.type==='cash' && inRange(s.date)).reduce((a,s)=>{
    const prod = products.find(p=>p.id===s.productId);
    const cost = prod ? (prod.cost||0) : ((s.totalPaid||0)-(s.profit||0));
    return a + (cost * (s.qty||1));
  },0);

  // تقسيط: (1 - نسبة الربح) × المدفوع = رأس المال
  const instCapital = installments.reduce((a,i)=>{
    if(!i.totalPrice || !i.paid) return a;
    const profitRatio = i.totalPrice>0 ? (i.profit||0)/i.totalPrice : 0;
    const capitalRatio = 1 - profitRatio;
    return a + Math.round(capitalRatio * (i.paid||0));
  },0);

  // ديون: (تكلفة ÷ إجمالي) × المدفوع
  const debtCapital = debts.reduce((a,d)=>{
    if(!d.totalDebt || !d.paid) return a;
    const cost = (d.cost||0) || Math.max(0,(d.totalDebt||0)-(d.profit||0));
    const ratio = d.totalDebt>0 ? cost/d.totalDebt : 0;
    return a + Math.round(ratio * (d.paid||0));
  },0);

  // تصليح: لا يدخل في رأس مال صاحب المحل — المصلّح يتحمل تكاليفه
  const repairsCapital = 0;

  const totalCapital = cashCapital + instCapital + debtCapital + repairsCapital;

  return { totalCollected, totalProfit, instRemain, debtRemain, totalCapital };
}

function renderDashboard(){
  const from = getFilterDate();
  const c = calcAll(from);

  // قيمة المخزون = مجموع (سعر البيع × الكمية) لكل المنتجات
  const stockValue = DB.get('products').reduce((a,p)=>a+((p.price||0)*(p.qty||0)),0);
  const stockEl = document.getElementById('kpi-stock-value');
  if(stockEl) stockEl.textContent = num(stockValue);

  document.getElementById('kpi-sales').textContent        = num(c.totalCollected);
  document.getElementById('kpi-profit').textContent       = num(Math.max(0, c.totalProfit));
  document.getElementById('kpi-installments').textContent = num(c.instRemain);
  document.getElementById('kpi-debts').textContent        = num(c.debtRemain);
  document.getElementById('kpi-capital').textContent      = num(c.totalCapital);

  drawDonut(c.totalCollected, Math.max(0,c.totalProfit), c.instRemain, c.debtRemain, c.totalCapital);

  // جدول آخر العمليات - مباشرة من البيانات الحقيقية
  const sales   = DB.get('sales');
  const repairs = DB.get('repairs');
  // المبيعات فقط — بدون التصليح (التصليح منفصل عن صاحب المحل)
  const allSales = sales.filter(s=> new Date(s.date)>=from && s.type!=='repair');

  const recentSales = allSales.map(s=>({
    saleId: s.id,
    name: s.productName,
    type: s.type==='installment'?'تقسيط': s.type==='installment_payment'?'دفعة قسط': s.type==='credit'?'كريدي': s.type==='debt_payment'?'دفعة دين': s.type==='owner_withdrawal'?'سحب أرباح': s.type==='worker_withdrawal'?'سحب عامل':'كاش',
    typeKey: s.type, qty: s.qty||1,
    paid: (s.type==='owner_withdrawal'||s.type==='worker_withdrawal') ? Math.abs(s.profit||0) : (s.totalPaid||0),
    productId: s.productId||'',
    date: s.date
  }));

  // آخر العمليات — بدون التصليح (التصليح لا علاقة له بصاحب المحل)
  const recentRepairs = [];

  const allRecent = [...recentSales, ...recentRepairs]
    .sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0,10);

  const tbody = document.getElementById('dash-recent');
  if(!allRecent.length){
    tbody.innerHTML=`<tr><td colspan="6" style="text-align:center;color:var(--text-gray);padding:30px">لا توجد عمليات في هذه الفترة</td></tr>`;
    return;
  }
  tbody.innerHTML = allRecent.map(r=>{
    const badgeMap={installment:'badge-orange',credit:'badge-red',cash:'badge-green',repair:'badge-blue',owner_withdrawal:'badge-purple',worker_withdrawal:'badge-orange'};
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
    owner_withdrawal:'سحب أرباح', worker_withdrawal:'سحب عامل'
  };
  const typeLabel = typeLabels[typeKey] || typeKey;
  const amount = (typeKey==='owner_withdrawal'||typeKey==='worker_withdrawal')
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
      if(typeKey==='installment'){
        let stockRestored = false;
        const insts = DB.get('installments');
        const instIdx = insts.map((x,i)=>({x,i})).reverse().find(({x})=>
          x.id===sale.installmentId || x.productId===sale.productId || x.productName===sale.productName
        );
        if(instIdx){
          const instRec = insts[instIdx.i];
          const instId = instRec.id;
          insts.splice(instIdx.i,1);
          DB.set('installments',insts);
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
          debts.splice(dIdx.i,1);
          DB.set('debts',debts);
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
        workers.forEach(w=>{
          if(sale.productName && sale.productName.includes(w.name)){
            w.remaining = (w.remaining||0) + wAmount;
            const wi = (w.withdrawals||[]).map((x,i)=>({x,i})).reverse().find(({x})=>x.amount===wAmount);
            if(wi) w.withdrawals.splice(wi.i,1);
          }
        });
        DB.set('workers', workers);
      }

      // ===== حذف العملية من المبيعات =====
      const finalSales = DB.get('sales');
      const fi = finalSales.findIndex(s=>s.id===saleId);
      if(fi>=0){ finalSales.splice(fi,1); DB.set('sales',finalSales); }

      toast('✅ تم إرجاع العملية بنجاح');
      renderDashboard();
    },
    '↩'
  );
}



// ====== تعتيم/إظهار أرباح التقسيط ======
let _instProfitBtn = null;

function toggleInstProfit(btn) {
  const hidden = document.getElementById('inst-kpi-collected-hidden');
  const real   = document.getElementById('inst-kpi-collected-real');
  if (!hidden || !real) return;

  if (real.style.display === 'none') {
    // فتح نافذة كلمة السر
    _instProfitBtn = btn;
    const input = document.getElementById('inst-profit-pwd-input');
    const err   = document.getElementById('inst-profit-pwd-err');
    if (input) input.value = '';
    if (err)   err.style.display = 'none';
    openModal('inst-profit-pwd-ov');
    setTimeout(() => { if(input) input.focus(); }, 300);
  } else {
    // إخفاء مباشرة
    hidden.style.display = 'inline';
    real.style.display   = 'none';
    btn.textContent      = '👁️';
  }
}

function confirmInstProfit() {
  const input  = document.getElementById('inst-profit-pwd-input');
  const err    = document.getElementById('inst-profit-pwd-err');
  const hidden = document.getElementById('inst-kpi-collected-hidden');
  const real   = document.getElementById('inst-kpi-collected-real');

  if (!input) return;

  if (input.value === getPWD()) {
    closeModal('inst-profit-pwd-ov');
    if (hidden) hidden.style.display = 'none';
    if (real)   real.style.display   = 'inline';
    if (_instProfitBtn) _instProfitBtn.textContent = '🙈';
  } else {
    if (err) { err.style.display = 'block'; }
    input.value = '';
    input.focus();
    setTimeout(() => { if(err) err.style.display='none'; }, 2000);
  }
}

// Enter في حقل كلمة السر
document.addEventListener('DOMContentLoaded', () => {
  const input = document.getElementById('inst-profit-pwd-input');
  if (input) {
    input.addEventListener('keypress', e => {
      if (e.key === 'Enter') confirmInstProfit();
    });
  }
});
