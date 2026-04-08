// ====== auth.js — تسجيل الدخول Firebase ======

// ================================================================
//  FIREBASE AUTH — إقلاع محلي أولاً ثم مزامنة سحابية عند توفر الإنترنت
// ================================================================
(function initFirebaseAuthBootstrap() {
  const AUTH_SYNC_FLAG_KEY = 'sj_force_sync';
  const AUTH_LAST_SYNC_UID_KEY = 'sj_last_synced_uid';
  const AUTH_OFFLINE_ALLOWED_KEY = 'sj_offline_session_ok';
  let authRuntimeStarted = false;
  let authRuntimeReady = false;
  let authBootingUid = null;
  let authApi = null;

  function authCollections() {
    return window.APP_COLLECTIONS || ['products', 'sales', 'transactions', 'installments', 'debts', 'repairs', 'warranties', 'workers'];
  }

  function hasSqliteUserSnapshot(uid) {
    if (!uid) return false;
    try {
      const status = window.nativeSqlite?.statusSync?.(uid);
      return !!(status?.ok && Object.values(status.collections || {}).some(count => Number(count) > 0));
    } catch {
      return false;
    }
  }

  function hasLocalUserSnapshot(uid) {
    if (!uid) return false;
    if (currentUserUid() !== uid) return false;
    if (hasSqliteUserSnapshot(uid)) return true;
    return authCollections().some(col => localStorage.getItem('sj_' + col) !== null);
  }

  function hasOfflineSession() {
    const uid = currentUserUid();
    return localStorage.getItem(AUTH_OFFLINE_ALLOWED_KEY) === '1' && hasLocalUserSnapshot(uid);
  }

  function pendingOpsCount() {
    return Number(window.getPendingFirestoreOpsCount?.() || 0);
  }

  function offlineSyncMessage() {
    const count = pendingOpsCount();
    return count
      ? `⚠️ يعمل بدون إنترنت — ${count} تغييرات بانتظار المزامنة`
      : '⚠️ يعمل بدون إنترنت';
  }

  function applySyncResult(synced) {
    if (synced) {
      setSyncIndicator('online');
      return;
    }
    setSyncIndicator('offline', offlineSyncMessage());
  }

  function setSyncIndicator(state, msg) {
    const si = document.getElementById('sync-indicator');
    if (!si) return;
    si.style.display = 'flex';
    if (state === 'hidden') {
      si.style.display = 'none';
      return;
    }
    if (state === 'syncing') {
      si.innerHTML = `<span style="width:8px;height:8px;background:#F6AD55;border-radius:50%;display:inline-block;margin-left:6px"></span> ☁️ جاري المزامنة...`;
      return;
    }
    if (state === 'online') {
      si.innerHTML = `<span style="width:8px;height:8px;background:#38A169;border-radius:50%;animation:syncPulse 1.5s ease-in-out infinite;display:inline-block;margin-left:6px"></span> ☁️ متزامن`;
      return;
    }
    if (state === 'offline') {
      si.innerHTML = `<span style="width:8px;height:8px;background:#DD6B20;border-radius:50%;display:inline-block;margin-left:6px"></span> ${msg || '⚠️ يعمل بدون إنترنت'}`;
      return;
    }
    si.innerHTML = `<span style="color:var(--red,red)">❌ ${msg || 'تعذرت المزامنة'}</span>`;
  }

  function bootAppFromCache() {
    if (typeof renderTopDate === 'function') renderTopDate();
    if (typeof bootInitialPosPage === 'function') {
      bootInitialPosPage();
    } else if (typeof refreshAll === 'function') {
      refreshAll();
    }
    setTimeout(() => {
      if (typeof renderPOS === 'function') renderPOS();
    }, 30);
  }

  function showAuthOverlay() {
    const ov = document.getElementById('auth-overlay');
    if (ov) {
      ov.style.display = 'flex';
      ov.classList.remove('hide');
    }
  }

  function hideAuthOverlay() {
    const ov = document.getElementById('auth-overlay');
    if (ov) {
      ov.classList.add('hide');
      setTimeout(() => { ov.style.display = 'none'; }, 0);
    }
  }

  window.showAuthOverlay = showAuthOverlay;
  window.hideAuthOverlay = hideAuthOverlay;

  function setCachedEmailDisplay() {
    const emailEl = document.getElementById('settings-email-display');
    if (emailEl) emailEl.textContent = currentUserEmail() || '—';
  }

  function bootOfflineSession(reason) {
    if (!hasOfflineSession()) return false;
    window.importCurrentLocalStateToSqlite?.(currentUserUid());
    setCachedEmailDisplay();
    hideAuthOverlay();
    bootAppFromCache();
    const count = pendingOpsCount();
    const offlineMsg = count
      ? `⚠️ يعمل بدون إنترنت — ${count} تغييرات بانتظار المزامنة`
      : '⚠️ يعمل بدون إنترنت';
    setSyncIndicator('offline', offlineMsg);
    console.warn('Offline boot:', reason || 'cached session');
    return true;
  }

  async function tryInitAuthRuntime() {
    if (authRuntimeStarted || authRuntimeReady) return;
    authRuntimeStarted = true;

    try {
      const { initializeApp, getApps } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js');
      const authMod = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js');
      const dbMod = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js');
      const fsMod = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');

      const fbApp = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
      const auth = authMod.getAuth(fbApp);
      const db = dbMod.getDatabase(fbApp);
      const fs = fsMod.getFirestore(fbApp);

      try {
        await authMod.setPersistence(auth, authMod.browserLocalPersistence);
      } catch (e) {
        console.warn('setPersistence:', e.message);
      }

      authApi = { auth, db, fs, authMod, dbMod, fsMod };
      authRuntimeReady = true;

      window._fbAuth = auth;
      window._fbDB = db;
      window._fbRef = dbMod.ref;
      window._fbSet = dbMod.set;
      window._fbGet = dbMod.get;
      window._fs = fs;

      authMod.onAuthStateChanged(auth, user => {
        if (user) {
          if (!user.emailVerified) {
            document.getElementById('auth-verify-email').textContent = user.email;
            authShowSection('verify');
            showAuthOverlay();
          } else {
            authGoToApp(user);
          }
        } else if (!hasOfflineSession()) {
          authBootingUid = null;
          setSyncIndicator('hidden');
          showAuthOverlay();
        }
      });

      if (navigator.onLine && hasOfflineSession()) {
        setSyncIndicator('syncing');
      }
    } catch (e) {
      authRuntimeStarted = false;
      authRuntimeReady = false;
      console.warn('Firebase auth bootstrap failed:', e?.message || e);
      if (!bootOfflineSession('firebase unavailable')) {
        showAuthOverlay();
        authShowErr('تحقق من اتصالك بالإنترنت');
      }
    }
  }

  async function authGoToApp(user) {
    if (authBootingUid === user.uid) return;
    authBootingUid = user.uid;

    const previousUid = currentUserUid();
    const switchedUser = !!previousUid && previousUid !== user.uid;
    if (switchedUser) {
      window.clearUserDataCache?.();
    }

    setCurrentSessionUser(user.uid, user.email);
    localStorage.setItem(AUTH_OFFLINE_ALLOWED_KEY, '1');
    await window.importCurrentLocalStateToSqlite?.(user.uid);
    await window.syncUserScopedSecurityState?.();
    setCachedEmailDisplay();

    const needsSync =
      navigator.onLine &&
      (
        localStorage.getItem(AUTH_SYNC_FLAG_KEY) === '1' ||
        localStorage.getItem(AUTH_LAST_SYNC_UID_KEY) !== user.uid ||
        !hasLocalUserSnapshot(user.uid) ||
        pendingOpsCount() > 0
      );

    if (!navigator.onLine) {
      hideAuthOverlay();
      bootAppFromCache();
      const count = pendingOpsCount();
      const msg = count
        ? `⚠️ يعمل بدون إنترنت — ${count} تغييرات بانتظار المزامنة`
        : '⚠️ يعمل بدون إنترنت';
      setSyncIndicator('offline', offlineSyncMessage());
      authBootingUid = null;
      return;
    }

    window._fsUid = user.uid;
    window._fs = authApi.fs;

    if (!needsSync) {
      hideAuthOverlay();
      bootAppFromCache();
      setSyncIndicator('syncing');
      authBootingUid = null;

      authApi.dbMod.get(authApi.dbMod.ref(authApi.db, `users/${user.uid}/profile`))
        .then(snap => {
          if (snap.exists()) setCurrentStoreName(snap.val().storeName || 'SJ STORE');
        })
        .catch(() => {});

      initFirestore(user.uid)
        .then((synced) => {
          applySyncResult(synced);
        })
        .catch((e) => {
          console.error('❌ Background Firestore sync:', e.message);
          const count = pendingOpsCount();
          const msg = count
            ? `⚠️ يعمل بدون إنترنت — ${count} تغييرات بانتظار المزامنة`
            : '⚠️ يعمل بدون إنترنت';
          setSyncIndicator('offline', offlineSyncMessage());
        });

      console.log('✅ Fast local login on same device');
      return;
    }

    hideAuthOverlay();
    setSyncIndicator('syncing');

    authApi.dbMod.get(authApi.dbMod.ref(authApi.db, `users/${user.uid}/profile`))
      .then(snap => {
        if (snap.exists()) setCurrentStoreName(snap.val().storeName || 'SJ STORE');
      })
      .catch(() => {});

    try {
      authApi.fsMod.setDoc(authApi.fsMod.doc(authApi.fs, `users/${user.uid}/meta/lastLogin`), {
        lastLogin: new Date().toISOString(),
        email: user.email
      }).catch(() => {});

      const synced = await initFirestore(user.uid);
      if (synced) {
        localStorage.setItem(AUTH_LAST_SYNC_UID_KEY, user.uid);
        localStorage.removeItem(AUTH_SYNC_FLAG_KEY);
      }

      bootAppFromCache();
      applySyncResult(synced);
      console.log('✅ Firestore synced');
    } catch (e) {
      console.error('❌ Firestore:', e.message);
      const count = pendingOpsCount();
      const msg = count
        ? `⚠️ يعمل بدون إنترنت — ${count} تغييرات بانتظار المزامنة`
        : '⚠️ يعمل بدون إنترنت';
      setSyncIndicator('offline', msg);
    } finally {
      authBootingUid = null;
    }
  }

  window.authDoLogin = async function() {
    const email = document.getElementById('auth-login-email').value.trim();
    const pwd = document.getElementById('auth-login-pwd').value;
    if (!email || !pwd) {
      authShowErr('أدخل البريد الإلكتروني وكلمة المرور');
      return;
    }
    if (!authRuntimeReady) {
      authShowErr('تسجيل الدخول الأول يحتاج اتصالاً بالإنترنت');
      tryInitAuthRuntime();
      return;
    }
    authSetLoading('auth-btn-login', true);
    authClearMsgs();
    try {
      localStorage.setItem(AUTH_SYNC_FLAG_KEY, '1');
      const cred = await authApi.authMod.signInWithEmailAndPassword(authApi.auth, email, pwd);
      if (!cred.user.emailVerified) {
        document.getElementById('auth-verify-email').textContent = email;
        authShowSection('verify');
      }
    } catch (e) {
      authShowErr(authFbErr(e.code));
    }
    authSetLoading('auth-btn-login', false);
  };

  window.authDoRegister = async function() {
    const name = document.getElementById('auth-reg-name').value.trim();
    const email = document.getElementById('auth-reg-email').value.trim();
    const pwd = document.getElementById('auth-reg-pwd').value;
    const pwd2 = document.getElementById('auth-reg-pwd2').value;
    if (!name) { authShowErr('أدخل اسم المحل'); return; }
    if (!email) { authShowErr('أدخل البريد الإلكتروني'); return; }
    if (pwd.length < 6) { authShowErr('كلمة المرور يجب أن تكون 6 أحرف على الأقل'); return; }
    if (pwd !== pwd2) { authShowErr('كلمتا المرور غير متطابقتان'); return; }
    if (!authRuntimeReady) {
      authShowErr('إنشاء الحساب يحتاج اتصالاً بالإنترنت');
      tryInitAuthRuntime();
      return;
    }
    authSetLoading('auth-btn-register', true);
    authClearMsgs();
    try {
      const cred = await authApi.authMod.createUserWithEmailAndPassword(authApi.auth, email, pwd);
      await authApi.dbMod.set(authApi.dbMod.ref(authApi.db, `users/${cred.user.uid}/profile`), {
        storeName: name,
        email,
        createdAt: new Date().toISOString()
      });
      await authApi.authMod.sendEmailVerification(cred.user);
      document.getElementById('auth-verify-email').textContent = email;
      authShowSection('verify');
      authShowInfo('تم إنشاء الحساب! تحقق من بريدك الإلكتروني لتفعيل الحساب 📧');
    } catch (e) {
      authShowErr(authFbErr(e.code));
    }
    authSetLoading('auth-btn-register', false);
  };

  window.authDoForgot = async function() {
    const email = document.getElementById('auth-forgot-email').value.trim();
    if (!email) { authShowErr('أدخل البريد الإلكتروني'); return; }
    if (!authRuntimeReady) {
      authShowErr('استعادة كلمة المرور تحتاج اتصالاً بالإنترنت');
      tryInitAuthRuntime();
      return;
    }
    authSetLoading('auth-btn-forgot', true);
    authClearMsgs();
    try {
      await authApi.authMod.sendPasswordResetEmail(authApi.auth, email);
      authShowOk('✅ تم الإرسال — تحقق من بريدك الإلكتروني');
      document.getElementById('auth-forgot-email').value = '';
    } catch (e) {
      authShowErr(authFbErr(e.code));
    }
    authSetLoading('auth-btn-forgot', false);
  };

  window.authCheckVerify = async function() {
    if (!authRuntimeReady || !authApi.auth.currentUser) {
      authShowErr('تعذر التحقق بدون اتصال بالإنترنت');
      return;
    }
    authSetLoading('auth-btn-verify', true);
    try {
      await authApi.auth.currentUser.reload();
      if (authApi.auth.currentUser.emailVerified) {
        localStorage.setItem(AUTH_SYNC_FLAG_KEY, '1');
        authGoToApp(authApi.auth.currentUser);
      } else {
        authShowErr('لم يتم تأكيد الإيميل بعد — افتح بريدك وانقر على الرابط');
      }
    } catch (e) {
      authShowErr('حدث خطأ — حاول مرة أخرى');
    }
    authSetLoading('auth-btn-verify', false);
  };

  window.authResendVerify = async function() {
    if (!authRuntimeReady || !authApi.auth.currentUser) {
      authShowErr('إعادة الإرسال تحتاج اتصالاً بالإنترنت');
      return;
    }
    try {
      await authApi.authMod.sendEmailVerification(authApi.auth.currentUser);
      authShowOk('✅ تم إعادة إرسال رسالة التأكيد');
    } catch (e) {
      authShowErr('انتظر قليلاً قبل إعادة الإرسال');
    }
  };

  window.confirmLogout = function() {
    showConfirm(
      'تسجيل الخروج',
      'هل أنت متأكد من تسجيل الخروج من الحساب؟',
      () => window.authDoLogout(),
      '🚪'
    );
  };

  window.authDoLogout = async function() {
    window.clearUserDataCache?.();
    clearCurrentSessionState();
    localStorage.removeItem(AUTH_SYNC_FLAG_KEY);
    localStorage.removeItem(AUTH_LAST_SYNC_UID_KEY);
    localStorage.removeItem(AUTH_OFFLINE_ALLOWED_KEY);
    authBootingUid = null;
    window._fsUid = null;
    window._fsReady = false;
    window._fs = null;
    if (authRuntimeReady) {
      await authApi.authMod.signOut(authApi.auth);
    }
    authSwitchTab('login');
    setSyncIndicator('hidden');
    await window.syncUserScopedSecurityState?.();
    showAuthOverlay();
  };

  window.changeFirebasePwd = async function() {
    const oldPwd = document.getElementById('fb-old-pwd').value;
    const newPwd = document.getElementById('fb-new-pwd').value;
    const confirm = document.getElementById('fb-confirm-pwd').value;
    const msgEl = document.getElementById('fb-pwd-msg');
    const showMsg = (txt, ok) => {
      msgEl.textContent = txt;
      msgEl.style.display = 'block';
      msgEl.style.background = ok ? 'rgba(56,161,105,.12)' : 'rgba(229,62,62,.12)';
      msgEl.style.color = ok ? '#276749' : 'var(--red)';
      msgEl.style.border = ok ? '1px solid #9AE6B4' : '1px solid #FED7D7';
    };
    if (!oldPwd) { showMsg('❌ أدخل كلمة المرور الحالية', false); return; }
    if (!newPwd) { showMsg('❌ أدخل كلمة المرور الجديدة', false); return; }
    if (newPwd.length < 6) { showMsg('❌ كلمة المرور يجب أن تكون 6 أحرف على الأقل', false); return; }
    if (newPwd !== confirm) { showMsg('❌ كلمتا المرور غير متطابقتان', false); return; }
    if (!authRuntimeReady) { showMsg('❌ تغيير كلمة المرور يحتاج اتصالاً بالإنترنت', false); return; }
    try {
      const user = authApi.auth.currentUser;
      if (!user) { showMsg('❌ غير مسجل الدخول', false); return; }
      const credential = authApi.authMod.EmailAuthProvider.credential(user.email, oldPwd);
      await authApi.authMod.reauthenticateWithCredential(user, credential);
      await authApi.authMod.updatePassword(user, newPwd);
      showMsg('✅ تم تغيير كلمة المرور بنجاح', true);
      ['fb-old-pwd', 'fb-new-pwd', 'fb-confirm-pwd'].forEach(id => { document.getElementById(id).value = ''; });
    } catch (e) {
      const map = {
        'auth/wrong-password': '❌ كلمة المرور الحالية غير صحيحة',
        'auth/invalid-credential': '❌ كلمة المرور الحالية غير صحيحة',
        'auth/too-many-requests': '⚠️ محاولات كثيرة — انتظر قليلاً'
      };
      showMsg(map[e.code] || '❌ حدث خطأ — حاول مرة أخرى', false);
    }
  };

  window.changeFirebaseEmail = async function() {
    const pwd = document.getElementById('fb-pwd-for-email').value;
    const newEmail = document.getElementById('fb-new-email').value.trim();
    const msgEl = document.getElementById('fb-email-msg');
    const showMsg = (txt, ok) => {
      msgEl.textContent = txt;
      msgEl.style.display = 'block';
      msgEl.style.background = ok ? 'rgba(56,161,105,.12)' : 'rgba(229,62,62,.12)';
      msgEl.style.color = ok ? '#276749' : 'var(--red)';
      msgEl.style.border = ok ? '1px solid #9AE6B4' : '1px solid #FED7D7';
    };
    if (!pwd) { showMsg('❌ أدخل كلمة المرور للتأكيد', false); return; }
    if (!newEmail) { showMsg('❌ أدخل البريد الإلكتروني الجديد', false); return; }
    if (!authRuntimeReady) { showMsg('❌ تغيير البريد يحتاج اتصالاً بالإنترنت', false); return; }
    try {
      const user = authApi.auth.currentUser;
      if (!user) { showMsg('❌ غير مسجل الدخول', false); return; }
      const credential = authApi.authMod.EmailAuthProvider.credential(user.email, pwd);
      await authApi.authMod.reauthenticateWithCredential(user, credential);
      await authApi.authMod.updateEmail(user, newEmail);
      await authApi.authMod.sendEmailVerification(user);
      setCurrentSessionUser(currentUserUid(), newEmail);
      setCachedEmailDisplay();
      showMsg('✅ تم تغيير البريد — تحقق من بريدك الجديد', true);
      ['fb-pwd-for-email', 'fb-new-email'].forEach(id => { document.getElementById(id).value = ''; });
    } catch (e) {
      const map = {
        'auth/wrong-password': '❌ كلمة المرور غير صحيحة',
        'auth/invalid-credential': '❌ كلمة المرور غير صحيحة',
        'auth/email-already-in-use': '❌ هذا البريد مستخدم بالفعل',
        'auth/invalid-email': '❌ البريد الإلكتروني غير صالح'
      };
      showMsg(map[e.code] || '❌ حدث خطأ — حاول مرة أخرى', false);
    }
  };

  window.authSwitchTab = function(tab) {
    document.querySelectorAll('.auth-tab').forEach((t, i) => t.classList.toggle('active', (i === 0 && tab === 'login') || (i === 1 && tab === 'register')));
    const map = { login: 'auth-sec-login', register: 'auth-sec-register', forgot: 'auth-sec-forgot' };
    document.querySelectorAll('.auth-sec').forEach(s => s.classList.remove('active'));
    if (map[tab]) document.getElementById(map[tab]).classList.add('active');
    authClearMsgs();
  };

  function authShowSection(id) {
    document.querySelectorAll('.auth-sec').forEach(s => s.classList.remove('active'));
    document.getElementById('auth-sec-' + id).classList.add('active');
  }

  function authClearMsgs() {
    ['auth-msg-err', 'auth-msg-ok', 'auth-msg-info'].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.classList.remove('show');
        el.textContent = '';
      }
    });
  }

  function authShowErr(msg) {
    const el = document.getElementById('auth-msg-err');
    el.textContent = '❌ ' + msg;
    el.classList.add('show');
  }

  function authShowOk(msg) {
    const el = document.getElementById('auth-msg-ok');
    el.textContent = msg;
    el.classList.add('show');
  }

  function authShowInfo(msg) {
    const el = document.getElementById('auth-msg-info');
    el.textContent = msg;
    el.classList.add('show');
  }

  function authSetLoading(btnId, loading) {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    btn.disabled = loading;
    if (loading) {
      btn.dataset.orig = btn.innerHTML;
      btn.innerHTML = '<span class="auth-spinner"></span> جاري التحميل...';
    } else {
      btn.innerHTML = btn.dataset.orig || btn.innerHTML;
    }
  }

  function authFbErr(code) {
    const m = {
      'auth/invalid-email': 'البريد الإلكتروني غير صالح',
      'auth/user-not-found': 'لا يوجد حساب بهذا البريد الإلكتروني',
      'auth/wrong-password': 'البريد الإلكتروني أو كلمة المرور غير صحيحة',
      'auth/invalid-credential': 'البريد الإلكتروني أو كلمة المرور غير صحيحة',
      'auth/email-already-in-use': 'هذا البريد الإلكتروني مستخدم بالفعل',
      'auth/weak-password': 'كلمة المرور ضعيفة — استخدم 6 أحرف على الأقل',
      'auth/too-many-requests': 'محاولات كثيرة — انتظر قليلاً وحاول مجدداً',
      'auth/network-request-failed': 'تحقق من اتصالك بالإنترنت'
    };
    return m[code] || 'حدث خطأ — حاول مرة أخرى';
  }

  window.authTogglePwd = function(inputId, btn) {
    const inp = document.getElementById(inputId);
    inp.type = inp.type === 'password' ? 'text' : 'password';
    btn.textContent = inp.type === 'password' ? '👁️' : '🙈';
  };

  document.addEventListener('keypress', e => {
    if (e.key !== 'Enter') return;
    const ov = document.getElementById('auth-overlay');
    if (!ov || ov.style.display === 'none') return;
    const active = document.querySelector('.auth-sec.active');
    if (!active) return;
    if (active.id === 'auth-sec-login') window.authDoLogin?.();
    if (active.id === 'auth-sec-register') window.authDoRegister?.();
    if (active.id === 'auth-sec-forgot') window.authDoForgot?.();
  });

  window.addEventListener('online', () => {
    if (hasOfflineSession()) setSyncIndicator('syncing');
    tryInitAuthRuntime();
    if (window._fsReady && window._fsUid) {
      window.flushPendingFirestoreOps?.();
    }
  });

  window.addEventListener('offline', () => {
    if (hasOfflineSession()) {
      const count = pendingOpsCount();
      const msg = count
        ? `⚠️ يعمل بدون إنترنت — ${count} تغييرات بانتظار المزامنة`
        : '⚠️ يعمل بدون إنترنت';
      setSyncIndicator('offline', msg);
    }
  });

  if (!navigator.onLine) {
    if (!bootOfflineSession('navigator.offline')) {
      showAuthOverlay();
      authShowErr('الاتصال مطلوب لأول تسجيل دخول على هذا الجهاز');
    }
  }

  tryInitAuthRuntime();
})();
