// ====== init.js - App bootstrap ======

let _currentPage = null;
let _navBtns = [];
const _pages = {};

const pageMeta = {
  dashboard: ['لوحة التحكم', 'نظرة عامة على كل النشاط التجاري'],
  inventory: ['إدارة المخزون', 'تحكم في البضاعة، أضف منتجات وحدد الأسعار'],
  pos: ['نقطة البيع (POS)', 'اختر المنتج من القائمة لإتمام عملية البيع'],
  cashier: ['🖥️ الكاشير', 'مسح المنتجات بالباركود وإتمام البيع بسرعة'],
  installments: ['بيانات البيع بالتقسيط', 'متابعة أقساط وديون الزبائن'],
  debts: ['سجل الديون العادية', 'متابعة الكريدي والديون'],
  repairs: ['تصليح الأعطال', 'سجل إدارة عمليات التصليح'],
  worker: ['العامل', 'إدارة راتب العامل وسجل السحوبات'],
  settings: ['الإعدادات', 'إعدادات البرنامج وربط التيليجرام']
};

function goPage(id, el){
  if(_currentPage) _currentPage.classList.remove('active');
  if(_navBtns.length === 0){
    document.querySelectorAll('.nav-btn').forEach(b => _navBtns.push(b));
  }
  _navBtns.forEach(b => b.classList.remove('active'));

  if(!_pages[id]) _pages[id] = document.getElementById('page-' + id);
  if(!_pages[id]){
    console.warn('Page not found:', id);
    return;
  }

  _pages[id].classList.add('active');
  _currentPage = _pages[id];
  if(el) el.classList.add('active');

  const m = pageMeta[id];
  if(m){
    document.getElementById('page-title').textContent = m[0];
    document.getElementById('page-sub').textContent = m[1];
  }

  const renderMap = {
    inventory: renderInventory,
    pos: renderPOS,
    cashier: renderCashier,
    installments: renderInstallments,
    debts: renderDebts,
    repairs: renderRepairs,
    worker: renderWorker,
    settings: renderSettings
  };
  if(renderMap[id]) setTimeout(renderMap[id], 10);
}

window.renderTopDate = function renderTopDate(){
  const n = new Date();
  const days = ['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];
  const months = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
  const el = document.getElementById('top-date');
  if(!el) return;
  el.textContent = `${days[n.getDay()]} ${n.getDate()} ${months[n.getMonth()]} ${n.getFullYear()}`;
  el.style.display = 'block';
};

window.bootInitialPosPage = function bootInitialPosPage(){
  const posPage = document.getElementById('page-pos');
  const posBtn = document.getElementById('btn-pos');
  if(!posPage) return;

  if(_currentPage !== posPage){
    goPage('pos', posBtn);
    return;
  }

  posPage.classList.add('active');
  _currentPage = posPage;
  if(posBtn) posBtn.classList.add('active');
  setTimeout(renderPOS, 10);
};

document.addEventListener('DOMContentLoaded', ()=>{
  setTimeout(checkInstallmentReminders, 3000);

  setInterval(() => {
    const activeId = document.querySelector('.page.active')?.id?.replace('page-','');
    Object.keys(_cache).forEach(k => {
      if (k !== activeId && k !== 'products' && k !== 'sales' && k !== 'transactions') {
        delete _cache[k];
      }
    });
  }, 10 * 60 * 1000);

  renderTopDate();
  bootInitialPosPage();
});

function dashboardPasswordValue() {
  return (localStorage.getItem('sj_pwd') || '').trim();
}

function dashboardHasPassword() {
  return !!dashboardPasswordValue();
}

function refreshDashboardPasswordUI() {
  const dashboardBtn = document.getElementById('btn-dashboard');
  const lockBadge = dashboardBtn?.querySelector('.nav-lock-badge');
  const manageBtn = document.querySelector('button[onclick="openChangePwd()"]');
  const changeTitle = document.querySelector('#change-pwd-ov .modal-hd h3');
  const oldField = document.getElementById('cp-old')?.closest('.fg');
  const saveBtn = document.querySelector('#change-pwd-ov button[onclick="saveNewPwd()"]');
  let note = document.getElementById('cp-note');
  let removeBtn = document.getElementById('cp-remove-btn');
  const protectedMode = dashboardHasPassword();

  if (lockBadge) {
    lockBadge.style.display = protectedMode ? 'inline-flex' : 'none';
    lockBadge.textContent = '🔒';
  }

  if (manageBtn) {
    manageBtn.id = 'dashboard-pwd-manage-btn';
    manageBtn.textContent = protectedMode ? '🔑 إدارة كلمة سر لوحة التحكم' : '🔓 تعيين كلمة سر للوحة التحكم';
  }

  if (changeTitle) {
    changeTitle.id = 'change-pwd-title';
    changeTitle.textContent = protectedMode ? '🔑 إدارة كلمة سر لوحة التحكم' : '🔓 تعيين كلمة سر للوحة التحكم';
  }

  if (!note) {
    note = document.createElement('div');
    note.id = 'cp-note';
    note.style.cssText = 'font-size:12px;color:var(--text-gray);line-height:1.7;margin-bottom:12px';
    const modal = document.querySelector('#change-pwd-ov .modal');
    const hd = document.querySelector('#change-pwd-ov .modal-hd');
    if (modal && hd) modal.insertBefore(note, hd.nextSibling);
  }

  if (note) {
    note.textContent = protectedMode
      ? 'يمكنك تغيير كلمة السر الحالية أو حذفها نهائيًا لفتح لوحة التحكم بدون قفل.'
      : 'إذا لم تضع كلمة سر فستبقى لوحة التحكم مفتوحة دائمًا.';
  }

  if (oldField) oldField.style.display = protectedMode ? 'block' : 'none';

  if (saveBtn) {
    saveBtn.id = 'cp-save-btn';
    saveBtn.style.width = 'auto';
    saveBtn.style.flex = '1';
    saveBtn.style.minWidth = '150px';
    saveBtn.textContent = protectedMode ? '💾 حفظ التغييرات' : '💾 حفظ كلمة السر';

    let actions = saveBtn.parentElement;
    if (!actions || actions.dataset.dashboardPwdActions !== '1') {
      actions = document.createElement('div');
      actions.dataset.dashboardPwdActions = '1';
      actions.style.cssText = 'display:flex;gap:10px;flex-wrap:wrap';
      saveBtn.parentElement?.insertBefore(actions, saveBtn);
      actions.appendChild(saveBtn);
    }

    if (!removeBtn) {
      removeBtn = document.createElement('button');
      removeBtn.id = 'cp-remove-btn';
      removeBtn.className = 'btn';
      removeBtn.style.cssText = 'flex:1;min-width:150px;background:#FFF5F5;color:#C53030;display:none';
      removeBtn.textContent = '🗑️ حذف كلمة السر';
      removeBtn.onclick = () => window.removeDashboardPwd();
      actions.insertBefore(removeBtn, saveBtn);
    }

    removeBtn.style.display = protectedMode ? 'block' : 'none';
  }
}

window.getPWD = function getPWD() {
  return dashboardPasswordValue();
};

window.openDashboard = function openDashboard(el) {
  window._dashboardAccessBtn = el;
  if (!dashboardHasPassword()) {
    goPage('dashboard', el);
    renderDashboard();
    return;
  }

  const input = document.getElementById('pwd-input');
  const error = document.getElementById('pwd-error');
  if (input) input.value = '';
  if (error) error.style.display = 'none';
  document.getElementById('dash-pwd-ov')?.classList.add('open');
  setTimeout(() => input?.focus(), 280);
};

window.confirmPwd = function confirmPwd() {
  const input = document.getElementById('pwd-input');
  const error = document.getElementById('pwd-error');

  if (input?.value === dashboardPasswordValue()) {
    closePwd();
    goPage('dashboard', window._dashboardAccessBtn);
    renderDashboard();
    return;
  }

  if (error) error.style.display = 'block';
  if (input) {
    input.value = '';
    input.focus();
  }
  setTimeout(() => {
    if (error) error.style.display = 'none';
  }, 2500);
};

window.openChangePwd = function openChangePwd() {
  ['cp-old', 'cp-new', 'cp-confirm'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  const err = document.getElementById('cp-error');
  if (err) err.style.display = 'none';
  refreshDashboardPasswordUI();
  openModal('change-pwd-ov');
};

window.saveNewPwd = function saveNewPwd() {
  const current = dashboardPasswordValue();
  const protectedMode = !!current;
  const old = document.getElementById('cp-old')?.value || '';
  const nw = (document.getElementById('cp-new')?.value || '').trim();
  const confirm = (document.getElementById('cp-confirm')?.value || '').trim();
  const errEl = document.getElementById('cp-error');
  const showErr = (msg) => {
    if (!errEl) return;
    errEl.textContent = msg;
    errEl.style.display = 'block';
  };

  if (protectedMode && old !== current) { showErr('❌ كلمة السر الحالية غير صحيحة'); return; }
  if (!nw) { showErr('❌ أدخل كلمة السر الجديدة'); return; }
  if (nw.length < 4) { showErr('❌ كلمة السر يجب أن تكون 4 أحرف على الأقل'); return; }
  if (nw !== confirm) { showErr('❌ كلمة السر الجديدة غير متطابقة'); return; }

  localStorage.setItem('sj_pwd', nw);
  closeModal('change-pwd-ov');
  refreshDashboardPasswordUI();
  toast(protectedMode ? '✅ تم تغيير كلمة السر بنجاح' : '✅ تم تعيين كلمة سر للوحة التحكم');
};

window.removeDashboardPwd = function removeDashboardPwd() {
  const current = dashboardPasswordValue();
  const old = document.getElementById('cp-old')?.value || '';
  const errEl = document.getElementById('cp-error');

  if (!current) {
    closeModal('change-pwd-ov');
    return;
  }

  if (old !== current) {
    if (errEl) {
      errEl.textContent = '❌ أدخل كلمة السر الحالية لحذف الحماية';
      errEl.style.display = 'block';
    }
    return;
  }

  localStorage.removeItem('sj_pwd');
  closeModal('change-pwd-ov');
  refreshDashboardPasswordUI();
  toast('✅ تم حذف كلمة السر وأصبحت لوحة التحكم مفتوحة');
};

window.toggleInstProfit = function toggleInstProfit(btn) {
  const hidden = document.getElementById('inst-kpi-collected-hidden');
  const real = document.getElementById('inst-kpi-collected-real');
  if (!hidden || !real) return;

  if (real.style.display === 'none') {
    if (!dashboardHasPassword()) {
      hidden.style.display = 'none';
      real.style.display = 'inline';
      if (btn) btn.textContent = '🙈';
      return;
    }

    window._instProfitBtn = btn;
    const input = document.getElementById('inst-profit-pwd-input');
    const err = document.getElementById('inst-profit-pwd-err');
    if (input) input.value = '';
    if (err) err.style.display = 'none';
    openModal('inst-profit-pwd-ov');
    setTimeout(() => input?.focus(), 300);
    return;
  }

  hidden.style.display = 'inline';
  real.style.display = 'none';
  if (btn) btn.textContent = '👁️';
};

window.confirmInstProfit = function confirmInstProfit() {
  const input = document.getElementById('inst-profit-pwd-input');
  const err = document.getElementById('inst-profit-pwd-err');
  const hidden = document.getElementById('inst-kpi-collected-hidden');
  const real = document.getElementById('inst-kpi-collected-real');
  if (!input) return;

  if (input.value === dashboardPasswordValue()) {
    closeModal('inst-profit-pwd-ov');
    if (hidden) hidden.style.display = 'none';
    if (real) real.style.display = 'inline';
    if (window._instProfitBtn) window._instProfitBtn.textContent = '🙈';
    return;
  }

  if (err) err.style.display = 'block';
  input.value = '';
  input.focus();
  setTimeout(() => { if (err) err.style.display = 'none'; }, 2000);
};

document.addEventListener('DOMContentLoaded', () => {
  refreshDashboardPasswordUI();
});

function hasProtectedDeletionPassword() {
  return !!dashboardPasswordValue();
}

function runDeleteConfirmFlow() {
  showConfirm(
    window._deleteConfirmTitle || 'تأكيد الحذف',
    window._deleteConfirmMsg || 'هل أنت متأكد؟',
    () => {
      if (window._deletePendingAction) {
        window._deletePendingAction();
        window._deletePendingAction = null;
      }
    },
    '🗑️'
  );
}

window.openDeletePwd = function openDeletePwd(pwdTitle, pwdMsg, confirmTitle, confirmMsg, action) {
  window._deletePendingAction = action;
  window._deleteConfirmTitle = confirmTitle;
  window._deleteConfirmMsg = confirmMsg;

  if (!hasProtectedDeletionPassword()) {
    runDeleteConfirmFlow();
    return;
  }

  const title = document.getElementById('del-pwd-title');
  const msg = document.getElementById('del-pwd-msg');
  const input = document.getElementById('del-pwd-input');
  const error = document.getElementById('del-pwd-error');
  const ov = document.getElementById('del-pwd-ov');
  const box = document.getElementById('del-pwd-box');

  if (title) title.textContent = pwdTitle;
  if (msg) msg.textContent = pwdMsg;
  if (input) input.value = '';
  if (error) error.style.display = 'none';
  if (ov) {
    ov.style.opacity = '1';
    ov.style.pointerEvents = 'all';
  }
  if (box) box.style.transform = 'translateY(0) scale(1)';
  setTimeout(() => input?.focus(), 200);
};

window.confirmDeletePwd = function confirmDeletePwd() {
  const input = document.getElementById('del-pwd-input');
  const error = document.getElementById('del-pwd-error');

  if (input?.value === dashboardPasswordValue()) {
    closeDeletePwd();
    setTimeout(() => runDeleteConfirmFlow(), 300);
    return;
  }

  if (error) error.style.display = 'block';
  if (input) {
    input.value = '';
    input.focus();
  }
  setTimeout(() => {
    if (error) error.style.display = 'none';
  }, 2500);
};

window.deletePageData = function deletePageData(page) {
  const pageNames = {
    inventory: 'إدارة المخزون',
    installments: 'بيانات التقسيط',
    debts: 'سجل الديون',
    repairs: 'تصليح الأعطال',
  };
  const name = pageNames[page] || page;

  const execMap = {
    inventory: {
      col: 'products',
      key: 'sj_products',
      render: () => renderInventory(),
    },
    installments: {
      col: 'installments',
      key: 'sj_installments',
      render: () => renderInstallments(),
    },
    debts: {
      col: 'debts',
      key: 'sj_debts',
      render: () => renderDebts(),
    },
    repairs: {
      col: 'repairs',
      key: 'sj_repairs',
      render: () => renderRepairs(),
    },
  };

  const runDelete = async () => {
    const cfg = execMap[page];
    if (!cfg) return;

    localStorage.removeItem(cfg.key);
    try { DB.clear(cfg.col); } catch (e) {}
    await clearFirestoreCollection(cfg.col);
    cfg.render();
    toast(`✅ تم حذف بيانات ${name} بنجاح`);
  };

  if (page === 'repairs') {
    window._deletePendingAction = runDelete;
    window._deleteConfirmTitle = `🗑️ تأكيد حذف بيانات ${name}`;
    window._deleteConfirmMsg = `هل أنت متأكد من حذف جميع بيانات "${name}" نهائيًا؟ لا يمكن التراجع عن هذا الإجراء.`;
    runDeleteConfirmFlow();
    return;
  }

  window.openDeletePwd(
    '🔒 تأكيد الهوية',
    `أدخل كلمة السر لحذف بيانات "${name}"`,
    `🗑️ تأكيد حذف بيانات ${name}`,
    `هل أنت متأكد من حذف جميع بيانات "${name}" نهائيًا؟ لا يمكن التراجع عن هذا الإجراء.`,
    runDelete
  );
};
