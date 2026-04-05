// ====== inventory.js ======

// ====== PRODUCT TYPE SELECTOR ======
function openProductTypeSelector() {
  openModal('prod-type-ov');
}

function openNormalProductModal(editId = null) {
  closeModal('prod-type-ov');
  openInvModal(editId);
}

function openKapaProductModal(editId = null) {
  closeModal('prod-type-ov');
  _kapaEditId = editId;
  _kapaImgData = null;

  ['kapa-name', 'kapa-qty', 'kapa-cost', 'kapa-price', 'kapa-ram',
   'kapa-storage', 'kapa-battery', 'kapa-barcode', 'kapa-color'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  document.getElementById('kapa-profit-display').textContent = '0 DA';
  document.getElementById('kapa-profit').value = '';

  if (editId) {
    const prods = DB.get('products');
    const p = prods.find(x => x.id === editId);
    if (!p) return;
    document.getElementById('kapa-modal-title').textContent = '📱 تعديل بيانات الهاتف';
    document.getElementById('kapa-name').value    = p.name || '';
    document.getElementById('kapa-qty').value     = p.qty || 0;
    document.getElementById('kapa-cost').value    = p.cost || 0;
    document.getElementById('kapa-price').value   = p.price || 0;
    document.getElementById('kapa-ram').value     = p.ram || '';
    document.getElementById('kapa-storage').value = p.storage || '';
    document.getElementById('kapa-battery').value = p.battery || '';
    document.getElementById('kapa-barcode').value = p.barcode || '';
    document.getElementById('kapa-color').value   = p.color || '';
    calcKapaProfit();
  } else {
    document.getElementById('kapa-modal-title').textContent = '📱 إضافة منتج كابا (هاتف)';
    document.getElementById('kapa-barcode').value = '';
    document.getElementById('kapa-barcode').placeholder = gen13Barcode() + ' (أوتو 8 رقم)';
  }
  openModal('kapa-modal-ov');
}

let _kapaEditId = null;
let _kapaImgData = null;

function calcKapaProfit() {
  const cost  = parseFloat(document.getElementById('kapa-cost').value) || 0;
  const price = parseFloat(document.getElementById('kapa-price').value) || 0;
  const profit = price - cost;
  document.getElementById('kapa-profit-display').textContent = profit >= 0 ? num(profit) + ' DA' : '0 DA';
  document.getElementById('kapa-profit').value = Math.max(0, profit);
}


function saveKapaProduct() {
  const name    = document.getElementById('kapa-name').value.trim();
  const qty     = parseInt(document.getElementById('kapa-qty').value) || 0;
  const cost    = parseFloat(document.getElementById('kapa-cost').value) || 0;
  const price   = parseFloat(document.getElementById('kapa-price').value) || 0;
  const profit  = Math.max(0, price - cost);
  const ram     = document.getElementById('kapa-ram').value.trim();
  const storage = document.getElementById('kapa-storage').value.trim();
  const battery = document.getElementById('kapa-battery').value.trim();
  let barcode   = document.getElementById('kapa-barcode').value.trim();
  const color   = document.getElementById('kapa-color').value.trim();
  const note    = '';
  const prods = DB.get('products');
  const currentProd = _kapaEditId ? prods.find(p => p.id === _kapaEditId) : null;

    if (!name)  { toast('أدخل اسم الهاتف', 'err'); return; }
    if (!price) { toast('أدخل سعر البيع', 'err'); return; }

  if (_kapaEditId && currentProd) {
    if (!barcode) barcode = currentProd.barcode || gen13Barcode();
    else if (barcode !== String(currentProd.barcode || '').trim()) {
      const normalized = normalizeProductBarcode(barcode);
      if(!normalized.ok){ toast(normalized.error, 'err'); return; }
      barcode = normalized.barcode;
    }
  } else {
    if (!barcode) barcode = gen13Barcode();
    else {
      const normalized = normalizeProductBarcode(barcode);
      if(!normalized.ok){ toast(normalized.error, 'err'); return; }
      barcode = normalized.barcode;
    }
  }

  // Build desc from specs
  const specs = [ram, storage, battery, color].filter(Boolean).join(' | ');

  if (_kapaEditId) {
    const idx = prods.findIndex(p => p.id === _kapaEditId);
    if (idx >= 0) {
      prods[idx] = { ...prods[idx], name, qty, price, profit, cost,
        barcode, desc: specs, note, ram, storage, battery, color,
        productType: 'kapa',
        updatedAt: nowISO() };
    }
      toast('✅ تم تحديث بيانات الهاتف');
  } else {
    prods.push({
      id: genId(), name, qty, price, profit, cost,
      barcode, desc: specs, note, ram, storage, battery, color,
      productType: 'kapa',
      date: nowISO(), createdAt: nowISO()
    });
      toast('✅ تم إضافة الهاتف للمخزون');
  }

  DB.set('products', prods);
  const lastKapa = prods[prods.length - 1];
  if (lastKapa) fsSaveDoc('products', lastKapa.id, lastKapa);
  closeModal('kapa-modal-ov');
  renderInventory();
}

function genRandom13(){
  const getAllBarcodes = () => {
    const used = new Set();
    DB.get('products').forEach(p => p.barcode && used.add(p.barcode));
    DB.get('installments').forEach(i => i.barcode13 && used.add(i.barcode13));
    DB.get('debts').forEach(d => d.barcode13 && used.add(d.barcode13));
    DB.get('repairs').forEach(r => r.barcode13 && used.add(r.barcode13));
    return used;
  };
  const used = getAllBarcodes();
  let n, attempts = 0;
  do {
    n = '';
    for(let i=0;i<13;i++) n += Math.floor(Math.random()*10);
    attempts++;
  } while(used.has(n) && attempts < 100);
  return n;
}

function genRandomEan8(){
  const used = new Set(
    DB.get('products')
      .map(p => String(p.barcode || '').replace(/\D/g, ''))
      .filter(Boolean)
      .map(toPrintableEan8)
  );

  let code, attempts = 0;
  do {
    let base7 = '';
    for(let i=0;i<7;i++) base7 += Math.floor(Math.random()*10);
    code = toPrintableEan8(base7);
    attempts++;
  } while(used.has(code) && attempts < 100);

  return code;
}

function normalizeProductBarcode(value){
  const digits = String(value || '').replace(/\D/g, '');
  if(!digits) return { ok:true, barcode:'' };
  if(digits.length === 7) return { ok:true, barcode: toPrintableEan8(digits) };
  if(digits.length === 8){
    const expected = toPrintableEan8(digits.slice(0, 7));
    if(digits !== expected){
      return {
        ok:false,
        error:'إذا أدخلت 8 أرقام فيجب أن يكون الرقم الثامن صحيحًا لباركود EAN-8'
      };
    }
    return { ok:true, barcode: digits };
  }
  return { ok:false, error:'باركود المنتج يجب أن يكون 7 أرقام أو 8 أرقام فقط' };
}

function toPrintableEan8(value){
  const digits = String(value || '').replace(/\D/g, '');
  const base7 = digits.padStart(7, '0').slice(-7);
  const checksum = base7
    .split('')
    .map(Number)
    .reduce((sum, digit, index) => sum + digit * (index % 2 === 0 ? 3 : 1), 0);
  const checkDigit = (10 - (checksum % 10)) % 10;
  return base7 + checkDigit;
}

function handleGlobalBarcodeScan(barcode){
  const installments = DB.get('installments');
  const inst = installments.find(i => i.barcode13 === barcode);
  if(inst){
    if((inst.remaining||0) <= 0){
      toast('✅ هذا الزبون سجل كل أقساطه، مدفوع بالكامل','ok');
    } else {
      openInstPay(inst.id);
    }
    return;
  }

  const debts = DB.get('debts');
  const debt = debts.find(d => d.barcode13 === barcode);
  if(debt){
    if((debt.remaining||0) <= 0){
      toast('✅ هذا الدين مسدد بالكامل','ok');
    } else {
      openDebtPay(debt.id);
    }
    return;
  }

  const repairs = DB.get('repairs');
  const rep = repairs.find(r => r.barcode13 === barcode);
  if(rep){
    if(rep.paid){
      toast('✅ هذه العملية مدفوعة بالكامل','ok');
    } else {
      openRepairPaid(rep.id);
    }
    return;
  }

  toast('⚠️ لا يوجد سجل بهذا الباركود','warn');
}


function gen13Barcode() { return genRandomEan8(); }

function ensureStoredProductBarcode(product){
  if(!product) return '';
  if(product.barcode) return product.barcode;

  const barcode = gen13Barcode();
  product.barcode = barcode;

  const prods = DB.get('products');
  const idx = prods.findIndex(p => p.id === product.id);
  if(idx >= 0){
    prods[idx] = { ...prods[idx], barcode, updatedAt: nowISO() };
    DB.set('products', prods);
  }

  return barcode;
}
function genBarcode()   { return genRandomEan8(); }

// ====== UPDATED INVENTORY FUNCTIONS ======

function calcProfitFromCost() {
  const cost  = parseFloat(document.getElementById('inv-cost-input').value) || 0;
  const price = parseFloat(document.getElementById('inv-price').value) || 0;
  const profit = price - cost;
  document.getElementById('inv-cost-display').textContent = profit >= 0 ? num(profit) + ' DA' : '⚠️ السعر أقل من التكلفة!';
  document.getElementById('inv-profit').value = Math.max(0, profit);
}

function calcCost() {
  calcProfitFromCost();
}


function openInvModal(editId=null){
  _invEditId = editId;
  _invImgData = null;

  ['inv-name','inv-qty','inv-price','inv-barcode','inv-desc',
   'inv-ram','inv-storage','inv-battery'].forEach(id=>{
    const el = document.getElementById(id);
    if(el) el.value='';
  });
  const costInput = document.getElementById('inv-cost-input');
  if(costInput) costInput.value = '';
  const profitInput = document.getElementById('inv-profit');
  if(profitInput) profitInput.value = '';
  document.getElementById('inv-cost-display').textContent='0 DA';

  if(editId){
    const prods = DB.get('products');
    const p = prods.find(x=>x.id===editId);
    if(!p) return;
    if(p.productType === 'kapa'){
      openKapaProductModal(editId);
      return;
    }
    document.getElementById('inv-modal-title').textContent = 'تعديل المنتج';
    document.getElementById('inv-name').value    = p.name||'';
    document.getElementById('inv-qty').value     = p.qty||0;
    document.getElementById('inv-price').value   = p.price||0;
    if(costInput) costInput.value = p.cost||0;
    if(profitInput) profitInput.value = p.profit||0;
    document.getElementById('inv-cost-display').textContent = num(p.profit||0)+' DA';
    document.getElementById('inv-barcode').value = p.barcode||'';
    document.getElementById('inv-desc').value    = p.color||p.desc||'';
    const ramEl = document.getElementById('inv-ram');
    const storageEl = document.getElementById('inv-storage');
    const batteryEl = document.getElementById('inv-battery');
    if(ramEl)     ramEl.value     = p.ram||'';
    if(storageEl) storageEl.value = p.storage||'';
    if(batteryEl) batteryEl.value = p.battery||'';
  } else {
    document.getElementById('inv-modal-title').textContent = 'إضافة منتج عادي';
    document.getElementById('inv-barcode').placeholder = gen13Barcode() + ' (أوتو 8 رقم)';
  }
  openModal('inv-modal-ov');
}

function saveProduct(){
  const name   = document.getElementById('inv-name').value.trim();
  const qty    = parseInt(document.getElementById('inv-qty').value)||0;
  const price  = parseFloat(document.getElementById('inv-price').value)||0;
  const costInput = document.getElementById('inv-cost-input');
  const cost   = costInput ? (parseFloat(costInput.value)||0) : 0;
  const profit = Math.max(0, price - cost);
  const color   = (document.getElementById('inv-desc')?.value||'').trim();
  const ram     = (document.getElementById('inv-ram')?.value||'').trim();
  const storage = (document.getElementById('inv-storage')?.value||'').trim();
  const battery = (document.getElementById('inv-battery')?.value||'').trim();
  const desc    = [ram, storage, battery, color].filter(Boolean).join(' | ');
  const note    = '';
  let barcode  = document.getElementById('inv-barcode').value.trim();
  const prods = DB.get('products');
  const currentProd = _invEditId ? prods.find(p => p.id === _invEditId) : null;

  if(!name) { toast('أدخل اسم المنتج','err'); document.getElementById('inv-name').focus(); return; }
  if(!price){ toast('أدخل سعر البيع','err');  document.getElementById('inv-price').focus(); return; }

  if(_invEditId && currentProd){
    if(!barcode) barcode = currentProd.barcode || gen13Barcode();
    else if(barcode !== String(currentProd.barcode || '').trim()) {
      const normalized = normalizeProductBarcode(barcode);
      if(!normalized.ok){ toast(normalized.error, 'err'); return; }
      barcode = normalized.barcode;
    }
  } else {
    if(!barcode) barcode = gen13Barcode();
    else {
      const normalized = normalizeProductBarcode(barcode);
      if(!normalized.ok){ toast(normalized.error, 'err'); return; }
      barcode = normalized.barcode;
    }
  }

  if(_invEditId){
    const idx = prods.findIndex(p=>p.id===_invEditId);
    if(idx>=0){
      prods[idx] = {...prods[idx], name, qty, price, profit, cost,
        barcode, desc, note, color, ram, storage, battery,
        updatedAt:nowISO()};
    }
    toast('✅ تم تحديث المنتج بنجاح');
  } else {
    prods.push({
      id:genId(), name, qty, price, profit, cost,
      barcode, desc, note, color, ram, storage, battery,
      date:nowISO(), createdAt:nowISO()
    });
    toast('✅ تم إضافة المنتج للمخزون');
  }

  DB.set('products', prods);
  const lastProd = prods[prods.length - 1];
  if (lastProd) fsSaveDoc('products', lastProd.id, lastProd);
  closeModal('inv-modal-ov');
  renderInventory();
}

function deleteProduct(id){
  const prods = DB.get('products');
  const p = prods.find(x=>x.id===id);
  showConfirm('حذف المنتج', `هل تريد حذف "${p?.name||'هذا المنتج'}" من المخزون؟`, async ()=>{
    DB.deleteOne('products', id);
    toast('🚱 تم حذف المنتج','warn');
    renderInventory();
  }, '🚱');
}

function openPrintChoice(id){
  const prods = DB.get('products');
  _printProd = prods.find(p=>p.id===id);
  if(!_printProd) return;

  const nameEl = document.getElementById('print-qty-prod-name');
  const allLabel = document.getElementById('print-qty-all-label');
  const qtyInput = document.getElementById('print-qty-input');

  if(nameEl)   nameEl.textContent   = _printProd.name;
  if(allLabel) allLabel.textContent = `طباعة ${_printProd.qty||1} مرة (كامل المخزون)`;
  if(qtyInput) qtyInput.value       = 1;

  openModal('print-qty-ov');
}

function printAllLabels(){
  closeModal('print-qty-ov');
  if(!_printProd) return;
  const count = _printProd.qty || 1;
  printLabelRepeat(count);
}

function printCustomLabels(){
  const qty = parseInt(document.getElementById('print-qty-input')?.value)||1;
  closeModal('print-qty-ov');
  if(!_printProd) return;
  printLabelRepeat(Math.max(1, qty));
}

async function printLabelRepeat(count){
  if(!_printProd || count < 1) return;
  waitForJsBarcode(async () => {
    const pages = await buildProductLabelPages(Array.from({ length: count }, () => _printProd));
    _doBulkPrint(pages);
  });
}

function doPrint(htmlContent, pageW='6cm', pageH='4cm'){
  let iframe = document.getElementById('print-iframe');
  if(iframe) iframe.remove();
  iframe = document.createElement('iframe');
  iframe.id = 'print-iframe';
  iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:'+pageW+';height:'+pageH+';border:none;visibility:hidden';
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument || iframe.contentWindow.document;
  doc.open();
  doc.write(`<!DOCTYPE html><html><head><style>
    @page{size:${pageW} ${pageH};margin:3mm}
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:Arial,sans-serif;font-size:11px;background:#fff}
  </style></head><body>${htmlContent}</body></html>`);
  doc.close();

  setTimeout(()=>{
    try{
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
    }catch(e){
      const w = window.open('','_blank');
      if(w){
        w.document.write(`<!DOCTYPE html><html><head><style>
          @page{size:${pageW} ${pageH};margin:3mm}
          body{font-family:Arial,sans-serif;font-size:11px}
        </style></head><body onload="window.print();setTimeout(()=>window.close(),800)">${htmlContent}</body></html>`);
        w.document.close();
      }
    }
    setTimeout(()=>{ if(iframe) iframe.remove(); }, 3000);
  }, 300);
}

const WARRANTY_FORM_IMAGE_URL = 'assets/warranty-form.png';

async function printWarranty(){
  if(!_posProd) return;
  const name     = document.getElementById('warr-name').value.trim();
  const phone    = document.getElementById('warr-phone').value.trim();
  const color    = document.getElementById('warr-color').value.trim();
  const imei     = document.getElementById('warr-imei').value.trim();
  const duration = document.getElementById('warr-duration').value.trim();
  if(!name)    { toast('أدخل اسم الزبون','err'); return; }
  if(!duration){ toast('أدخل مدة الضمان','err'); return; }

  const p = _posProd;
  const today = new Date();
  const dateStr = `${today.getDate()}/${today.getMonth()+1}/${today.getFullYear()}`;
  const priceFormatted = Number(p.price || 0).toLocaleString('fr-DZ');
  const storageValue = p.storage || '';
  const ramValue     = p.ram     || '';
  const specsValue   = [storageValue, ramValue].filter(Boolean).join(' / ') || '-';
  const batteryValue = p.battery || '-';
  const descValue    = p.desc    || p.note || '';
  const barcodeValue = p.barcode || '';
  const colorProd    = p.color   || color || '-';
  const sellerName   = 'SJ Store';
  const esc = v => String(v || '').replace(/[&<>"']/g, s => ({
    '&':'&amp;',
    '<':'&lt;',
    '>':'&gt;',
    '"':'&quot;',
    "'":'&#39;'
  }[s]));

  let iframe = document.getElementById('print-warranty-iframe');
  if(iframe) iframe.remove();
  iframe = document.createElement('iframe');
  iframe.id = 'print-warranty-iframe';
  iframe.srcdoc = `<!DOCTYPE html>
<html><head>
<meta charset="UTF-8">
<style>
@page { size: A4 landscape; margin: 0; }
*{ box-sizing:border-box; }
html,body{
  margin:0;
  width:100%;
  height:100%;
  background:#fff;
  -webkit-print-color-adjust:exact;
  print-color-adjust:exact;
}
body{ font-family:Arial,sans-serif; }
.page{
  position:relative;
  width:297mm;
  height:210mm;
  margin:0;
  background:#fff;
  overflow:hidden;
}
.sheet{
  position:absolute;
  left:157mm;
  top:6.5mm;
  width:130mm;
  height:197.5mm;
  overflow:hidden;
}
.bg-wrap{
  position:absolute;
  left:0;
  top:0;
  width:130mm;
  height:197.5mm;
  transform-origin:top left;
  transform:translateX(130mm) rotate(90deg);
}
.bg{
  position:absolute;
  width:197.5mm;
  height:130mm;
  left:0;
  top:0;
  object-fit:fill;
  image-orientation: none;
}
.field{
  position:absolute;
  color:#1d4f7a;
  font-weight:700;
  font-size:8.8pt;
  line-height:1;
  display:flex;
  align-items:center;
  overflow:hidden;
  text-overflow:ellipsis;
  white-space:nowrap;
}
.line-right{ text-align:right; }
.line-center{ text-align:center; }
.name{ left:104.5mm; top:81.8mm; width:28mm; height:5.2mm; justify-content:flex-end; }
.phone{ left:82.5mm; top:66.1mm; width:25mm; height:4.8mm; justify-content:flex-end; }
.v-field{
  justify-content:center;
  overflow:visible;
}
.v-field > span{
  display:inline-block;
  transform:rotate(90deg);
  transform-origin:center center;
  white-space:nowrap;
}
.product{ left:77.7mm; top:84.8mm; width:9.8mm; height:49.5mm; font-size:8.2pt; }
.specs{ left:66.1mm; top:84.8mm; width:9.8mm; height:49.5mm; font-size:8.2pt; }
.color{ left:54.4mm; top:84.8mm; width:9.8mm; height:49.5mm; font-size:8.2pt; }
.battery{ left:42.8mm; top:84.8mm; width:9.8mm; height:49.5mm; font-size:8.2pt; }
.imei{ left:31.2mm; top:84.8mm; width:9.8mm; height:49.5mm; font-size:7.2pt; }
.date{ left:22.8mm; top:58.4mm; width:25mm; height:4.8mm; justify-content:center; }
.seller{ left:22.8mm; top:66.1mm; width:25mm; height:4.8mm; justify-content:center; }
.total{ left:116.4mm; top:118.5mm; width:6.8mm; height:28mm; justify-content:center; font-size:8.8pt; }
.duration{ left:49.5mm; top:151.6mm; width:34mm; height:8mm; justify-content:center; white-space:nowrap; font-size:8.4pt; }
@media print {
  html,body{ width:auto; height:auto; }
  .page{ margin:0; }
}
</style>
</head><body>
<div class="page">
  <div class="sheet">
    <div class="bg-wrap">
      <img class="bg" src="${WARRANTY_FORM_IMAGE_URL}" alt="Warranty form">
      <div class="field name line-right">${esc(name)}</div>
      <div class="field phone line-right">${esc(phone)}</div>
      <div class="field date line-center">${esc(dateStr)}</div>
      <div class="field seller line-center">${esc(sellerName)}</div>
      <div class="field product v-field line-center"><span>${esc(p.name)}</span></div>
      <div class="field specs v-field line-center"><span>${esc(specsValue)}</span></div>
      <div class="field color v-field line-center"><span>${esc(colorProd)}</span></div>
      <div class="field battery v-field line-center"><span>${esc(batteryValue)}</span></div>
      <div class="field imei v-field line-center"><span>${esc(imei || '-')}</span></div>
      <div class="field total line-center">${esc(priceFormatted)} DA</div>
      <div class="field duration line-right">${esc(duration)}</div>
    </div>
  </div>
</div>
</body></html>`;

  iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:297mm;height:210mm;border:none;visibility:hidden';
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument || iframe.contentWindow.document;
  doc.open();
  doc.write(iframe.srcdoc);
  doc.close();

  setTimeout(()=>{
    try{
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
    }catch(e){
      const w = window.open('', '_blank');
      if(w){
        w.document.write(iframe.srcdoc);
        w.document.close();
        w.onload = ()=>{
          w.print();
          setTimeout(()=>w.close(), 1000);
        };
      }
    }
    setTimeout(()=>{ if(iframe) iframe.remove(); }, 4000);
  }, 300);

  toast('تمت طباعة فاتورة الضمان');
}

let _printSelectionMode = false;

function togglePrintSelection(){
  _printSelectionMode = true;
  document.getElementById('print-selection-actions').style.display = 'flex';
  document.getElementById('btn-print-all').style.display = 'none';
  const th = document.getElementById('inv-check-th');
  if(th) th.style.display = 'table-cell';
  document.querySelectorAll('[id^="inv-check-td-"]').forEach(td=>td.style.display='table-cell');
}

function cancelPrintSelection(){
  _printSelectionMode = false;
  document.getElementById('print-selection-actions').style.display = 'none';
  document.getElementById('btn-print-all').style.display = 'inline-flex';
  const th = document.getElementById('inv-check-th');
  if(th) th.style.display = 'none';
  document.querySelectorAll('[id^="inv-check-td-"]').forEach(td=>td.style.display='none');
  document.querySelectorAll('.inv-select-cb').forEach(cb=>cb.checked=false);
  const allCb = document.getElementById('select-all-cb');
  if(allCb) allCb.checked = false;
}

function toggleSelectAll(checked){
  document.querySelectorAll('.inv-select-cb').forEach(cb=>cb.checked=checked);
}

function buildProductLabelPages(products){
  const buildId = Date.now();
  return products.map((p, index) => {
    const barcode = ensureStoredProductBarcode(p);
    const priceFormatted = Number(p.price).toLocaleString('fr-DZ');
    const specs = [p.ram, p.storage, p.battery].filter(Boolean).join(' | ');

    const tempSvg = document.createElementNS('http://www.w3.org/2000/svg','svg');
    tempSvg.id = `_bulk_svg_${buildId}_${index}`;
    tempSvg.style.cssText = 'position:absolute;top:-9999px';
    document.body.appendChild(tempSvg);

      try {
      JsBarcode(`#${tempSvg.id}`, barcode, {
        format:'EAN8',
        width: 1.48,
        height: 17,
        displayValue: true,
        fontSize: 8,
        fontOptions: 'bold',
        font: 'Arial',
        margin: 0,
        textMargin: 0.35,
        lineColor: '#222'
      });
      const svgHtml = tempSvg.outerHTML;
      tempSvg.remove();
      return { svgHtml, p, priceFormatted, specs };
    } catch(e) {
      tempSvg.remove();
      return null;
    }
  }).filter(Boolean);
}

function getProductLabelNameMarkup(name){
  const safeName = String(name || '');
  const len = safeName.length;
  let fontSize = 12;
  let scale = 1;

  if (len > 34) {
    fontSize = 8.2;
    scale = 0.9;
  } else if (len > 28) {
    fontSize = 9;
    scale = 0.93;
  } else if (len > 22) {
    fontSize = 10;
    scale = 0.96;
  } else if (len > 18) {
    fontSize = 11;
    scale = 0.98;
  }

  return `<div class="name" style="font-size:${fontSize}pt !important;transform:scaleX(${scale});transform-origin:center center;">${safeName}</div>`;
}

function getProductLabelFontUrl(fileName){
  return new URL(`../fonts/${fileName}`, window.location.href).href;
}

function getProductLabelFontFaceCss(){
  const agrandirUrl = getProductLabelFontUrl('Agrandir Wide Light 300.otf');

  return `
  @font-face {
    font-family: 'SJ Agrandir Price';
    src: url('${agrandirUrl}') format('opentype');
    font-style: normal;
    font-weight: 300;
    font-display: swap;
  }`;
}

function startBulkPrint(){
  const selected = [...document.querySelectorAll('.inv-select-cb:checked')].map(cb=>cb.dataset.id);
  if(!selected.length){ toast('⚠️ لم تحدد أي منتج','warn'); return; }
  const prods = DB.get('products');
  const selectedProds = selected.map(id=>prods.find(p=>p.id===id)).filter(Boolean);
  if(!selectedProds.length){ toast('⚠️ لم يُعثر على المنتجات المحددة','warn'); return; }

  waitForJsBarcode(()=>{
    cancelPrintSelection();
    toast(`↳ جاري تجهيز ${selectedProds.length} وثيقة...`);

    const pages = buildProductLabelPages(selectedProds);
    _doBulkPrint(pages);
    return;

    selectedProds.forEach((p, index) => {
      const barcode = ensureStoredProductBarcode(p);
      const priceFormatted = Number(p.price).toLocaleString('fr-DZ');
      const specs = [p.ram, p.storage, p.battery].filter(Boolean).join(' | ');

      const tempSvg = document.createElementNS('http://www.w3.org/2000/svg','svg');
      tempSvg.id = `_bulk_svg_${index}`;
      tempSvg.style.cssText = 'position:absolute;top:-9999px';
      document.body.appendChild(tempSvg);

      try {
        JsBarcode(`#_bulk_svg_${index}`, barcode, {
          format:'EAN8',
          width: 1.05,
          height: 18,
          displayValue: true,
          fontSize: 8.5,
          fontOptions: '',
          margin: 0,
          textMargin: 2,
          lineColor: '#333'
        });
        const svgHtml = tempSvg.outerHTML;
        tempSvg.remove();
        pages[index] = { svgHtml, p, priceFormatted, specs };
      } catch(e) {
        tempSvg.remove();
        pages[index] = null;
      }
      done++;

      if(done === selectedProds.length){
        _doBulkPrint(pages.filter(Boolean));
      }
    });
  });
}

function _doBulkPrint(pages){
  if(!pages.length){ toast('❌ لا توجد صفحات للطباعة','err'); return; }

  const pagesHTML = pages.map((pg, i) => `
    <div class="label-page">
      ${getProductLabelNameMarkup(pg.p.name)}
      ${pg.specs ? `<div class="specs">${pg.specs}</div>` : ''}
      <div class="bc">${pg.svgHtml}</div>
      <div class="price">${pg.priceFormatted} DA</div>
    </div>`).join('');

  const labelFontCss = getProductLabelFontFaceCss();
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>
  @page { size: 5cm 2.5cm; margin: 0; }
  ${labelFontCss}
  * { margin:0; padding:0; box-sizing:border-box; }
  html, body { background:#fff; font-family:'SJ Agrandir Price', 'Agrandir Grand', sans-serif; direction:rtl; }
  .label-page {
    width: calc(5cm - 4mm);
    height: 2.5cm;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-start;
    margin-left: 4mm;
    padding: 0.4mm 0.95mm 0 1.15mm;
    overflow: hidden;
    break-after: page;
    page-break-after: always;
    gap: 0.22mm;
  }
  .label-page:last-child { break-after: avoid; page-break-after: avoid; }
  .name  {
    font-size:12.2pt !important;
    font-size:12.7pt !important;
    font-weight:500;
    text-align:center;
    line-height:1;
    font-family:'SJ Agrandir Price', 'Agrandir Grand', sans-serif;
    margin-top:0.2mm;
    max-height: 5.1mm;
    white-space: nowrap;
    text-overflow: clip;
    overflow: hidden;
    width: 100%;
    display:block;
  }
  .specs {
    font-size:9.6pt;
    font-weight:400;
    text-align:center;
    color:#111;
    line-height:0.98;
    font-family:'SJ Agrandir Price', 'Agrandir Grand', sans-serif;
    max-height: 4.4mm;
    overflow: hidden;
    width: 100%;
    margin-bottom:0.25mm;
  }
  .bc    { width:100%; text-align:center; padding:0; margin-bottom:0.75mm; }
  .bc svg { width:100%; height:8.4mm; display:block; margin:0 auto; shape-rendering:geometricPrecision; }
  .bc svg text {
    font-family:Arial, sans-serif;
    font-weight:500;
    fill:#222;
    font-size:8.6pt;
    letter-spacing:0;
    text-rendering:geometricPrecision;
  }
  .price {
    font-size:13pt !important;
    font-weight:500;
    text-align:center;
    letter-spacing:0;
    font-family:'SJ Agrandir Price', 'Agrandir Grand', sans-serif !important;
    line-height:1;
    max-height: 3.8mm;
    overflow: hidden;
    width: 100%;
  }
  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .label-page { break-after: page; page-break-after: always; }
    .label-page:last-child { break-after: avoid; page-break-after: avoid; }
  }

@keyframes syncPulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.5;transform:scale(1.3)}}
/* ===== AUTH OVERLAY ===== */
#auth-overlay{
  position:fixed;inset:0;z-index:9999;
  background:#0A1628;
  display:flex;align-items:center;justify-content:center;
  transition:opacity .4s ease;
}
#auth-overlay.hide{opacity:0;pointer-events:none}
.auth-orb{position:absolute;border-radius:50%;filter:blur(90px);opacity:.12;animation:authFloat 9s ease-in-out infinite}
.auth-orb1{width:500px;height:500px;background:#00AEEF;top:-150px;right:-150px;animation-delay:0s}
.auth-orb2{width:350px;height:350px;background:#0068A0;bottom:-80px;left:-80px;animation-delay:3s}
.auth-orb3{width:250px;height:250px;background:#00D4FF;top:55%;left:45%;animation-delay:1.5s}
@keyframes authFloat{0%,100%{transform:translateY(0) scale(1)}50%{transform:translateY(-25px) scale(1.04)}}
.auth-grid{position:absolute;inset:0;background-image:linear-gradient(rgba(0,174,239,.04) 1px,transparent 1px),linear-gradient(90deg,rgba(0,174,239,.04) 1px,transparent 1px);background-size:44px 44px}
.auth-card{
  position:relative;z-index:10;width:430px;
  background:#0F1F38;border:1px solid #1E3050;border-radius:26px;padding:40px;
  box-shadow:0 32px 80px rgba(0,0,0,.6),0 0 0 1px rgba(0,174,239,.08),inset 0 1px 0 rgba(0,174,239,.1);
  animation:authSlideUp .5s cubic-bezier(.34,1.56,.64,1);
}
@keyframes authSlideUp{from{opacity:0;transform:translateY(30px) scale(.97)}to{opacity:1;transform:translateY(0) scale(1)}}
.auth-logo{text-align:center;margin-bottom:28px}
.auth-logo-circle{
  width:90px;height:90px;border-radius:50%;
  border:3px solid rgba(0,174,239,.35);
  display:flex;align-items:center;justify-content:center;
  margin:0 auto 14px;
  background:radial-gradient(circle at 40% 35%,#1a3a5c,#0a1628);
  box-shadow:0 0 0 6px rgba(0,174,239,.08),0 8px 30px rgba(0,0,0,.5);
  overflow:hidden;transition:.3s;
}
.auth-logo-circle img{width:86px;height:86px;border-radius:50%;object-fit:cover}
.auth-logo h1{font-size:22px;font-weight:900;color:#E8F4FF;letter-spacing:.5px}
.auth-logo p{font-size:12px;color:#3A5A7A;margin-top:4px;font-weight:500}
.auth-badge{display:inline-block;background:rgba(0,174,239,.1);border:1px solid rgba(0,174,239,.2);color:#00AEEF;font-size:10px;font-weight:700;padding:2px 10px;border-radius:20px;margin-top:6px;letter-spacing:.5px}
.auth-tabs{display:flex;gap:4px;background:#0A1628;padding:4px;border-radius:12px;margin-bottom:26px;border:1px solid #1E3050}
.auth-tab{flex:1;padding:9px;border:none;border-radius:9px;font-family:'Cairo',sans-serif;font-size:13px;font-weight:600;cursor:pointer;transition:.2s;background:transparent;color:#3A5A7A}
.auth-tab.active{background:linear-gradient(135deg,#00AEEF,#0068A0);color:#fff;box-shadow:0 4px 14px rgba(0,174,239,.3)}
.auth-sec{display:none}.auth-sec.active{display:block}
.auth-fg{margin-bottom:15px}
.auth-label{display:block;font-size:12px;font-weight:600;color:#7EB8D4;margin-bottom:6px}
.auth-input{width:100%;padding:12px 14px;background:#162540;border:1.5px solid #1E3050;border-radius:10px;font-family:'Cairo',sans-serif;font-size:14px;color:#E8F4FF;outline:none;transition:.2s}
.auth-input:focus{border-color:#00AEEF;box-shadow:0 0 0 3px rgba(0,174,239,.12);background:#1a2e48}
.auth-input::placeholder{color:#3A5A7A}
.auth-pwd-wrap{position:relative}
.auth-pwd-toggle{position:absolute;left:12px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;color:#3A5A7A;font-size:15px;padding:4px}
.auth-btn{width:100%;padding:13px;background:linear-gradient(135deg,#00AEEF,#0068A0);color:#fff;border:none;border-radius:10px;font-family:'Cairo',sans-serif;font-size:14px;font-weight:700;cursor:pointer;transition:.25s;margin-top:8px;box-shadow:0 4px 18px rgba(0,174,239,.3)}
.auth-btn:hover{transform:translateY(-1px);box-shadow:0 7px 24px rgba(0,174,239,.4)}
.auth-btn:disabled{opacity:.55;cursor:not-allowed;transform:none}
.auth-link-btn{background:none;border:none;color:#00AEEF;font-family:'Cairo',sans-serif;font-size:12px;font-weight:600;cursor:pointer;text-decoration:underline;padding:0}
.auth-msg{padding:10px 14px;border-radius:8px;font-size:12.5px;font-weight:600;margin-bottom:14px;display:none;animation:authFadeIn .3s ease;line-height:1.5}
.auth-msg.show{display:block}
.auth-msg-err{background:rgba(229,62,62,.12);color:#FC8181;border:1px solid rgba(229,62,62,.25)}
.auth-msg-ok{background:rgba(56,161,105,.12);color:#68D391;border:1px solid rgba(56,161,105,.25)}
.auth-msg-info{background:rgba(0,174,239,.12);color:#00CFFF;border:1px solid rgba(0,174,239,.25)}
@keyframes authFadeIn{from{opacity:0;transform:translateY(-5px)}to{opacity:1;transform:translateY(0)}}
.auth-forgot-row{text-align:left;margin-top:-8px;margin-bottom:14px}
.auth-spinner{display:inline-block;width:15px;height:15px;border:2px solid rgba(255,255,255,.3);border-top-color:#fff;border-radius:50%;animation:authSpin .7s linear infinite;vertical-align:middle;margin-right:6px}
@keyframes authSpin{to{transform:rotate(360deg)}}
.auth-verify{background:rgba(0,174,239,.08);border:1px solid rgba(0,174,239,.2);border-radius:12px;padding:18px;text-align:center;margin-bottom:16px}
.auth-verify .icon{font-size:34px;margin-bottom:10px}
.auth-verify p{font-size:12.5px;color:#7EB8D4;line-height:1.7}
.auth-verify b{color:#E8F4FF}
.auth-ver-actions{display:flex;gap:10px;margin-top:12px;justify-content:center;flex-wrap:wrap}
</style>
</head><body>${pagesHTML}</body></html>`;

  if(window.require){
    try{
      const { ipcRenderer } = window.require('electron');
      ipcRenderer.send('bulk-print', html);
      toast(`✅ تم إرسال ${pages.length} ورقة للطباعة`);
      return;
    }catch(e){}
  }

  let iframe = document.getElementById('_bulk_print_frame');
  if(iframe) iframe.remove();
  iframe = document.createElement('iframe');
  iframe.id = '_bulk_print_frame';
  iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:5cm;height:2.5cm;border:none;visibility:hidden';
  document.body.appendChild(iframe);
  const doc = iframe.contentDocument || iframe.contentWindow.document;
  doc.open(); doc.write(html); doc.close();
  setTimeout(()=>{
    try{ iframe.contentWindow.focus(); iframe.contentWindow.print(); }
    catch(e){ const w=window.open('','_blank'); if(w){ w.document.write(html); w.document.close(); w.onload=()=>{ w.print(); setTimeout(()=>w.close(),2000); }; } }
    setTimeout(()=>{ if(iframe) iframe.remove(); }, 5000);
    toast(`✅ تم طباعة ${pages.length} ملصق`);
  }, 500);
}

function printProductsSequence(prods, index){
  if(index >= prods.length){ toast(`✅ تمت الطباعة`); return; }
  _printProd = prods[index];
  printProductLabel();
  setTimeout(()=>printProductsSequence(prods, index+1), 2000);
}

function printProductLabel(){
  if(!_printProd) return;
  waitForJsBarcode(() => {
    const p = _printProd;
    const priceFormatted = Number(p.price).toLocaleString('fr-DZ');
    const specs = [p.ram, p.storage, p.battery].filter(Boolean).join(' | ');
    const barcode = ensureStoredProductBarcode(p);

    const tempSvg = document.createElementNS('http://www.w3.org/2000/svg','svg');
    tempSvg.id = '_temp_label_bc';
    tempSvg.style.cssText = 'position:absolute;top:-9999px';
    document.body.appendChild(tempSvg);

    try {
      JsBarcode('#_temp_label_bc', barcode, {
        format:'EAN8',
        width: 1.48,
        height: 17,
        displayValue: true,
        fontSize: 8,
        fontOptions: 'bold',
        font: 'Arial',
        margin: 0,
        textMargin: 0.35,
        lineColor: '#222'
      });
      const svgHtml = tempSvg.outerHTML;
      tempSvg.remove();

      const labelFontCss = getProductLabelFontFaceCss();
      const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>
  @page { size: 5cm 2.5cm; margin: 0; }
  ${labelFontCss}
  * { margin:0; padding:0; box-sizing:border-box; }
  html, body {
    width: 5cm; height: 2.5cm;
    overflow: hidden;
    font-family: 'SJ Agrandir Price', 'Agrandir Grand', sans-serif;
    background: #fff;
    direction: rtl;
  }
  .wrap {
    width: calc(5cm - 4mm);
    height: 2.5cm;
    display: flex; flex-direction: column;
    align-items: center; justify-content: flex-start;
    gap: 0.22mm;
    margin-left: 4mm;
    padding: 0.4mm 0.95mm 0 1.15mm;
  }
  .name  {
    font-size: 12.2pt !important;
    font-size: 12.7pt !important;
    font-weight: 500;
    text-align: center;
    line-height: 1;
    font-family: 'SJ Agrandir Price', 'Agrandir Grand', sans-serif;
    margin-top:0.2mm;
    max-height: 5.1mm;
    white-space: nowrap;
    text-overflow: clip;
    overflow: hidden;
    width: 100%;
    display:block;
  }
  .specs {
    font-size: 9.6pt;
    font-weight: 400;
    text-align: center;
    color: #222;
    line-height: 0.98;
    font-family: 'SJ Agrandir Price', 'Agrandir Grand', sans-serif;
    max-height: 4.4mm;
    overflow: hidden;
    width: 100%;
    margin-bottom:0.25mm;
  }
  .bc    { width:100%; text-align:center; margin-bottom:0.75mm; }
  .bc svg{
    width:100% !important;
    height:8.4mm !important;
    display:block;
    margin:0 auto;
    shape-rendering:geometricPrecision;
  }
  .bc svg text {
    font-family: Arial, sans-serif;
    font-weight: 500;
    fill: #222;
    font-size: 8.6pt;
    letter-spacing: 0;
    text-rendering: geometricPrecision;
  }
  .price {
    font-size: 13pt !important;
    font-weight: 500;
    text-align: center;
    letter-spacing: 0;
    font-family: 'SJ Agrandir Price', 'Agrandir Grand', sans-serif !important;
    line-height: 1;
    max-height: 3.8mm;
    overflow: hidden;
    width: 100%;
  }
</style></head><body><div class="wrap">
  ${getProductLabelNameMarkup(p.name)}
  ${specs ? `<div class="specs">${specs}</div>` : ''}
  <div class="bc">${svgHtml}</div>
  <div class="price">${priceFormatted} DA</div>
</div></body></html>`;

      let iframe = document.getElementById('print-label-iframe');
      if(iframe) iframe.remove();
      iframe = document.createElement('iframe');
      iframe.id = 'print-label-iframe';
      iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:5cm;height:2.5cm;border:none;visibility:hidden';
      document.body.appendChild(iframe);
      const doc = iframe.contentDocument || iframe.contentWindow.document;
      doc.open(); doc.write(html); doc.close();
      setTimeout(()=>{
        try{ iframe.contentWindow.focus(); iframe.contentWindow.print(); }
        catch(e){
          const w = window.open('','_blank');
          if(w){ w.document.write(html); w.document.close();
            w.onload=()=>{ w.print(); setTimeout(()=>w.close(),800); }; }
        }
        setTimeout(()=>{ if(iframe) iframe.remove(); },3000);
      },400);

    } catch(e) {
      tempSvg.remove();
      toast('❌ خطأ في الباركود','err');
    }
  });
}


function waitForJsBarcode(cb) {
  if (typeof JsBarcode !== 'undefined') { cb(); return; }
  let attempts = 0;
  const interval = setInterval(() => {
    attempts++;
    if (typeof JsBarcode !== 'undefined') {
      clearInterval(interval);
      cb();
    } else if (attempts > 30) {
      clearInterval(interval);
      toast('❌ تعذر تحويل مكتبة الباركود، تحقق من الاتصال بالإنترنت', 'err');
    }
  }, 200);
}

function printProductBarcode(){
  if(!_printProd) return;
  waitForJsBarcode(() => {
  closeModal('print-choice-ov');
  const p = _printProd;
  const priceFormatted = Number(p.price).toLocaleString('fr-DZ');
  const barcodeData = [p.name, p.desc||'', priceFormatted+' DA', p.note||'']
    .filter(Boolean).join(' | ');
  const tempSvg = document.createElementNS('http://www.w3.org/2000/svg','svg');
  tempSvg.id = '_temp_bc';
  tempSvg.style.cssText = 'position:absolute;top:-9999px';
  document.body.appendChild(tempSvg);
  try{
    JsBarcode('#_temp_bc', p.barcode||'SJ000', {
      format:'CODE128', width:1.8, height:35,
      displayValue:true, fontSize:9, margin:2
    });
    const svgHtml = tempSvg.outerHTML;
    tempSvg.remove();
    const html = `<div style="direction:rtl;font-family:Arial,sans-serif;padding:2px;text-align:center;width:52mm">
      <div style="font-size:10px;font-weight:700;margin-bottom:1px">${p.name}</div>
      ${p.note ? `<div style="font-size:9px;margin-bottom:1px">${p.note}</div>` : ''}
      ${svgHtml}
      <div style="font-size:10px;font-weight:900;margin-top:1px">${priceFormatted} DA</div>
    </div>`;
    doPrint(html, '5.2cm', '2cm');
  }catch(e){
    tempSvg.remove();
    toast('❌ خطأ في الباركود','err');
  }
  }); // waitForJsBarcode
}

function renderInventory(){
  const q = document.getElementById('inv-search').value.trim().toLowerCase();
  let prods = DB.get('products');
  if(q) prods = prods.filter(p=>
    (p.name||'').toLowerCase().includes(q) ||
    (p.barcode||'').toLowerCase().includes(q) ||
    (p.desc||'').toLowerCase().includes(q) ||
    (p.ram||'').toLowerCase().includes(q) ||
    (p.storage||'').toLowerCase().includes(q) ||
    (p.color||'').toLowerCase().includes(q)
  );

  const tbody = document.getElementById('inv-tbody');
  const empty = document.getElementById('inv-empty');
  document.getElementById('inv-count').textContent = prods.length + ' منتج';

  if(!prods.length){
    tbody.innerHTML='';
    empty.style.display='block';
    return;
  }
  empty.style.display='none';

  tbody.innerHTML = prods.map(p=>{
    const imgEl = `<div class="prod-img-placeholder">📱</div>`;

    const stockClass = p.qty<=0?'stock-zero': p.qty<=3?'stock-low':'stock-ok';
    const stockLabel = p.qty<=0?'نفد المخزون': p.qty<=3?'مخزون منخفض':'متوفر';

    return `<tr>
      <td id="inv-check-td-${p.id}" style="display:none;text-align:center;width:40px">
        <input type="checkbox" class="inv-select-cb" data-id="${p.id}" style="width:16px;height:16px;cursor:pointer">
      </td>
      <td>
        <div style="display:flex;align-items:center;gap:12px">
          ${imgEl}
          <div class="prod-info">
            <div class="prod-name">${p.name}${p.productType==='kapa'?'<span style="margin-right:6px;background:#EDE9FE;color:#5B4FCF;border-radius:6px;padding:2px 7px;font-size:10px;font-weight:700">📱 كابا</span>':''}</div>
            ${p.productType==='kapa'&&(p.ram||p.storage||p.battery)?`<div class="prod-desc" style="color:var(--primary);font-size:10.5px">${[p.ram,p.storage,p.battery,p.color].filter(Boolean).join(' | ')}</div>`:''}
            <div class="prod-serial">🗂️ ${p.barcode||'--'}</div>
          </div>
        </div>
      </td>
      <td style="text-align:center">
        <div style="font-size:16px;font-weight:800;color:var(--text-dark)">${p.qty||0}</div>
        <span class="stock-badge ${stockClass}">${stockLabel}</span>
      </td>
      <td style="font-weight:700;color:var(--primary);font-size:14px">${fmt(p.price)}</td>
      <td style="font-size:12px;color:var(--text-gray)">${p.date ? new Date(p.date).toLocaleDateString('ar-DZ') : '--'}</td>
      <td>
        <div class="act-btns" style="justify-content:center">
          <button class="ibtn ibtn-purple" title="طباعة" onclick="openPrintChoice('${p.id}')">🖨️</button>
          <button class="ibtn ibtn-blue" title="تعديل" onclick="openInvModal('${p.id}')">✔️</button>
          <button class="ibtn ibtn-red" title="حذف" onclick="deleteProduct('${p.id}')">🚱</button>
        </div>
      </td>
    </tr>`;
  }).join('');
}



// ===== دالة طباعة وثيقة الضمان =====
// الحقول المقترحة في HTML:
// warr-name, warr-phone, warr-color, warr-imei, warr-duration
// بيانات العميل تأتي من الكائن p (name, ram, storage, battery, price)
const WARRANTY_LOGO_LEFT = 'assets/warranty-logo-left.png';
const WARRANTY_LOGO_RIGHT = 'assets/warranty-logo-right.png';

async function printWarranty(p) {
  const product = p || (typeof _posProd !== 'undefined' ? _posProd : null);
  if (!product) {
    toast('اختر منتج الضمان أولاً', 'err');
    return;
  }

  const esc = v => String(v ?? '').replace(/[&<>"']/g, s => ({
    '&':'&amp;',
    '<':'&lt;',
    '>':'&gt;',
    '"':'&quot;',
    "'":'&#39;'
  }[s]));

  // قراءة البيانات من حقول الواجهة
  const name     = document.getElementById('warr-name').value.trim();
  const phone    = document.getElementById('warr-phone').value.trim();
  const color    = document.getElementById('warr-color').value.trim();
  const imei     = document.getElementById('warr-imei').value.trim();
  const duration = document.getElementById('warr-duration').value.trim();

  if (!name)    { toast('أدخل اسم الزبون', 'err'); return; }
  if (!duration){ toast('أدخل مدة الضمان', 'err');  return; }

  // بيانات ديناميكية
  const today       = new Date();
  const dateStr     = `${today.getDate()}/${today.getMonth()+1}/${today.getFullYear()}`;
  const priceFmt    = Number(product.price || 0).toLocaleString('fr-DZ');
  const specsLine   = [product.ram, product.storage].filter(Boolean).join(' / ');

  // الصور مضمّنة بكود base64
  const IMG_QR = 'assets/warranty-qr.png';

  // بناء HTML الوثيقة كاملة
  const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;900&display=swap" rel="stylesheet">
<style>
  :root { --blue:#2c4a73; --border:#5d7c90; --bg:#f0f2f5; }
  @page { size:A4 landscape; margin:0; }
  * { margin:0; padding:0; box-sizing:border-box; }
  body { width:29.7cm; height:21cm; font-family:'Cairo',sans-serif; background:#fff; overflow:hidden; display:flex; justify-content:flex-start; align-items:flex-start; }
  .page { width:13.4cm; height:20.6cm; padding:0.35cm 0.3cm 0.7cm; box-sizing:border-box; margin-top:0.15cm; display:flex; flex-direction:column; }

  /* رأس الصفحة */
  .hdr { display:flex; justify-content:center; align-items:center; margin-bottom:4px; }
  .logo { width:2.2cm; height:2.2cm; object-fit:contain; background:transparent; }
  .hdr-mid { text-align:center; flex:0 1 auto; margin:0 0.55cm; }
  .hdr-mid h1 { font-size:28pt; margin:0; font-weight:900; color:var(--blue); font-style:italic; letter-spacing:-1px; }
  .hdr-mid p { font-size:8pt; margin:1px 0; color:#333; font-weight:600; font-family:'Celandine','Cairo',sans-serif; }

  /* شريط التواصل */
  .contact { display:flex; justify-content:space-between; border-top:1px solid var(--border); border-bottom:1px solid var(--border); padding:5px 0; margin:4px 0 7px; font-size:10.5pt; font-weight:700; flex-wrap:wrap; gap:4px; }
  .ci { display:flex; align-items:center; gap:4px; }
  .ci svg { width:18px; height:18px; display:block; flex:none; }

  /* عنوان الفاتورة */
  .inv-title { text-align:center; margin-bottom:8px; }
  .inv-title-box { display:inline-block; background:var(--bg); border:2px solid var(--border); border-radius:8px; padding:3px 16px; font-size:13pt; font-weight:900; color:var(--blue); }

  /* حقول الزبون */
  .fields { display:grid; grid-template-columns:1fr 1fr; gap:7px 14px; margin-bottom:10px; }
  .frow { display:flex; align-items:flex-end; gap:3px; }
  .flbl { font-weight:900; font-size:9pt; white-space:nowrap; color:#111; }
  .fval { flex:1; border-bottom:1.5px dotted #888; font-size:9pt; color:#000; padding-bottom:1px; min-height:3.5mm; }

  /* جدول المواصفات */
  table { width:100%; border-collapse:separate; border-spacing:2px; margin-top:20px; margin-bottom:0; }
  td { border:1.5px solid var(--border); height:46px; padding:0 8px; vertical-align:middle; }
  .lbl { background:var(--bg); width:38%; text-align:center; font-weight:900; font-size:9.5pt; color:var(--blue); }
  .val { width:62%; text-align:center; font-weight:700; font-size:9.5pt; color:#000; }

  /* المبلغ */
  .total { border:1.5px solid var(--border); width:7.5cm; margin:12px auto 2px; display:flex; padding:5px 12px; justify-content:space-between; align-items:center; border-radius:5px; }
  .tlbl { font-weight:900; font-size:11pt; color:#111; }
  .tval { font-size:12pt; font-weight:900; color:#000; border-bottom:1px dotted #888; min-width:2.5cm; text-align:center; }

  /* قسم الضمان */
  .footer { display:grid; grid-template-columns:3.2cm 1fr; gap:8px; margin-top:12px; }
  .qr-box { border:1.5px solid var(--border); border-radius:10px; padding:6px; text-align:center; display:flex; flex-direction:column; align-items:center; }
  .qr-title { font-size:9.5pt; font-weight:900; color:var(--blue); margin-bottom:4px; }
  .qr-img { width:2.2cm; height:2.2cm; object-fit:contain; }
  .scan { background:var(--border); color:#fff; font-size:7.5pt; padding:2px 8px; border-radius:4px; font-weight:900; margin-top:4px; display:inline-block; }
  .warr-box { border:1.5px solid var(--border); border-radius:10px; padding:10px; }
  .wlbl { font-weight:900; font-size:9.5pt; color:#111; }
  .wval { margin-top:12px; border-bottom:1px dotted #888; font-size:13pt; font-weight:900; color:#000; min-height:5mm; }

  @media print { body { -webkit-print-color-adjust:exact; print-color-adjust:exact; } }
</style>
</head>
<body><div class="page">

  <!-- رأس -->
  <div class="hdr">
    <img class="logo" src="${WARRANTY_LOGO_LEFT}" alt="">
    <div class="hdr-mid">
      <h1>SJ Store</h1>
      <p>Vente et Réparation des téléphones portables</p>
      <p>et pièces informatiques</p>
    </div>
    <img class="logo" src="${WARRANTY_LOGO_RIGHT}" alt="">
  </div>

  <!-- شريط التواصل -->
  <div class="contact">
    <span class="ci">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#2c4a73" d="M6.62 10.79a15.05 15.05 0 0 0 6.59 6.59l2.2-2.2a1 1 0 0 1 1.01-.24c1.11.37 2.3.56 3.52.56a1 1 0 0 1 1 1V20a1 1 0 0 1-1 1C10.3 21 3 13.7 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.22.19 2.41.56 3.52a1 1 0 0 1-.24 1.01l-2.2 2.26Z"/></svg>
      06.69.30.75.93
    </span>
    <span class="ci">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#d6249f" d="M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5Zm0 2.2A2.8 2.8 0 0 0 4.2 7v10A2.8 2.8 0 0 0 7 19.8h10a2.8 2.8 0 0 0 2.8-2.8V7A2.8 2.8 0 0 0 17 4.2H7Zm10.25 1.65a1.1 1.1 0 1 1 0 2.2 1.1 1.1 0 0 1 0-2.2ZM12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10Zm0 2.2a2.8 2.8 0 1 0 0 5.6 2.8 2.8 0 0 0 0-5.6Z"/></svg>
      siraj_store28
    </span>
    <span class="ci">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#1877f2" d="M13.5 22v-8h2.7l.4-3h-3.1V9.1c0-.9.3-1.6 1.6-1.6H17V4.8c-.3 0-1.2-.1-2.3-.1-2.3 0-3.9 1.4-3.9 4V11H8v3h2.5v8h3Z"/></svg>
      SJ Store
    </span>
    <span class="ci">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#e44d26" d="M12 2a7 7 0 0 1 7 7c0 4.97-7 13-7 13S5 13.97 5 9a7 7 0 0 1 7-7Zm0 9.5A2.5 2.5 0 1 0 12 6.5a2.5 2.5 0 0 0 0 5Z"/></svg>
      Ain El Hadjel, M'sila
    </span>
  </div>

  <!-- عنوان -->
  <div class="inv-title"><span class="inv-title-box">فاتـــورة شراء</span></div>

  <!-- بيانات الزبون -->
  <div class="fields">
    <div class="frow"><span class="flbl">اسم الزبون :</span><span class="fval">${esc(name)}</span></div>
    <div class="frow"><span class="flbl">تاريخ الفاتورة :</span><span class="fval">${esc(dateStr)}</span></div>
    <div class="frow"><span class="flbl">رقم الهاتف :</span><span class="fval">${esc(phone)}</span></div>
    <div class="frow"><span class="flbl">اسم البائع :</span><span class="fval">SJ STORE</span></div>
  </div>

  <!-- جدول المواصفات -->
  <table>
    <tr><td class="val">${esc(product.name)}</td><td class="lbl">نوع الجهاز</td></tr>
    <tr><td class="val">${esc(specsLine)}</td><td class="lbl">السعة</td></tr>
    <tr><td class="val">${esc(color)}</td><td class="lbl">اللون</td></tr>
    <tr><td class="val">${esc(product.battery || '')}</td><td class="lbl">نسبة البطارية</td></tr>
    <tr><td class="val">${esc(imei)}</td><td class="lbl">IMEI</td></tr>
  </table>

  <!-- المبلغ -->
  <div class="total">
    <span class="tlbl">المبلغ الإجمالي :</span>
    <span class="tval">${esc(priceFmt)} DA</span>
  </div>

  <!-- الضمان -->
  <div class="footer">
    <div class="qr-box">
      <div class="qr-title">دليل الضمان</div>
      <img class="qr-img" src="${IMG_QR}" alt="QR">
      <span class="scan">SCAN HERE</span>
    </div>
    <div class="warr-box">
      <div class="wlbl">مدة الضمان :</div>
      <div class="wval">${esc(duration)}</div>
    </div>
  </div>

</div></body></html>`;

  // طباعة عبر iframe مخفي
  let iframe = document.getElementById('_warranty_iframe');
  if (iframe) iframe.remove();
  iframe = document.createElement('iframe');
  iframe.id = '_warranty_iframe';
  iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:29.7cm;height:21cm;border:none;visibility:hidden';
  document.body.appendChild(iframe);
  const doc = iframe.contentDocument || iframe.contentWindow.document;
  doc.open(); doc.write(html); doc.close();
  setTimeout(() => {
    try { iframe.contentWindow.focus(); iframe.contentWindow.print(); }
    catch (e) {
      const w = window.open('', '_blank');
      if (w) { w.document.write(html); w.document.close(); w.onload = () => { w.print(); setTimeout(() => w.close(), 1000); }; }
    }
    setTimeout(() => { if (iframe) iframe.remove(); }, 4000);
  }, 600);
  toast('✅ تمت طباعة فاتورة الضمان');
}
