// ====== barcode.js â€” Ù‚Ø§Ø±Ø¦ Ø§Ù„Ø¨Ø§Ø±ÙƒÙˆØ¯ ======

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
  toast('ðŸ“· Ù…Ø±Ø± Ù‚Ø§Ø±Ø¦ Ø§Ù„Ø¨Ø§Ø±ÙƒÙˆØ¯ Ø§Ù„Ø¢Ù†...', 'ok');
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
//  Ù†Ø¸Ø§Ù… Ù‚Ø§Ø±Ø¦ Ø§Ù„Ø¨Ø§Ø±ÙƒÙˆØ¯ Ø§Ù„Ø¹Ø§Ù„Ù…ÙŠ
// ================================================================
(function initBarcodeScanner() {
  let _bcBuffer = '';
  let _bcTimer  = null;
  const BC_TIMEOUT = 80; // ms Ø¨ÙŠÙ† Ø§Ù„Ø£Ø­Ø±Ù â€” Ø§Ù„Ù‚Ø§Ø±Ø¦ Ø³Ø±ÙŠØ¹ Ø¬Ø¯Ø§Ù‹

  document.addEventListener('keydown', function(e) {
    // ØªØ¬Ø§Ù‡Ù„ Ø¥Ø°Ø§ ÙƒØ§Ù† Ø§Ù„Ù…Ø³ØªØ®Ø¯Ù… ÙŠÙƒØªØ¨ ÙÙŠ Ø­Ù‚Ù„ Ù†Øµ
    const tag = document.activeElement?.tagName;
    const activeId = document.activeElement?.id;
    // ÙÙŠ Ø§Ù„ÙƒØ§Ø´ÙŠØ±: Ø¥Ø°Ø§ ÙƒØ§Ù† Ø­Ù‚Ù„ Ø§Ù„Ø¨Ø­Ø« Ù†Ø´Ø·Ø§Ù‹ Ù†ØªØ±ÙƒÙ‡ ÙŠØ¹Ù…Ù„ Ø¨Ø´ÙƒÙ„Ù‡ Ø§Ù„Ø·Ø¨ÙŠØ¹ÙŠ
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
      // Ù„ÙƒÙ† Ø¥Ø°Ø§ ÙƒØ§Ù† Ø§Ù„Ù‚Ø§Ø±Ø¦ ÙŠÙƒØªØ¨ ÙÙŠ cashier-search Ù†ØªØ±ÙƒÙ‡
      if (activeId !== 'cashier-search') return;
    }
    // ØªØ¬Ø§Ù‡Ù„ Ø¥Ø°Ø§ ÙƒØ§Ù†Øª Ù†Ø§ÙØ°Ø© Auth Ù…ÙØªÙˆØ­Ø©
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

    // Ù‚Ø¨ÙˆÙ„ Ø§Ù„Ø£Ø±Ù‚Ø§Ù… ÙˆØ§Ù„Ø­Ø±ÙˆÙ ÙÙ‚Ø·
    if (e.key.length === 1) {
      _bcBuffer += e.key;
      clearTimeout(_bcTimer);
      _bcTimer = setTimeout(() => { _bcBuffer = ''; }, BC_TIMEOUT * 10);
    }
  });
})();

// ================================================================
//  Ù…Ø¹Ø§Ù„Ø¬Ø© Ø§Ù„Ø¨Ø§Ø±ÙƒÙˆØ¯ Ø­Ø³Ø¨ Ø§Ù„ÙˆØ§Ø¬Ù‡Ø© Ø§Ù„Ø­Ø§Ù„ÙŠØ©
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
//  Ø¨Ø§Ø±ÙƒÙˆØ¯ â€” Ø¥Ø¯Ø§Ø±Ø© Ø§Ù„Ù…Ø®Ø²ÙˆÙ†
// ================================================================
function bcInventory(barcode) {
  const prods = DB.get('products');
  const p = prods.find(x => (x.barcode||'') === barcode);
  if (p) {
    // Ù…Ù†ØªØ¬ Ù…ÙˆØ¬ÙˆØ¯ â†’ Ø§ÙØªØ­ Ù†Ø§ÙØ°Ø© Ø§Ù„ØªØ¹Ø¯ÙŠÙ„ Ù…Ø¨Ø§Ø´Ø±Ø©
    openInvModal(p.id);
  } else {
    // Ù…Ù†ØªØ¬ ØºÙŠØ± Ù…ÙˆØ¬ÙˆØ¯ â†’ Ù†Ø§ÙØ°Ø© ØªØ³Ø£Ù„
    showBcNotFound('Ø§Ù„Ù…Ù†ØªØ¬ ØºÙŠØ± Ù…ÙˆØ¬ÙˆØ¯ ÙÙŠ Ø§Ù„Ù…Ø®Ø²ÙˆÙ†', barcode, () => {
      closeModal('bc-notfound-ov');
      openModal('prod-type-ov');
    });
  }
}

// ================================================================
//  Ø¨Ø§Ø±ÙƒÙˆØ¯ â€” Ù†Ù‚Ø·Ø© Ø§Ù„Ø¨ÙŠØ¹
// ================================================================
function bcPOS(barcode) {
  const prods = DB.get('products');
  const p = prods.find(x => (x.barcode||'') === barcode);
  if (!p) {
    showBcNotFound('Ø§Ù„Ù…Ù†ØªØ¬ ØºÙŠØ± Ù…ÙˆØ¬ÙˆØ¯ ÙÙŠ Ø§Ù„Ù…Ø®Ø²ÙˆÙ†', barcode, () => {
      closeModal('bc-notfound-ov');
      goPage('inventory', document.getElementById('btn-inventory'));
      setTimeout(() => openModal('prod-type-ov'), 300);
    });
    return;
  }
  if ((p.qty||0) <= 0) {
    showBcAlert('âš ï¸ Ù†ÙØ¯ Ø§Ù„Ù…Ø®Ø²ÙˆÙ†', `Ø§Ù„Ù…Ù†ØªØ¬ <b>${p.name}</b> Ù†ÙØ¯ Ù…Ù† Ø§Ù„Ù…Ø®Ø²ÙˆÙ†`, 'warn');
    return;
  }
  // Ù…Ù†ØªØ¬ Ù…ÙˆØ¬ÙˆØ¯ ÙˆÙ…ØªÙˆÙØ± â†’ Ø§ÙØªØ­ Ù†Ø§ÙØ°Ø© Ø§Ù„Ø¨ÙŠØ¹
  openSale(p.id);
}

// ================================================================
//  Ø¨Ø§Ø±ÙƒÙˆØ¯ â€” Ø§Ù„ÙƒØ§Ø´ÙŠØ±
// ================================================================
function bcCashier(barcode) {
  const prods = DB.get('products');
  const p = prods.find(x => (x.barcode||'') === barcode);
  if (!p) {
    showBcNotFound('Ø§Ù„Ù…Ù†ØªØ¬ ØºÙŠØ± Ù…ÙˆØ¬ÙˆØ¯ ÙÙŠ Ø§Ù„Ù…Ø®Ø²ÙˆÙ†', barcode, () => {
      closeModal('bc-notfound-ov');
      goPage('inventory', document.getElementById('btn-inventory'));
      setTimeout(() => openModal('prod-type-ov'), 300);
    });
    return;
  }
  if ((p.qty||0) <= 0) {
    showBcAlert('âš ï¸ Ù†ÙØ¯ Ø§Ù„Ù…Ø®Ø²ÙˆÙ†', `Ø§Ù„Ù…Ù†ØªØ¬ <b>${p.name}</b> Ù†ÙØ¯ Ù…Ù† Ø§Ù„Ù…Ø®Ø²ÙˆÙ†`, 'warn');
    return;
  }
  // Ø¥Ø¶Ø§ÙØ© Ù…Ø¨Ø§Ø´Ø±Ø© Ù„Ù„Ø³Ù„Ø©
  addToCashier(p.id);
}

// ================================================================
//  Ø¨Ø§Ø±ÙƒÙˆØ¯ â€” Ø³Ø¬Ù„ Ø§Ù„Ø¯ÙŠÙˆÙ†
// ================================================================
function bcDebts(barcode) {
  const debts = DB.get('debts');
  const d = debts.find(x => (x.barcode13||'') === barcode);
  if (!d) return; // ØªØ¬Ø§Ù‡Ù„ Ø¥Ø°Ø§ ØºÙŠØ± Ù…ÙˆØ¬ÙˆØ¯

  if (d.status === 'closed' || (d.remaining||0) <= 0) {
    showBcAlert('âœ… ØªÙ… Ø§Ù„ØªØ³Ø¯ÙŠØ¯', `Ø§Ù„Ø²Ø¨ÙˆÙ† <b>${d.customerName}</b> Ø¯ÙØ¹ ÙƒÙ„ Ø¯ÙŠÙˆÙ†Ù‡ Ø¨Ø§Ù„ÙƒØ§Ù…Ù„`, 'ok');
    return;
  }
  // ÙØªØ­ Ù†Ø§ÙØ°Ø© Ø®ÙŠØ§Ø±Ø§Øª Ø§Ù„Ø¯ÙØ¹
  showBcDebtOptions(d);
}

// ================================================================
//  Ø¨Ø§Ø±ÙƒÙˆØ¯ â€” Ø²Ø¨Ø§Ø¦Ù† Ø§Ù„ØªÙ‚Ø³ÙŠØ·
// ================================================================
function bcInstallments(barcode) {
  const insts = DB.get('installments');
  const inst = insts.find(x => (x.barcode13||'') === barcode);
  if (!inst) return;

  if (inst.status === 'closed' || (inst.remaining||0) <= 0) {
    showBcAlert('âœ… Ø§Ù†ØªÙ‡Ù‰ Ø§Ù„ØªÙ‚Ø³ÙŠØ·', `Ø§Ù„Ø²Ø¨ÙˆÙ† <b>${inst.customerName}</b> Ø£ØªÙ… ÙƒÙ„ Ø£Ù‚Ø³Ø§Ø·Ù‡ Ø¨Ø§Ù„ÙƒØ§Ù…Ù„`, 'ok');
    return;
  }
  showBcInstOptions(inst);
}

// ================================================================
//  Ø¨Ø§Ø±ÙƒÙˆØ¯ â€” ØªØµÙ„ÙŠØ­ Ø§Ù„Ø£Ø¹Ø·Ø§Ù„
// ================================================================
function bcRepairs(barcode) {
  const reps = DB.get('repairs');
  const r = reps.find(x => (x.barcode13||'') === barcode);
  if (!r) return;

  if (r.paid) {
    showBcAlert('âœ… Ù…Ø¯ÙÙˆØ¹', `Ø§Ù„Ø²Ø¨ÙˆÙ† <b>${r.customerName}</b> Ø¯ÙØ¹ Ù…Ø³Ø¨Ù‚Ø§Ù‹`, 'ok');
    return;
  }
  // ÙØªØ­ Ù†Ø§ÙØ°Ø© ØªØ³Ø¬ÙŠÙ„ Ø§Ù„Ø¯ÙØ¹
  _repTarget = r;
  openModal('rep-paid-ov');
  document.getElementById('rpaid-name').textContent      = r.customerName;
  document.getElementById('rpaid-device').textContent    = r.device;
  document.getElementById('rpaid-siraj').textContent     = fmt(r.profitSiraj);
  document.getElementById('rpaid-anis').textContent      = fmt(r.profitAnis);
}

// ================================================================
//  Ù†ÙˆØ§ÙØ° Ù…Ø³Ø§Ø¹Ø¯Ø© Ù„Ù„Ø¨Ø§Ø±ÙƒÙˆØ¯
// ================================================================

// Ù†Ø§ÙØ°Ø© "ØºÙŠØ± Ù…ÙˆØ¬ÙˆØ¯" Ù…Ø¹ Ø²Ø± Ø¥Ø¶Ø§ÙØ©
function showBcNotFound(msg, barcode, onAdd) {
  let ov = document.getElementById('bc-notfound-ov');
  if (!ov) {
    ov = document.createElement('div');
    ov.id = 'bc-notfound-ov';
    ov.className = 'modal-overlay';
    ov.innerHTML = `
      <div class="modal" style="max-width:360px;text-align:center">
        <div style="font-size:40px;margin-bottom:12px">ðŸ”</div>
        <div id="bc-nf-msg" style="font-size:15px;font-weight:700;color:var(--text-dark);margin-bottom:6px"></div>
        <div id="bc-nf-code" style="font-size:12px;color:var(--text-gray);margin-bottom:20px;font-family:monospace"></div>
        <div style="display:flex;gap:10px">
          <button class="btn btn-primary" style="flex:1" id="bc-nf-add-btn">âž• Ø¥Ø¶Ø§ÙØ© Ù…Ù†ØªØ¬</button>
          <button class="btn" style="flex:1;background:var(--bg)" onclick="closeModal('bc-notfound-ov')">Ø¥Ù„ØºØ§Ø¡</button>
        </div>
      </div>`;
    document.body.appendChild(ov);
  }
  document.getElementById('bc-nf-msg').textContent  = msg;
  document.getElementById('bc-nf-code').textContent = 'Ø§Ù„Ø¨Ø§Ø±ÙƒÙˆØ¯: ' + barcode;
  document.getElementById('bc-nf-add-btn').onclick  = onAdd;
  openModal('bc-notfound-ov');
}

// Ù†Ø§ÙØ°Ø© ØªÙ†Ø¨ÙŠÙ‡ Ø¨Ø³ÙŠØ·Ø©
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
        <button class="btn btn-primary" style="width:100%" onclick="closeModal('bc-alert-ov')">Ø­Ø³Ù†Ø§Ù‹</button>
      </div>`;
    document.body.appendChild(ov);
  }
  document.getElementById('bc-alert-icon').textContent  = type === 'ok' ? 'âœ…' : 'âš ï¸';
  document.getElementById('bc-alert-title').textContent = title;
  document.getElementById('bc-alert-msg').innerHTML     = msgHtml;
  openModal('bc-alert-ov');
  // Ø¥ØºÙ„Ø§Ù‚ ØªÙ„Ù‚Ø§Ø¦ÙŠ Ø¨Ø¹Ø¯ 3 Ø«ÙˆØ§Ù†Ù
  setTimeout(() => closeModal('bc-alert-ov'), 3000);
}

// Ù†Ø§ÙØ°Ø© Ø®ÙŠØ§Ø±Ø§Øª Ø§Ù„Ø¯ÙŠÙ†
function showBcDebtOptions(d) {
  let ov = document.getElementById('bc-debt-ov');
  if (!ov) {
    ov = document.createElement('div');
    ov.id = 'bc-debt-ov';
    ov.className = 'modal-overlay';
    ov.innerHTML = `
      <div class="modal" style="max-width:380px">
        <div class="modal-header">
          <div class="modal-title">ðŸ’³ Ø¯ÙØ¹ Ø¯ÙŠÙ†</div>
          <button class="modal-close" onclick="closeModal('bc-debt-ov')">âœ•</button>
        </div>
        <div style="padding:4px 0 16px">
          <div style="background:var(--bg);border-radius:10px;padding:12px 16px;margin-bottom:16px">
            <div style="font-size:14px;font-weight:800;color:var(--text-dark)" id="bc-debt-name"></div>
            <div style="font-size:12px;color:var(--text-gray);margin-top:4px" id="bc-debt-info"></div>
          </div>
          <div style="display:flex;gap:10px">
            <button class="btn btn-primary" style="flex:1;padding:13px" id="bc-debt-pay-btn">ðŸ’µ ØªØ³Ø¬ÙŠÙ„ Ø¯ÙØ¹Ø©</button>
            <button class="btn btn-green" style="flex:1;padding:13px" id="bc-debt-all-btn">âœ… ØªØ³Ø¯ÙŠØ¯ Ø§Ù„ÙƒÙ„</button>
          </div>
        </div>
      </div>`;
    document.body.appendChild(ov);
  }
  document.getElementById('bc-debt-name').textContent = d.customerName + (d.phone ? ' â€” ' + d.phone : '');
  document.getElementById('bc-debt-info').innerHTML   = `Ø§Ù„Ù…ØªØ¨Ù‚ÙŠ: <b style="color:var(--red)">${fmt(d.remaining)} DA</b> Ù…Ù† Ø£ØµÙ„ ${fmt(d.totalDebt)} DA`;
  document.getElementById('bc-debt-pay-btn').onclick  = () => { closeModal('bc-debt-ov'); openDebtPay(d.id); };
  document.getElementById('bc-debt-all-btn').onclick  = () => { closeModal('bc-debt-ov'); openDebtPayAll(d.id); };
  openModal('bc-debt-ov');
}

// Ù†Ø§ÙØ°Ø© Ø®ÙŠØ§Ø±Ø§Øª Ø§Ù„ØªÙ‚Ø³ÙŠØ·
function showBcInstOptions(inst) {
  let ov = document.getElementById('bc-inst-ov');
  if (!ov) {
    ov = document.createElement('div');
    ov.id = 'bc-inst-ov';
    ov.className = 'modal-overlay';
    ov.innerHTML = `
      <div class="modal" style="max-width:380px">
        <div class="modal-header">
          <div class="modal-title">ðŸ“… Ø¯ÙØ¹ Ù‚Ø³Ø·</div>
          <button class="modal-close" onclick="closeModal('bc-inst-ov')">âœ•</button>
        </div>
        <div style="padding:4px 0 16px">
          <div style="background:var(--bg);border-radius:10px;padding:12px 16px;margin-bottom:16px">
            <div style="font-size:14px;font-weight:800;color:var(--text-dark)" id="bc-inst-name"></div>
            <div style="font-size:12px;color:var(--text-gray);margin-top:4px" id="bc-inst-info"></div>
          </div>
          <div style="display:flex;gap:10px">
            <button class="btn btn-primary" style="flex:1;padding:13px" id="bc-inst-pay-btn">ðŸ’µ Ø¯ÙØ¹ Ù‚Ø³Ø·</button>
            <button class="btn btn-green" style="flex:1;padding:13px" id="bc-inst-all-btn">âœ… Ø¯ÙØ¹ Ø§Ù„ÙƒÙ„</button>
          </div>
        </div>
      </div>`;
    document.body.appendChild(ov);
  }
  document.getElementById('bc-inst-name').textContent = inst.customerName + (inst.phone ? ' â€” ' + inst.phone : '');
  document.getElementById('bc-inst-info').innerHTML   = `Ø§Ù„Ù‚Ø³Ø· Ø§Ù„Ø´Ù‡Ø±ÙŠ: <b style="color:var(--primary)">${fmt(inst.monthlyPayment)} DA</b> Â· Ø§Ù„Ù…ØªØ¨Ù‚ÙŠ: <b style="color:var(--red)">${fmt(inst.remaining)} DA</b>`;
  document.getElementById('bc-inst-pay-btn').onclick  = () => { closeModal('bc-inst-ov'); openInstPay(inst.id); };
  document.getElementById('bc-inst-all-btn').onclick  = () => { closeModal('bc-inst-ov'); openInstPayAll(inst.id); };
  openModal('bc-inst-ov');
}

// ================================================================
//  ØªØ°ÙƒÙŠØ±Ø§Øª Ø§Ù„ØªÙ‚Ø³ÙŠØ· â€” ØªØ±Ø³Ù„ Ø¹Ù†Ø¯ Ø¨Ø¯Ø¡ Ø§Ù„Ø¨Ø±Ù†Ø§Ù…Ø¬
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

  const active = insts.filter(i => i.status !== 'closed' && (i.remaining || 0) > 0);
  if (!active.length) return;

  const reminders = [];

  active.forEach(inst => {
    const startDate = new Date(inst.date);
    const monthsPaid = inst.paidMonths || 0;

    // تاريخ الدفع القادم = يوم البداية + (أشهر مدفوعة + 1)
    const nextPayDate = new Date(startDate);
    nextPayDate.setMonth(nextPayDate.getMonth() + monthsPaid + 1);
    nextPayDate.setHours(0, 0, 0, 0);

    const diffDays = Math.round((nextPayDate - today) / (1000 * 60 * 60 * 24));
    if (diffDays > 0) return;

    const status = diffDays < 0
      ? `⚠️ متأخر ${Math.abs(diffDays)} يوم!`
      : '⚠️ يجب عليه الدفع اليوم!';

    reminders.push(
      `👤 <b>${inst.customerName}</b>\n` +
      `📱 الهاتف: ${inst.phone || '—'}\n` +
      `💰 القسط: ${fmt(inst.monthlyPayment)} DA\n` +
      `📦 المنتج: ${inst.productName || '—'}\n` +
      `${status}`
    );
  });

  if (!reminders.length) return;

  const header = reminders.length === 1
    ? '⏰ <b>تذكير دفع قسط</b>'
    : `⏰ <b>تذكيرات دفع أقساط (${reminders.length} زبون)</b>`;

  tg(header + '\n\n' + reminders.join('\n\n─────────────\n\n'));
}
