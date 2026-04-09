// ====== warranties.js - سجل الضمان ======

let _warrantyEditId = null;

function warrantyFormData(prefix = 'warr') {
  const pick = (field) => document.getElementById(`${prefix}-${field}`)?.value.trim() || '';
  return {
    customerName: pick('name'),
    phone: pick('phone'),
    color: pick('color'),
    imei: pick('imei'),
    duration: pick('duration')
  };
}

function buildWarrantyProductSnapshot(product, unitPrice) {
  return {
    id: product?.id || '',
    name: product?.name || '',
    ram: product?.ram || '',
    storage: product?.storage || '',
    battery: product?.battery || '',
    barcode: product?.barcode || '',
    color: product?.color || '',
    productType: product?.productType || '',
    price: Number(unitPrice || product?.price || 0)
  };
}

function warrantyPrintableProduct(record) {
  const liveProduct = DB.get('products').find((item) => item.id === record.productId);
  const snapshot = record.productSnapshot || {};
  return {
    ...snapshot,
    ...liveProduct,
    id: record.productId || snapshot.id || liveProduct?.id || '',
    name: record.productName || snapshot.name || liveProduct?.name || '',
    price: Number(record.unitPrice || snapshot.price || liveProduct?.price || 0),
    barcode: record.imei || snapshot.barcode || liveProduct?.barcode || '',
    color: record.color || snapshot.color || liveProduct?.color || ''
  };
}

function warrantyPrintPayload(record) {
  return {
    name: record.customerName || '',
    phone: record.phone || '',
    color: record.color || '',
    imei: record.imei || '',
    duration: record.duration || ''
  };
}

function updateWarrantyLinkedRecords(record) {
  if (!record?.saleId) return;

  const sales = DB.get('sales').slice();
  const saleIdx = sales.findIndex((item) => item.id === record.saleId);
  if (saleIdx >= 0) {
    sales[saleIdx] = {
      ...sales[saleIdx],
      customerName: record.customerName,
      phone: record.phone,
      warrantyDuration: record.duration,
      imei: record.imei,
      color: record.color
    };
    DB.set('sales', sales);
  }

  if (!record.transactionId) return;
  const tx = DB.get('transactions').slice();
  const txIdx = tx.findIndex((item) => item.id === record.transactionId);
  if (txIdx >= 0) {
    tx[txIdx] = {
      ...tx[txIdx],
      customerName: record.customerName,
      phone: record.phone,
      warrantyDuration: record.duration
    };
    DB.set('transactions', tx);
  }
}

function restoreWarrantyStock(record) {
  if (!record?.productId || !record?.qty) return;
  const products = DB.get('products').slice();
  const idx = products.findIndex((item) => item.id === record.productId);
  if (idx < 0) return;
  products[idx] = {
    ...products[idx],
    qty: Number(products[idx].qty || 0) + Number(record.qty || 0)
  };
  DB.set('products', products);
}

function unlinkWarrantyFromSale(warrantyId) {
  if (!warrantyId) return;
  const sales = DB.get('sales').slice();
  const idx = sales.findIndex((item) => item.warrantyId === warrantyId);
  if (idx < 0) return;
  sales[idx] = { ...sales[idx] };
  delete sales[idx].warrantyId;
  DB.set('sales', sales);
}

window.removeWarrantyRecord = function removeWarrantyRecord(id, options = {}) {
  const record = DB.get('warranties').find((item) => item.id === id);
  if (!record) return null;
  DB.deleteOne('warranties', id);
  if (!options.keepSaleLink) unlinkWarrantyFromSale(id);
  return record;
};

function warrantyDateLabel(value) {
  const date = new Date(value || Date.now());
  if (Number.isNaN(date.getTime())) return '—';
  return `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
}

window.confirmWarrantySale = async function confirmWarrantySale() {
  if (typeof _posProd === 'undefined' || !_posProd) return;

  const form = warrantyFormData('warr');
  if (!form.customerName) { toast('أدخل اسم الزبون', 'err'); return; }
  if (!form.phone) { toast('أدخل رقم الهاتف', 'err'); return; }
  if (!form.duration) { toast('أدخل مدة الضمان', 'err'); return; }
  if (typeof ensureSaleStockAvailable === 'function' && !ensureSaleStockAvailable()) return;

  const qty = typeof _saleQty === 'number' ? _saleQty : 1;
  const unitPrice = typeof currentSaleUnitPrice === 'function' ? currentSaleUnitPrice() : Number(_posProd.price || 0);
  const unitCost = typeof currentSaleUnitCost === 'function' ? currentSaleUnitCost() : Number(_posProd.cost || 0);
  const totalPrice = unitPrice * qty;
  const profit = totalPrice - (unitCost * qty);
  const saleDate = nowISO();
  const saleId = genId();
  const warrantyId = genId();

  const sale = {
    id: saleId,
    productId: _posProd.id,
    productName: _posProd.name,
    type: 'warranty',
    qty,
    totalPaid: totalPrice,
    profit,
    customerName: form.customerName,
    phone: form.phone,
    warrantyId,
    date: saleDate,
    selectedProducts: [{
      id: _posProd.id,
      name: _posProd.name || '',
      qty,
      price: unitPrice,
      cost: unitCost
    }],
    warrantyDuration: form.duration,
    imei: form.imei,
    color: form.color
  };

  const sales = DB.get('sales').slice();
  sales.push(sale);
  DB.set('sales', sales);

  const transaction = DB.addTransaction({
    type: 'warranty',
    productName: _posProd.name,
    productId: _posProd.id,
    customerName: form.customerName,
    phone: form.phone,
    qty,
    salePrice: totalPrice,
    profit,
    cost: unitCost * qty,
    warrantyDuration: form.duration,
    date: saleDate,
    saleId
  });

  const warrantyRecord = DB.saveOne('warranties', {
    id: warrantyId,
    saleId,
    transactionId: transaction?.id || '',
    productId: _posProd.id,
    productName: _posProd.name,
    customerName: form.customerName,
    phone: form.phone,
    color: form.color,
    imei: form.imei,
    duration: form.duration,
    qty,
    unitPrice,
    unitCost,
    totalPrice,
    profit,
    date: saleDate,
    productSnapshot: buildWarrantyProductSnapshot(_posProd, unitPrice)
  });

  if (typeof deductStock === 'function' && !deductStock(_posProd.id, qty)) return;

  tg(`🛡️ <b>بيع ضمان جديد</b>\nالزبون: ${form.customerName}\nالمنتج: ${_posProd.name}\nالكمية: ${qty}\nالمبلغ: ${fmt(totalPrice)}\nمدة الضمان: ${form.duration}\nالتاريخ: ${todayStr()}`);

  await printWarranty(warrantyPrintableProduct(warrantyRecord), warrantyPrintPayload(warrantyRecord));

  closeModal('pos-sale-ov');
  toast('✅ تم تسجيل بيع الضمان وحفظ السجل');
  renderPOS();
  if (document.getElementById('page-warranties')?.classList.contains('active')) renderWarranties();
};

window.renderWarranties = function renderWarranties() {
  const q = (document.getElementById('warranty-search')?.value || '').trim().toLowerCase();
  let records = DB.get('warranties').slice().sort((a, b) => Date.parse(b.date || 0) - Date.parse(a.date || 0));

  if (q) {
    records = records.filter((item) =>
      [item.customerName, item.phone, item.productName, item.imei, item.duration]
        .some((value) => String(value || '').toLowerCase().includes(q))
    );
  }

  const tbody = document.getElementById('warranty-tbody');
  const empty = document.getElementById('warranty-empty');
  const countEl = document.getElementById('warranty-count');
  const kpiCount = document.getElementById('warranty-kpi-count');
  const kpiTotal = document.getElementById('warranty-kpi-total');
  const kpiProfit = document.getElementById('warranty-kpi-profit');
  if (!tbody || !empty) return;

  if (countEl) countEl.textContent = `${records.length} سجل`;
  if (kpiCount) kpiCount.textContent = String(records.length);
  if (kpiTotal) kpiTotal.textContent = num(records.reduce((sum, item) => sum + Number(item.totalPrice || 0), 0));
  if (kpiProfit) kpiProfit.textContent = num(records.reduce((sum, item) => sum + Number(item.profit || 0), 0));

  if (!records.length) {
    tbody.innerHTML = '';
    empty.style.display = 'block';
    return;
  }

  empty.style.display = 'none';
  tbody.innerHTML = records.map((item, idx) => `
    <tr>
      <td>${idx + 1}</td>
      <td>
        <div style="font-weight:800;color:var(--text-dark)">${item.customerName || '—'}</div>
        <div style="font-size:12px;color:var(--text-gray);margin-top:4px">${item.phone || '—'}</div>
      </td>
      <td>
        <div style="font-weight:700">${item.productName || '—'}</div>
        <div style="font-size:12px;color:var(--text-gray);margin-top:4px">الكمية: ${item.qty || 1}</div>
      </td>
      <td>
        <div style="font-size:12px;color:var(--text-mid)">المدة: <b>${item.duration || '—'}</b></div>
        <div style="font-size:12px;color:var(--text-mid);margin-top:4px">IMEI: ${item.imei || '—'}</div>
        <div style="font-size:12px;color:var(--text-mid);margin-top:4px">اللون: ${item.color || '—'}</div>
      </td>
      <td>
        <div style="font-weight:900;color:var(--primary)">${fmt(item.totalPrice || 0)}</div>
        <div style="font-size:12px;color:#276749;margin-top:4px">ربح: ${fmt(item.profit || 0)}</div>
      </td>
      <td>${warrantyDateLabel(item.date)}</td>
      <td style="text-align:center">
        <div class="act-btns" style="justify-content:center;flex-wrap:wrap;gap:4px">
          <button class="ibtn ibtn-blue" title="تعديل" onclick="openWarrantyEditModal('${item.id}')">✏️</button>
          <button class="ibtn ibtn-purple" title="طباعة" onclick="printWarrantyRecord('${item.id}')">🖨️</button>
          <button class="ibtn ibtn-red" title="حذف" onclick="deleteWarranty('${item.id}')">🗑️</button>
        </div>
      </td>
    </tr>
  `).join('');
};

window.openWarrantyEditModal = function openWarrantyEditModal(id) {
  const record = DB.get('warranties').find((item) => item.id === id);
  if (!record) return;
  _warrantyEditId = id;

  document.getElementById('warranty-modal-title').textContent = 'تعديل سجل الضمان';
  document.getElementById('wm-name').value = record.customerName || '';
  document.getElementById('wm-phone').value = record.phone || '';
  document.getElementById('wm-product').value = record.productName || '';
  document.getElementById('wm-total').value = fmt(record.totalPrice || 0);
  document.getElementById('wm-color').value = record.color || '';
  document.getElementById('wm-imei').value = record.imei || '';
  document.getElementById('wm-duration').value = record.duration || '';
  document.getElementById('wm-qty').value = String(record.qty || 1);
  openModal('warranty-modal-ov');
};

window.saveWarrantyEdit = function saveWarrantyEdit() {
  if (!_warrantyEditId) return;
  const records = DB.get('warranties');
  const record = records.find((item) => item.id === _warrantyEditId);
  if (!record) return;

  const customerName = document.getElementById('wm-name').value.trim();
  const duration = document.getElementById('wm-duration').value.trim();
  if (!customerName) { toast('أدخل اسم الزبون', 'err'); return; }
  if (!duration) { toast('أدخل مدة الضمان', 'err'); return; }

  const updated = DB.saveOne('warranties', {
    ...record,
    customerName,
    phone: document.getElementById('wm-phone').value.trim(),
    color: document.getElementById('wm-color').value.trim(),
    imei: document.getElementById('wm-imei').value.trim(),
    duration
  });

  updateWarrantyLinkedRecords(updated);
  _warrantyEditId = null;
  closeModal('warranty-modal-ov');
  toast('✅ تم تحديث سجل الضمان');
  renderWarranties();
};

window.printWarrantyRecord = async function printWarrantyRecord(id) {
  const record = DB.get('warranties').find((item) => item.id === id);
  if (!record) return;
  await printWarranty(warrantyPrintableProduct(record), warrantyPrintPayload(record));
};

window.deleteWarranty = function deleteWarranty(id) {
  const record = DB.get('warranties').find((item) => item.id === id);
  if (!record) return;

  showConfirm(
    'حذف سجل الضمان',
    `هل تريد حذف سجل الضمان الخاص بالزبون "${record.customerName || 'هذا الزبون'}"؟`,
    () => {
      window.removeWarrantyRecord(id);
      toast('🗑️ تم حذف سجل الضمان فقط', 'warn');
      renderWarranties();
    },
    '🗑️'
  );
};
