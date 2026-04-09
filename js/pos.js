// ====== pos.js — نقطة البيع ======

// ====== POS ======
let _posProd = null;
let _saleQty = 1;
let _saleType = 'cash';

function currentPosProductRecord(){
  if(!_posProd?.id) return null;
  return DB.get('products').find(p => p.id === _posProd.id) || null;
}

function currentAvailableSaleQty(){
  return Math.max(0, parseInt(currentPosProductRecord()?.qty) || 0);
}

function ensureSaleStockAvailable(requiredQty = _saleQty){
  const liveProduct = currentPosProductRecord();
  if(!liveProduct){
    toast('⚠️ المنتج لم يعد موجودًا', 'warn');
    closeModal('pos-sale-ov');
    renderPOS();
    return false;
  }
  const available = Math.max(0, parseInt(liveProduct.qty) || 0);
  if(available < requiredQty){
    _posProd = liveProduct;
    _saleQty = Math.max(1, available || 1);
    document.getElementById('sale-qty').textContent = _saleQty;
    toast(`⚠️ المخزون المتاح هو ${available} فقط`, 'warn');
    updateSaleTotals();
    renderPOS();
    return false;
  }
  _posProd = liveProduct;
  return true;
}

function currentSaleTotal(){
  const input = document.getElementById('sale-total-input');
  const value = parseFloat(input?.value);
  return Number.isFinite(value) ? Math.max(0, value) : (parseFloat(_posProd?.price) || 0) * _saleQty;
}

function currentSaleOriginalUnitCost(){
  return parseFloat(_posProd?.cost) || 0;
}

function currentSaleOriginalUnitPrice(){
  return parseFloat(_posProd?.price) || 0;
}

function currentSaleOriginalBaseProfit(){
  return Math.max(0, (currentSaleOriginalUnitPrice() - currentSaleOriginalUnitCost()) * _saleQty);
}

function currentSaleAllocatedCost(){
  const total = currentSaleTotal();
  const baseProfit = currentSaleOriginalBaseProfit();
  return Math.max(0, total - Math.min(total, Math.max(baseProfit, total - (currentSaleOriginalUnitCost() * _saleQty))));
}

function currentSaleUnitCost(){
  if(!_saleQty) return 0;
  return currentSaleAllocatedCost() / _saleQty;
}

function currentSaleUnitPrice(){
  if(!_saleQty) return 0;
  return currentSaleTotal() / _saleQty;
}

function currentSaleBaseTotal(){
  return currentSaleTotal();
}

function currentSaleBaseProfit(){
  const total = currentSaleBaseTotal();
  const originalCost = currentSaleOriginalUnitCost() * _saleQty;
  const originalProfit = currentSaleOriginalBaseProfit();
  return Math.min(total, Math.max(originalProfit, total - originalCost));
}

function renderPOS(){
  const q = (document.getElementById('pos-search').value||'').trim().toLowerCase();
  let prods = DB.get('products');
  if(q) prods = prods.filter(p=>
    (p.name||'').toLowerCase().includes(q)||
    (p.barcode||'').toLowerCase().includes(q)
  );

  const grid = document.getElementById('pos-grid');
  const empty = document.getElementById('pos-empty');

  if(!prods.length){
    grid.innerHTML='';
    empty.style.display='block';
    return;
  }
  empty.style.display='none';

  grid.innerHTML = prods.map(p=>{
    const imgEl = `<div class="pos-card-img">📱</div>`;
    const outStock = (p.qty||0)<=0;
    return `<div class="pos-card">
      ${imgEl}
      <div class="pos-card-body">
        <div class="pos-card-name" title="${p.name}">${p.name}</div>
        <div class="pos-card-price">${fmt(p.price)}</div>
        <div class="pos-card-stock">المخزون: ${p.qty||0} قطعة</div>
        <button class="pos-sell-btn" ${outStock?'disabled':''} onclick="openSale('${p.id}')">
          🛒 ${outStock?'نفد المخزون':'بيع الآن'}
        </button>
      </div>
    </div>`;
  }).join('');
}

function openSale(prodId){
  const prods = DB.get('products');
  _posProd = prods.find(p=>p.id===prodId);
  if(!_posProd) return;
  _saleQty = 1;
  _saleType = 'cash';

  document.getElementById('pos-prod-name').textContent = _posProd.name;
  document.getElementById('pos-prod-price').textContent = fmt((_posProd.price||0) * _saleQty);
  document.getElementById('sale-qty').textContent = 1;
  document.getElementById('sale-total-input').value = String(parseFloat(_posProd.price)||0);

  // إظهار زر الضمان لكل المنتجات
  const warrantyTab = document.getElementById('tab-warranty');
  if(warrantyTab){
    warrantyTab.style.display = 'block';
  }

  // تعبئة بيانات الضمان من المنتج تلقائياً
  const warrColor = document.getElementById('warr-color');
  const warrImei  = document.getElementById('warr-imei');
  if(warrColor) warrColor.value = _posProd.color||'';
  if(warrImei)  warrImei.value  = _posProd.barcode || _posProd.serialNo || '';

  // reset tabs
  setSaleType('cash');

  // reset fields
  ['inst-name','inst-phone','inst-down','inst-months','inst-extra',
   'cred-name','cred-phone','cred-paid',
   'warr-name','warr-phone','warr-duration'].forEach(id=>{
    const el = document.getElementById(id);
    if(el) el.value = id==='cred-paid'?'0':'';
  });
  // إعادة تعبئة الضمان
  if(warrColor) warrColor.value = _posProd.color||'';
  if(warrImei)  warrImei.value  = _posProd.barcode || _posProd.serialNo || '';

  updateSaleTotals();
  openModal('pos-sale-ov');
}

function setSaleType(type){
  _saleType = type;
  const tabMap = {cash:'tab-cash', installment:'tab-install', credit:'tab-credit', warranty:'tab-warranty'};
  const secMap = {cash:'sec-cash', installment:'sec-installment', credit:'sec-credit', warranty:'sec-warranty'};
  ['cash','installment','credit','warranty'].forEach(t=>{
    const tabEl = document.getElementById(tabMap[t]);
    const secEl = document.getElementById(secMap[t]);
    if(tabEl) tabEl.classList.toggle('active', t===type);
    if(secEl) secEl.classList.toggle('active', t===type);
  });
  // إخفاء زر التأكيد عند الضمان
  const confirmBtn = document.getElementById('confirm-sale-btn');
  if(confirmBtn) confirmBtn.style.display = type==='warranty' ? 'none' : 'block';
  updateSaleTotals();
}

function changeSaleQty(d){
  const unitPrice = currentSaleUnitPrice();
  const max = _posProd ? currentAvailableSaleQty() : 99;
  _saleQty = Math.max(1, Math.min(max, _saleQty + d));
  document.getElementById('sale-qty').textContent = _saleQty;
  const totalInput = document.getElementById('sale-total-input');
  if(totalInput) totalInput.value = String(Math.max(0, unitPrice * _saleQty));
  updateSaleTotals();
}

function updateSaleTotals(){
  if(!_posProd) return;
  const total = currentSaleBaseTotal();
  document.getElementById('pos-prod-price').textContent = fmt(total);
  document.getElementById('cash-total').textContent = fmt(total);
  document.getElementById('cred-total-lbl').textContent = fmt(total);
  calcInstallment();
  calcCredit();
}

function calcInstallment(){
  if(!_posProd) return;
  const base = currentSaleBaseTotal();
  const extra = parseFloat(document.getElementById('inst-extra').value)||0;
  const total = base + extra;
  const downInput = document.getElementById('inst-down');
  let down = parseFloat(downInput.value)||0;
  if(down > total){
    down = total;
    downInput.value = String(total);
  }
  const months = parseInt(document.getElementById('inst-months').value)||1;
  const remain = Math.max(0, total - down);
  const monthly = remain > 0 ? Math.ceil(remain / months) : 0;

  document.getElementById('inst-base-lbl').textContent = fmt(base);
  document.getElementById('inst-extra-lbl').textContent = '+ ' + fmt(extra);
  document.getElementById('inst-total-lbl').textContent = fmt(total);
  document.getElementById('inst-remain-lbl').textContent = fmt(remain);
  document.getElementById('inst-monthly-lbl').textContent = fmt(monthly);
}

function calcCredit(){
  if(!_posProd) return;
  const total = currentSaleBaseTotal();
  const paidInput = document.getElementById('cred-paid');
  let paid = parseFloat(paidInput.value)||0;
  if(paid > total){
    paid = total;
    paidInput.value = String(total);
  }
  document.getElementById('cred-total-lbl').textContent = fmt(total);
  document.getElementById('cred-remain-lbl').textContent = fmt(Math.max(0, total - paid));
}

function confirmSale(){
  if(!_posProd) return;
  if(!ensureSaleStockAvailable()) return;
  const unitPrice = currentSaleUnitPrice();
  const unitCost = currentSaleUnitCost();
  const baseTotal = currentSaleBaseTotal();
  const baseProfit = currentSaleBaseProfit();

  if(_saleType==='cash'){
    // حفظ مبيعة كاش
    const sale = {
      id: genId(), productId: _posProd.id,
      productName: _posProd.name,
      type: 'cash', qty: _saleQty,
      totalPaid: baseTotal, profit: baseProfit,
      date: nowISO()
    };
    DB.saveOne('sales', sale);

    // حفظ Transaction
    DB.addTransaction({
      type: 'cash',
      productName: _posProd.name,
      productId: _posProd.id,
      qty: _saleQty,
      salePrice: baseTotal,
      profit: baseProfit,
      cost: unitCost * _saleQty,
      date: nowISO(),
      saleId: sale.id
    });

    // نقص المخزون
    if(!deductStock(_posProd.id, _saleQty)) return;

    // تيليجرام
    tg(`🛒 <b>بيع جديد</b>\nالمنتج: ${_posProd.name}\nالنوع: عادي كاش\nالكمية: ${_saleQty}\nالمبلغ: ${fmt(baseTotal)}\nالربح: ${fmt(baseProfit)}\nالتاريخ: ${todayStr()}`);

    closeModal('pos-sale-ov');
    toast('✅ تم تسجيل البيع بنجاح');
    renderPOS();

  } else if(_saleType==='installment'){
    const name = document.getElementById('inst-name').value.trim();
    const phone = document.getElementById('inst-phone').value.trim();
    const extra = parseFloat(document.getElementById('inst-extra').value)||0;
    const down = parseFloat(document.getElementById('inst-down').value)||0;
    const monthsValue = document.getElementById('inst-months').value.trim();
    const months = parseInt(monthsValue, 10);

    if(!name){ toast('أدخل اسم الزبون','err'); return; }
    if(!phone){ toast('أدخل رقم الهاتف','err'); return; }
    if(!monthsValue || !Number.isInteger(months) || months < 1){ toast('أدخل عدد الأشهر','err'); return; }

    const installmentBase = baseTotal;
    const installmentTotal = installmentBase + extra;  // السعر + الربح الإضافي
    if(down > installmentTotal){ toast('⚠️ المقدم أكبر من إجمالي البيع','err'); return; }
    const remain = Math.max(0, installmentTotal - down);
    const monthly = remain > 0 ? Math.ceil(remain / months) : 0;
    const totalProfit = baseProfit + extra;

    const rec = {
      id: genId(), productId: _posProd.id,
      productName: _posProd.name,
      customerName: name, phone,
      totalPrice: installmentTotal,
      basePrice: installmentBase,
      extraProfit: extra,
      downPayment: down,
      months, monthlyPayment: monthly,
      profit: totalProfit,
      paid: down,
      remaining: remain,
      selectedProducts:[{
        id:_posProd.id,
        name:_posProd.name || '',
        qty:_saleQty,
        price:unitPrice,
        cost:unitCost
      }],
      paidMonths: 0, payments: down>0?[{amount:down,date:nowISO()}]:[],
      barcode13: genRandom13(),
      date: nowISO()
    };
    DB.saveOne('installments', rec);

    if(!deductStock(_posProd.id, _saleQty)) return;

    tg(`📅 <b>بيع بالتقسيط</b>\nالزبون: ${name}\nالمنتج: ${_posProd.name}\nالسعر الأصلي: ${fmt(installmentBase)}\nالربح الإضافي: ${fmt(extra)}\nالإجمالي: ${fmt(installmentTotal)}\nالمقدم: ${fmt(down)}\nالقسط: ${fmt(monthly)}/شهر × ${months}\nالتاريخ: ${todayStr()}`);

    const instSaleId = genId();
    DB.saveOne('sales', {id:instSaleId,productId:_posProd.id,productName:_posProd.name,
      type:'installment',qty:_saleQty,totalPaid:down,profit:totalProfit,date:nowISO(),
      installmentId:rec.id,
      selectedProducts:rec.selectedProducts});

    // حفظ Transaction
    DB.addTransaction({
      type:'installment', productName:_posProd.name, productId:_posProd.id,
      customerName:name, qty:_saleQty,
      salePrice:installmentTotal, profit:totalProfit, cost:unitCost*_saleQty,
      downPayment:down, months, monthlyPayment:monthly,
      date:nowISO(), saleId:instSaleId
    });

    closeModal('pos-sale-ov');
    toast('✅ تم تسجيل التقسيط بنجاح');
    renderPOS();

  } else if(_saleType==='credit'){
    const name = document.getElementById('cred-name').value.trim();
    const phone = document.getElementById('cred-phone').value.trim();
    const paid = parseFloat(document.getElementById('cred-paid').value)||0;

    if(!name){ toast('أدخل اسم الزبون','err'); return; }
    if(!phone){ toast('أدخل رقم الهاتف','err'); return; }
    if(paid > baseTotal){ toast('⚠️ المبلغ المدفوع أكبر من إجمالي الدين','err'); return; }

    const totalProfit = baseProfit;
    const initialProfit = baseTotal > 0 ? Math.round((totalProfit / baseTotal) * paid) : 0;
    const rec = {
      id: genId(), productId: _posProd.id,
      productName: _posProd.name,
      customerName: name, phone,
      reason: 'شراء '+_posProd.name,
      totalDebt: baseTotal,
      paid, remaining: Math.max(0, baseTotal-paid),
      profit: totalProfit,
      barcode13: genRandom13(),
      date: nowISO(), lastUpdate: nowISO(),
      archived:false, archivedAt:'',
      selectedProducts:[{
        id:_posProd.id,
        name:_posProd.name || '',
        qty:_saleQty,
        price:unitPrice,
        cost:unitCost
      }],
      payments: paid>0?[{amount:paid,date:nowISO()}]:[]
    };
    DB.saveOne('debts', rec);

    // نقص المخزون
    if(!deductStock(_posProd.id, _saleQty)) return;

    // تيليجرام
    tg(`💳 <b>بيع كريدي (دين)</b>\nالزبون: ${name}\nالمنتج: ${_posProd.name}\nالإجمالي: ${fmt(baseTotal)}\nدفع: ${fmt(paid)}\nمتبقي: ${fmt(baseTotal-paid)}\nالتاريخ: ${todayStr()}`);

    // حفظ في المبيعات + Transaction
    const credSaleId = genId();
    DB.addTransaction({
      type:'credit', productName:_posProd.name, productId:_posProd.id,
      customerName:name, qty:_saleQty,
      salePrice:baseTotal, profit:initialProfit, cost:unitCost*_saleQty,
      totalDebt:baseTotal, downPayment:paid, remaining:Math.max(0,baseTotal-paid),
      date:nowISO(), saleId:credSaleId
    });
    DB.saveOne('sales', {id:credSaleId,productId:_posProd.id,productName:_posProd.name,
      type:'credit',qty:_saleQty,totalPaid:paid,profit:initialProfit,date:nowISO(),
      debtId:rec.id,
      selectedProducts:rec.selectedProducts});

    closeModal('pos-sale-ov');
    toast('✅ تم تسجيل الدين بنجاح');
    renderPOS();
  }
}

function deductStock(prodId, qty){
  const prods = DB.get('products').slice();
  const idx = prods.findIndex(p=>p.id===prodId);
  if(idx<0){
    toast('⚠️ المنتج لم يعد موجودًا', 'warn');
    return false;
  }
  const available = Math.max(0, parseInt(prods[idx].qty) || 0);
  if(available < qty){
    toast(`⚠️ المخزون المتاح هو ${available} فقط`, 'warn');
    return false;
  }
  prods[idx] = {
    ...prods[idx],
    qty: available - qty
  };
  DB.set('products', prods);
  _posProd = prods[idx];
  return true;
}

// تحميل POS عند فتح الصفحة — يتم عبر goPage
