(function initSecurityHardening() {
  const DASHBOARD_PIN_HASH_KEY = 'dashboard_pin_hash';
  const DASHBOARD_PIN_UPDATED_AT_KEY = 'dashboard_pin_updated_at';

  function dashboardPinKey(uid = currentUserUid()) {
    return userScopedStorageKey(DASHBOARD_PIN_HASH_KEY, uid);
  }

  function dashboardPinUpdatedAtKey(uid = currentUserUid()) {
    return userScopedStorageKey(DASHBOARD_PIN_UPDATED_AT_KEY, uid);
  }

  function storedDashboardPinHash(uid = currentUserUid()) {
    return uid ? (localStorage.getItem(dashboardPinKey(uid)) || '') : '';
  }

  function storedDashboardPinUpdatedAt(uid = currentUserUid()) {
    return uid ? (localStorage.getItem(dashboardPinUpdatedAtKey(uid)) || '') : '';
  }

  function storeDashboardPinState(hash, updatedAt = new Date().toISOString(), uid = currentUserUid()) {
    if (!uid) return;
    if (hash) {
      localStorage.setItem(dashboardPinKey(uid), hash);
      localStorage.setItem(dashboardPinUpdatedAtKey(uid), updatedAt);
      return;
    }
    localStorage.removeItem(dashboardPinKey(uid));
    localStorage.removeItem(dashboardPinUpdatedAtKey(uid));
  }

  function dashboardPinEnabled() {
    return !!storedDashboardPinHash();
  }

  async function dashboardPinCloudRef(uid = currentUserUid()) {
    if (!uid || !window._fs) return null;
    const { doc } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
    return doc(window._fs, `users/${uid}/meta/security`);
  }

  async function readCloudDashboardPinState(uid = currentUserUid()) {
    try {
      const ref = await dashboardPinCloudRef(uid);
      if (!ref) return null;
      const { getDoc } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
      const snap = await getDoc(ref);
      if (!snap.exists()) return null;
      const data = snap.data() || {};
      return {
        hash: String(data.dashboardPinHash || ''),
        updatedAt: String(data.dashboardPinUpdatedAt || '')
      };
    } catch (e) {
      console.warn('readCloudDashboardPinState:', e.message);
      return null;
    }
  }

  async function writeCloudDashboardPinState(hash, updatedAt = new Date().toISOString(), uid = currentUserUid()) {
    try {
      const ref = await dashboardPinCloudRef(uid);
      if (!ref) return false;
      const { setDoc } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
      await setDoc(ref, {
        dashboardPinHash: hash,
        dashboardPinUpdatedAt: updatedAt
      }, { merge: true });
      return true;
    } catch (e) {
      console.warn('writeCloudDashboardPinState:', e.message);
      return false;
    }
  }

  async function clearCloudDashboardPinState(uid = currentUserUid()) {
    try {
      const ref = await dashboardPinCloudRef(uid);
      if (!ref) return false;
      const { setDoc, deleteField } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
      await setDoc(ref, {
        dashboardPinHash: deleteField(),
        dashboardPinUpdatedAt: deleteField()
      }, { merge: true });
      return true;
    } catch (e) {
      console.warn('clearCloudDashboardPinState:', e.message);
      return false;
    }
  }

  async function hashDashboardPin(pin, uid = currentUserUid()) {
    if (!uid || !window.crypto?.subtle) return '';
    const bytes = new TextEncoder().encode(`sj-dashboard:${uid}:${String(pin || '').trim()}`);
    const digest = await window.crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest)).map(n => n.toString(16).padStart(2, '0')).join('');
  }

  async function syncDashboardPinState() {
    const uid = currentUserUid();
    if (!uid) return;

    const localHash = storedDashboardPinHash(uid);
    const localUpdatedAt = storedDashboardPinUpdatedAt(uid);
    const cloudState = await readCloudDashboardPinState(uid);
    const cloudHash = cloudState?.hash || '';
    const cloudUpdatedAt = cloudState?.updatedAt || '';
    const localTs = Date.parse(localUpdatedAt || '') || 0;
    const cloudTs = Date.parse(cloudUpdatedAt || '') || 0;

    if (!localHash && cloudHash) {
      storeDashboardPinState(cloudHash, cloudUpdatedAt || new Date().toISOString(), uid);
      return;
    }

    if (localHash && !cloudHash) {
      await writeCloudDashboardPinState(localHash, localUpdatedAt || new Date().toISOString(), uid);
      return;
    }

    if (localHash && cloudHash && localHash !== cloudHash) {
      if (cloudTs > localTs) {
        storeDashboardPinState(cloudHash, cloudUpdatedAt || new Date().toISOString(), uid);
      } else {
        await writeCloudDashboardPinState(localHash, localUpdatedAt || new Date().toISOString(), uid);
      }
    }
  }

  async function verifyDashboardPin(pin) {
    const raw = String(pin || '').trim();
    if (!raw) return false;

    const stored = storedDashboardPinHash();
    if (!stored) return false;
    const hashed = await hashDashboardPin(raw);
    return !!hashed && hashed === stored;
  }

  function hasAuthenticatedSession() {
    const uid = currentUserUid();
    const user = window._fbAuth?.currentUser;
    return !!(uid && user && user.uid === uid && user.emailVerified !== false);
  }

  function requireAuthenticatedSession(message) {
    if (hasAuthenticatedSession()) return true;
    toast(message || 'أعد تسجيل الدخول بالحساب الحالي لتنفيذ هذا الإجراء', 'err');
    return false;
  }

  function closeDashboardPinModal() {
    document.getElementById('dash-pwd-ov')?.classList.remove('open');
  }

  window.closePwd = function closePwd() {
    closeDashboardPinModal();
  };

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

  window.refreshDashboardPasswordUI = function refreshDashboardPasswordUI() {
    const dashboardBtn = document.getElementById('btn-dashboard');
    const lockBadge = dashboardBtn?.querySelector('.nav-lock-badge');
    const manageBtn = document.querySelector('button[onclick="openChangePwd()"]');
    const changeTitle = document.querySelector('#change-pwd-ov .modal-hd h3');
    const oldField = document.getElementById('cp-old')?.closest('.fg');
    const saveBtn = document.querySelector('#change-pwd-ov button[onclick="saveNewPwd()"]');
    let note = document.getElementById('cp-note');
    let removeBtn = document.getElementById('cp-remove-btn');
    const protectedMode = dashboardPinEnabled();

    if (lockBadge) {
      lockBadge.style.display = protectedMode ? 'inline-flex' : 'none';
      lockBadge.textContent = '🔒';
    }

    if (manageBtn) {
      manageBtn.id = 'dashboard-pwd-manage-btn';
      manageBtn.textContent = protectedMode ? '🔑 إدارة كلمة سر لوحة التحكم' : '🔐 تعيين كلمة سر للوحة التحكم';
    }

    if (changeTitle) {
      changeTitle.id = 'change-pwd-title';
      changeTitle.textContent = protectedMode ? '🔑 إدارة كلمة سر لوحة التحكم' : '🔐 تعيين كلمة سر للوحة التحكم';
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
        ? 'القفل محفوظ بشكل آمن لكل مستخدم على هذا الجهاز. يمكنك تغييره أو حذفه.'
        : 'إذا لم تضع كلمة سر فستبقى لوحة التحكم مفتوحة بعد تسجيل الدخول.';
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
  };

  window.syncUserScopedSecurityState = async function syncUserScopedSecurityState() {
    await syncDashboardPinState();
    window.refreshDashboardPasswordUI();
    window.renderSettings?.();
  };

  window.getPWD = function getPWD() {
    return '';
  };

  window.openDashboard = function openDashboard(el) {
    window._dashboardAccessBtn = el;
    if (!dashboardPinEnabled()) {
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

  window.confirmPwd = async function confirmPwd() {
    const input = document.getElementById('pwd-input');
    const error = document.getElementById('pwd-error');

    if (await verifyDashboardPin(input?.value || '')) {
      closeDashboardPinModal();
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
    if (!requireAuthenticatedSession('أعد تسجيل الدخول بالحساب الحالي لإدارة قفل لوحة التحكم')) return;
    ['cp-old', 'cp-new', 'cp-confirm'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    const err = document.getElementById('cp-error');
    if (err) err.style.display = 'none';
    window.refreshDashboardPasswordUI();
    openModal('change-pwd-ov');
  };

  window.saveNewPwd = async function saveNewPwd() {
    if (!requireAuthenticatedSession('أعد تسجيل الدخول بالحساب الحالي لحفظ قفل لوحة التحكم')) return;

    const protectedMode = dashboardPinEnabled();
    const old = document.getElementById('cp-old')?.value || '';
    const nw = (document.getElementById('cp-new')?.value || '').trim();
    const confirm = (document.getElementById('cp-confirm')?.value || '').trim();
    const errEl = document.getElementById('cp-error');
    const showErr = (msg) => {
      if (!errEl) return;
      errEl.textContent = msg;
      errEl.style.display = 'block';
    };

    if (protectedMode && !(await verifyDashboardPin(old))) { showErr('❌ كلمة السر الحالية غير صحيحة'); return; }
    if (!nw) { showErr('❌ أدخل كلمة السر الجديدة'); return; }
    if (nw.length < 4) { showErr('❌ كلمة السر يجب أن تكون 4 أحرف على الأقل'); return; }
    if (nw !== confirm) { showErr('❌ كلمة السر الجديدة غير متطابقة'); return; }

    const hashed = await hashDashboardPin(nw);
    if (!hashed) { showErr('❌ تعذر حفظ كلمة السر'); return; }

    const updatedAt = new Date().toISOString();
    storeDashboardPinState(hashed, updatedAt);
    await writeCloudDashboardPinState(hashed, updatedAt);
    closeModal('change-pwd-ov');
    window.refreshDashboardPasswordUI();
    toast(protectedMode ? '✅ تم تغيير كلمة السر بنجاح' : '✅ تم تعيين كلمة سر للوحة التحكم');
  };

  window.removeDashboardPwd = async function removeDashboardPwd() {
    if (!requireAuthenticatedSession('أعد تسجيل الدخول بالحساب الحالي لحذف قفل لوحة التحكم')) return;

    const old = document.getElementById('cp-old')?.value || '';
    const errEl = document.getElementById('cp-error');

    if (!dashboardPinEnabled()) {
      closeModal('change-pwd-ov');
      return;
    }

    if (!(await verifyDashboardPin(old))) {
      if (errEl) {
        errEl.textContent = '❌ أدخل كلمة السر الحالية لحذف الحماية';
        errEl.style.display = 'block';
      }
      return;
    }

    storeDashboardPinState('');
    await clearCloudDashboardPinState();
    closeModal('change-pwd-ov');
    window.refreshDashboardPasswordUI();
    toast('✅ تم حذف كلمة السر وأصبحت لوحة التحكم مفتوحة');
  };

  window.toggleInstProfit = function toggleInstProfit() {
    const hidden = document.getElementById('inst-kpi-collected-hidden');
    const real = document.getElementById('inst-kpi-collected-real');
    if (!hidden || !real) return;

    if (real.style.display === 'none') {
      hidden.style.display = 'none';
      real.style.display = 'inline';
      return;
    }

    hidden.style.display = 'inline';
    real.style.display = 'none';
  };

  window.confirmInstProfit = function confirmInstProfit() {
    window.toggleInstProfit();
  };

  window.openDeletePwd = function openDeletePwd(pwdTitle, pwdMsg, confirmTitle, confirmMsg, action) {
    if (!requireAuthenticatedSession('أعد تسجيل الدخول بالحساب الحالي لتنفيذ الحذف')) return;

    window._deletePendingAction = action;
    window._deleteConfirmTitle = confirmTitle;
    window._deleteConfirmMsg = confirmMsg;

    if (!dashboardPinEnabled()) {
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

  window.confirmDeletePwd = async function confirmDeletePwd() {
    const input = document.getElementById('del-pwd-input');
    const error = document.getElementById('del-pwd-error');

    if (await verifyDashboardPin(input?.value || '')) {
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
      inventory: { col: 'products', render: () => renderInventory() },
      installments: { col: 'installments', render: () => renderInstallments() },
      debts: { col: 'debts', render: () => renderDebts() },
      repairs: { col: 'repairs', render: () => renderRepairs() },
    };

    const runDelete = async () => {
      const cfg = execMap[page];
      if (!cfg) return;
      try { DB.set(cfg.col, []); } catch {}
      await clearFirestoreCollection(cfg.col);
      cfg.render();
      toast(`✅ تم حذف بيانات ${name} بنجاح`);
    };

    window.openDeletePwd(
      '🔒 تأكيد الهوية',
      `أدخل كلمة السر لحذف بيانات "${name}"`,
      `🗑️ تأكيد حذف بيانات ${name}`,
      `هل أنت متأكد من حذف جميع بيانات "${name}" نهائياً؟ لا يمكن التراجع عن هذا الإجراء.`,
      runDelete
    );
  };

  document.addEventListener('DOMContentLoaded', () => {
    window.syncUserScopedSecurityState?.();

    const pwdInput = document.getElementById('pwd-input');
    if (pwdInput && !pwdInput.dataset.secureBound) {
      pwdInput.dataset.secureBound = '1';
      pwdInput.addEventListener('keypress', e => {
        if (e.key === 'Enter') window.confirmPwd?.();
      });
    }

    const deletePwdInput = document.getElementById('del-pwd-input');
    if (deletePwdInput && !deletePwdInput.dataset.secureBound) {
      deletePwdInput.dataset.secureBound = '1';
      deletePwdInput.addEventListener('keypress', e => {
        if (e.key === 'Enter') window.confirmDeletePwd?.();
      });
    }
  });
})();
