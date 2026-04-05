// ====== barcode.js — قارئ الباركود ======

// ====== BARCODE SCANNER INTEGRATION ======
let _activeScannerField = null;
let _activeScannerMode = 'field';
let _scannerBuffer = '';
let _scannerTimer = null;

function activateBarcodeScanner(fieldId, mode = 'field') {
  _activeScannerField = fieldId;
  _activeScannerMode = mode || 'field';
  _scannerBuffer = '';
  const ind = document.getElementById('barcode-scanner-indicator');
  if (ind) { ind.style.display = 'flex'; }
  // Focus hidden input to capture keyboard events from scanner
  document.addEventListener('keydown', _handleScannerKey);
  toast('📷 مرر قارئ الباركود الآن...', 'ok');
}

function deactivateBarcodeScanner() {
  _activeScannerField = null;
  _activeScannerMode = 'field';
  _scannerBuffer = '';
  if (_scannerTimer) clearTimeout(_scannerTimer);
  const ind = document.getElementById('barcode-scanner-indicator');
  if (ind) ind.style.display = 'none';
  document.removeEventListener('keydown', _handleScannerKey);
}

function _handleScannerKey(e) {
  if (!_activeScannerField) return;
  if (e.key === 'Enter') {
    if (_scannerBuffer.length >= 6) {
      const barcode = _scannerBuffer.trim();
      if (_activeScannerMode === 'cashier') {
        bcCashier(barcode);
        toast('OK: ' + barcode);
      } else if (_activeScannerMode === 'pos') {
        bcPOS(barcode);
        toast('OK: ' + barcode);
      } else {
        const field = document.getElementById(_activeScannerField);
        if (field) {
          field.value = barcode;
          field.dispatchEvent(new Event('input'));
          toast('OK: ' + barcode);
        }
      }
    }
    deactivateBarcodeScanner();
    e.preventDefault();
  } else if (e.key.length === 1) {
    _scannerBuffer += e.key;
    if (_scannerTimer) clearTimeout(_scannerTimer);
    _scannerTimer = setTimeout(() => {
      if (_scannerBuffer.length < 6) { _scannerBuffer = ''; }
    }, 100);
  }
}

// ================================================================
//  نظام قارئ الباركود العالمي
// ================================================================
(function initBarcodeScanner() {
  let _bcBuffer = '';
  let _bcTimer  = null;
  const BC_TIMEOUT = 80; // ms بين الأحرف — القارئ سريع جداً

  document.addEventListener('keydown', function(e) {
    // تجاهل إذا كان المستخدم يكتب في حقل نص
    const tag = document.activeElement?.tagName;
    const activeId = document.activeElement?.id;
    // في الكاشير: إذا كان حقل البحث نشطاً نتركه يعمل بشكله الطبيعي
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
      // لكن إذا كان القارئ يكتب في cashier-search نتركه
      if (activeId !== 'cashier-search') return;
    }
    // تجاهل إذا كانت نافذة Auth مفتوحة
    const authOv = document.getElementById('auth-overlay');
    if (authOv && authOv.style.display !== 'none') return;

    if (e.key === 'Enter') {
      if (_bcBuffer.length >= 4) {
        handleBarcodeScanned(_bcBuffer.trim());
      }
      _bcBuffer = '';
      clearTimeout(_bcTimer);
      return;
    }

    // قبول الأرقام والحروف فقط
    if (e.key.length === 1) {
      _bcBuffer += e.key;
      clearTimeout(_bcTimer);
      _bcTimer = setTimeout(() => { _bcBuffer = ''; }, BC_TIMEOUT * 10);
    }
  });
})();

// ================================================================
//  معالجة الباركود حسب الواجهة الحالية
// ================================================================
function handleBarcodeScanned(barcode) {
  const activePage = document.querySelector('.page.active');
  if (!activePage) return;
  const pageId = activePage.id;

  if      (pageId === 'page-inventory')    bcInventory(barcode);
  else if (pageId === 'page-pos')          bcPOS(barcode);
  else if (pageId === 'page-cashier')      bcCashier(barcode);
  else if (pageId === 'page-debts')        bcDebts(barcode);
  else if (pageId === 'page-installments') bcInstallments(barcode);
  else if (pageId === 'page-repairs')      bcRepairs(barcode);
}

// ================================================================
//  باركود — إدارة المخزون
// ================================================================
function bcInventory(barcode) {
  const prods = DB.get('products');
  const p = prods.find(x => (x.barcode||'') === barcode);
  if (p) {
    // منتج موجود → افتح نافذة التعديل مباشرة
    openInvModal(p.id);
  } else {
    // منتج غير موجود → نافذة تسأل
    showBcNotFound('المنتج غير موجود في المخزون', barcode, () => {
      closeModal('bc-notfound-ov');
      openModal('prod-type-ov');
    });
  }
}

// ================================================================
//  باركود — نقطة البيع
// ================================================================
function bcPOS(barcode) {
  const prods = DB.get('products');
  const p = prods.find(x => (x.barcode||'') === barcode);
  if (!p) {
    showBcNotFound('المنتج غير موجود في المخزون', barcode, () => {
      closeModal('bc-notfound-ov');
      goPage('inventory', document.getElementById('btn-inventory'));
      setTimeout(() => openModal('prod-type-ov'), 300);
    });
    return;
  }
  if ((p.qty||0) <= 0) {
    showBcAlert('⚠️ نفد المخزون', `المنتج <b>${p.name}</b> نفد من المخزون`, 'warn');
    return;
  }
  // منتج موجود ومتوفر → افتح نافذة البيع
  openSale(p.id);
}

// ================================================================
//  باركود — الكاشير
// ================================================================
function bcCashier(barcode) {
  const prods = DB.get('products');
  const p = prods.find(x => (x.barcode||'') === barcode);
  if (!p) {
    showBcNotFound('المنتج غير موجود في المخزون', barcode, () => {
      closeModal('bc-notfound-ov');
      goPage('inventory', document.getElementById('btn-inventory'));
      setTimeout(() => openModal('prod-type-ov'), 300);
    });
    return;
  }
  if ((p.qty||0) <= 0) {
    showBcAlert('⚠️ نفد المخزون', `المنتج <b>${p.name}</b> نفد من المخزون`, 'warn');
    return;
  }
  // إضافة مباشرة للسلة
  addToCashier(p.id);
}

// ================================================================
//  باركود — سجل الديون
// ================================================================
function bcDebts(barcode) {
  const debts = DB.get('debts');
  const d = debts.find(x => (x.barcode13||'') === barcode);
  if (!d) return; // تجاهل إذا غير موجود

  if (d.status === 'closed' || (d.remaining||0) <= 0) {
    showBcAlert('✅ تم التسديد', `الزبون <b>${d.customerName}</b> دفع كل ديونه بالكامل`, 'ok');
    return;
  }
  // فتح نافذة خيارات الدفع
  showBcDebtOptions(d);
}

// ================================================================
//  باركود — زبائن التقسيط
// ================================================================
function bcInstallments(barcode) {
  const insts = DB.get('installments');
  const inst = insts.find(x => (x.barcode13||'') === barcode);
  if (!inst) return;

  if (inst.status === 'closed' || (inst.remaining||0) <= 0) {
    showBcAlert('✅ انتهى التقسيط', `الزبون <b>${inst.customerName}</b> أتم كل أقساطه بالكامل`, 'ok');
    return;
  }
  showBcInstOptions(inst);
}

// ================================================================
//  باركود — تصليح الأعطال
// ================================================================
function bcRepairs(barcode) {
  const reps = DB.get('repairs');
  const r = reps.find(x => (x.barcode13||'') === barcode);
  if (!r) return;

  if (r.paid) {
    showBcAlert('✅ مدفوع', `الزبون <b>${r.customerName}</b> دفع مسبقاً`, 'ok');
    return;
  }
  // فتح نافذة تسجيل الدفع
  _repTarget = r;
  openModal('rep-paid-ov');
  document.getElementById('rpaid-customer').textContent  = r.customerName;
  document.getElementById('rpaid-device').textContent    = r.device;
  document.getElementById('rpaid-siraj').textContent     = fmt(r.profitSiraj);
  document.getElementById('rpaid-anis').textContent      = fmt(r.profitAnis);
}

// ================================================================
//  نوافذ مساعدة للباركود
// ================================================================

// نافذة "غير موجود" مع زر إضافة
function showBcNotFound(msg, barcode, onAdd) {
  let ov = document.getElementById('bc-notfound-ov');
  if (!ov) {
    ov = document.createElement('div');
    ov.id = 'bc-notfound-ov';
    ov.className = 'modal-overlay';
    ov.innerHTML = `
      <div class="modal" style="max-width:360px;text-align:center">
        <div style="font-size:40px;margin-bottom:12px">🔍</div>
        <div id="bc-nf-msg" style="font-size:15px;font-weight:700;color:var(--text-dark);margin-bottom:6px"></div>
        <div id="bc-nf-code" style="font-size:12px;color:var(--text-gray);margin-bottom:20px;font-family:monospace"></div>
        <div style="display:flex;gap:10px">
          <button class="btn btn-primary" style="flex:1" id="bc-nf-add-btn">➕ إضافة منتج</button>
          <button class="btn" style="flex:1;background:var(--bg)" onclick="closeModal('bc-notfound-ov')">إلغاء</button>
        </div>
      </div>`;
    document.body.appendChild(ov);
  }
  document.getElementById('bc-nf-msg').textContent  = msg;
  document.getElementById('bc-nf-code').textContent = 'الباركود: ' + barcode;
  document.getElementById('bc-nf-add-btn').onclick  = onAdd;
  openModal('bc-notfound-ov');
}

// نافذة تنبيه بسيطة
function showBcAlert(title, msgHtml, type='ok') {
  let ov = document.getElementById('bc-alert-ov');
  if (!ov) {
    ov = document.createElement('div');
    ov.id = 'bc-alert-ov';
    ov.className = 'modal-overlay';
    ov.innerHTML = `
      <div class="modal" style="max-width:340px;text-align:center">
        <div id="bc-alert-icon" style="font-size:44px;margin-bottom:12px"></div>
        <div id="bc-alert-title" style="font-size:16px;font-weight:800;margin-bottom:8px"></div>
        <div id="bc-alert-msg" style="font-size:13px;color:var(--text-gray);margin-bottom:20px;line-height:1.6"></div>
        <button class="btn btn-primary" style="width:100%" onclick="closeModal('bc-alert-ov')">حسناً</button>
      </div>`;
    document.body.appendChild(ov);
  }
  document.getElementById('bc-alert-icon').textContent  = type === 'ok' ? '✅' : '⚠️';
  document.getElementById('bc-alert-title').textContent = title;
  document.getElementById('bc-alert-msg').innerHTML     = msgHtml;
  openModal('bc-alert-ov');
  // إغلاق تلقائي بعد 3 ثوانٍ
  setTimeout(() => closeModal('bc-alert-ov'), 3000);
}

// نافذة خيارات الدين
function showBcDebtOptions(d) {
  let ov = document.getElementById('bc-debt-ov');
  if (!ov) {
    ov = document.createElement('div');
    ov.id = 'bc-debt-ov';
    ov.className = 'modal-overlay';
    ov.innerHTML = `
      <div class="modal" style="max-width:380px">
        <div class="modal-header">
          <div class="modal-title">💳 دفع دين</div>
          <button class="modal-close" onclick="closeModal('bc-debt-ov')">✕</button>
        </div>
        <div style="padding:4px 0 16px">
          <div style="background:var(--bg);border-radius:10px;padding:12px 16px;margin-bottom:16px">
            <div style="font-size:14px;font-weight:800;color:var(--text-dark)" id="bc-debt-name"></div>
            <div style="font-size:12px;color:var(--text-gray);margin-top:4px" id="bc-debt-info"></div>
          </div>
          <div style="display:flex;gap:10px">
            <button class="btn btn-primary" style="flex:1;padding:13px" id="bc-debt-pay-btn">💵 تسجيل دفعة</button>
            <button class="btn btn-green" style="flex:1;padding:13px" id="bc-debt-all-btn">✅ تسديد الكل</button>
          </div>
        </div>
      </div>`;
    document.body.appendChild(ov);
  }
  document.getElementById('bc-debt-name').textContent = d.customerName + (d.phone ? ' — ' + d.phone : '');
  document.getElementById('bc-debt-info').innerHTML   = `المتبقي: <b style="color:var(--red)">${fmt(d.remaining)} DA</b> من أصل ${fmt(d.totalDebt)} DA`;
  document.getElementById('bc-debt-pay-btn').onclick  = () => { closeModal('bc-debt-ov'); openDebtPay(d.id); };
  document.getElementById('bc-debt-all-btn').onclick  = () => { closeModal('bc-debt-ov'); openDebtPayAll(d.id); };
  openModal('bc-debt-ov');
}

// نافذة خيارات التقسيط
function showBcInstOptions(inst) {
  let ov = document.getElementById('bc-inst-ov');
  if (!ov) {
    ov = document.createElement('div');
    ov.id = 'bc-inst-ov';
    ov.className = 'modal-overlay';
    ov.innerHTML = `
      <div class="modal" style="max-width:380px">
        <div class="modal-header">
          <div class="modal-title">📅 دفع قسط</div>
          <button class="modal-close" onclick="closeModal('bc-inst-ov')">✕</button>
        </div>
        <div style="padding:4px 0 16px">
          <div style="background:var(--bg);border-radius:10px;padding:12px 16px;margin-bottom:16px">
            <div style="font-size:14px;font-weight:800;color:var(--text-dark)" id="bc-inst-name"></div>
            <div style="font-size:12px;color:var(--text-gray);margin-top:4px" id="bc-inst-info"></div>
          </div>
          <div style="display:flex;gap:10px">
            <button class="btn btn-primary" style="flex:1;padding:13px" id="bc-inst-pay-btn">💵 دفع قسط</button>
            <button class="btn btn-green" style="flex:1;padding:13px" id="bc-inst-all-btn">✅ دفع الكل</button>
          </div>
        </div>
      </div>`;
    document.body.appendChild(ov);
  }
  document.getElementById('bc-inst-name').textContent = inst.customerName + (inst.phone ? ' — ' + inst.phone : '');
  document.getElementById('bc-inst-info').innerHTML   = `القسط الشهري: <b style="color:var(--primary)">${fmt(inst.monthlyPayment)} DA</b> · المتبقي: <b style="color:var(--red)">${fmt(inst.remaining)} DA</b>`;
  document.getElementById('bc-inst-pay-btn').onclick  = () => { closeModal('bc-inst-ov'); openInstPay(inst.id); };
  document.getElementById('bc-inst-all-btn').onclick  = () => { closeModal('bc-inst-ov'); openInstPayAll(inst.id); };
  openModal('bc-inst-ov');
}

// ================================================================
//  تذكيرات التقسيط — ترسل عند بدء البرنامج
// ================================================================
function checkInstallmentReminders() {
  const insts = DB.get('installments');
  if (!insts.length) return;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().split('T')[0];

  // نتحقق فقط مرة واحدة في اليوم
  const lastCheck = localStorage.getItem('sj_last_reminder_check');
  if (lastCheck === todayStr) return;
  localStorage.setItem('sj_last_reminder_check', todayStr);

  const active = insts.filter(i => i.status !== 'closed' && (i.remaining||0) > 0);
  if (!active.length) return;

  let reminders = [];

  active.forEach(inst => {
    const startDate  = new Date(inst.date);
    const monthsPaid = inst.paidMonths || 0;

    // تاريخ الدفع القادم = يوم البداية + (أشهر مدفوعة + 1)
    const nextPayDate = new Date(startDate);
    nextPayDate.setMonth(nextPayDate.getMonth() + monthsPaid + 1);
    nextPayDate.setHours(0, 0, 0, 0);

    const diffDays = Math.round((nextPayDate - today) / (1000 * 60 * 60 * 24));

    // اليوم هو يوم الدفع أو تأخر
    if (diffDays <= 0) {
      const status = diffDays < 0
        ? `⚠️ متأخر ${Math.abs(diffDays)} يوم!`
        : `⚠️ يجب عليه الدفع اليوم!`;

      reminders.push(
        `👤 <b>${inst.customerName}</b>
` +
        `📱 الهاتف: ${inst.phone || '—'}
` +
        `💰 القسط: ${fmt(inst.monthlyPayment)} DA
` +
        `📦 المنتج: ${inst.productName || '—'}
` +
        `${status}`
      );
    }
  });

  if (reminders.length === 0) return;

  // إرسال رسالة واحدة تجمع كل التذكيرات
  const header = reminders.length === 1
    ? '⏰ <b>تذكير دفع قسط</b>'
    : `⏰ <b>تذكيرات دفع أقساط (${reminders.length} زبون)</b>`;

  tg(header + '

' + reminders.join('

─────────────

'));
}

