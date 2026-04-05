// ====== pos.js — نقطة البيع ======

// ====== POS ======
let _posProd = null;
let _saleQty = 1;
let _saleType = 'cash';

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
  document.getElementById('pos-prod-price').textContent = fmt(_posProd.price);
  document.getElementById('sale-qty').textContent = 1;

  // إظهار/إخفاء زر الضمان حسب نوع المنتج
  const warrantyTab = document.getElementById('tab-warranty');
  if(warrantyTab){
    warrantyTab.style.display = _posProd.productType==='kapa' ? 'block' : 'none';
  }

  // تعبئة بيانات الضمان من المنتج تلقائياً
  const warrColor = document.getElementById('warr-color');
  const warrImei  = document.getElementById('warr-imei');
  if(warrColor) warrColor.value = _posProd.color||'';
  if(warrImei)  warrImei.value  = _posProd.barcode||'';

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
  if(warrImei)  warrImei.value  = _posProd.barcode||'';

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
  const max = _posProd ? (_posProd.qty||1) : 99;
  _saleQty = Math.max(1, Math.min(max, _saleQty + d));
  document.getElementById('sale-qty').textContent = _saleQty;
  updateSaleTotals();
}

function updateSaleTotals(){
  if(!_posProd) return;
  const total = (_posProd.price||0) * _saleQty;
  document.getElementById('cash-total').textContent = fmt(total);
  document.getElementById('cred-total-lbl').textContent = fmt(total);
  calcInstallment();
  calcCredit();
}

function calcInstallment(){
  if(!_posProd) return;
  const base = (_posProd.price||0) * _saleQty;
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
  const total = (_posProd.price||0) * _saleQty;
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
  const total = (_posProd.price||0) * _saleQty;

  if(_saleType==='cash'){
    // حفظ مبيعة كاش
    const sales = DB.get('sales');
    const sale = {
      id: genId(), productId: _posProd.id,
      productName: _posProd.name,
      type: 'cash', qty: _saleQty,
      totalPaid: total, profit: (_posProd.profit||0)*_saleQty,
      date: nowISO()
    };
    sales.push(sale);
    DB.set('sales', sales);

    // حفظ Transaction
    DB.addTransaction({
      type: 'cash',
      productName: _posProd.name,
      productId: _posProd.id,
      qty: _saleQty,
      salePrice: total,
      profit: (_posProd.profit||0) * _saleQty,
      cost: (_posProd.cost||0) * _saleQty,
      date: nowISO(),
      saleId: sale.id
    });

    // نقص المخزون
    deductStock(_posProd.id, _saleQty);

    // تيليجرام
    tg(`🛒 <b>بيع جديد</b>\nالمنتج: ${_posProd.name}\nالنوع: عادي كاش\nالكمية: ${_saleQty}\nالمبلغ: ${fmt(total)}\nالربح: ${fmt((_posProd.profit||0)*_saleQty)}\nالتاريخ: ${todayStr()}`);

    closeModal('pos-sale-ov');
    toast('✅ تم تسجيل البيع بنجاح');
    renderPOS();

  } else if(_saleType==='installment'){
    const name = document.getElementById('inst-name').value.trim();
    const phone = document.getElementById('inst-phone').value.trim();
    const extra = parseFloat(document.getElementById('inst-extra').value)||0;
    const down = parseFloat(document.getElementById('inst-down').value)||0;
    const months = parseInt(document.getElementById('inst-months').value)||1;

    if(!name){ toast('أدخل اسم الزبون','err'); return; }
    if(!months){ toast('أدخل عدد الأشهر','err'); return; }

    const base = (_posProd.price||0) * _saleQty;
    const total = base + extra;  // السعر + الربح الإضافي
    if(down > total){ toast('⚠️ المقدم أكبر من إجمالي البيع','err'); return; }
    const remain = Math.max(0, total - down);
    const monthly = remain > 0 ? Math.ceil(remain / months) : 0;
    const totalProfit = ((_posProd.profit||0) * _saleQty) + extra;

    const inst = DB.get('installments');
    const rec = {
      id: genId(), productId: _posProd.id,
      productName: _posProd.name,
      customerName: name, phone,
      totalPrice: total,
      basePrice: base,
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
        price:parseFloat(_posProd.price)||0,
        cost:parseFloat(_posProd.cost)||0
      }],
      paidMonths: 0, payments: down>0?[{amount:down,date:nowISO()}]:[],
      barcode13: genRandom13(),
      date: nowISO()
    };
    inst.push(rec);
    DB.set('installments', inst);

    deductStock(_posProd.id, _saleQty);

    tg(`📅 <b>بيع بالتقسيط</b>\nالزبون: ${name}\nالمنتج: ${_posProd.name}\nالسعر الأصلي: ${fmt(base)}\nالربح الإضافي: ${fmt(extra)}\nالإجمالي: ${fmt(total)}\nالمقدم: ${fmt(down)}\nالقسط: ${fmt(monthly)}/شهر × ${months}\nالتاريخ: ${todayStr()}`);

    const instSaleId = genId();
    const sales = DB.get('sales');
    sales.push({id:instSaleId,productId:_posProd.id,productName:_posProd.name,
      type:'installment',qty:_saleQty,totalPaid:down,profit:totalProfit,date:nowISO(),
      installmentId:rec.id,
      selectedProducts:rec.selectedProducts});
    DB.set('sales',sales);

    // حفظ Transaction
    DB.addTransaction({
      type:'installment', productName:_posProd.name, productId:_posProd.id,
      customerName:name, qty:_saleQty,
      salePrice:total, profit:totalProfit, cost:(_posProd.cost||0)*_saleQty,
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
    if(paid > total){ toast('⚠️ المبلغ المدفوع أكبر من إجمالي الدين','err'); return; }

    const debts = DB.get('debts');
    const totalProfit = (_posProd.profit||0) * _saleQty;
    const initialProfit = total > 0 ? Math.round((totalProfit / total) * paid) : 0;
    const rec = {
      id: genId(), productId: _posProd.id,
      productName: _posProd.name,
      customerName: name, phone,
      reason: 'شراء '+_posProd.name,
      totalDebt: total,
      paid, remaining: Math.max(0, total-paid),
      profit: totalProfit,
      barcode13: genRandom13(),
      date: nowISO(), lastUpdate: nowISO(),
      archived:false, archivedAt:'',
      selectedProducts:[{
        id:_posProd.id,
        name:_posProd.name || '',
        qty:_saleQty,
        price:parseFloat(_posProd.price)||0,
        cost:parseFloat(_posProd.cost)||0
      }],
      payments: paid>0?[{amount:paid,date:nowISO()}]:[]
    };
    debts.push(rec);
    DB.set('debts', debts);

    // نقص المخزون
    deductStock(_posProd.id, _saleQty);

    // تيليجرام
    tg(`💳 <b>بيع كريدي (دين)</b>\nالزبون: ${name}\nالمنتج: ${_posProd.name}\nالإجمالي: ${fmt(total)}\nدفع: ${fmt(paid)}\nمتبقي: ${fmt(total-paid)}\nالتاريخ: ${todayStr()}`);

    // حفظ في المبيعات + Transaction
    const credSaleId = genId();
    DB.addTransaction({
      type:'credit', productName:_posProd.name, productId:_posProd.id,
      customerName:name, qty:_saleQty,
      salePrice:total, profit:initialProfit, cost:(_posProd.cost||0)*_saleQty,
      totalDebt:total, downPayment:paid, remaining:Math.max(0,total-paid),
      date:nowISO(), saleId:credSaleId
    });
    const sales = DB.get('sales');
    sales.push({id:credSaleId,productId:_posProd.id,productName:_posProd.name,
      type:'credit',qty:_saleQty,totalPaid:paid,profit:initialProfit,date:nowISO(),
      debtId:rec.id,
      selectedProducts:rec.selectedProducts});
    DB.set('sales',sales);

    closeModal('pos-sale-ov');
    toast('✅ تم تسجيل الدين بنجاح');
    renderPOS();
  }
}

function deductStock(prodId, qty){
  const prods = DB.get('products');
  const idx = prods.findIndex(p=>p.id===prodId);
  if(idx>=0) prods[idx].qty = Math.max(0,(prods[idx].qty||0)-qty);
  DB.set('products', prods);
}

// تحميل POS عند فتح الصفحة — يتم عبر goPage
