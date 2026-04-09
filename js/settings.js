// ====== settings.js - unified settings logic ======

async function clearFirestoreCollection(col){
  if(!(window._fsReady && window._fs && window._fsUid)) return;
  try {
    const { collection, getDocs, deleteDoc, doc } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
    const snap = await getDocs(collection(window._fs, fsPath(col)));
    for (const item of snap.docs) {
      await deleteDoc(doc(window._fs, fsPath(col), item.id));
    }
  } catch (e) {
    console.warn(`clearFirestoreCollection [${col}]:`, e);
  }
}

window.clearFirestoreCollection = clearFirestoreCollection;

window.closeDeletePwd = function closeDeletePwd(){
  const ov = document.getElementById('del-pwd-ov');
  const box = document.getElementById('del-pwd-box');
  if (ov) {
    ov.style.opacity = '0';
    ov.style.pointerEvents = 'none';
  }
  if (box) {
    box.style.transform = 'translateY(20px) scale(.97)';
  }
};

function currentTelegramSettings(){
  return {
    token: getUserSetting('tg_token'),
    chatId: getUserSetting('tg_chatid'),
    disabled: getUserSetting('tg_disabled') === '1'
  };
}

window.switchAccTab = function switchAccTab(tab){
  document.getElementById('acc-tab-pwd')?.classList.toggle('active', tab === 'pwd');
  document.getElementById('acc-tab-email')?.classList.toggle('active', tab === 'email');
  const pwdSection = document.getElementById('acc-sec-pwd');
  const emailSection = document.getElementById('acc-sec-email');
  if (pwdSection) pwdSection.style.display = tab === 'pwd' ? 'block' : 'none';
  if (emailSection) emailSection.style.display = tab === 'email' ? 'block' : 'none';
  ['fb-pwd-msg', 'fb-email-msg'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.style.display = 'none';
      el.textContent = '';
    }
  });
};

window.refreshStorageEngineStatus = async function refreshStorageEngineStatus(){
  const badge = document.getElementById('storage-engine-badge');
  const uidEl = document.getElementById('storage-engine-uid');
  const pendingEl = document.getElementById('storage-engine-pending');
  const colsEl = document.getElementById('storage-engine-cols');
  const noteEl = document.getElementById('storage-engine-note');
  const modeEl = document.getElementById('storage-engine-mode');
  const uid = currentUserUid();

  if (uidEl) uidEl.textContent = uid || '—';
  if (pendingEl) pendingEl.textContent = String(window.getPendingFirestoreOpsCount?.() || 0);
  if (modeEl) modeEl.textContent = 'SQLite + Firebase';
  if (!badge || !colsEl || !noteEl) return;

  badge.style.background = '#FFFAF0';
  badge.style.color = 'var(--orange)';
  badge.textContent = 'جارٍ الفحص...';
  colsEl.innerHTML = '';
  noteEl.textContent = 'جارٍ قراءة حالة SQLite...';

  const status = await window.getSqliteMigrationStatus?.(uid);
  if (!status?.ok) {
    badge.style.background = '#FFF5F5';
    badge.style.color = 'var(--red)';
    badge.textContent = 'SQLite غير جاهزة';
    noteEl.textContent = 'تعذر قراءة حالة SQLite حالياً. اضغط "استيراد إلى SQLite" ثم أعد التحديث إذا كنت في بداية الترحيل.';
    return;
  }

  const cols = status.collections || {};
  const totalRecords = Object.values(cols).reduce((sum, value) => sum + (Number(value) || 0), 0);
  badge.style.background = '#F0FFF4';
  badge.style.color = '#276749';
  badge.textContent = totalRecords > 0 ? 'SQLite جاهزة' : 'SQLite فارغة';

  const labels = {
    warranties: 'الضمان',
    products: 'المنتجات',
    sales: 'المبيعات',
    transactions: 'المعاملات',
    installments: 'التقسيط',
    debts: 'الديون',
    repairs: 'التصليح',
    workers: 'العمال'
  };

  colsEl.innerHTML = (window.APP_COLLECTIONS || Object.keys(labels)).map((col) => {
    const count = Number(cols[col] || 0);
    return `
      <div style="background:var(--bg);border-radius:10px;padding:10px 12px">
        <div style="font-size:11px;color:var(--text-gray);margin-bottom:4px">${labels[col] || col}</div>
        <div style="font-size:18px;font-weight:900;color:var(--text-dark)">${count}</div>
      </div>
    `;
  }).join('');

  noteEl.textContent = totalRecords > 0
    ? `قاعدة SQLite تحتوي حالياً على ${totalRecords} سجل محلي، والعمليات المعلقة الحالية هي ${window.getPendingFirestoreOpsCount?.() || 0}.`
    : 'SQLite موجودة لكنها لا تحتوي سجلات للمستخدم الحالي بعد. إذا كانت لديك بيانات حالية فاضغط "استيراد إلى SQLite".';
};

window.forceImportCurrentStateToSqlite = async function forceImportCurrentStateToSqlite(){
  const uid = currentUserUid();
  if (!uid) {
    toast('سجل الدخول أولاً', 'err');
    return;
  }
  const ok = await window.importCurrentLocalStateToSqlite?.(uid);
  if (ok) {
    toast('✅ تم استيراد البيانات الحالية إلى SQLite');
    await window.refreshStorageEngineStatus?.();
    return;
  }
  toast('❌ تعذر استيراد البيانات إلى SQLite', 'err');
};

window.renderSettings = function renderSettings(){
  window.refreshStorageEngineStatus?.();

  const emailEl = document.getElementById('settings-email-display');
  if (emailEl) emailEl.textContent = currentUserEmail() || '—';

  const { token, chatId, disabled } = currentTelegramSettings();
  const tokenInput = document.getElementById('tg-token');
  const chatInput = document.getElementById('tg-chatid');
  const badge = document.getElementById('tg-status-badge');
  const toggleBtn = document.getElementById('tg-toggle-btn');

  if (tokenInput) {
    tokenInput.value = '';
    tokenInput.placeholder = token ? '•••••••••••••••• (محفوظ)' : '123456789:AAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
  }
  if (chatInput) {
    chatInput.value = '';
    chatInput.placeholder = chatId ? '•••••••• (محفوظ)' : 'مثال: 123456789';
  }

  if (!badge) return;

  if (token && chatId && !disabled) {
    badge.style.background = '#F0FFF4';
    badge.style.color = '#276749';
    badge.textContent = '✅ مفعّل';
    if (toggleBtn) toggleBtn.textContent = '⏸ تعطيل';
    return;
  }

  if (token && chatId && disabled) {
    badge.style.background = '#FFFAF0';
    badge.style.color = 'var(--orange)';
    badge.textContent = '⏸ معطّل';
    if (toggleBtn) toggleBtn.textContent = '▶ تفعيل';
    return;
  }

  badge.style.background = '#FFF5F5';
  badge.style.color = 'var(--red)';
  badge.textContent = '⭘ غير مفعّل';
  if (toggleBtn) toggleBtn.textContent = '⏸ تعطيل';
};

window.saveTgSettings = function saveTgSettings(){
  const uid = currentUserUid();
  if (!uid) {
    toast('سجل الدخول أولاً لحفظ الإعدادات', 'err');
    return;
  }

  const tokenInput = document.getElementById('tg-token')?.value.trim() || '';
  const chatIdInput = document.getElementById('tg-chatid')?.value.trim() || '';
  const current = currentTelegramSettings();
  const token = tokenInput || current.token;
  const chatId = chatIdInput || current.chatId;

  if (!token) { toast('أدخل توكن البوت', 'err'); return; }
  if (!chatId) { toast('أدخل Chat ID', 'err'); return; }

  setUserSetting('tg_token', token, uid);
  setUserSetting('tg_chatid', chatId, uid);
  removeUserSetting('tg_disabled', uid);
  renderSettings();
  toast('✅ تم حفظ إعدادات التيليجرام');
};

window.clearTgSettings = function clearTgSettings(){
  showConfirm('إزالة إعدادات التيليجرام', 'هل تريد حذف التوكن والـ Chat ID؟', () => {
    const uid = currentUserUid();
    removeUserSetting('tg_token', uid);
    removeUserSetting('tg_chatid', uid);
    removeUserSetting('tg_disabled', uid);
    renderSettings();
    toast('✅ تم حذف إعدادات التيليجرام');
  }, '🗑️');
};

window.toggleTg = function toggleTg(){
  const uid = currentUserUid();
  if (!uid) {
    toast('سجل الدخول أولاً', 'err');
    return;
  }

  const { token, chatId, disabled } = currentTelegramSettings();
  if (!token || !chatId) {
    toast('احفظ التوكن والـ Chat ID أولاً', 'err');
    return;
  }

  if (disabled) {
    removeUserSetting('tg_disabled', uid);
    toast('✅ تم تفعيل التيليجرام');
  } else {
    setUserSetting('tg_disabled', '1', uid);
    toast('⏸ تم تعطيل التيليجرام');
  }

  renderSettings();
};

window.testTgBot = async function testTgBot(){
  const tokenInput = document.getElementById('tg-token')?.value.trim() || '';
  const chatIdInput = document.getElementById('tg-chatid')?.value.trim() || '';
  const current = currentTelegramSettings();
  const token = tokenInput || current.token;
  const chatId = chatIdInput || current.chatId;

  if (!token)  { toast('أدخل توكن البوت أولاً', 'err'); return; }
  if (!chatId) { toast('أدخل Chat ID أولاً', 'err'); return; }

  toast('⏳ جاري إرسال رسالة اختبار...');

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: String(chatId).trim(),
        parse_mode: 'HTML',
        text: normalizeTelegramMessage(`✅ <b>SJ STORE Pro</b>\n\nتم ربط البرنامج بنجاح!\nستصلك الإشعارات التلقائية من الآن.\n\nالتاريخ: ${todayStr()}`)
      })
    });
    const data = await res.json();
    if (data.ok) {
      toast('✅ تم الإرسال بنجاح! تحقق من تيليجرام');
    } else {
      toast('❌ خطأ: ' + (data.description || 'تحقق من التوكن والـ Chat ID'), 'err');
    }
  } catch (e) {
    toast('❌ تعذر الاتصال بالإنترنت', 'err');
  }
};

window.clearAllData = function clearAllData(){
  window.openDeletePwd(
    '🔒 تأكيد الهوية',
    'أدخل كلمة السر لمسح كل البيانات',
    '⚠️ مسح كل البيانات نهائياً',
    'هل أنت متأكد؟ سيتم حذف كل المنتجات والمبيعات والتقسيط والديون والتصليح والعمال. لا يمكن التراجع!',
    async () => {
      const cols = window.APP_COLLECTIONS || ['products', 'sales', 'transactions', 'installments', 'debts', 'repairs', 'warranties', 'workers'];
      cols.forEach(col => {
        try { DB.set(col, []); } catch {}
      });
      await window.importCurrentLocalStateToSqlite?.(currentUserUid());

      if (window._fsReady && window._fs && window._fsUid) {
        try {
          for (const col of cols) {
            await clearFirestoreCollection(col);
          }
        } catch (e) {
          console.warn('clearAllData Firestore:', e);
        }
      }

      renderSettings();
      toast('✅ تم مسح كل البيانات بنجاح');
    }
  );
};
