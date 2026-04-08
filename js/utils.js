// ====== utils.js — دوال مشتركة ======

// ====== MODAL ======
const _modalCache = {};
function openModal(id){
  if(!_modalCache[id]) _modalCache[id] = document.getElementById(id);
  if(_modalCache[id]) _modalCache[id].classList.add('open');
}
function closeModal(id){
  if(!_modalCache[id]) _modalCache[id] = document.getElementById(id);
  if(_modalCache[id]) _modalCache[id].classList.remove('open');
}

// ====== CONFIRM ======
let _confCB=null;
function showConfirm(title,msg,cb,icon='⚠️'){
  document.getElementById('conf-title').textContent=title;
  document.getElementById('conf-msg').textContent=msg;
  document.getElementById('conf-icon').textContent=icon;
  document.getElementById('confirm-ov').classList.add('open');
  _confCB=cb;
  document.getElementById('conf-yes').onclick=()=>{closeConfirm();if(_confCB)_confCB()};
}
function closeConfirm(){document.getElementById('confirm-ov').classList.remove('open')}

// ====== TOAST ======
function toast(msg,type='ok'){
  const t=document.getElementById('toast');
  t.textContent=msg;
  t.style.background=type==='err'?'#E53E3E':type==='warn'?'#DD6B20':'#1A1A2E';
  t.classList.add('show');
  setTimeout(()=>t.classList.remove('show'),2800);
}
// ====== HELPERS ======
function fmt(n){return Number(n||0).toLocaleString('fr-DZ')+' DA'}
function num(n){return Number(n||0).toLocaleString('fr-DZ')}
function todayStr(){return new Date().toLocaleDateString('ar-DZ')}
function nowISO(){return new Date().toISOString()}
function genId(){return Date.now().toString(36)+Math.random().toString(36).slice(2,5)}

window._sessionState = window._sessionState || {
  uid: localStorage.getItem('sj_uid') || '',
  email: localStorage.getItem('sj_email') || '',
  storeName: localStorage.getItem('sj_store_name') || ''
};

function currentUserUid(){
  return window._sessionState?.uid || localStorage.getItem('sj_uid') || window._fsUid || '';
}

function currentUserEmail(){
  return window._sessionState?.email || localStorage.getItem('sj_email') || '';
}

function currentStoreName(){
  return window._sessionState?.storeName || localStorage.getItem('sj_store_name') || 'SJ STORE';
}

function setCurrentSessionUser(uid = '', email = ''){
  const nextUid = String(uid || '').trim();
  const nextEmail = String(email || '').trim();
  window._sessionState = {
    ...(window._sessionState || {}),
    uid: nextUid,
    email: nextEmail
  };
  if(nextUid) localStorage.setItem('sj_uid', nextUid);
  else localStorage.removeItem('sj_uid');
  if(nextEmail) localStorage.setItem('sj_email', nextEmail);
  else localStorage.removeItem('sj_email');
}

function setCurrentStoreName(name = ''){
  const nextName = String(name || '').trim();
  window._sessionState = {
    ...(window._sessionState || {}),
    storeName: nextName
  };
  if(nextName) localStorage.setItem('sj_store_name', nextName);
  else localStorage.removeItem('sj_store_name');
}

function clearCurrentSessionState(){
  window._sessionState = { uid:'', email:'', storeName:'' };
  localStorage.removeItem('sj_uid');
  localStorage.removeItem('sj_email');
  localStorage.removeItem('sj_store_name');
}

function userScopedStorageKey(name, uid = currentUserUid()){
  return uid ? `sj_user_${uid}_${name}` : `sj_${name}`;
}

function getUserSetting(name, fallback = ''){
  const uid = currentUserUid();
  if(uid){
    const scoped = localStorage.getItem(userScopedStorageKey(name, uid));
    if(scoped !== null) return scoped;
  }
  const legacy = localStorage.getItem(`sj_${name}`);
  return legacy !== null ? legacy : fallback;
}

function setUserSetting(name, value, uid = currentUserUid()){
  if(!uid) return;
  localStorage.setItem(userScopedStorageKey(name, uid), value);
  localStorage.removeItem(`sj_${name}`);
}

function removeUserSetting(name, uid = currentUserUid()){
  if(uid) localStorage.removeItem(userScopedStorageKey(name, uid));
  localStorage.removeItem(`sj_${name}`);
}

function hasUserSetting(name, uid = currentUserUid()){
  if(uid && localStorage.getItem(userScopedStorageKey(name, uid)) !== null) return true;
  return localStorage.getItem(`sj_${name}`) !== null;
}

function normalizeTelegramMessage(msg=''){
  const LTR_OPEN  = '\u2066';
  const LTR_CLOSE = '\u2069';
  return String(msg).replace(/#?\d[\d\s,./:()-]*(?:\s*(?:DA|\/شهر))?(?:\s*[×x]\s*\d+)?/g, part => {
    return /[\d]/.test(part) ? (LTR_OPEN + part + LTR_CLOSE) : part;
  });
}


// ====== TELEGRAM ======
async function tg(msg){
  window.migrateUserScopedSettings?.();
  if(getUserSetting('tg_disabled')==='1') return;
  const token  = getUserSetting('tg_token');
  const chatId = getUserSetting('tg_chatid');
  if(!token || !chatId) {
    console.warn('تيليجرام: لم يتم إعداد التوكن أو Chat ID');
    return;
  }
  try{
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`,{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({
        chat_id: String(chatId).trim(),
        text: normalizeTelegramMessage(msg),
        parse_mode:'HTML'
      })
    });
    const data = await res.json();
    if(!data.ok) {
      console.warn('تيليجرام خطأ:', data.description);
    }
  }catch(e){
    console.warn('تيليجرام fetch error:', e.message);
  }
}
