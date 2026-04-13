(function initSecurityHardening() {
  const DASHBOARD_PIN_HASH_KEY = 'dashboard_pin_hash';
  const DASHBOARD_PIN_UPDATED_AT_KEY = 'dashboard_pin_updated_at';
  const KPI_VISIBILITY_KEY = 'kpi_visibility_state';
  const KPI_VISIBILITY_UPDATED_AT_KEY = 'kpi_visibility_state_updated_at';
  const KPI_VISIBILITY_DEFAULTS = Object.freeze({
    inst_total: true,
    inst_collected: false,
    inst_expected: true,
    inst_remaining: true,
    warranty_count: true,
    warranty_total: true,
    warranty_profit: false
  });
  const KPI_VISIBILITY_FIELDS = Object.freeze({
    inst_total: { hiddenId: 'inst-kpi-total-hidden', realId: 'inst-kpi-total-real', realDisplay: 'inline' },
    inst_collected: { hiddenId: 'inst-kpi-collected-hidden', realId: 'inst-kpi-collected-real', realDisplay: 'inline' },
    inst_expected: { hiddenId: 'inst-kpi-expected-hidden', realId: 'inst-kpi-expected-real', realDisplay: 'inline' },
    inst_remaining: { hiddenId: 'inst-kpi-remaining-hidden', realId: 'inst-kpi-remaining-real', realDisplay: 'inline' },
    warranty_count: { hiddenId: 'warranty-kpi-count-hidden', realId: 'warranty-kpi-count-real', realDisplay: 'inline' },
    warranty_total: { hiddenId: 'warranty-kpi-total-hidden', realId: 'warranty-kpi-total-real', realDisplay: 'inline' },
    warranty_profit: { hiddenId: 'warranty-kpi-profit-hidden', realId: 'warranty-kpi-profit-real', realDisplay: 'inline' }
  });
  let dashboardPinSuccessAction = null;

  function dashboardPinKey(uid = currentUserUid()) {
    return userScopedStorageKey(DASHBOARD_PIN_HASH_KEY, uid);
  }

  function dashboardPinUpdatedAtKey(uid = currentUserUid()) {
    return userScopedStorageKey(DASHBOARD_PIN_UPDATED_AT_KEY, uid);
  }

  function kpiVisibilityKey(uid = currentUserUid()) {
    return userScopedStorageKey(KPI_VISIBILITY_KEY, uid);
  }

  function kpiVisibilityUpdatedAtKey(uid = currentUserUid()) {
    return userScopedStorageKey(KPI_VISIBILITY_UPDATED_AT_KEY, uid);
  }

  function storedDashboardPinHash(uid = currentUserUid()) {
    return uid ? (localStorage.getItem(dashboardPinKey(uid)) || '') : '';
  }

  function storedDashboardPinUpdatedAt(uid = currentUserUid()) {
    return uid ? (localStorage.getItem(dashboardPinUpdatedAtKey(uid)) || '') : '';
  }

  function normalizeKpiVisibilityState(state) {
    const next = { ...KPI_VISIBILITY_DEFAULTS };
    if (!state || typeof state !== 'object' || Array.isArray(state)) return next;
    Object.keys(next).forEach((key) => {
      if (typeof state[key] === 'boolean') next[key] = state[key];
    });
    return next;
  }

  function hasStoredKpiVisibilityState(uid = currentUserUid()) {
    return !!(uid && localStorage.getItem(kpiVisibilityKey(uid)) !== null);
  }

  function storedKpiVisibilityState(uid = currentUserUid()) {
    if (!uid) return normalizeKpiVisibilityState();
    try {
      return normalizeKpiVisibilityState(JSON.parse(localStorage.getItem(kpiVisibilityKey(uid)) || 'null'));
    } catch {
      return normalizeKpiVisibilityState();
    }
  }

  function storedKpiVisibilityUpdatedAt(uid = currentUserUid()) {
    return uid ? (localStorage.getItem(kpiVisibilityUpdatedAtKey(uid)) || '') : '';
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

  function storeKpiVisibilityState(state, updatedAt = new Date().toISOString(), uid = currentUserUid()) {
    if (!uid) return;
    localStorage.setItem(kpiVisibilityKey(uid), JSON.stringify(normalizeKpiVisibilityState(state)));
    localStorage.setItem(kpiVisibilityUpdatedAtKey(uid), updatedAt);
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

  async function readCloudKpiVisibilityState(uid = currentUserUid()) {
    try {
      const ref = await dashboardPinCloudRef(uid);
      if (!ref) return null;
      const { getDoc } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
      const snap = await getDoc(ref);
      if (!snap.exists()) return null;
      const data = snap.data() || {};
      return {
        state: normalizeKpiVisibilityState(data.kpiVisibilityState),
        updatedAt: String(data.kpiVisibilityUpdatedAt || '')
      };
    } catch (e) {
      console.warn('readCloudKpiVisibilityState:', e.message);
      return null;
    }
  }

  async function writeCloudKpiVisibilityState(state, updatedAt = new Date().toISOString(), uid = currentUserUid()) {
    try {
      const ref = await dashboardPinCloudRef(uid);
      if (!ref) return false;
      const { setDoc } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
      await setDoc(ref, {
        kpiVisibilityState: normalizeKpiVisibilityState(state),
        kpiVisibilityUpdatedAt: updatedAt
      }, { merge: true });
      return true;
    } catch (e) {
      console.warn('writeCloudKpiVisibilityState:', e.message);
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

  async function syncKpiVisibilityState() {
    const uid = currentUserUid();
    if (!uid) return;

    const localExists = hasStoredKpiVisibilityState(uid);
    const localState = storedKpiVisibilityState(uid);
    const localUpdatedAt = storedKpiVisibilityUpdatedAt(uid);
    const cloudState = await readCloudKpiVisibilityState(uid);
    const cloudExists = !!cloudState?.updatedAt;
    const cloudVisibility = normalizeKpiVisibilityState(cloudState?.state);
    const cloudUpdatedAt = cloudState?.updatedAt || '';
    const localTs = Date.parse(localUpdatedAt || '') || 0;
    const cloudTs = Date.parse(cloudUpdatedAt || '') || 0;

    if (!localExists && cloudExists) {
      storeKpiVisibilityState(cloudVisibility, cloudUpdatedAt || new Date().toISOString(), uid);
      return;
    }

    if (localExists && !cloudExists) {
      await writeCloudKpiVisibilityState(localState, localUpdatedAt || new Date().toISOString(), uid);
      return;
    }

    if (localExists && cloudExists && JSON.stringify(localState) !== JSON.stringify(cloudVisibility)) {
      if (cloudTs > localTs) {
        storeKpiVisibilityState(cloudVisibility, cloudUpdatedAt || new Date().toISOString(), uid);
      } else {
        await writeCloudKpiVisibilityState(localState, localUpdatedAt || new Date().toISOString(), uid);
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

  function setDashboardPinDialog(title, message, confirmLabel = 'دخول') {
    const titleEl = document.getElementById('pwd-title');
    const messageEl = document.getElementById('pwd-message');
    const confirmEl = document.getElementById('pwd-confirm-btn');
    if (titleEl) titleEl.textContent = title || 'لوحة التحكم';
    if (messageEl) messageEl.innerHTML = message || 'هذه الصفحة خاصة بصاحب المحل فقط<br>أدخل كلمة المرور للمتابعة';
    if (confirmEl) confirmEl.textContent = confirmLabel;
  }

  function openDashboardPinPrompt(onSuccess, options = {}) {
    if (!dashboardPinEnabled()) {
      onSuccess?.();
      return;
    }

    dashboardPinSuccessAction = typeof onSuccess === 'function' ? onSuccess : null;
    setDashboardPinDialog(
      options.title || 'لوحة التحكم',
      options.message || 'هذه الصفحة خاصة بصاحب المحل فقط<br>أدخل كلمة المرور للمتابعة',
      options.confirmLabel || 'دخول'
    );

    const input = document.getElementById('pwd-input');
    const error = document.getElementById('pwd-error');
    if (input) input.value = '';
    if (error) error.style.display = 'none';
    document.getElementById('dash-pwd-ov')?.classList.add('open');
    setTimeout(() => input?.focus(), 280);
  }

  function setSensitiveKpiVisibility(key, visible) {
    const state = storedKpiVisibilityState();
    state[key] = !!visible;
    const updatedAt = new Date().toISOString();
    storeKpiVisibilityState(state, updatedAt);
    window.applySensitiveKpiVisibilityState?.();
    writeCloudKpiVisibilityState(state, updatedAt).catch(() => {});
  }

  function toggleSensitiveKpi(key, options = {}) {
    const state = storedKpiVisibilityState();
    const visible = !!state[key];
    if (visible) {
      setSensitiveKpiVisibility(key, false);
      return;
    }

    const reveal = () => setSensitiveKpiVisibility(key, true);
    if (options.requiresPin && dashboardPinEnabled()) {
      openDashboardPinPrompt(reveal, {
        title: options.title || 'كشف البيانات',
        message: options.message || 'أدخل كلمة سر لوحة التحكم للمتابعة',
        confirmLabel: options.confirmLabel || 'إظهار'
      });
      return;
    }
    reveal();
  }

  function closeDashboardPinModal() {
    document.getElementById('dash-pwd-ov')?.classList.remove('open');
  }

  window.closePwd = function closePwd() {
    dashboardPinSuccessAction = null;
    setDashboardPinDialog('لوحة التحكم', 'هذه الصفحة خاصة بصاحب المحل فقط<br>أدخل كلمة المرور للمتابعة', 'دخول');
    closeDashboardPinModal();
  };

  window.applySensitiveKpiVisibilityState = function applySensitiveKpiVisibilityState() {
    const state = storedKpiVisibilityState();
    Object.entries(KPI_VISIBILITY_FIELDS).forEach(([key, config]) => {
      const hidden = document.getElementById(config.hiddenId);
      const real = document.getElementById(config.realId);
      const visible = !!state[key];
      if (hidden) hidden.style.display = visible ? 'none' : 'inline';
      if (real) real.style.display = visible ? (config.realDisplay || 'inline') : 'none';
    });
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
    await syncKpiVisibilityState();
    window.refreshDashboardPasswordUI();
    window.applySensitiveKpiVisibilityState?.();
    window.renderSettings?.();
  };

  window.getPWD = function getPWD() {
    return '';
  };

  window.toggleDashboardPasswordField = function toggleDashboardPasswordField(inputId, btn) {
    const input = document.getElementById(inputId);
    if (!input) return;
    const showing = input.type === 'text';
    input.type = showing ? 'password' : 'text';
    if (btn) btn.textContent = showing ? '👁️' : '🙈';
  };

  window.openDashboard = function openDashboard(el) {
    window._dashboardAccessBtn = el;
    if (!dashboardPinEnabled()) {
      goPage('dashboard', el);
      renderDashboard();
      return;
    }
    openDashboardPinPrompt(() => {
      goPage('dashboard', window._dashboardAccessBtn);
      renderDashboard();
    });
  };

  window.confirmPwd = async function confirmPwd() {
    const input = document.getElementById('pwd-input');
    const error = document.getElementById('pwd-error');

    if (await verifyDashboardPin(input?.value || '')) {
      closeDashboardPinModal();
      const action = dashboardPinSuccessAction;
      dashboardPinSuccessAction = null;
      setDashboardPinDialog('لوحة التحكم', 'هذه الصفحة خاصة بصاحب المحل فقط<br>أدخل كلمة المرور للمتابعة', 'دخول');
      if (typeof action === 'function') action();
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

  window.toggleInstallmentKpi = function toggleInstallmentKpi(key) {
    const map = {
      total: 'inst_total',
      collected: 'inst_collected',
      expected: 'inst_expected',
      remaining: 'inst_remaining'
    };
    const stateKey = map[key];
    if (!stateKey) return;
    toggleSensitiveKpi(stateKey, key === 'collected' ? {
      requiresPin: true,
      title: 'إظهار الأرباح المحصلة',
      message: 'أدخل كلمة سر لوحة التحكم لإظهار أرباح التقسيط المحصلة',
      confirmLabel: 'إظهار'
    } : {});
  };

  window.toggleWarrantyKpi = function toggleWarrantyKpi(key) {
    const map = {
      count: 'warranty_count',
      total: 'warranty_total',
      profit: 'warranty_profit'
    };
    const stateKey = map[key];
    if (!stateKey) return;
    toggleSensitiveKpi(stateKey, key === 'profit' ? {
      requiresPin: true,
      title: 'إظهار أرباح الضمان',
      message: 'أدخل كلمة سر لوحة التحكم لإظهار أرباح مبيعات الضمان',
      confirmLabel: 'إظهار'
    } : {});
  };

  window.toggleInstProfit = function toggleInstProfit() {
    window.toggleInstallmentKpi('collected');
  };

  window.confirmInstProfit = function confirmInstProfit() {
    window.toggleInstallmentKpi('collected');
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
      await window.importCurrentLocalStateToSqlite?.(currentUserUid());
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
