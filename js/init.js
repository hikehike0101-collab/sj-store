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
