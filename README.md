# SJ STORE Pro 🏪

نظام إدارة محل الهواتف الاحترافي

## هيكل المشروع

```
📁 sj-store-pro/
├── main.js                    ← Electron
├── package.json               ← الإعدادات
├── index.html                 ← الهيكل HTML
│
├── 📁 config/
│   └── firebase.config.js    ← ⭐ إعدادات Firebase (غيّر هذا فقط)
│
├── 📁 css/
│   └── style.css             ← التصميم
│
├── 📁 js/
│   ├── auth.js               ← تسجيل الدخول
│   ├── db.js                 ← قاعدة البيانات
│   ├── utils.js              ← دوال مشتركة
│   ├── dashboard.js          ← لوحة التحكم
│   ├── inventory.js          ← المخزون
│   ├── pos.js                ← نقطة البيع
│   ├── cashier.js            ← الكاشير
│   ├── installments.js       ← التقسيط
│   ├── debts.js              ← الديون (قريباً)
│   ├── repairs.js            ← التصليح
│   ├── worker.js             ← العامل
│   ├── settings.js           ← الإعدادات
│   ├── barcode.js            ← الباركود
│   └── init.js               ← التهيئة
│
└── 📁 libs/
    └── jsbarcode.min.js      ← مكتبة الباركود
```

## تشغيل البرنامج

```bash
npm install
npm start
```

## بناء ملف exe

```bash
npm run build
```

## تغيير حساب Firebase

افتح `config/firebase.config.js` وغيّر البيانات فقط ✅
