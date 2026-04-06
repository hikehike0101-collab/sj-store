// ====== settings.js — الإعدادات ======

// ====== SETTINGS ======
// ====== نظام حذف البيانات بكلمة السر ======
// المنطق: كلمة السر ← نافذة تأكيد ← الحذف الفعلي
let _deletePendingAction = null;
let _deleteConfirmTitle  = '';
let _deleteConfirmMsg    = '';

async function clearFirestoreCollection(col){
  if(!(window._fsReady && window._fs && window._fsUid)) return;
  try {
    const { collection, getDocs, deleteDoc, doc } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
    const snap = await getDocs(collection(window._fs, fsPath(col)));
    for(const d of snap.docs){
      await deleteDoc(doc(window._fs, fsPath(col), d.id));
    }
  } catch(e) {
    console.warn(`clearFirestoreCollection [${col}]:`, e);
  }
}

function openDeletePwd(pwdTitle, pwdMsg, confirmTitle, confirmMsg, action){
  _deletePendingAction = action;
  _deleteConfirmTitle  = confirmTitle;
  _deleteConfirmMsg    = confirmMsg;
  document.getElementById('del-pwd-title').textContent = pwdTitle;
  document.getElementById('del-pwd-msg').textContent   = pwdMsg;
  document.getElementById('del-pwd-input').value = '';
  document.getElementById('del-pwd-error').style.display = 'none';
  const ov  = document.getElementById('del-pwd-ov');
  const box = document.getElementById('del-pwd-box');
  ov.style.opacity='1'; ov.style.pointerEvents='all';
  box.style.transform='translateY(0) scale(1)';
  setTimeout(()=>document.getElementById('del-pwd-input').focus(), 200);
}

function closeDeletePwd(){
  const ov  = document.getElementById('del-pwd-ov');
  const box = document.getElementById('del-pwd-box');
  ov.style.opacity='0'; ov.style.pointerEvents='none';
  box.style.transform='translateY(20px) scale(.97)';
}

function confirmDeletePwd(){
  const val = document.getElementById('del-pwd-input').value;
  if(val === getPWD()){
    // كلمة السر صحيحة → أغلق نافذة السر وافتح نافذة التأكيد
    closeDeletePwd();
    setTimeout(()=>{
      showConfirm(
        _deleteConfirmTitle,
        _deleteConfirmMsg,
        ()=>{ if(_deletePendingAction){ _deletePendingAction(); _deletePendingAction=null; } },
        '🗑️'
      );
    }, 300);
  } else {
    const err = document.getElementById('del-pwd-error');
    err.style.display='block';
    document.getElementById('del-pwd-input').value='';
    document.getElementById('del-pwd-input').focus();
    setTimeout(()=>err.style.display='none', 2500);
  }
}

document.addEventListener('DOMContentLoaded',()=>{
  const di = document.getElementById('del-pwd-input');
  if(di) di.addEventListener('keypress',e=>{ if(e.key==='Enter') confirmDeletePwd(); });
});

// حذف بيانات صفحة محددة
function deletePageData(page){
  const pageNames = {
    inventory:    'إدارة المخزون',
    installments: 'بيانات التقسيط',
    debts:        'سجل الديون',
    repairs:      'تصليح الأعطال'
  };
  const name = pageNames[page] || page;

  const execMap = {
    inventory: {
      col: 'products',
      key: 'sj_products',
      render: ()=>renderInventory()
    },
    installments: {
      col: 'installments',
      key: 'sj_installments',
      render: ()=>renderInstallments()
    },
    debts: {
      col: 'debts',
      key: 'sj_debts',
      render: ()=>renderDebts()
    },
    repairs: {
      col: 'repairs',
      key: 'sj_repairs',
      render: ()=>renderRepairs()
    }
  };

  openDeletePwd(
    `🔒 تأكيد الهوية`,
    `أدخل كلمة السر لحذف بيانات "${name}"`,
    `🗑️ تأكيد حذف بيانات ${name}`,
    `هل أنت متأكد من حذف جميع بيانات "${name}" نهائياً؟ لا يمكن التراجع عن هذا الإجراء.`,
    async ()=>{
      const cfg = execMap[page];
      if(cfg){
        try{ DB.set(cfg.col, []); }catch(e){}
        await clearFirestoreCollection(cfg.col);
        cfg.render();
        toast(`✅ تم حذف بيانات ${name} بنجاح`);
      }
    }
  );
}

function clearAllData(){
  openDeletePwd(
    `🔒 تأكيد الهوية`,
    `أدخل كلمة السر لمسح كل البيانات`,
    `⚠️ مسح كل البيانات نهائياً`,
    `هل أنت متأكد؟ سيتم حذف كل المنتجات والمبيعات والتقسيط والديون والتصليح والعمال. لا يمكن التراجع!`,
    async ()=>{
      const cols = window.APP_COLLECTIONS || ['products','sales','transactions','installments','debts','repairs','workers'];
      cols.forEach(k=>{
        try{ DB.set(k, []); }catch(e){}
      });
      try{DB.clearAll();}catch(e){}

      // حذف من Firestore نهائياً
      if(window._fsReady && window._fs && window._fsUid){
        try {
          for(const col of cols){
            await clearFirestoreCollection(col);
          }
          console.log('✅ تم مسح كل بيانات Firestore');
        } catch(e){ console.warn('clearAllData Firestore:', e); }
      }

      toast('✅ تم مسح كل البيانات بنجاح');
      renderSettings();
    }
  );
}

// ====== تبديل تبويبات الحساب ======
function switchAccTab(tab){
  document.getElementById('acc-tab-pwd').classList.toggle('active', tab==='pwd');
  document.getElementById('acc-tab-email').classList.toggle('active', tab==='email');
  document.getElementById('acc-sec-pwd').style.display   = tab==='pwd'   ? 'block' : 'none';
  document.getElementById('acc-sec-email').style.display = tab==='email' ? 'block' : 'none';
  // مسح الرسائل
  ['fb-pwd-msg','fb-email-msg'].forEach(id=>{
    const el = document.getElementById(id);
    if(el){ el.style.display='none'; el.textContent=''; }
  });
}

// ====== تغيير كلمة مرور Firebase ======
async function changeFirebasePwd(){
  const oldPwd  = document.getElementById('fb-old-pwd').value;
  const newPwd  = document.getElementById('fb-new-pwd').value;
  const confirm = document.getElementById('fb-confirm-pwd').value;
  const msgEl   = document.getElementById('fb-pwd-msg');

  const showMsg = (txt, ok) => {
    msgEl.textContent = txt;
    msgEl.style.display = 'block';
    msgEl.style.background = ok ? 'rgba(56,161,105,.12)' : 'rgba(229,62,62,.12)';
    msgEl.style.color = ok ? '#276749' : 'var(--red)';
    msgEl.style.border = ok ? '1px solid #9AE6B4' : '1px solid #FED7D7';
  };

  if(!oldPwd)       { showMsg('❌ أدخل كلمة المرور الحالية', false); return; }
  if(!newPwd)       { showMsg('❌ أدخل كلمة المرور الجديدة', false); return; }
  if(newPwd.length < 6) { showMsg('❌ كلمة المرور يجب أن تكون 6 أحرف على الأقل', false); return; }
  if(newPwd !== confirm){ showMsg('❌ كلمتا المرور غير متطابقتان', false); return; }

  try {
    // نحتاج Firebase Auth — نستخدمه عبر FDB إذا كان متاحاً
    if(typeof firebase !== 'undefined' || window._fbAuth) {
      const auth = window._fbAuth;
      const user = auth.currentUser;
      if(!user) { showMsg('❌ غير مسجل الدخول', false); return; }

      // إعادة المصادقة أولاً
      const { EmailAuthProvider, reauthenticateWithCredential, updatePassword } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js');
      const credential = EmailAuthProvider.credential(user.email, oldPwd);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, newPwd);

      showMsg('✅ تم تغيير كلمة المرور بنجاح', true);
      document.getElementById('fb-old-pwd').value = '';
      document.getElementById('fb-new-pwd').value = '';
      document.getElementById('fb-confirm-pwd').value = '';
    } else {
      showMsg('❌ Firebase غير متصل — تأكد من تشغيل firebase-db.js', false);
    }
  } catch(e) {
    const map = {
      'auth/wrong-password': '❌ كلمة المرور الحالية غير صحيحة',
      'auth/invalid-credential': '❌ كلمة المرور الحالية غير صحيحة',
      'auth/too-many-requests': '⚠️ محاولات كثيرة — انتظر قليلاً',
      'auth/network-request-failed': '❌ تحقق من اتصالك بالإنترنت',
    };
    showMsg(map[e.code] || '❌ حدث خطأ — حاول مرة أخرى', false);
  }
}

// ====== تغيير البريد الإلكتروني Firebase ======
async function changeFirebaseEmail(){
  const pwd      = document.getElementById('fb-pwd-for-email').value;
  const newEmail = document.getElementById('fb-new-email').value.trim();
  const msgEl    = document.getElementById('fb-email-msg');

  const showMsg = (txt, ok) => {
    msgEl.textContent = txt;
    msgEl.style.display = 'block';
    msgEl.style.background = ok ? 'rgba(56,161,105,.12)' : 'rgba(229,62,62,.12)';
    msgEl.style.color = ok ? '#276749' : 'var(--red)';
    msgEl.style.border = ok ? '1px solid #9AE6B4' : '1px solid #FED7D7';
  };

  if(!pwd)      { showMsg('❌ أدخل كلمة المرور للتأكيد', false); return; }
  if(!newEmail) { showMsg('❌ أدخل البريد الإلكتروني الجديد', false); return; }

  try {
    if(typeof firebase !== 'undefined' || window._fbAuth) {
      const auth = window._fbAuth;
      const user = auth.currentUser;
      if(!user) { showMsg('❌ غير مسجل الدخول', false); return; }

      const { EmailAuthProvider, reauthenticateWithCredential, updateEmail, sendEmailVerification } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js');
      const credential = EmailAuthProvider.credential(user.email, pwd);
      await reauthenticateWithCredential(user, credential);
      await updateEmail(user, newEmail);
      await sendEmailVerification(user);

      localStorage.setItem('sj_email', newEmail);
      document.getElementById('settings-email-display').textContent = newEmail;

      showMsg('✅ تم تغيير البريد الإلكتروني — تحقق من بريدك الجديد للتأكيد', true);
      document.getElementById('fb-pwd-for-email').value = '';
      document.getElementById('fb-new-email').value = '';
    } else {
      showMsg('❌ Firebase غير متصل', false);
    }
  } catch(e) {
    const map = {
      'auth/wrong-password': '❌ كلمة المرور غير صحيحة',
      'auth/invalid-credential': '❌ كلمة المرور غير صحيحة',
      'auth/email-already-in-use': '❌ هذا البريد مستخدم بالفعل',
      'auth/invalid-email': '❌ البريد الإلكتروني غير صالح',
      'auth/too-many-requests': '⚠️ محاولات كثيرة — انتظر قليلاً',
      'auth/network-request-failed': '❌ تحقق من اتصالك بالإنترنت',
    };
    showMsg(map[e.code] || '❌ حدث خطأ — حاول مرة أخرى', false);
  }
}

function renderSettings(){
  // عرض البريد الإلكتروني الحالي
  const emailEl = document.getElementById('settings-email-display');
  if(emailEl) emailEl.textContent = localStorage.getItem('sj_email') || '—';

  const token    = localStorage.getItem('sj_tg_token')||'';
  const chatId   = localStorage.getItem('sj_tg_chatid')||'';
  const disabled = localStorage.getItem('sj_tg_disabled')==='1';

  // لا نعرض التوكن المحفوظ — فقط placeholder يشير لوجوده
  document.getElementById('tg-token').value  = '';
  document.getElementById('tg-chatid').value = '';
  document.getElementById('tg-token').placeholder  = token  ? '●●●●●●●●●●●●●●●● (محفوظ)' : '123456789:AAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
  document.getElementById('tg-chatid').placeholder = chatId ? '●●●●●●●● (محفوظ)' : 'مثال: 123456789';

  const badge    = document.getElementById('tg-status-badge');
  const toggleBtn = document.getElementById('tg-toggle-btn');

  if(token && chatId && !disabled){
    badge.style.background='#F0FFF4'; badge.style.color='#276749';
    badge.textContent='✅ مفعّل';
    if(toggleBtn){ toggleBtn.textContent='⏸ تعطيل'; }
  } else if(token && chatId && disabled){
    badge.style.background='#FFFAF0'; badge.style.color='var(--orange)';
    badge.textContent='⏸ معطّل';
    if(toggleBtn){ toggleBtn.textContent='▶ تفعيل'; }
  } else {
    badge.style.background='#FFF5F5'; badge.style.color='var(--red)';
    badge.textContent='⭕ غير مفعّل';
    if(toggleBtn){ toggleBtn.textContent='⏸ تعطيل'; }
  }
}

function saveTgSettings(){
  const tokenInput  = document.getElementById('tg-token').value.trim();
  const chatIdInput = document.getElementById('tg-chatid').value.trim();

  // نبقي القيمة القديمة إذا الحقل فارغ
  const oldToken  = localStorage.getItem('sj_tg_token')||'';
  const oldChatId = localStorage.getItem('sj_tg_chatid')||'';

  const token  = tokenInput  || oldToken;
  const chatId = chatIdInput || oldChatId;

  if(!token)  { toast('أدخل توكن البوت','err'); return; }
  if(!chatId) { toast('أدخل Chat ID','err'); return; }

  localStorage.setItem('sj_tg_token',  token);
  localStorage.setItem('sj_tg_chatid', chatId);
  localStorage.removeItem('sj_tg_disabled');
  renderSettings();
  toast('✅ تم حفظ إعدادات التيليجرام');
}

function clearTgSettings(){
  showConfirm('إزالة إعدادات التيليجرام','هل تريد حذف التوكن والـ Chat ID؟',()=>{
    localStorage.removeItem('sj_tg_token');
    localStorage.removeItem('sj_tg_chatid');
    localStorage.removeItem('sj_tg_disabled');
    renderSettings();
    toast('✅ تم حذف إعدادات التيليجرام');
  },'🗑️');
}

function toggleTg(){
  const wasDisabled = localStorage.getItem('sj_tg_disabled')==='1';
  const token  = localStorage.getItem('sj_tg_token')||'';
  const chatId = localStorage.getItem('sj_tg_chatid')||'';

  if(wasDisabled){
    localStorage.removeItem('sj_tg_disabled');
    toast('✅ تم تفعيل التيليجرام');
  } else {
    localStorage.setItem('sj_tg_disabled','1');
    toast('⏸ تم تعطيل التيليجرام');
  }

  const nowDisabled = !wasDisabled;
  const badge  = document.getElementById('tg-status-badge');
  const btn    = document.getElementById('tg-toggle-btn');

  if(token && chatId && !nowDisabled){
    badge.style.background='#F0FFF4'; badge.style.color='#276749';
    badge.textContent='✅ مفعّل';
    if(btn) btn.textContent='⏸ تعطيل';
  } else if(token && chatId && nowDisabled){
    badge.style.background='#FFFAF0'; badge.style.color='var(--orange)';
    badge.textContent='⏸ معطّل';
    if(btn) btn.textContent='▶ تفعيل';
  } else {
    badge.style.background='#FFF5F5'; badge.style.color='var(--red)';
    badge.textContent='⭕ غير مفعّل';
    if(btn) btn.textContent='⏸ تعطيل';
  }
}

async function testTgBot(){
  // يقرأ من localStorage مباشرة وليس من الحقل الفارغ
  const token  = localStorage.getItem('sj_tg_token')||document.getElementById('tg-token').value.trim();
  const chatId = localStorage.getItem('sj_tg_chatid')||document.getElementById('tg-chatid').value.trim();

  if(!token)  { toast('أدخل توكن البوت أولاً','err'); return; }
  if(!chatId) { toast('أدخل Chat ID أولاً','err'); return; }

  toast('⏳ جاري إرسال رسالة اختبار...');

  try{
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`,{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({
        chat_id: chatId,
        parse_mode:'HTML',
        text: normalizeTelegramMessage(`✅ <b>SJ STORE Pro</b>\n\nتم ربط البرنامج بنجاح! 🎉\nستصلك الإشعارات التلقائية من الآن.\n\nالتاريخ: ${todayStr()}`)
      })
    });
    const data = await res.json();
    if(data.ok){
      toast('✅ تم الإرسال بنجاح! تحقق من تيليجرام');
    } else {
      toast('❌ خطأ: '+( data.description||'تحقق من التوكن والـ Chat ID'),'err');
    }
  } catch(e){
    toast('❌ تعذر الاتصال بالإنترنت','err');
  }
}
