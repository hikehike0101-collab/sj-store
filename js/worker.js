// ====== worker.js — العامل ======

// ====== WORKER ======

// ① تحويل البيانات من عامل واحد إلى مصفوفة
function getWorkers(){
  try{
    const data = DB.get('workers');
    if(Array.isArray(data) && data.length) return data;
    if(typeof readPendingOps === 'function'){
      const pendingWorkers = readPendingOps()
        .filter(op => op?.col === 'workers' && op.type === 'set' && op.data)
        .map(op => window.normalizeRecord ? normalizeRecord('workers', op.data) : op.data);
      if(pendingWorkers.length){
        DB.set('workers', pendingWorkers);
        return pendingWorkers;
      }
    }
    return Array.isArray(data) ? data : [];
  }catch(e){ return []; }
}

function saveWorkers(arr){
  DB.set('workers', arr.map(w => window.normalizeRecord ? normalizeRecord('workers', w) : w));
}

function getWorkerById(id){ return getWorkers().find(w=>w.id===id)||null; }

// للتوافق مع الكود القديم
function getWorker(){ return getWorkers()[0]||{}; }
function saveWorkerData(w){
  const workers = getWorkers();
  const idx = workers.findIndex(x=>x.id===w.id);
  if(idx>=0) workers[idx]=w; else workers.push(w);
  saveWorkers(workers);
}

function getWorkerMonthKey(date){
  const d = new Date(date || nowISO());
  return `${d.getFullYear()}-${d.getMonth()+1}`;
}

function recalculateWorkerBalances(worker, salaryOverride = null){
  const salary = salaryOverride ?? (worker.salary || 0);
  const resetMonth = worker.lastResetMonth || getWorkerMonthKey(nowISO());
  let runningRemaining = salary;
  const withdrawals = [...(worker.withdrawals || [])]
    .sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0))
    .map((item) => {
      const amount = item.amount || 0;
      if(getWorkerMonthKey(item.date) === resetMonth){
        runningRemaining = Math.max(0, runningRemaining - amount);
        return { ...item, remainingAfter: runningRemaining };
      }
      return item;
    });

  return {
    ...worker,
    salary,
    lastResetMonth: resetMonth,
    remaining: runningRemaining,
    withdrawals
  };
}


// تجديد راتب العمال كل شهر تلقائياً
function checkWorkerMonthlyReset(){
  const workers = getWorkers();
  if(!workers.length) return;
  const now   = new Date();
  const month = `${now.getFullYear()}-${now.getMonth()+1}`;
  let changed = false;
  workers.forEach(w=>{
    if(w.salary && w.lastResetMonth !== month){
      w.lastResetMonth = month;
      const refreshed = recalculateWorkerBalances(w, w.salary);
      w.remaining = refreshed.remaining;
      w.withdrawals = refreshed.withdrawals;
      changed = true;
    }
  });
  if(changed) saveWorkers(workers);
}

function renderWorker(){
  checkWorkerMonthlyReset();
  const workers = getWorkers();
  const emptyMsg  = document.getElementById('worker-empty-msg');
  const list      = document.getElementById('workers-list');
  const addBtn    = document.getElementById('worker-add-btn');

  if(!workers.length){
    emptyMsg.style.display = 'block';
    list.style.display     = 'none';
    if(addBtn) addBtn.style.display = 'block';
    return;
  }

  emptyMsg.style.display = 'none';
  list.style.display     = 'grid';
  // إخفاء زر الإضافة إذا وصلنا للحد الأقصى (2 عمال)
  if(addBtn) addBtn.style.display = workers.length >= 2 ? 'none' : 'block';

  list.innerHTML = workers.map(w=>{
    const withdrawals = w.withdrawals||[];
    const isFull = (w.remaining||0) <= 0;
    const rows = [...withdrawals].reverse().slice(0,5).map((s,idx)=>{
      const d = new Date(s.date);
      return `<tr>
        <td style="font-weight:700;color:var(--text-gray)">${withdrawals.length-idx}</td>
        <td style="font-weight:800;color:var(--red)">${fmt(s.amount)}</td>
        <td style="font-weight:600;color:var(--primary)">${fmt(s.remainingAfter)}</td>
        <td style="font-size:12px;color:var(--text-gray)">${d.getDate()}/${d.getMonth()+1}/${d.getFullYear()}</td>
        <td style="font-size:12px;color:var(--text-mid)">${s.note||'—'}</td>
      </tr>`;
    }).join('');

    return `<div class="tbl-wrap" style="padding:20px">
      <!-- رأس البطاقة -->
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
        <div style="display:flex;align-items:center;gap:10px">
          <div style="width:42px;height:42px;background:var(--primary-light);border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:20px">👷</div>
          <div>
            <div style="font-size:16px;font-weight:900;color:var(--text-dark)">${w.name}</div>
            <div style="font-size:12px;color:var(--text-gray)">راتب: ${fmt(w.salary||0)}/شهر</div>
          </div>
        </div>
        <div style="display:flex;gap:6px">
          <button class="ibtn ibtn-blue" onclick="openWorkerModal('${w.id}')">✏️</button>
          <button class="ibtn ibtn-red" onclick="deleteWorkerById('${w.id}')">🗑️</button>
        </div>
      </div>

      <!-- المتبقي + السحب -->
      <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 14px;background:var(--bg);border-radius:10px;margin-bottom:12px">
        <span style="font-size:12px;color:var(--text-gray)">المتبقي من الراتب</span>
        <span style="font-weight:900;font-size:16px;color:${isFull?'var(--red)':'var(--green)'}">${fmt(w.remaining||0)}</span>
      </div>
      ${isFull
        ? `<div style="padding:8px 12px;background:#FFF5F5;border-radius:8px;font-size:12px;color:var(--red);text-align:center;font-weight:700;margin-bottom:12px">⏳ سحبت كل مدخولك — انتظر الشهر القادم</div>`
        : `<button class="btn btn-primary" style="width:100%;margin-bottom:12px;font-size:12px;padding:8px" onclick="openWorkerWithdraw('${w.id}')">💸 سحب</button>`
      }

      <!-- جدول السحوبات -->
      ${withdrawals.length ? `
      <div style="font-size:12px;color:var(--text-gray);margin-bottom:8px;font-weight:600">آخر السحوبات (${withdrawals.length})</div>
      <table style="font-size:12px">
        <thead><tr><th>#</th><th>المبلغ</th><th>المتبقي</th><th>التاريخ</th><th>ملاحظة</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>` : `<div style="text-align:center;padding:16px;color:var(--text-gray);font-size:12px">لا توجد سحوبات بعد</div>`}
    </div>`;
  }).join('');
}

function openWorkerModal(workerId=null){
  const workers = getWorkers();
  const w = workerId ? workers.find(x=>x.id===workerId) : null;
  document.getElementById('worker-modal-title').textContent = w ? 'تعديل بيانات العامل' : 'إضافة عامل';
  document.getElementById('wm-id').value = w ? w.id : '';
  if(w){
    const parts = w.name.split(' ');
    document.getElementById('wm-fname').value  = parts[0]||'';
    document.getElementById('wm-lname').value  = parts.slice(1).join(' ')||'';
    document.getElementById('wm-salary').value = w.salary||0;
  } else {
    document.getElementById('wm-fname').value  = '';
    document.getElementById('wm-lname').value  = '';
    document.getElementById('wm-salary').value = '';
  }
  openModal('worker-modal-ov');
}

function saveWorker(){
  const fname    = document.getElementById('wm-fname').value.trim();
  const lname    = document.getElementById('wm-lname').value.trim();
  const salary   = parseFloat(document.getElementById('wm-salary').value)||0;
  const editId   = document.getElementById('wm-id').value;

  if(!fname)  { toast('أدخل الاسم','err'); return; }
  if(!lname)  { toast('أدخل اللقب','err'); return; }
  if(!salary) { toast('أدخل الراتب الشهري','err'); return; }

  const workers = getWorkers();
  const now     = new Date();
  const month   = `${now.getFullYear()}-${now.getMonth()+1}`;

  if(editId){
    // تعديل عامل موجود
    const idx = workers.findIndex(x=>x.id===editId);
    if(idx>=0){
      workers[idx].name   = fname+' '+lname;
      if(!workers[idx].lastResetMonth) workers[idx].lastResetMonth = month;
      workers[idx] = recalculateWorkerBalances(workers[idx], salary);
    }
  } else {
    // إضافة عامل جديد (حد أقصى 2)
    if(workers.length >= 2){ toast('الحد الأقصى عاملان فقط!','err'); return; }
    workers.push({
      id: genId(),
      name: fname+' '+lname,
      salary,
      remaining: salary,
      withdrawals: [],
      lastResetMonth: month,
      status: 'active'
    });
  }

  saveWorkers(workers);
  closeModal('worker-modal-ov');
  toast('✅ تم حفظ بيانات العامل');
  renderWorker();
}

function deleteWorkerById(workerId){
  const workers = getWorkers();
  const w = workers.find(x=>x.id===workerId);
  showConfirm('حذف العامل', `هل تريد حذف بيانات "${w?.name||'العامل'}"؟`, ()=>{
    saveWorkers(workers.filter(x=>x.id!==workerId));
    toast('🗑️ تم حذف العامل','warn');
    renderWorker();
  }, '🗑️');
}

function deleteWorker(){
  deleteWorkerById(getWorker().id);
}

function openWorkerWithdraw(workerId){
  const w = getWorkerById(workerId);
  if(!w || !w.name) return;
  document.getElementById('wd-worker-id').value = workerId;
  document.getElementById('wd-worker-name').textContent = `💸 سحب — ${w.name}`;
  document.getElementById('wd-remaining-display').textContent = fmt(w.remaining||0);
  document.getElementById('wd-amount').value = '';
  document.getElementById('wd-note').value   = '';
  openModal('worker-withdraw-ov');
}

function confirmWorkerWithdraw(){
  const workerId = document.getElementById('wd-worker-id').value;
  let w          = getWorkerById(workerId);
  if(!w) return;
  const amount = parseFloat(document.getElementById('wd-amount').value)||0;
  const note   = document.getElementById('wd-note').value.trim();

  if(!amount) { toast('أدخل المبلغ','err'); return; }
  if(amount > (w.remaining||0)) { toast('⚠️ المبلغ أكبر من المتبقي في الراتب!','err'); return; }

  w.remaining = (w.remaining||0) - amount;
  w.withdrawals = [...(w.withdrawals||[]), {
    amount, note,
    remainingAfter: w.remaining,
    date: nowISO()
  }];
  w = recalculateWorkerBalances(w, w.salary || 0);
  saveWorkerData(w);

  const sales = DB.get('sales');
  sales.push({
    id:genId(),
    productName:'سحب عامل — '+(note||w.name),
    workerId: w.id,
    workerName: w.name,
    type:'worker_withdrawal',
    qty:1, totalPaid:0,
    profit: -amount,
    date: nowISO()
  });
  DB.set('sales', sales);

  tg(`💸 <b>سحب عامل</b>\nالعامل: ${w.name}\nالمبلغ: ${fmt(amount)}\nالمتبقي: ${fmt(w.remaining)}${note?'\nملاحظة: '+note:''}\nالتاريخ: ${todayStr()}`);

  closeModal('worker-withdraw-ov');
  toast('✅ تم تسجيل السحب بنجاح');
  renderWorker();
}

function openOwnerWithdraw(){
  const c = calcAll(null);
  const availableProfit = Math.max(0, c.totalProfit);
  document.getElementById('ow-profit-display').textContent = fmt(availableProfit);
  document.getElementById('ow-profit-display').dataset.profit = availableProfit;
  document.getElementById('ow-amount').value = '';
  document.getElementById('ow-note').value   = '';
  openModal('owner-withdraw-ov');
}

function confirmOwnerWithdraw(){
  const amount = parseFloat(document.getElementById('ow-amount').value)||0;
  const note   = document.getElementById('ow-note').value.trim();
  const availableProfit = parseFloat(document.getElementById('ow-profit-display').dataset.profit||0);

  if(!amount){ toast('أدخل المبلغ','err'); return; }
  if(amount > availableProfit){
    toast(`⚠️ المبلغ أكبر من الأرباح المتاحة (${fmt(availableProfit)})!`,'err');
    return;
  }

  const sales = DB.get('sales');
  sales.push({
    id: genId(),
    productName: 'سحب صاحب المحل' + (note ? ' — '+note : ''),
    type: 'owner_withdrawal',
    qty: 1, totalPaid: 0,
    profit: -amount,
    date: nowISO()
  });
  DB.set('sales', sales);

  closeModal('owner-withdraw-ov');
  toast('✅ تم تسجيل السحب بنجاح');
  renderDashboard();
}
