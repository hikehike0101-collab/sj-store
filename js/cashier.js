// ====== cashier.js — الكاشير ======

// ====== الكاشير ======
let _cashierItems  = [];   // [{prod, qty, price}]
let _cashierDiscount = 0;
let _cashierSaleType = 'cash';

function renderCashier(){
  _cashierItems   = [];
  _cashierDiscount = 0;
  updateCashierUI();
  // تفعيل قارئ الباركود على هذه الصفحة
  document.getElementById('cashier-search').value = '';
  document.getElementById('cashier-search-results').style.display = 'none';
}

function clearCashier(){
  _cashierItems    = [];
  _cashierDiscount = 0;
  updateCashierUI();
  document.getElementById('cashier-search').value = '';
  document.getElementById('cashier-search-results').style.display = 'none';
}

function getCashierTotal(){
  const sub = _cashierItems.reduce((s,i)=>s+(i.price*i.qty),0);
  return Math.max(0, sub - _cashierDiscount);
}

function getCashierProfit(){
  const profit = _cashierItems.reduce((s,i)=>s+((i.prod.profit||0)*i.qty),0);
  return Math.max(0, profit - _cashierDiscount);
}

function updateCashierUI(){
  const total  = getCashierTotal();
  const count  = _cashierItems.reduce((s,i)=>s+i.qty,0);

  document.getElementById('cashier-total-display').textContent = fmt(total);
  document.getElementById('cashier-count').textContent = count;

  const discEl = document.getElementById('cashier-discount-display');
  if(_cashierDiscount>0){
    discEl.style.display='block';
    document.getElementById('cashier-discount-val').textContent = fmt(_cashierDiscount);
  } else {
    discEl.style.display='none';
  }

  const tbody = document.getElementById('cashier-tbody');
  if(!_cashierItems.length){
    tbody.innerHTML=`<tr id="cashier-empty-row"><td colspan="6" style="text-align:center;color:var(--text-gray);padding:30px">
      <div style="font-size:36px;margin-bottom:8px">📷</div>امسح باركود المنتج أو ابحث يدوياً</td></tr>`;
    return;
  }
  tbody.innerHTML = _cashierItems.map((item,idx)=>`
    <tr>
      <td style="text-align:center;color:var(--text-gray)">${idx+1}</td>
      <td>
        <div style="font-weight:700">${item.prod.name}</div>
        ${item.prod.color?`<div style="font-size:11px;color:var(--text-gray)">${item.prod.color}</div>`:''}
      </td>
      <td style="text-align:center">
        <div style="display:flex;align-items:center;justify-content:center;gap:6px">
          <button class="qty-btn" onclick="changeCashierQty(${idx},-1)">−</button>
          <span style="font-weight:700;min-width:20px;text-align:center">${item.qty}</span>
          <button class="qty-btn" onclick="changeCashierQty(${idx},1)">+</button>
        </div>
      </td>
      <td style="text-align:center;font-weight:700">${fmt(item.price)}</td>
      <td style="text-align:center;font-weight:800;color:var(--primary)">${fmt(item.price*item.qty)}</td>
      <td style="text-align:center">
        <button class="ibtn ibtn-red" onclick="removeCashierItem(${idx})">🗑️</button>
      </td>
    </tr>`).join('');
}

function addToCashier(prodId){
  const prods = DB.get('products');
  const prod  = prods.find(p=>p.id===prodId);
  if(!prod){ toast('⚠️ المنتج غير موجود','warn'); return; }
  if((prod.qty||0)<=0){ toast('⚠️ المنتج نفد من المخزون','warn'); return; }

  const existing = _cashierItems.findIndex(i=>i.prod.id===prodId);
  if(existing>=0){
    const maxQty = prod.qty||1;
    if(_cashierItems[existing].qty >= maxQty){ toast('⚠️ لا يوجد مخزون كافٍ','warn'); return; }
    _cashierItems[existing].qty++;
  } else {
    _cashierItems.push({prod, qty:1, price: prod.price||0});
  }
  updateCashierUI();
  toast(`✅ ${prod.name} أُضيف`,'ok');
  // إخفاء نتائج البحث
  document.getElementById('cashier-search-results').style.display='none';
  document.getElementById('cashier-search').value='';
}

function changeCashierQty(idx, delta){
  if(!_cashierItems[idx]) return;
  const newQty = _cashierItems[idx].qty + delta;
  const maxQty = _cashierItems[idx].prod.qty||1;
  if(newQty<=0){ removeCashierItem(idx); return; }
  if(newQty>maxQty){ toast('⚠️ لا يوجد مخزون كافٍ','warn'); return; }
  _cashierItems[idx].qty = newQty;
  updateCashierUI();
}

function removeCashierItem(idx){
  _cashierItems.splice(idx,1);
  updateCashierUI();
}

function cashierManualSearch(){
  const q = (document.getElementById('cashier-search').value||'').trim().toLowerCase();
  const resultsEl = document.getElementById('cashier-search-results');
  if(!q){ resultsEl.style.display='none'; return; }

  const prods = DB.get('products').filter(p=>
    (p.name||'').toLowerCase().includes(q) ||
    (p.barcode||'').includes(q)
  ).slice(0,6);

  if(!prods.length){ resultsEl.style.display='none'; return; }

  resultsEl.style.display='block';
  resultsEl.innerHTML = prods.map(p=>`
    <div onclick="addToCashier('${p.id}')" style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;cursor:pointer;border-bottom:1px solid var(--border);transition:background 0.15s" onmouseenter="this.style.background='var(--bg)'" onmouseleave="this.style.background=''">
      <div>
        <div style="font-weight:700;font-size:13px">${p.name}</div>
        <div style="font-size:11px;color:var(--text-gray)">${p.barcode||''} ${p.color?'· '+p.color:''}</div>
      </div>
      <div style="font-weight:800;color:var(--primary)">${fmt(p.price)} DA</div>
    </div>`).join('');
}

function openCashierDiscount(){
  if(!_cashierItems.length){ toast('⚠️ لا يوجد منتجات','warn'); return; }
  document.getElementById('cashier-discount-input').value = _cashierDiscount||'';
  openModal('cashier-discount-ov');
}

function confirmCashierDiscount(){
  const amount = parseFloat(document.getElementById('cashier-discount-input').value)||0;
  const sub = _cashierItems.reduce((s,i)=>s+(i.price*i.qty),0);
  if(amount>=sub){ toast('⚠️ الخصم أكبر من الإجمالي','err'); return; }
  _cashierDiscount = amount;
  updateCashierUI();
  closeModal('cashier-discount-ov');
  toast(`✅ تم تطبيق خصم ${fmt(amount)} DA`);
}

function openCashierSale(type){
  if(!_cashierItems.length){ toast('⚠️ لا يوجد منتجات','warn'); return; }
  _cashierSaleType = type;
  const total = getCashierTotal();

  document.getElementById('cashier-sale-total').textContent = fmt(total)+' DA';
  const titles = {cash:'💵 بيع كاش', installment:'📅 بيع بالتقسيط', credit:'💳 بيع كريدي'};
  document.getElementById('cashier-sale-title').textContent = titles[type]||'تأكيد البيع';

  ['cashier-sec-cash','cashier-sec-install','cashier-sec-credit'].forEach(id=>{
    document.getElementById(id).style.display='none';
  });
  const secMap={cash:'cashier-sec-cash',installment:'cashier-sec-install',credit:'cashier-sec-credit'};
  document.getElementById(secMap[type]).style.display='block';

  if(type==='installment') calcCashierInstall();
  openModal('cashier-sale-ov');
}

function calcCashierInstall(){
  const total  = getCashierTotal();
  const downInput = document.getElementById('ci-down');
  let down   = parseFloat(downInput?.value)||0;
  if(down > total){
    down = total;
    if(downInput) downInput.value = String(total);
  }
  const months = parseInt(document.getElementById('ci-months')?.value)||1;
  const remain = Math.max(0,total-down);
  const monthly = remain>0?Math.ceil(remain/months):0;
  const el = document.getElementById('ci-summary');
  if(el) el.innerHTML=`
    <div style="display:flex;justify-content:space-between;margin-bottom:5px"><span>المتبقي:</span><b>${fmt(remain)} DA</b></div>
    <div style="display:flex;justify-content:space-between"><span>القسط الشهري:</span><b style="color:var(--primary)">${fmt(monthly)} DA × ${months}</b></div>`;
}

async function confirmCashierSale(){
  if(!_cashierItems.length) return;
  const total  = getCashierTotal();
  const profit = getCashierProfit();
  const type   = _cashierSaleType;
  const sales  = DB.get('sales');
  const lineItems = _cashierItems.map(item => ({
    id: item.prod.id,
    name: item.prod.name || '',
    qty: item.qty,
    price: parseFloat(item.price) || 0,
    cost: parseFloat(item.prod.cost) || 0
  }));
  const deductCashierStock = () => {
    const prods = DB.get('products').slice();
    for(const item of _cashierItems){
      const pi = prods.findIndex(p=>p.id===item.prod.id);
      if(pi < 0){
        toast(`⚠️ المنتج ${item.prod.name} لم يعد موجودًا`, 'warn');
        return false;
      }
      const available = Math.max(0, parseInt(prods[pi].qty, 10) || 0);
      if(available < item.qty){
        toast(`⚠️ المخزون المتاح للمنتج ${item.prod.name} هو ${available} فقط`, 'warn');
        return false;
      }
      prods[pi].qty = available - item.qty;
    }
    DB.set('products',prods);
    _cashierItems = _cashierItems.map(item => {
      const updated = prods.find(p => p.id === item.prod.id);
      return updated ? {...item, prod: updated} : item;
    });
    return true;
  };

  const productNames = _cashierItems.map(i=>`${i.prod.name}${i.qty>1?' ×'+i.qty:''}`).join('، ');

  if(type==='cash'){
    if(!deductCashierStock()) return;
    const saleId = genId();
    const saleData = {id:saleId, productName:productNames, type:'cash',
      qty:_cashierItems.reduce((s,i)=>s+i.qty,0),
      totalPaid:total, profit, date:nowISO()};
    sales.push(saleData);
    DB.set('sales',sales);
    // Snapshot محمي في Transactions
    DB.addTransaction({
      type:'cash', productName:productNames,
      qty:_cashierItems.reduce((s,i)=>s+i.qty,0),
      salePrice:total, profit,
      cost: _cashierItems.reduce((s,i)=>s+(i.prod.cost||0)*i.qty,0),
      discount:_cashierDiscount, date:nowISO(), saleId
    });
    tg(`💵 <b>كاشير — كاش</b>\n${productNames}\nالإجمالي: ${fmt(total)}\nخصم: ${fmt(_cashierDiscount)}\nالربح: ${fmt(profit)}\nالتاريخ: ${todayStr()}`);
    toast('✅ تم البيع كاش بنجاح');
  }

  if(type==='installment'){
    const name  = document.getElementById('ci-name').value.trim();
    const phone = document.getElementById('ci-phone').value.trim();
    const down  = parseFloat(document.getElementById('ci-down').value)||0;
    const months= parseInt(document.getElementById('ci-months').value)||1;
    if(!name){ toast('أدخل اسم الزبون','err'); return; }
    if(down > total){ toast('⚠️ المقدم أكبر من إجمالي البيع','err'); return; }
    if(!deductCashierStock()) return;
    const remain  = Math.max(0,total-down);
    const monthly = remain>0?Math.ceil(remain/months):0;
    const insts   = DB.get('installments');
    insts.push({id:genId(), customerName:name, phone, productName:productNames,
      totalPrice:total, downPayment:down, months, monthlyPayment:monthly,
      profit, paid:down, remaining:remain, paidMonths:0,
      selectedProducts: lineItems,
      payments:down>0?[{amount:down,date:nowISO()}]:[],
      barcode13:genRandom13(), date:nowISO()});
    DB.set('installments',insts);
    // مزامنة Firestore
    const lastInst = insts[insts.length-1];
    if(lastInst) fsSaveDoc('installments', lastInst.id, lastInst);
    const instSaleId = genId();
    sales.push({id:instSaleId, productName:productNames, type:'installment',
      qty:_cashierItems.reduce((s,i)=>s+i.qty,0),
      totalPaid:down, profit, date:nowISO(),
      installmentId:lastInst?.id||'',
      selectedProducts: lineItems});
    DB.set('sales',sales);
    DB.addTransaction({
      type:'installment', productName:productNames, customerName:name,
      qty:_cashierItems.reduce((s,i)=>s+i.qty,0),
      salePrice:total, profit,
      cost:_cashierItems.reduce((s,i)=>s+(i.prod.cost||0)*i.qty,0),
      downPayment:down, months, monthlyPayment:monthly,
      date:nowISO(), saleId:instSaleId
    });
    await window.autoPrintInstallmentContract?.(lastInst);
    tg(`📅 <b>كاشير — تقسيط</b>\nالزبون: ${name}\n${productNames}\nالإجمالي: ${fmt(total)}\nمقدم: ${fmt(down)}\nقسط: ${fmt(monthly)}×${months}\nالتاريخ: ${todayStr()}`);
    toast('✅ تم تسجيل التقسيط');
  }

  if(type==='credit'){
    const name  = document.getElementById('cc-name').value.trim();
    const phone = document.getElementById('cc-phone').value.trim();
    const paid  = parseFloat(document.getElementById('cc-paid').value)||0;
    if(!name){ toast('أدخل اسم الزبون','err'); return; }
    if(paid > total){ toast('⚠️ المبلغ المدفوع أكبر من إجمالي الدين','err'); return; }
    if(!deductCashierStock()) return;
    const remain = Math.max(0,total-paid);
    const initialProfit = total > 0 ? Math.round((profit / total) * paid) : 0;
    const debts  = DB.get('debts');
    debts.push({id:genId(), customerName:name, phone, reason:productNames,
      productName:productNames, totalDebt:total, paid, remaining:remain,
      profit, barcode13:genRandom13(), date:nowISO(), lastUpdate:nowISO(),
      archived:false, archivedAt:'',
      selectedProducts: lineItems,
      payments:paid>0?[{amount:paid,date:nowISO()}]:[]});
    DB.set('debts',debts);
    // مزامنة Firestore
    const lastDebt = debts[debts.length-1];
    if(lastDebt) fsSaveDoc('debts', lastDebt.id, lastDebt);
    const credSaleId = genId();
    sales.push({id:credSaleId, productName:productNames, type:'credit',
      qty:_cashierItems.reduce((s,i)=>s+i.qty,0),
      totalPaid:paid, profit:initialProfit, date:nowISO(),
      debtId:lastDebt?.id||'',
      selectedProducts: lineItems});
    DB.set('sales',sales);
    DB.addTransaction({
      type:'credit', productName:productNames, customerName:name,
      qty:_cashierItems.reduce((s,i)=>s+i.qty,0),
      salePrice:total, profit:initialProfit,
      cost:_cashierItems.reduce((s,i)=>s+(i.prod.cost||0)*i.qty,0),
      totalDebt:total, downPayment:paid, remaining:remain,
      date:nowISO(), saleId:credSaleId
    });
    tg(`💳 <b>كاشير — كريدي</b>\nالزبون: ${name}\n${productNames}\nالإجمالي: ${fmt(total)}\nدفع: ${fmt(paid)}\nمتبقي: ${fmt(remain)}\nالتاريخ: ${todayStr()}`);
    toast('✅ تم تسجيل الكريدي');
  }

  closeModal('cashier-sale-ov');
  clearCashier();
}

function renderRepairs(){
  const q    = (document.getElementById('rep-search').value||'').trim().toLowerCase();
  const from = getRepairFrom();
  let reps   = DB.get('repairs');

  // KPI المبسط
  const filtered = reps.filter(r=>new Date(r.date)>=from);
  const paidFiltered = filtered.filter(r=>r.paid);
  const pendingFiltered = filtered.filter(r=>!r.paid);
  const kpiTotal = document.getElementById('rep-kpi-total');
  const kpiCount = document.getElementById('rep-kpi-count');
  const kpiPending = document.getElementById('rep-kpi-pending');
  if(kpiTotal)   kpiTotal.textContent   = num(paidFiltered.reduce((a,r)=>a+(r.servicePrice||r.total||0),0));
  if(kpiCount)   kpiCount.textContent   = filtered.length;
  if(kpiPending) kpiPending.textContent = pendingFiltered.length;
  // عناصر مخفية للتوافق
  document.getElementById('rep-kpi-parts').textContent = '0';
  document.getElementById('rep-kpi-anis').textContent  = '0';
  document.getElementById('rep-kpi-siraj').textContent = '0';

  // تصفية الجدول بالبحث
  if(q) reps = reps.filter(r=>
    (r.customerName||'').toLowerCase().includes(q)||
    (r.device||'').toLowerCase().includes(q)||
    String(r.serialNo||'').includes(q)
  );

  document.getElementById('rep-count').textContent = reps.length+' عملية';
  const tbody = document.getElementById('rep-tbody');
  const empty = document.getElementById('rep-empty');

  if(!reps.length){ tbody.innerHTML=''; empty.style.display='block'; return; }
  empty.style.display='none';

  tbody.innerHTML = reps.map(r=>{
    const paidBadge = r.paid
      ? `<span class="badge badge-green">✅ مدفوع</span>`
      : `<span class="badge badge-orange">⏳ بانتظار الدفع</span>`;
    return `<tr>
      <td style="text-align:center;font-size:16px;font-weight:900;color:var(--primary)">${r.serialNo}</td>
      <td>
        <div style="font-weight:700;font-size:13.5px;cursor:pointer;color:var(--primary);text-decoration:underline"
          onclick="openRepairDetail('${r.id}')">${r.customerName}</div>
        <div style="font-size:11.5px;color:var(--text-gray)">${r.phone||'—'}</div>
        <div style="margin-top:3px">${paidBadge}</div>
      </td>
      <td style="font-size:12.5px;font-weight:600;max-width:180px">${r.device}</td>
      <td style="font-weight:800;color:var(--primary);font-size:15px">${fmt(r.total)}</td>
      <td style="font-size:11px;color:var(--text-gray);font-family:monospace">${r.barcode13||'—'}</td>
      <td style="font-size:12px;color:var(--text-gray)">${r.date ? new Date(r.date).toLocaleDateString('ar-DZ') : '—'}</td>
      <td>
        <div class="act-btns" style="justify-content:center;flex-wrap:wrap;gap:4px">
          <button class="ibtn ibtn-purple" title="طباعة" onclick="openRepairPrint('${r.id}')">🖨️</button>
          <button class="ibtn ibtn-blue" title="تعديل" onclick="openRepairModal('${r.id}')">✏️</button>
          <button class="ibtn ibtn-red" title="حذف" onclick="deleteRepair('${r.id}')">🗑️</button>
          ${!r.paid?`<button class="btn btn-sm btn-green" onclick="openRepairPaid('${r.id}')">✅ تم الدفع</button>`:''}
        </div>
      </td>
    </tr>`;
  }).join('');
}

// تحميل التصليح — يتم عبر goPage

let _debtTarget = null;
let _debtEditId = null;
let _debtSelectedProducts = [];

function getDebtTotalValue(){
  return parseFloat(document.getElementById('dm-total').value) || 0;
}

function setDebtTotalValue(total){
  const normalized = Math.max(0, Number(total) || 0);
  document.getElementById('dm-total').value = normalized > 0 ? String(normalized) : '';
  const display = document.getElementById('dm-total-display');
  if(display) display.textContent = fmt(normalized);
}

function calcDebtRemain(){
  const total = getDebtTotalValue();
  const paidInput = document.getElementById('dm-paid');
  let paid  = parseFloat(paidInput.value)||0;
  if(paid > total){
    paid = total;
    paidInput.value = String(total);
  }
  document.getElementById('dm-remain-display').textContent = fmt(Math.max(0, total-paid));
}

function calcDebtProfit(){
  const cost     = parseFloat(document.getElementById('dm-cost').value)||0;
  const salePrice = parseFloat(document.getElementById('dm-profit').value)||0;
  const netProfit = Math.max(0, salePrice - cost);
  const profitEl  = document.getElementById('dm-profit-display');
  if(profitEl) profitEl.textContent = fmt(netProfit);
  calcDebtRemain();
}

function syncDebtSalePrice(){
  const salePrice = parseFloat(document.getElementById('dm-profit').value)||0;
  setDebtTotalValue(salePrice);
  calcDebtProfit();
}

function calcDebtTotal(){
  calcDebtRemain();
}

function getDebtSelectionEntries() {
  return _debtSelectedProducts.map(item => {
    const product = DB.get('products').find(p => p.id === item.id);
    if (!product) return null;
    return { product, qty: Math.max(1, parseInt(item.qty) || 1) };
  }).filter(Boolean);
}

function findDebtSelection(id) {
  return _debtSelectedProducts.find(item => item.id === id);
}

function applyDebtSelectionToForm() {
  const selected = getDebtSelectionEntries();
  const chips = document.getElementById('debt-selected-products');

  if (chips) {
    if (!selected.length) {
      chips.style.display = 'none';
      chips.innerHTML = '';
    } else {
      chips.style.display = 'flex';
      chips.innerHTML = selected.map(({ product, qty }) => (
        '<div style="display:inline-flex;align-items:center;gap:8px;padding:6px 10px;border:1px solid var(--border);border-radius:999px;background:var(--primary-light);color:var(--primary-dark);font-size:12px;font-weight:700">' +
        '<span>' + product.name + '</span>' +
        '<button type="button" onclick="changeDebtSelectedQty(\'' + product.id + '\',-1); event.stopPropagation();" style="border:none;background:white;color:var(--primary-dark);width:22px;height:22px;border-radius:50%;cursor:pointer;font-weight:900">-</button>' +
        '<span>' + qty + '</span>' +
        '<button type="button" onclick="changeDebtSelectedQty(\'' + product.id + '\',1); event.stopPropagation();" style="border:none;background:var(--primary);color:white;width:22px;height:22px;border-radius:50%;cursor:pointer;font-weight:900">+</button>' +
        '<button type="button" onclick="removeDebtSelectedProduct(\'' + product.id + '\'); event.stopPropagation();" style="border:none;background:transparent;color:var(--red);cursor:pointer;font-weight:900">×</button>' +
        '</div>'
      )).join('');
    }
  }

  if (!selected.length) return;

  document.getElementById('dm-reason').value = selected.map(({ product, qty }) => product.name + (qty > 1 ? ' ×' + qty : '')).join('، ');
  document.getElementById('dm-cost').value = selected.reduce((sum, item) => sum + ((parseFloat(item.product.cost) || 0) * item.qty), 0);
  document.getElementById('dm-profit').value = selected.reduce((sum, item) => sum + ((parseFloat(item.product.price) || 0) * item.qty), 0);
  setDebtTotalValue(selected.reduce((sum, item) => sum + ((parseFloat(item.product.price) || 0) * item.qty), 0));
  calcDebtProfit();
  calcDebtRemain();
}

function getDebtProductSnapshots() {
  return getDebtSelectionEntries().map(({ product, qty }) => ({
    id: product.id,
    name: product.name || '',
    price: parseFloat(product.price) || 0,
    cost: parseFloat(product.cost) || 0,
    qty
  }));
}

function syncDebtProductStock(previousItems = [], nextItems = []) {
  const products = DB.get('products');
  const previousMap = new Map(previousItems.map(item => [item.id, Math.max(0, parseInt(item.qty) || 0)]));
  const nextMap = new Map(nextItems.map(item => [item.id, Math.max(0, parseInt(item.qty) || 0)]));
  const allIds = new Set([...previousMap.keys(), ...nextMap.keys()]);
  const changed = new Set();

  for (const id of allIds) {
    const prevQty = previousMap.get(id) || 0;
    const nextQty = nextMap.get(id) || 0;
    const diff = nextQty - prevQty;
    if (!diff) continue;

    const idx = products.findIndex(p => p.id === id);
    if (idx < 0) {
      toast('⚠️ المنتج غير موجود', 'warn');
      return false;
    }

    if (diff > 0) {
      const available = parseInt(products[idx].qty) || 0;
      if (available < diff) {
        toast('⚠️ المخزون لا يكفي للمنتج: ' + (products[idx].name || id), 'warn');
        return false;
      }
      products[idx].qty = available - diff;
    } else {
      products[idx].qty = (parseInt(products[idx].qty) || 0) + Math.abs(diff);
    }

    changed.add(products[idx].id);
  }

  if (!changed.size) return true;

  DB.set('products', products);
  products.filter(prod => changed.has(prod.id)).forEach(prod => fsSaveDoc('products', prod.id, prod));
  return true;
}

function addDebtSelectedProduct(id) {
  const product = DB.get('products').find(p => p.id === id);
  if (!product) return;

  const selected = findDebtSelection(id);
  const available = parseInt(product.qty) || 0;
  if (available <= 0) {
    toast('⚠️ المنتج نفد من المخزون', 'warn');
    return;
  }

  if (selected) {
    if (selected.qty >= available) {
      toast('⚠️ لا يمكن تجاوز المخزون المتاح', 'warn');
      return;
    }
    selected.qty += 1;
  } else {
    _debtSelectedProducts.push({ id, qty: 1 });
  }

  applyDebtSelectionToForm();
  openDebtProductPicker();
}

function changeDebtSelectedQty(id, delta) {
  const selected = findDebtSelection(id);
  if (!selected) {
    if (delta > 0) addDebtSelectedProduct(id);
    return;
  }

  if (delta < 0 && selected.qty <= 1) {
    removeDebtSelectedProduct(id);
    return;
  }

  if (delta > 0) {
    const product = DB.get('products').find(p => p.id === id);
    const available = parseInt(product?.qty) || 0;
    if (available <= 0 || selected.qty >= available) {
      toast('⚠️ لا يمكن تجاوز المخزون المتاح', 'warn');
      return;
    }
  }

  selected.qty = Math.max(1, selected.qty + delta);
  applyDebtSelectionToForm();
  openDebtProductPicker();
}

function removeDebtSelectedProduct(id) {
  _debtSelectedProducts = _debtSelectedProducts.filter(item => item.id !== id);
  applyDebtSelectionToForm();
  openDebtProductPicker();
}

function upsertDebtCreditSale(debtRec) {
  const sales = DB.get('sales');
  const paidNow = Math.max(0, parseFloat(debtRec.initialPaid) || 0);
  const totalDebt = Math.max(0, parseFloat(debtRec.totalDebt) || 0);
  const profitRatio = totalDebt > 0 ? (parseFloat(debtRec.profit) || 0) / totalDebt : 0;
  const creditSale = {
    id: debtRec.saleId || genId(),
    debtId: debtRec.id,
    customerName: debtRec.customerName,
    productName: debtRec.reason || debtRec.productName,
    type: 'credit',
    qty: debtRec.selectedProducts?.reduce((sum, item) => sum + (parseInt(item.qty) || 0), 0) || 1,
    totalPaid: paidNow,
    totalPrice: totalDebt,
    profit: Math.round(profitRatio * paidNow),
    date: debtRec.date || nowISO()
  };

  const idx = sales.findIndex(s => s.id === creditSale.id || s.debtId === debtRec.id);
  if (idx >= 0) sales[idx] = { ...sales[idx], ...creditSale };
  else sales.push(creditSale);

  DB.set('sales', sales);
  fsSaveDoc('sales', creditSale.id, creditSale);
  return creditSale.id;
}

function normalizeDebtPayments(payments = [], initialPaid = 0, recordDate = nowISO()) {
  const laterPayments = (payments || []).filter(payment => payment?.saleId);
  if (initialPaid > 0) {
    return [{ amount: initialPaid, date: recordDate, kind: 'initial' }, ...laterPayments];
  }
  return laterPayments;
}

function openDebtModal(editId=null){
  _debtEditId = editId;
  _debtSelectedProducts = [];
  ['dm-name','dm-phone','dm-reason','dm-cost','dm-profit','dm-paid'].forEach(id=>{
    document.getElementById(id).value = id==='dm-paid' ? '0' : '';
  });
  setDebtTotalValue(0);
  document.getElementById('dm-remain-display').textContent = '0';
  const dpEl = document.getElementById('dm-profit-display');
  if (dpEl) dpEl.textContent = '0';
  applyDebtSelectionToForm();

  if (editId) {
    const data = DB.get('debts');
    const d = data.find(x=>x.id===editId && !x.archived);
    if (!d) return;
    document.getElementById('debt-modal-title').textContent = 'تعديل بيانات الدين';
    document.getElementById('dm-name').value   = d.customerName || '';
    document.getElementById('dm-phone').value  = d.phone || '';
    document.getElementById('dm-reason').value = d.reason || d.productName || '';
    document.getElementById('dm-cost').value   = d.cost || 0;
    document.getElementById('dm-profit').value = d.totalDebt || 0;
    setDebtTotalValue(d.totalDebt || 0);
    document.getElementById('dm-paid').value   = d.initialPaid ?? d.paid ?? 0;
    _debtSelectedProducts = (d.selectedProducts || []).map(item => ({ id: item.id, qty: Math.max(1, parseInt(item.qty) || 1) }));
    applyDebtSelectionToForm();
    calcDebtRemain();
  } else {
    document.getElementById('debt-modal-title').textContent = 'إضافة دين جديد';
  }
  openModal('debt-modal-ov');
}

function saveDebt(){
  const name   = document.getElementById('dm-name').value.trim();
  const reason = document.getElementById('dm-reason').value.trim();
  const total  = getDebtTotalValue();
  const paid   = parseFloat(document.getElementById('dm-paid').value) || 0;
  const cost   = parseFloat(document.getElementById('dm-cost').value) || 0;
  const salePrice = parseFloat(document.getElementById('dm-profit').value) || 0;
  const profit = Math.max(0, salePrice - cost);
  const selectedProducts = getDebtProductSnapshots();

  if (!name)   { toast('أدخل اسم الزبون', 'err'); return; }
  if (!reason) { toast('أدخل سبب الدين', 'err'); return; }
  if (!total)  { toast('أدخل مبلغ الدين', 'err'); return; }
  if (paid > total) { toast('⚠️ المبلغ المدفوع أكبر من إجمالي الدين', 'err'); return; }

  const data = DB.get('debts');
  let savedDebtRec = null;

  if (_debtEditId) {
    const idx = data.findIndex(d => d.id === _debtEditId);
    if (idx >= 0) {
      const currentDebt = data[idx];
      const previousProducts = currentDebt.selectedProducts || [];
      const laterPaid = (currentDebt.payments || [])
        .filter(payment => payment?.saleId)
        .reduce((sum, payment) => sum + (parseFloat(payment.amount) || 0), 0);
      if (total < laterPaid) { toast('⚠️ الإجمالي الجديد أقل من المبالغ المسددة سابقاً', 'err'); return; }
      const initialPaid = Math.max(0, paid - laterPaid);
      if (!syncDebtProductStock(previousProducts, selectedProducts)) return;
      data[idx] = {
        ...currentDebt,
        customerName: name,
        phone: document.getElementById('dm-phone').value.trim(),
        reason,
        productName: reason,
        selectedProducts,
        initialPaid,
        cost,
        profit,
        totalDebt: total,
        paid: Math.max(0, initialPaid + laterPaid),
        remaining: Math.max(0, total - (initialPaid + laterPaid)),
        payments: normalizeDebtPayments(currentDebt.payments, initialPaid, currentDebt.date || nowISO()),
        lastUpdate: nowISO(),
        archived: false,
        archivedAt: ''
      };
      data[idx].saleId = upsertDebtCreditSale(data[idx]);
      savedDebtRec = data[idx];
    }
    toast('✅ تم تحديث الدين');
  } else {
    if (!syncDebtProductStock([], selectedProducts)) return;
    const rec = {
      id: genId(),
      customerName: name,
      phone: document.getElementById('dm-phone').value.trim(),
      reason,
      productName: reason,
      selectedProducts,
      initialPaid: paid,
      cost,
      profit,
      totalDebt: total,
      paid,
      remaining: Math.max(0, total - paid),
      barcode13: genRandom13(),
      date: nowISO(),
      lastUpdate: nowISO(),
      archived: false,
      archivedAt: '',
      payments: normalizeDebtPayments([], paid, nowISO())
    };
    rec.saleId = upsertDebtCreditSale(rec);
    data.push(rec);
    savedDebtRec = rec;
    tg(`💳 <b>دين جديد</b>\nالزبون: ${name}\nالسبب: ${reason}\nالمبلغ: ${fmt(total)}\nمدفوع أولي: ${fmt(paid)}\nالمتبقي: ${fmt(rec.remaining)}\nالتاريخ: ${todayStr()}`);
    toast('✅ تم تسجيل الدين');
  }

  DB.set('debts', data);
  if (savedDebtRec) fsSaveDoc('debts', savedDebtRec.id, savedDebtRec);
  closeModal('debt-modal-ov');
  renderDebts();
}
function openDebtPay(id){
  const data = DB.get('debts');
  _debtTarget = data.find(d=>d.id===id && !d.archived);
  if(!_debtTarget) return;
  document.getElementById('dpay-name').textContent   = _debtTarget.customerName;
  document.getElementById('dpay-reason').textContent = _debtTarget.reason||_debtTarget.productName||'—';
  document.getElementById('dpay-paid').textContent   = fmt(_debtTarget.paid||0);
  document.getElementById('dpay-remain').textContent = fmt(_debtTarget.remaining||0);
  document.getElementById('dpay-amount').value = '';
  document.getElementById('dpay-amount').max = String(_debtTarget.remaining||0);
  openModal('debt-pay-ov');
}

function confirmDebtPayment(){
  if(!_debtTarget) return;
  const amount = parseFloat(document.getElementById('dpay-amount').value)||0;
  if(!amount){ toast('أدخل المبلغ المستلم','err'); return; }

  const data = DB.get('debts');
  const idx  = data.findIndex(d=>d.id===_debtTarget.id);
  if(idx<0) return;

  const d = data[idx];
  if(amount > (d.remaining||0)){ toast('⚠️ المبلغ أكبر من المتبقي', 'err'); return; }
  const paymentSaleId = genId();
  data[idx].paid       = (d.paid||0) + amount;
  data[idx].remaining  = Math.max(0, (d.totalDebt||0) - data[idx].paid);
  data[idx].lastUpdate = nowISO();
  data[idx].payments   = [...(d.payments||[]), { saleId: paymentSaleId, amount, date: nowISO() }];
  if(data[idx].remaining<=0) data[idx].status='closed';
  DB.set('debts', data);
  fsSaveDoc('debts', data[idx].id, data[idx]);

  const profitRatio = d.totalDebt>0 ? (d.profit||0)/d.totalDebt : 0;
  const profitForPayment = Math.round(profitRatio * amount);

  const sales = DB.get('sales');
  sales.push({
    id:paymentSaleId, debtId:d.id, productName:d.reason||d.productName,
    type:'debt_payment', qty:1,
    totalPaid:amount,
    profit:profitForPayment,
    date:nowISO()
  });
  DB.set('sales', sales);

  tg(`💰 <b>دفعة دين</b>\nالزبون: ${d.customerName}\nالسبب: ${d.reason||''}\nالمبلغ: ${fmt(amount)}\nالربح: ${fmt(profitForPayment)}\nالمتبقي: ${fmt(data[idx].remaining)}\nالتاريخ: ${todayStr()}`);

  closeModal('debt-pay-ov');
  toast('✅ تم تسجيل الدفعة');
  renderDebts();
}

function openDebtPayAll(id){
  const data = DB.get('debts');
  _debtTarget = data.find(d=>d.id===id && !d.archived);
  if(!_debtTarget) return;
  document.getElementById('dpayall-name').textContent   = _debtTarget.customerName;
  document.getElementById('dpayall-reason').textContent = _debtTarget.reason||_debtTarget.productName||'—';
  document.getElementById('dpayall-remain').textContent = fmt(_debtTarget.remaining||0);
  openModal('debt-payall-ov');
}

function confirmDebtPayAll(){
  if(!_debtTarget) return;
  const data = DB.get('debts');
  const idx  = data.findIndex(d=>d.id===_debtTarget.id);
  if(idx<0) return;

  const d = data[idx];
  const finalAmount = d.remaining||0;
  const paymentSaleId = genId();

  data[idx].paid       = d.totalDebt;
  data[idx].remaining  = 0;
  data[idx].status     = 'closed';
  data[idx].lastUpdate = nowISO();
  data[idx].payments   = [...(d.payments||[]), { saleId: paymentSaleId, amount: finalAmount, date: nowISO() }];
  DB.set('debts', data);
  fsSaveDoc('debts', data[idx].id, data[idx]);

  const profitRatio = d.totalDebt>0 ? (d.profit||0)/d.totalDebt : 0;
  const profitForPayment = Math.round(profitRatio * finalAmount);

  const sales = DB.get('sales');
  sales.push({
    id:paymentSaleId, debtId:d.id, productName:d.reason||d.productName,
    type:'debt_payment', qty:1,
    totalPaid:finalAmount,
    profit:profitForPayment,
    date:nowISO()
  });
  DB.set('sales', sales);

  tg(`🎉 <b>تسوية دين كاملة</b>\nالزبون: ${d.customerName}\nالإجمالي: ${fmt(d.totalDebt)}\nالربح: ${fmt(profitForPayment)}\nالتاريخ: ${todayStr()}`);

  closeModal('debt-payall-ov');
  toast('🎉 تم تسوية الدين كاملاً');
  renderDebts();
}
function deleteDebt(id){
  const data = DB.get('debts');
  const d = data.find(x=>x.id===id && !x.archived);
  showConfirm('حذف الدين', `هل تريد حذف دين "${d?.customerName||'هذا الزبون'}"؟`, async ()=>{
    const idx = data.findIndex(x=>x.id===id);
    if(idx < 0) return;
    data[idx] = {
      ...data[idx],
      archived: true,
      archivedAt: nowISO()
    };
    DB.set('debts', data);
    fsSaveDoc('debts', data[idx].id, data[idx]);
    toast('🗑️ تم الحذف','warn');
    renderDebts();
    if(document.getElementById('page-dashboard').classList.contains('active')) renderDashboard();
  }, '🗑️');
}
function openDebtPrint(id){
  const data = DB.get('debts');
  _debtTarget = data.find(d=>d.id===id);
  if(!_debtTarget) return;
  printDebtNewLabel();
}

function printDebtNewLabel(){
  if(!_debtTarget) return;
  waitForJsBarcode(()=>{
    const d = _debtTarget;
    const dateObj = new Date(d.date);
    const dateStr = `${dateObj.getDate()}/${dateObj.getMonth()+1}/${dateObj.getFullYear()}`;

    // باركود 13 عشوائي — إذا لم يكن موجوداً نولّده ونحفظه
    let barcode = d.barcode13;
    if(!barcode){
      barcode = genRandom13();
      const allDebts = DB.get('debts');
      const idx = allDebts.findIndex(x=>x.id===d.id);
      if(idx>=0){ allDebts[idx].barcode13 = barcode; DB.set('debts', allDebts); }
    }

    const tempSvg = document.createElementNS('http://www.w3.org/2000/svg','svg');
    tempSvg.id='_temp_debt_bc';
    tempSvg.style.cssText='position:absolute;top:-9999px';
    document.body.appendChild(tempSvg);
    try{
      JsBarcode('#_temp_debt_bc', barcode, {
        format:'CODE128', width:1.8, height:40,
        displayValue:true, fontSize:9, margin:2
      });
      const svgHtml = tempSvg.outerHTML;
      tempSvg.remove();

      const html = `<div style="width:204mm;height:288mm;display:flex;justify-content:center;align-items:flex-start;box-sizing:border-box;margin:3mm auto 0;overflow:hidden">
      <div style="direction:rtl;font-family:Arial,sans-serif;width:71mm;padding:2mm 2.5mm 0 1.5mm;box-sizing:border-box;text-align:center">

        <!-- ??? ?????? -->
        <div style="display:flex;align-items:center;justify-content:center;gap:10px;margin-bottom:4mm;padding-bottom:3mm;border-bottom:2px dashed #1a2a5e">
          <div style="font-size:26px;font-weight:900;color:#1a2a5e;font-style:italic;letter-spacing:1px">SJ STORE</div>
        </div>

        <!-- ???????? -->
        <div style="font-size:18px;font-weight:900;margin-bottom:3mm;color:#1a2a5e;text-align:center">${d.customerName}</div>
        <div style="font-size:15px;font-weight:700;margin-bottom:3mm;color:#333;text-align:center">${d.reason||d.productName||"?"}</div>
        <div style="font-size:15px;font-weight:700;margin-bottom:2.5mm;text-align:center"><b>المبلغ:</b> ${fmt(d.totalDebt)}</div>
        <div style="font-size:15px;font-weight:700;margin-bottom:2.5mm;text-align:center"><b>المدفوع:</b> ${fmt(d.paid)}</div>
        <div style="font-size:15px;font-weight:700;margin-bottom:2.5mm;text-align:center"><b>المتبقي:</b> <b style="color:#c00">${fmt(d.remaining)}</b></div>
        <div style="font-size:13px;font-weight:600;margin-bottom:4mm;color:#555;text-align:center"><b>التاريخ:</b> ${dateStr}</div>

        <!-- خط فاصل -->
        <div style="border-top:2.5px solid #1a2a5e;margin-bottom:3mm"></div>

        <!-- الباركود -->
        <div style="display:flex;justify-content:center">${svgHtml}</div>

        <!-- خط + كلمة دين -->
        <div style="border-top:2.5px solid #1a2a5e;margin-top:3mm;padding-top:2.5mm;border-bottom:2px dashed #1a2a5e;padding-bottom:2.5mm">
          <div style="font-size:18px;font-weight:900;color:#1a2a5e">دين</div>
        </div>

      </div>
      </div>`;

      doPrint(html, '210mm', '297mm');
    }catch(e){ tempSvg.remove(); toast('❌ خطأ في الباركود','err'); }
  });
}

function printDebtInfo(){
  if(!_debtTarget) return;
  closeModal('debt-print-ov');
  const d = _debtTarget;
  const html = `<div style="direction:rtl;font-family:Arial,sans-serif;padding:11mm 2.5mm 0;margin:0 auto;text-align:right;width:65mm">
    <div style="display:flex;align-items:center;justify-content:flex-end;gap:8px;margin-bottom:8px;border-bottom:2px solid #000;padding-bottom:6px">
      <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFAAAABQCAYAAACOEfKtAAAwh0lEQVR4nL28eZxcV3nn/T3LvbV29apudbd2WbIsyZJteWUT2DHGwLC3CQMhk4QQJskMGcJMkuET2iIM874whIRMIAwJhCRsbgIZ42BwWCwM2ODd1i5LttSLet9qv/eec94/7q3qUlsy+3s+n+quulV165zfec6z/J7nHMEvv4n9+4fVi++93R4QwjYuXgKpwdt+c1tY6N4rs+nLUanLhPY3Oq3WIHU7QuaEFAghcM46gSw65xax4Yw09owJaicJ6o+rxeknZ/7pb04cgaBx76E77lDThw+LgwcOGMD9Ugf3y7z30B13yJHbbjONC9e/4hWDum/bjS7ffjN+9jqX9jeSLqSsl6YuBKETGCewzuIQWAEgkUKgBCgpUVLiS0kKh4rquFopIAhOu7B2vywu/psdf/Le+77ylXON39w/PKwPHrjdgPilAPnLAPA84Pb09eXabrntFaLQ/hayhZeI9q58TWcoGkPdgqeVbUtnXE8+T29bWnTnUqI944lsyiOlPBCOemSphMYt1SLmK3U3Vaq6hUqdUj0U1jiZ8hQ5rUiHFczy4rKrFL/D0uznyl95/10Pn6MCsVSO3Hab5Rcskb9QAIeG7lAjIzFw1+zfv9bfsu+3RXvHb4jONZurfpalwGCkMn3tbewa6BJ7B9eI3b3tYl1bhnZfkxYOYQ0uijCmZfUJgVQKqTROKmpOsBhZxop1js6W3GOTC+7o1KKdKdaFB6rd90iFJczi3ClbWvxb75H7Pv3tb391CppAmosO4qdsvxgAh4clt9/uEMJdv/P6LnfDDf9ZF7p+V3SvXbPkFKXImd6ONp6/dUDetH2d2NPbQZcWhNUKy6USxXKFSq1OEIYYa3HG4XBYFwPoXPxaAFJKfK3JplMUclnaCwX8XJ4FJ3lyrsK3T0+7B87M2blihTZfqYJw2PnJGbc49THv3i995JsPP7zEsJNwOxw4YJ9zXD9B+7kB3L9/WB88eCACuOGtb/8N1bl2mJ7BjXNGUkVEuwZ75Rv2bpM3XrKWNVpSXFpiZmGBUqVKZCxCCIRY6YhzrvkAwMbgufhNXPwP6yzWWox1KCkoZDP09XTT2d3NvPD41tlF/uXouD0xtWBzUukO7bAzY88wO377vR+9/TPQ0I9x33/W9vMAKIaG7pAjI7eZK142tDO9cfNH/TUDNy3pNAuRiPZsXKt+84ad4iUb+5C1KudmZlkqlXHOoZRCJGBZG4OolGo+tNZIKREi7p6zDmMMURhSDwPCMCQMQ6xNBEgInHWEUbwyuwp5Nq7rR7Z38d2JIv/wyBl3eGrJdPlS56Ma0dToN8ITD7/zByOfOv7z6safDcDhYcn73mdxjuve9Nu/q9as/aDt6c9N1Kzp7+6Uv7//SvGqHRsw5SJjk9NU6wFaKYQUuGTQWmvS6TTpdJpMJoPv+yit4w5JiUwesRsTL18cOGcxxlCr1SiXyywvL1MsFqnVqjgHQiiMtQRhnVw6zSWb1pPp6eOuZxb45IOn7cxyxfVnfMXM2JKZPvOu7/7lez+FEPDe98qfZUn/1AAODQ2pkZERs6evL5e5ZegTqcGNb17QaZadMkPX7lbveuEeCi7izNg5qkGA9jQiWXJKKTKZDLlcjkwm05Q0AGMtUioyvkYqCdaAtSAEKA1CARCEEUIQT0gCbhAELC8vMzs7y/z8PLVaDSk1DqjVa+SzaXZdspVavpOPPnyGOw+dM+3aqraoRjB64tOzH3r3O45A0BjbLw3A/fv364MHD0Z7rn3h5uzlV9/hD266ejwg6uxoV7f/uxeKWzb3cXZ8gsViCV97CMBai/Y0uXyebDaL1hqlVFPHOeeQStOWTVEvlTh8doJHzs1zuhwxbwUyiujSgks6slw92M3ujYOQzhJEBqxBCHGetNZqNaanpzl37hylUhkpFc4ZqvWA/p5udu3cwTenanzgO0ddqVozvb7S0fjJ+yo/uuff/+jrXxlr9SR+oQA2wNt788uvyGza8VXVv2nd2ZqNrt2+UX/4tfvpEY6nRsdjgZEyBk5rcrlcEziXLEGVSI+xlmwmjQjq/MtDh/nH03McEe3Q0Usm3472PCRgw4BquYgozrHbFXnrth5edc0u8NIEQYCUMl7miS4VQmCM4dy5c5w9O0alUkJrnyCo44B9u3dQynfzR988wuNjC+G6rPaisVNPh0fuv/UHI586/tOA+BMB2BDtvS99zbWpzZfcrdas6xoNXDR03eX6/bc+j+X5OabmF0h5XlOy0ul0C3AuWaoSIeLnxjracxlOj47znm8/wX1+H92btlPIFzBBnTCo4YxBSIHvebSlcqR9zUKxyMQzJ3mBmeV//soeBgcGqAchKgn7Goan8TwIAs6cOcPY2HgCMpSrNS7ZsI7127fz3u+e4q4j49FARmk7+fRkcOxHL33gc//nyZ8UxB8LYAO83Te+bE92y66Dom+wYzzEvOMl16k/ufFKzoxOUK7V8D0Pa1f0nO/75w2kFUAHFLIZHj5+mnfcd5LFLVcy0NvH7Nwc6eUp9qYd2wseXWkP52A6MJwqRTwVpkl39bG2s53j52ZIPf0Yf/eSbey6ZDNBEKK1av4m0DJxsLi4yPHjJ1heLuJ5mkq1Qk9nB1ftu4IPPjjOZx56xqzNCCXOnZkKHv/ui+//8meO/SQ68bkBHB6WHDhgr37hC9eLbVfeL/s3Do4FmD946fPUu190BSfPjBIZg0qWkOd5ZDKZ5gAaemkFwNiHy2cznDwzxq9+6yhm53UUMllmnj7O6wsBb7t8PdvXdCF8D2QMCM5ig5BDk/N86sQc3406uHTdIKOlOuGh+7nj5ZexYd0gJjJIuSKFjdYA0hjD8eMnGB+fwPMUtXpANpPmBddfy58/do5P/vCUGchIZUefeqb60DdvePDuL03+OOssnwvcYWDnzp15t2nXnd7aDYPjNWPe8ZJr1Lv3X8FTZ8dwgO9phBCkUilSqdT5TvCq5pxAaUW1VOTd3z1Mfds+8ukMi8ef5EObFB+65Sq2ru2jgqJcjyjVQyr1kGrgCJXHno0D/MWv7OLdfVVOPHOa9fkUasfV/OG3DhFWygh5YXlo6EilFDt3Xsb27ZcQRZa071Or1fnuDx7gXVes5df3bVbjVRupDds3Za580Zf2O6eHdu0SPIegXRTA/fuH1YEDB2x617V/nx7cdMXZWhS97trL1X+/cR+nRydwNFwJied5TV23evZbm3WONl/zqR8e5vHCBro72pk5eYgPbM/w+uv3sFQz1MIQiUsYmMYDhHPUgpCagX+/bwd/sl5wYnScbT0dHM5v4nM/OoRKdOsFpaFlWW/cuJHdu3dhncXzNEEQ8r0HHuSPrhngFZcN6IlyFPkbdz7f/OEHPz5y221m//Cw+qkAHBoaUgcPHoiufPVt/ym7bvPrJ0PCq7dv1B945QsZn57DOtf0wxouRKNdXPocvucxOTPHF85VWLNuExPjZ/m19oDXX7OTpVIVLUC2TEDjrkkgF4OKoxZGvOHKrdyaK/HM7ALbN2/mc2drVIpL6BYX6UJ9aviOa9f2sXv3bqy1+L5HpVrlkUce53/s38rlgx16OiBMbbrsbc/7/eG3HDxwIBq6444LgvhsAIeH5cjIl8yem2/e7fcMfmhZ+abQUdAffu1N1EolgjDE07qp21ol7sdJX9aTfP+ZCSayPYCgb26U/3j1dqqRQ4nnnoDzO+2wTvC7u9filqZIeR7nUt18/9QEQtAkIS7WGiD29vaya9cuoiginUoxPb/I2MmTfOjmy8imPV30ctZbu+Vj+9/465tGhoYsw8PPwmv1BTF05IgAJ72u9X9L15rUIoLbX/lisS6TYqFYxtO6OdDWwf64gTsAa3hocgmTyTI7Nc6NbY6Bnk7qQdD8jGvcmxgI13o9eU8KQRhFDHR3cH06YHxxGZlr5/4zM4mveYHfX3VxRRLXsm3bNsIwJJ/NcOKZUdori/z3l+wQi6Fzom99m9u0928QwiX68OIAxuTAiNn3iqHfSa1df91EYKLXXXO5euWOTYzPLZDyveYPNwP5i3TSOYexNqanHGilCYzlzGIJVV7CjZ/i2rUF0F5TDTQjilWvV78npEQICULx/N4MU1OTFOsVzswsJpGfwhGHhxfq52oQN27cyMDAAGEYksukefDJo9zan+Hf7exXkzUTeeu23/KC333vm0Zuu82sXsq6FcyRO4bsjmuv6RadXX9WlL7t62qX77rxOuaXllHJAIwxRFHU4pa4ZmdaXzugLZvBV4pytUpYr1INAhbOjaN0idTkGXqvuZVqtUZYq2OVpKEBBCKxqGJFJ7bqRhkPXFmPTgLUqSOIXDsTM2dZmp0m21ZAK4XWHiRAygYpsUrNxK8dl156KcVimUqlBDgOHz3Of7n2Mu4/uyDLde1SPQP/780333znyOHDVWKr7KDFPDc87yte/asfzGy57L+OGhkdeMMt+q37LmNsdh5fxbNarVZXKKkWPdhKP2mtyfg+Dx06wjd+9BgnJiYpV+tYIZjSWSr5TvyFGfrDMhlfYWmJHpDQuG8DONHob/JcyJhcFZKi9JltWwv5TuzMGL1hkaynSKd9Luvv4TXP28e+yy9LlvX5k926WoQQLC4u8sgjj6CUolSp8sJ9e/nyjOUD3z4WbfDRwZEf/sl9H33P/9PKIzbuJAG3b98L14qdu08Uu/pymzau5463DYlKqYRNHNFarUa9Xj8PvFZnWQgRMyzO8ed3/F++9Ogxgkw7MpNFKAnKR2SyCKnQ1mAqJaIwwLiGjlsBkPMkT4BMgCUGEClxUiHTeXSugJUeGWFwtTIiirnCoFIhtTzLr129lT9+y+uQWkOLFLYC2QDxxImTjI6OIoTE9zWX77uKN9952E7OF0V+5vSMd98927/5b3csJ/1zGmD//mF58OCBKFo3+I5015p8xcnoPzzvKp0WsBgZPK0wxlCv18/7sQs1LeF9n/kSIycnKFyyi7SfwkkFKIRUKCkIkJSCCC+Vo1NaCtqREhItwZcCJSRKCWSylAUxzyeJXRkhBI4Vfej8NB3ZNIdKlomgndA6hHV0SoerV/jYY0cJzD/zvre9EePOZ79bgXTOsXnzJmZmpgnDkOVSmWBuhrdesV7+6T2Ho/bejb3VXXt/AyH+oiGFDS/b7dmzJ+ftvvZEpXugf3DDenfHb98mg1o1lj4hKJVKBEHQlL7VYZp1jo58nru+9wDv+dr3SG/ZjtUZtOcjpUAqDyM9SpFlnY54UXea6/ra2diRo5DSeErFhkIkei9ZpohYLlcHAzGjbXAIZFjhM6eLfGw2CzbiipzFM4YjSzVqVtJu6iwceZS/e8uN3HjtVc3wc3VrhHyjo6OcOHECKTW+p9h55ZW85c6jdmapJNITR5+Sf/bFnQfdvQYh0Pv3D6uDBw9Ecv3WW3V790DRCvOaK3eqNl8xXXF4WhFFEfV6vRkSrZ49l/yv12vc9dgx6OnHeVk8P43WGuF7LAlNykS8bX0bb7ikj/Wd7TjtEzmHTZSIcCJJHTXVFU5c3Io66/DCkM8ePsP7Fnu4uiPNgc2Sgi8JLAT1Gh87Mscji2m8vg18/vtPcOM1VyLFhQOwhlXu7+9nfHycer1OsVKF4iKv3tknP/zdRVvo6t8WvP2GGxHinv37h7Xu7d3lAGS28Gs1L+O629rdLZdtoVyto1RseavVKtba8yKO1lnDOVKex9TcPE8Xq3hdHSgtUVpBKs0sHlt9w/t2D3Ltuj5qQlJykMaQdo4wigiMjYHEcr53ZVtkT7Zii5KS8uIsX61kGejs4HfW1rl/0XKiWMU5S0/a42Ub2jhXXWIiX+Dk7AyLS4t0dHQ2czEXGo/Wmv7+fk6dOoXvac6MTXDzJTv4u2zG1q0WqrP/14F7en/vdqdHRm4zO/bt6xep9M1LYSRuuWS92thZYL5YimNLY6hWq83Zaf2h1qSPkpLZYpGSsUjtI6WH0ppZNFdmHH95zSbWdneyGBnSCDL1CifmS9y/FPB4VTBpFMbJxH7ES1g6cM0lDZKV9yVJFGTbOJvv4Zo2yQCLfHshpKO9DRtGTJXrvKDgc1VBcHbZoxg6zs0tJAC6xC5dyK2Bvr4+xsbGiCLD7FKJ7dJw3boOde/JadGdLbz0ea96VdvIbaKoAdJ961+s2tozRipz02VblMAhhERrTbFYxBiDUheNp3E4pBQsFisENk6CKykpCcW2lOWj122hu7PAUmjJ4Tg1Mc5nJmp8IyowaXPooEZKGFSygIVQSGETixtPlBMCRSI1SRpUCFB+GjwfCLh+Yx8zxdPcX6uhlMfNfRlesaGDb56cRGlN1UomZhe4bGsjvhbPilAgTkOk02k6OzuZnp7GOcvi3Bwv3tItvn5i2siOnh69Ye8L4M67NYDM5V4cKJ+eQrvbt6GfahChEme1Wq02Je48qWsJ5RwgEcwsLhMJQVpKnFBkrOX9VwzS29XOcmDJmIB/O/40H5pL8UyunzXBLL9am+D6dk1XJhUbDkHDmaGRimsVEtFET9KeSvGUyPOhUi/PBIJTNcGrdqzjgQfOMJkf4HVb2ji3sMiTVUnKU9SFZHRmoQlSK3Gx2qVxztHT08P09DSe1kzNzXPl1jV05X0XBMLJTPtLgbs1oIRK31AyjqsH18iBQp5SNc4zRFFEvVYnsYfNWPRZuiPJdZydWwSdSF9k+N3tfVw92Mt8aMm4iLsPHefAUhvVjkGumD7Gb2WXuGHfNnIdnQilEz+PFUPyLEmPWwyuQ0nFplKZL5+qcIwCf3GmzPu2at6wpZMl5YiCOh8+vsgx2hkQRap+irOzi+cBdaHnDYALhQKpVIowDFkqldmmHDt68uLJ0XmRz7TdACD3vOCmrWh/W81a9q5fK1JagwStFWEYEpmWxH1rqUVrBYGAIAgZnV9E+BnqVrAxqxja3k/JWnzpePzEST445xF0DbBp9hT/pVDixuuvJ9WzlkB7hFISSUEoBKEgebjkAVHLIxAQCkHFOvK5HL+1JqDN1vhBPc9vHIN7TSdH6h5vfCzgU8sdvHwN9PuGSKeZmC+Cs3Es/RzNWksqlSKfz+OcIzKWqFpmd1+brBiL9NOXvvCWN/drmc/tIZ1KS+XZXf29suH3NVKEzjlcrIqaJRar5UNJSalaZbpUxk93UzaGm9d10deeZSkURPNTfOJsidnuHeQqRV7DNPv2XoVVGiksOSmwYUjdWkAgG4n01h8SK08aXqEQAiMlt/TnyMgifztnOG0yfGbWYELoDOu8Z6DOK9os7xwP0JkMU8VZ6rUaOpVuJvkv1oQQFAoF5ufnEUJQLBbZ3dMZu6CpTEe4cdNe7dL+nkh55DJpt7Gnk9Cs6IZ6vX5+ZYAQiRTGeshai5ASXwpmiiUW6iGuTZNRgucP9hAhSGH4/jMT/Eh3k/Y8+pYmeMH6HkSmDYfFE3DPVJU75yVVBJ5weHGckehDicChkgFJ4ZBuhYeUOBCSvFegWwdM25BQe9ycK/POPmhv6+Ho009TDSNSKZ+5uYCF5RJr+7KExjwnh+mcI5fLIaVEIVguVVg/0EfOV9aQUzqb3aNR/s4QQWdbljX5HFHi7xljCMOwcadYP7mknkVYpEvKLpKKgpnlIpXIEUnFQCbFps42Qge2UuK+2TK1tgHS1rJR1Onr7MHiyCjJkcUaByY8ajqFLx0eMY0vE+KgEQorl4BpLapBPgDWQQREdYcSKXxlMQHkfUlPRwdLLtblFof0UiyHML24yNq+3ucMSRuC06igIIoo1+qs8xWFbIpqWMP305dpLfW6qnX05DMi78flEA0DEkVRM9KwiVTgHMKJ5pKyzqGEYGphiQCBRdGT8ymkYqdkebnIycjD81IAZJXA83wcMT0/Uw2pyww9nkQ6ixYylrJE4AWx0RASlLNNQyMSCXEidr2tII5qEhVkHEQ2QkovEQCJUB5VITg3u8SeS398NVEj0+h5HpExBFFETlq6cynx9KLAk3qbRsj+yAm6clmR0ppaEicaY5p53ngJJ5TSKt4vqTtjYn6BSCmQkrT2UEpigGK1woLwEqmSLKkMYRTh4ag6uDwL10STPGJ7SHsKJZKEEiBFrDpUMmEy+S8EOBFbe99ZhDOIxgSLxtJXTZeoAbSUCitTTVdmtWvWClzjvxACz/Oo1+tExiCtoSvliRNO4JTs006qNuschUxWKCUh0QvGmPPNfNOAiCawjXUURYaxhWXwUzgpcULEWANhZDFCIIUiJeC018a5UpntvYLIWtryed67rsb9YydZKEWx7kt+sSH98b1Ek8Z0UlARPqd1gafTaxEqjXYhTsQ9jLmfxiIXMc0vFEiB8FOMzsyfB+BzpSOkjAMKkaQKnDUU0joJbXVBA1mLI5vSTeMhRAxS681jTAQi0YeN2FgIST2oM1MsIbwMTqh41iGRiWQ2pcRzhsVUJ/+6UGVnpUiQKRBh6Ojt4VXdXdgookmcstpCCpyzSX8EzkSUqxUeXTjDF8O1LHgFPBvGUywsQtjE9MQ9cSLmD5WfYnyxiDPRBWP71ZLYqLdxiTRjLTlPirgQXma1w6Vw4Cl5nm/UALD52iUWr7mYXcJMCyq1Gou1AJVpxwiBQWJxIGyyHBOZEoKsFtwZ9XPp2Cyv3aSp+xki56hJCX5q9RBaLP+z38rmCtzUUad/ep4PFxVFmUU7k8TODRY7/rqRAiMVKp1jqrhIpVzBy2Se05VpCFAT6Fjx4ivZsKspLRprJE6bPauwsSmBSXdsouBJlrIUglKlSikwUNAgBVY07hf7iB6AiJeScuD8FH9e62P8mSVe1RvSm03hy0R3CUlD+lxD7brWHsTPQ6UJnaWsfHb3dfJ6W+KTlQwpIdCIpiJoAGGlxgqFl0qxMBcxv1xiMJ8n+DGuTKNJKcHaltUF1lqhcbaGIx0Yc55VamVfnhUDJ92zSQXBQqlE2ThkUoVqE2uNixNASjTyHTHfp5xFaI9/CNdwz3iNrR50KEtaOnxl0Ei8JAZegSyxzAhyhFyZCtjUVQCtqCnF9R2Kr1WqzIhsXNnQMhbrABEbOOl5FCPH1MIi69cNNL2IZ0nfKils9B8pCCLbyDqUtIOyEKSrtbpzzgkhZHPdA+fxgE1AhUvIT4cUMLNYpIpAa4UQCttc7DGAGotoMQQWUM7RpmBZZHjECrAtpRyAdgKEXUkuQZPSt1LxrblzvLM0yvYtm4lwtKclG72QqcjGFt+1+Io4rNIYpVDaoyQ9xmcXuDoZ33PJn01So00WXkoq9cgph8C6knbWLEpc92KlhrExLeVEnFlrnYHVQLYyxePzCxip8ZRGKIlJlqto7DJKLGpD9hvOsXXgY/BlbHulkHgCFO48AButYZ6kEixluzk2fZodG0NQHkpKMlogQ0gyogn5ITAWnFQ4oXBKYbw04y2kwnM1a+Oa7BhAgZOKxXqIFA5nowXtrJnWsHW+XHbVMBQpLwU2diAbFH5DhM93a2LJMMYwvrCM83wQceIokrGUxoyJRK/Y4nhgiTKWUlJyChcaclKgFZRNLIVaSpTTSLESfTckECSZqWMMZC1O+wgXl3qUrERIgXQWTzZ7SGQdTmqQCic9pJ9mbH4ZTPhj3ZgGgAiBVgorFPPVwHkCIaJoTBOFT/uCG+aXS65YrZFNpbGA53koFTMyq8GL/bOYdA2CkMliGVJZpFAgFUbIJmBCCJRY0WQNoyCkYCmIeAmzXNnhczz0Wa6F7BTVeJmUa4RhiLPRihVOJFiFFXanI3bt2EnkHFrCQtUwGvj40hEiKMhE1C0EJta5TkmMksh0honlRcLg2WNrbUIIouauKUh7HmUD86XAaSwuCk5rgvCIdoaFUpmppRIDXV0YY/A8j1Qq1cwDrzYkAFIJStUKs9UaotABWuJkou6TPkkhEat8OikEFSSv1zP8/pY8P1iI6HJQtxFv355nWXj4JkcUhY1UePK7MYpSKlQuhxMCA2SxfH3JMeN88oDCsN53GOJq/6XIYvwUygms9NDpDNOLUxQrFTLZHOYCerDhvtTr9URKIZdJMxuELFTrFEyEi8LD0tn64zIKKVdq8umZ2XjSki9ns9mmn7Taa7fWogQslsoshSA9HycVVmpMiz8phEC7FqsmBMuhZdPyOL0EfPLpZb46WSZn6lyVF3xhRvB7h8p85fAzWD+Dy3fg2toh34Vo70C0d+LaCvFvCEmHcjwxX+crxRwZJQiR9IqIS3MQIHD1KmdqEptuQ0oRG5JUmoUgYmG5GFfXtgQNq8fZmgvP5zKcWapTqweKasnaxaXHtJkvPa47KyWnMvnDY9Pu9dc60fAD29raOJeA1YhOZFKBD7FvNLtcpuIEwvORUmOlxMoVCRQijmldTFsTRRFvElO8c0cbVT9NRlpGA/jBTImjFFhfrfDHnUW6830UfE0ziBQxpdFYygKoh45vL4T8w0KWuvJJC8dC5HhdrkJ3OkXFKUpLCxxyeTw/jQ2qREojU2lKTjO1UGTjOtFMMK1urQk1gFw2y6FnFpzACWrlWe/sg0f14YfuG9u7Yf3RlOSaw2fP2UqtrrxUGmstbW1teNrDxmFIcyaEENiEYJheWqamFCmtQUkiqbCNZZ44wNKCcI7AObbIMjt6CnwjyuFCA8LDE450tsDMgkFIyXT3IM8YiKaC2Mdvri/XJBQWjeRoTfNU1I6vJVoK5iPYr+a5tUdQERLfhDxyboln8peQFpaa8nDKA88jULElViLeBCTc+QgKIQjDsMmJ+p7CeSmenFq2aYVyYe3QwYMHF+MpDuv3ZSRXH5+Ydmdn57l0/SBRkpnKteVZXFhAS+9ZS1k4y+RyidDzyUoPJyRIgRNJslzEg7bCEQqJj+WUyPPHs7GjLYUHxKGf1oo2BdYKvjwBSjqkkGgSOktItACFRAoSl0fiaYhMQCEo8YZUkVcP+IhUCik00+ee5q56J6q9HRfUUEqD0liVwqVynJlbhES/Xah+sFqtYqzBOkd7NsNk3XJyZsnlcE5UK/dBUt4m6pWve2H1XTNLyAdPn2XHhgGsi2/S3d3N/Nxck9Jv6D+EwESGqVIVUjmEllglcVJCM4iP/S+vWqKtOE0WhxOKdkFLaYXECoENQLgYnE4hm3xjXGwUg6lE7B9KAT6ONuHokyHbU4ZruxWbOgvUtI8QktrsOf5+wnG2YwspG2Fk7MdppTDaQ2SzTCxXMFF0XtavtVXLFYSQGBvR3dHON6aKLJWrsj9cFFFx5ltNAO3k+A9coXtKtaX6vnP0lH3jDVdJqT2MMXR1dZFKpZItBBKnaEaataDOuWodkepASIUVmmbMKmLmItXexTuv2AwyqUdxJgHHNPVZqwlcedmgLJoysfJXgK8kWc8jn06TyqSJtEfgJFkbMDE5zWcmLQ8XtpPBUU0SA1LERwZYqRHpHHO1EvV6gEuOGWiVvnq9Hu+5EwKtJKlcnm/96KRNgTRL86Pedx59EEAn+33Ll2/Ydldbh/yth54atcfPzcjdG9cRJpmp7p4exsfGSfk+uMbGQU0QBpSNQ2c9hJTJGQcO5wzGOowD5fls2by5BZ7naqKZwAJoEN+tAtJMcAkBrpFwDUlFAQvlKvfO1vnXcoGpbDdpIupRy8QIh5ASlED4aeoVRRhZSDYmNj4phKBcLjcZqa62PGerhkfOztt2haS0/NWDZw7W9g9/R+ve3iPxd8vL/+DVKr81HTn5jSeOcvmGAQCsMaxdu5apqSmMsygrcQKMNaS0ppBOxcE6AuEszlqUc3SmfLSUWCKci+tdRBOZBlgujlGabk4j/mq4Ti2guzj6IVElxlrqxrEUhJytGA6VHI/UUoypbtIZj5QNCZzA4DDOYq07z7A56+jM+viepBIZWreYGBNRqVTisDQI6e3u4hNHZyiWq7KtNk99fvwzAL1HPub0yMiIwTnxOiG+9y+v7nki35O9/K5Hj5g3P3+fWtPZibGWfD7PmjVrmJiYQPo+wgmssXipFFcP9PDDM/OIjk68KCLjBJWq46+fOAvWxjvLnSOOcB22uSwFFgnOYZMcRgynS/5LrHCYxA23TmCJX0cIak6zZBVLpFhWOYxKkfc88tLgopB6QuUbawlNHMtHUYQJQ3znqFSKXLerB6kUpl6ngaCUknK53GTk2zIZytLjziMTpuAhw+mpBx74/CceZHhYjhw4YOICyxe/WB2AaE958eO5rjUfPz02wb8+epi3/coLiFwcD69fv56ZmZlkX28c/JfrIS/bsZkfTi7yyPwcPV3d5B1UTcjfHCnHPmCy7mKNFte4xKRMQt4nsa0TMVUvkrJtIQSukU1CJgOUOAlCapAOp0FpSyZtyYoAjKWGxCc2ODZxnUJjCOo1bBjgRYby3AxX5wJu3bOVUi1IONt4WsMwpFqtopSiWquzdXAtd5yeZWxmiQFZEcHywkcAtx/UQRKt1VAzO3fuzPnb9x6rdPUPrFs36D77n94qezs7cYBSirNnz3Lq1ClSqRXmOOV7LJWrfPxHh3mobLE6hRDgOYHExsq7aRlWOO1mWTAidn+awCb8deISNZ7HiaSGRhQgPUSuDZEvUPezyFSWVLLrPZVUuUY4AmOp1qqYUhGxtICuFLmuYPmvL9pBd0dbsoF7JZVRKpWo1WpY5/CVoqt/gDfe8ZBZWFyQ6YmnTha++sk9Xz95MkhMt2tU6btkP3Dp8sGN/7Otc83/PjE6Yb94/6O88+UvickB5xgcHGR2dpZisYjnxVse6kFEIZvhT/ZfxeGJWZ5ZKmGS3G2zgjVhmgWxlIFDCt0sVROJ2+JosNIqqcKKJTYGMckRJ9Y0svDI1DxPThbxu3sxWGouRxpHoDVaCqxL+LwwRM2M8dJcnVe8YCO7B7oRSlGtB+dV7wdB0CwkDeoBl6zr5xOHJ3h6eo71si6qS9Pv//pTT9X33367Phino88zcILhYXHJZz/r5XZd/Xi0Zt12v9DuPvt7b5WXbVqHJfajisUijz32WFNfNDhCISVZ30fL88t/aYCX5EYa2xcQMSMjE/Baq/KlaHw/MU5NoFe+K4Fyrc7Xj40x8tQ8E14XsrsHkc7i+xmkjrNwNjJUK2U4/CAf27+J6/dcyvRyqVn50GjOOSqVCtZawiiiM5+jnG7jTZ9/wKiwptTZY4/5f/Wea148PGwPHDjQYPXP2yfiho4ckSNPPVXfu27rH2baOu6ajqz5yDe+K//qra9Bp7NY62hra2Pr1q0cP34c3/dXiFbnKNfrCQCrQGQFANkimRaa21OFkBcA7NlAwsrEaCV53RVbuWFjL198cpR7ps6y3NEH7YIUafDiFIPQCuNnKBnDcrXWyJA1WbKG9DV2SCmpWLOmmwN3P0mxUqSvvkQ4O/kHByHqPXJE0ZIyPC8AHBkZMUNDQ+rxe7/xr/X5qX/u8dD3PHIo+sIDj6GcaSRSGBgYYP369QTJFq2GvySSG8baISYPBEllfUN7iZX/unHdxTmP+LOtn3fnXV/5H+c8rHUsVet0tGV55wt28D+uXcsN0Szh5CjFShGMQyLx/DQmnaWRlWmcOdPodxAEGBPvNQ4jw5aBXr549BzfPDYWrdVOhRNP//0Dn/+rg0N33PGsDdgXCmIkzrl9V79ordm44cmwc22nKrTz6d95k7zqkk0YqZDJTB07doypqanmPuHVe0YutAmHJI49r0yXxEFe9dnV0tsq0a3XG05w1vcwUci3Tk3xT2drnMr209W9Bs/TzD91lA9vg+u2b6RcD5qbxOPSNdPcTtvX1c5YqPm1O75v/bAu/HOnxu0D9+695ZYbFg8cuL2ZI7ygBCbNDt12m3z44fvORYvzb0vXSrK8uGTfM/J1JmfnkNYmVlFw6aWX0tPTcx5ndqFH62zjVj5nEh+xNQPWKCm52D1a89WN6w1pL9cD6k5w6451fPSGtfyHzBxmepSSAa+tHSd1k/uz1qzkfQWExtCez2JTWf7o7kedqdZsenla1CfP/OYDD9wzf+TIEbEavIsByMjIiNm/f78+9O27/6U+M/GXnTLSR089E77nS/dQLhVxzgCxtOzcuZPe3t4VHdI66AZAFwG1+Rlrwbpm91aDdTEgV7+Pc2Ati9U6mXSa/3jlIB/ZLrimepYwlcekcmCjmJ5jpWwvMo6079PV1c1/+8bjPDU5F/W4mq6NPvVnD3/hE/+2f3hYX+zshIvwEPF7Q0NDcmRkxF7+8tfenRrcfMtUpKLb9l+j3//6l+FlsnEeOBnw6dOnGR0dbSajLrT8LmRYGku68XqlqoBnff9CS7v1M63XAIyDnK8RUcg3ZyM25Ty25CRGKKQUkDjZWkn6e3v4428+yVcePR2t004Hpx7/vz/8uw+9JtmRdNGDHJ8LQJJpYt/VWwvR4DXf1X3r90wbEb35Jdfr4dfcjJ+N972R+FETExOcPn26mVNphPrIZ+vECw38vEd88TwgW7+3GqyLgWldTCBkhSN0AuF5Tf0XhBEpT9Pb08WffvsQX3j4ZLRBCx0+c/jh8KufftHDb397jQvovdamL/ZG0hy33y4ffvj00uWq5xUGeV9v3+Cmz977wyiIrL79tb8S1xAnumVgYIB8Ps+pU6dYWlpqnlIkbEyqNo95MuaihT3NKoCmJY6ltKEfL2RMVn+/FUjnHM5aqtojnU7F1juRvHwmRVtbgT+653G+8tjpaL1Gh2ePH608+eDLn5icrJDsn3ougH6cBMZtaEgxMmJ27XveVm/dxm/o3sGtU0ZGN+3boz/w+pvo7+nBCBW7F0lx5sTEBGNjY4RBGEujOj/RdLFHo62W0iaYrFjsiy3dxvPWc2w8z2teq4cRPYUcNaH5b3c/ysETo9GgZ3U49tSR4OQTNz/6zTsnGke+/DhofjIAWTmA5/Jr96/T/QN36t7+K6eNF+7YssF7/+tu4eptGzAy2QabLJtKpcL4+DjT09NEUYTWGi3VStx7Ef120ecJhEKIljzJ+fdpGJTG6XCNc2yMMbG7gmBtR54n5sr88dce4dTUXDggrVcfPf6j4Ohjr3zse1+f+WkOIfuJAWwFcd++Le3h2n2fT/Wtu3VReCbT3in+860vlG++fg/pbBaT1AU2BlUqlZiammJudi5O0si49uZi0cqPMxbPAtLGNJkQcTVpNpslk8nEDLp1GGsIIkMhnSKd9vnck6N85OAhaytluglkffSpf6l+7R/f8sTUVHl4eFge+CmOwfupAARoFe29L33th/WavnfVsp0UpYpu2nuZ/oOXPp89G/pxStMoBmsAUKvVWFxcZH5+nnK5TBiEcYFS65kIz2FkGs2tMLDJkaAeqUwsbalUGinFCv9nHb5WdGTTHJsv8eH7DnPvsbGoW1qdWp6hfu7s+x/6/F//KUL8TGcI/vQANr7nHAjh9t74itfKzu6/Vl19/bNG2vbuLt7y/H3yTdfvZrCnC4QiamGWGxawXq9TLpUplopUKpW4BjmKzjsk4kIRTeOES9/3SaVSpNPp+PBGpbDWYYzFOoOxFl9K2jI+s9WQzz72NP/40AlbKZbp1VaaybHRcGb0HQ9/+e+/Njzs5IEDokkQ/P8BINByqtvevYNi/fb/pTrX/Go9086S02bzuj7xq9ftka/cu531PZ0gNaGxNKoLpWw9T8s1j/Vs7A5o1KM0Wit4DWltRjQmTj0aE48/60nSnmayXOPOo6N87tFTdnR63vVooVLLcwQzE/9YP/Xgu5+4//7pn/cc1Z8LQFgBEeCqm259JW1d75fda/aWVZaS8Mym/h5x6+Xb5Usv38bO/jVkMilANrckNLrRiGhXuyfnRS3WJiVrjYhkJRTzVbzhJ7CO43PLfO3oOF87esaOzS64DolqCyqEs+MP2pnJ9z741X/6+uq+/6zt5wawcZ8kajE7wU/d8srfEPnOd8uONZdUdZqSUy7f3mau2LROvmj7Jnnd5gE293RQyKShUcjpHMbGoDaAtfEbiW/nkmT8ynlaMvEPS0HE0wvLPDg6w8FTk/axsVlbLpVUhxYiF5SJ5qePRQvT/+vhL3/m04BNTij5hRzK/YsCEDh/Rvf09eW48ro3etn2t4tcx3VRro2yU9SVZ9vb8nZTX4/YObBG7hzoEVt62llbyNGRSZPxPTwlUUImtYAJqNYRWks1jFiq1ZlYrnFmbplDUwvu0OSCPTO34JZLVZnByoKwiNICtrj4A1da+vjMP3/6S2eghhAMveENP7fUtbZfKICNezaksXHhype8/EXk235NZHIvk7nCOpvOUxGaKgKnNZlUxhRyGTryOdGZTdOWToms7+EpJRCCwFpXDUKK9cgtVGosVmpuqVYjqIdKOkdGQA6LrC7jysWno8ry3WFp4fNP3DXyvUYffhHL9YKD/UXfsPXeQ0NDcuRLXzIN6nfnmjV5f8+114ts200ynX4enr8bP9vl/CyRjsviIqEwDSpVQJxPlgkB69AIPCzaRoigAkF9jjA4bOu1+6iU/03f9fkfPQCNXeJi6Lbb5MjIyC/8DP3mIH8ZN13dhoaG1PT0TtE48bzR9u3b1++6Bi4zXnqv8r0dTnlbpPL6hJRdToo8jmxcoiNKCMrS2Tkb2RmMPWWj8JAMy4fkzOjRBx98cLL1vvuHh3XvkSPulyFxq9v/B57+nF8E5DchAAAAAElFTkSuQmCC" style="width:55px;height:55px;object-fit:contain">
      <span style="font-size:22px;font-weight:900;letter-spacing:1px">SJ STORE</span>
    </div>
    <div style="font-size:16px;font-weight:700;margin:6px 0">${d.customerName}</div>
    <div style="font-size:14px;margin:4px 0;color:#333">${d.reason||d.productName}</div>
    <div style="font-size:15px;margin:4px 0">المبلغ: <b>${fmt(d.totalDebt)}</b></div>
    <div style="font-size:15px;margin:4px 0">متبقي: <b style="color:#E53E3E">${fmt(d.remaining)}</b></div>
    <div style="margin-top:8px;padding-top:6px;border-top:1px dashed #999;font-size:14px;font-weight:700">وصل دين</div>
    <div style="margin-top:8px"><img src="data:image/png;base64,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" style="width:55px;height:55px;object-fit:contain"></div>
  </div>`;
  doPrint(html, '6.5cm', '9cm');
}
function printDebtBarcode(){
  if(!_debtTarget) return;
  waitForJsBarcode(() => {
  closeModal('debt-print-ov');
  const d = _debtTarget;
  const code = 'SJDEBT-'+d.id.slice(-6).toUpperCase();
  const tempSvg = document.createElementNS('http://www.w3.org/2000/svg','svg');
  tempSvg.id = '_temp_dbc';
  tempSvg.style.cssText = 'position:absolute;top:-9999px';
  document.body.appendChild(tempSvg);
  try{
    JsBarcode('#_temp_dbc', code, {format:'CODE128',width:1.5,height:28,displayValue:true,fontSize:9,margin:2});
    const svgHtml = tempSvg.outerHTML;
    tempSvg.remove();
    const html = `<div style="direction:rtl;font-family:Arial,sans-serif;padding:4mm 2.5mm 0;margin:0 auto;text-align:right;width:65mm">
      <div style="display:flex;align-items:center;justify-content:flex-end;gap:6px;margin-bottom:6px;border-bottom:1px solid #000;padding-bottom:4px">
        <img src="logo.png" style="width:55px;height:55px;object-fit:contain">
        <span style="font-size:16px;font-weight:900">SJ STORE</span>
      </div>
      <div style="font-size:14px;font-weight:800">${d.customerName}</div>
      <div style="font-size:12.5px;font-weight:600;margin:2px 0">${d.reason||d.productName}</div>
      <div style="display:flex;justify-content:center">${svgHtml}</div>
      <div style="font-size:11.5px;font-weight:600">المبلغ: ${fmt(d.totalDebt)} | متبقي: ${fmt(d.remaining)}</div>
    </div>`;
    doPrint(html, '6.5cm', '9cm');
  }catch(e){ tempSvg.remove(); toast('❌ خطأ في إنشاء الباركود','err'); }
  }); // waitForJsBarcode
}

function renderDebts(){
  const q = (document.getElementById('debt-search').value||'').trim().toLowerCase();
  let data = DB.get('debts').filter(d => !d.archived);
  if(q) data = data.filter(d=>
    (d.customerName||'').toLowerCase().includes(q)||
    (d.reason||d.productName||'').toLowerCase().includes(q)
  );

  // KPI
  const all = DB.get('debts');
  document.getElementById('debt-kpi-total').textContent     = num(all.reduce((a,d)=>a+(d.totalDebt||0),0));
  document.getElementById('debt-kpi-collected').textContent = num(all.reduce((a,d)=>a+(d.paid||0),0));
  document.getElementById('debt-kpi-remaining').textContent = num(all.reduce((a,d)=>a+(d.remaining||0),0));
  document.getElementById('debt-count').textContent = data.length+' دين';

  const tbody = document.getElementById('debt-tbody');
  const empty = document.getElementById('debt-empty');

  if(!data.length){ tbody.innerHTML=''; empty.style.display='block'; return; }
  empty.style.display='none';

  tbody.innerHTML = data.map(d=>{
    const lastUpd = new Date(d.lastUpdate||d.date);
    const dateStr = `${lastUpd.getDate()}/${lastUpd.getMonth()+1}/${lastUpd.getFullYear()}`;
    const closed = d.status==='closed';
    return `<tr style="${closed?'opacity:.6':''}">
      <td>
        <div style="font-weight:700;font-size:13.5px">${d.customerName}</div>
        <div style="font-size:11.5px;color:var(--text-gray)">${d.phone||'—'}</div>
        <div style="font-size:11.5px;color:var(--text-mid);margin-top:2px">📌 ${d.reason||d.productName||'—'}</div>
      </td>
      <td style="font-weight:700;color:var(--text-dark)">${fmt(d.totalDebt)}</td>
      <td style="font-weight:600;color:#276749">${fmt(d.paid)}</td>
      <td style="font-weight:800;color:${closed?'#276749':'var(--red)'}">${closed?'✅ مسدد':fmt(d.remaining)}</td>
      <td style="font-size:11px;color:var(--text-gray);font-family:monospace">${d.barcode13||'—'}</td>
      <td style="font-size:12px;color:var(--text-gray)">${dateStr}</td>
      <td>
        <div class="act-btns" style="justify-content:center;flex-wrap:wrap;gap:4px">
          ${!closed?`<button class="btn btn-sm btn-primary" onclick="openDebtPay('${d.id}')">💵 تسديد</button>
          <button class="btn btn-sm btn-green" onclick="openDebtPayAll('${d.id}')">دفع الكل</button>`:''}
          <button class="ibtn ibtn-blue" title="تعديل" onclick="openDebtModal('${d.id}')">✏️</button>
          <button class="ibtn ibtn-purple" title="طباعة" onclick="openDebtPrint('${d.id}')">🖨️</button>
          <button class="ibtn ibtn-red" title="حذف" onclick="deleteDebt('${d.id}')">🗑️</button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

// تحميل الديون — يتم عبر goPage

let _invEditId = null;
let _invImgData = null;
let _printProd = null;

// توليد رقم باركود تسلسلي
function genBarcode(){
  const prods = DB.get('products');
  const nums = prods.map(p=>{
    const m = String(p.barcode||'').match(/(\d+)$/);
    return m ? parseInt(m[1]) : 0;
  });
  const next = nums.length ? Math.max(...nums)+1 : 1;
  return 'SJ' + String(next).padStart(3,'0');
}



// ====== اختيار منتج من المخزون في نافذة الدين ======
function openDebtProductPicker() {
  const picker = document.getElementById('debt-product-picker');
  if (!picker) return;

  const selectedMap = new Map(_debtSelectedProducts.map(item => [item.id, Math.max(1, parseInt(item.qty) || 1)]));
  const q = (selectedMap.size ? '' : (document.getElementById('dm-reason').value || '').toLowerCase().trim());
  const filtered = DB.get('products').filter(p => {
    const available = parseInt(p.qty) || 0;
    return available > 0 || selectedMap.has(p.id);
  }).filter(p => {
    if (!q) return true;
    return (p.name || '').toLowerCase().includes(q);
  });

  if (!filtered.length) {
    picker.innerHTML = '<div style="padding:12px;text-align:center;color:var(--text-gray);font-size:13px">لا توجد منتجات متوفرة</div>';
    picker.style.display = 'block';
    return;
  }

  picker.innerHTML = filtered.map(p => {
    const selectedQty = selectedMap.get(p.id) || 0;
    const qty = parseInt(p.qty) || 0;
    const isSelected = selectedQty > 0;
    return `
      <div style="padding:10px 14px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;gap:10px;${isSelected ? 'background:var(--primary-light);' : ''}">
        <div style="display:flex;align-items:center;gap:10px;min-width:0">
          <div style="width:20px;height:20px;border-radius:6px;border:1.5px solid ${isSelected ? 'var(--primary)' : 'var(--border)'};display:flex;align-items:center;justify-content:center;color:white;background:${isSelected ? 'var(--primary)' : 'transparent'};font-size:12px;font-weight:900">${isSelected ? '✓' : ''}</div>
          <div style="min-width:0">
            <div style="font-weight:700;font-size:13px">${p.name}</div>
            <div style="font-size:11px;color:var(--text-gray)">${[p.ram,p.storage,p.color].filter(Boolean).join(' · ') || 'بدون تفاصيل'}</div>
            <div style="font-size:11px;color:${qty > 0 ? 'var(--text-gray)' : 'var(--red)'}">المخزون الحالي: ${qty}</div>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:6px;flex-shrink:0">
          <button type="button" onclick="changeDebtSelectedQty('${p.id}',-1); event.stopPropagation();" style="border:none;background:#EDF2F7;color:#1A202C;width:28px;height:28px;border-radius:8px;cursor:pointer;font-weight:900">-</button>
          <span style="min-width:24px;text-align:center;font-weight:800">${selectedQty}</span>
          <button type="button" onclick="changeDebtSelectedQty('${p.id}',1); event.stopPropagation();" style="border:none;background:var(--primary);color:white;width:28px;height:28px;border-radius:8px;cursor:pointer;font-weight:900">+</button>
        </div>
      </div>
    `;
  }).join('');

  picker.style.display = 'block';

  setTimeout(() => {
    document.addEventListener('click', function closePicker(e) {
      if (!picker.contains(e.target) && e.target.id !== 'dm-reason') {
        picker.style.display = 'none';
        document.removeEventListener('click', closePicker);
      }
    });
  }, 100);
}
