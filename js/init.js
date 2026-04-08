// ====== init.js - App bootstrap ======

let _currentPage = null;
let _navBtns = [];
const _pages = {};
let _topDateTimer = null;

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

pageMeta.warranties = ['سجل الضمان', 'متابعة مبيعات الضمان وإعادة طباعة الوثائق'];

function goPage(id, el) {
  if (_currentPage) _currentPage.classList.remove('active');
  if (_navBtns.length === 0) {
    document.querySelectorAll('.nav-btn').forEach((btn) => _navBtns.push(btn));
  }
  _navBtns.forEach((btn) => btn.classList.remove('active'));

  if (!_pages[id]) _pages[id] = document.getElementById(`page-${id}`);
  if (!_pages[id]) {
    console.warn('Page not found:', id);
    return;
  }

  _pages[id].classList.add('active');
  _currentPage = _pages[id];
  if (el) el.classList.add('active');

  const meta = pageMeta[id];
  if (meta) {
    document.getElementById('page-title').textContent = meta[0];
    document.getElementById('page-sub').textContent = meta[1];
  }

  const renderMap = {
    dashboard: renderDashboard,
    inventory: renderInventory,
    pos: renderPOS,
    cashier: renderCashier,
    installments: renderInstallments,
    debts: renderDebts,
    repairs: renderRepairs,
    worker: renderWorker,
    settings: renderSettings
  };

  renderMap.warranties = renderWarranties;

  if (renderMap[id]) setTimeout(renderMap[id], 10);
}

window.renderTopDate = function renderTopDate() {
  const now = new Date();
  const days = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
  const months = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
  const el = document.getElementById('top-date');
  if (!el) return;

  el.textContent = `${days[now.getDay()]} ${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}`;
  el.style.display = 'block';
};

function startTopDateTicker() {
  renderTopDate();
  if (_topDateTimer) clearInterval(_topDateTimer);
  _topDateTimer = setInterval(renderTopDate, 60 * 1000);
}

window.bootInitialPosPage = function bootInitialPosPage() {
  const posPage = document.getElementById('page-pos');
  const posBtn = document.getElementById('btn-pos');
  if (!posPage) return;

  if (_currentPage !== posPage) {
    goPage('pos', posBtn);
    return;
  }

  posPage.classList.add('active');
  _currentPage = posPage;
  if (posBtn) posBtn.classList.add('active');
  setTimeout(renderPOS, 10);
};

document.addEventListener('DOMContentLoaded', () => {
  setTimeout(checkInstallmentReminders, 3000);

  setInterval(() => {
    const activeId = document.querySelector('.page.active')?.id?.replace('page-', '');
    Object.keys(_cache).forEach((key) => {
      if (key !== activeId && key !== 'products' && key !== 'sales' && key !== 'transactions') {
        delete _cache[key];
      }
    });
  }, 10 * 60 * 1000);

  startTopDateTicker();
  bootInitialPosPage();
});
