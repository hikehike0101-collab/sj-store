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

function normalizeTelegramMessage(msg=''){
  const LTR_OPEN  = '\u2066';
  const LTR_CLOSE = '\u2069';
  return String(msg).replace(/#?\d[\d\s,./:()-]*(?:\s*(?:DA|\/شهر))?(?:\s*[×x]\s*\d+)?/g, part => {
    return /[\d]/.test(part) ? (LTR_OPEN + part + LTR_CLOSE) : part;
  });
}


// ====== TELEGRAM ======
async function tg(msg){
  if(localStorage.getItem('sj_tg_disabled')==='1') return;
  const token  = localStorage.getItem('sj_tg_token')||'';
  const chatId = localStorage.getItem('sj_tg_chatid')||'';
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
