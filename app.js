// ============================================================
//  DEBT TRACKER — app.js
//  Backend: Google Apps Script + Google Sheet
//  localStorage ใช้เป็น cache เท่านั้น
// ============================================================

// ─── CONFIGURATION ───────────────────────────────────────────
// ⚠️ ใส่ URL ของ Google Apps Script ที่ deploy แล้วตรงนี้
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbw1QpyirqfHe7MZkv0dOd2V232jYibYcbkSG4gtrkZWCjjmQV0cQ7f8BDdVMNc5_MC5/exec'

// ─── SEED DATA (fallback ถ้ายังไม่มีข้อมูล) ──────────────────
const SEED_LOANS = [
  { id: 'loan_1', name: 'KT1800', originalAmount: 87413, currentBalance: 87413, monthlyPayment: 1800, interestRate: 20, color: '#2563eb', status: 'active', startDate: '2026-02', notes: '', createdAt: new Date().toISOString() },
  { id: 'loan_2', name: 'KT2200', originalAmount: 116253, currentBalance: 116253, monthlyPayment: 2200, interestRate: 20, color: '#7c3aed', status: 'active', startDate: '2026-02', notes: '', createdAt: new Date().toISOString() },
  { id: 'loan_3', name: 'CI1800', originalAmount: 55409, currentBalance: 55409, monthlyPayment: 1800, interestRate: 20, color: '#dc2626', status: 'active', startDate: '2026-02', notes: '', createdAt: new Date().toISOString() },
  { id: 'loan_4', name: 'UMP', originalAmount: 119225, currentBalance: 119225, monthlyPayment: 3600, interestRate: 20, color: '#ea580c', status: 'active', startDate: '2026-02', notes: '', createdAt: new Date().toISOString() },
  { id: 'loan_5', name: 'KB5281', originalAmount: 23871, currentBalance: 23871, monthlyPayment: 800, interestRate: 7, color: '#0891b2', status: 'active', startDate: '2026-02', notes: '', createdAt: new Date().toISOString() },
  { id: 'loan_6', name: 'KB4286', originalAmount: 35027, currentBalance: 35027, monthlyPayment: 1200, interestRate: 7, color: '#0d9488', status: 'active', startDate: '2026-02', notes: '', createdAt: new Date().toISOString() },
  { id: 'loan_7', name: 'KB9885', originalAmount: 27100, currentBalance: 27100, monthlyPayment: 500, interestRate: 7, color: '#16a34a', status: 'active', startDate: '2026-02', notes: '', createdAt: new Date().toISOString() },
  { id: 'loan_8', name: 'KBL', originalAmount: 28888, currentBalance: 28888, monthlyPayment: 500, interestRate: 7, color: '#ca8a04', status: 'active', startDate: '2026-02', notes: '', createdAt: new Date().toISOString() },
  { id: 'loan_9', name: 'TKKP', originalAmount: 16900, currentBalance: 16900, monthlyPayment: 0, interestRate: 0, color: '#db2777', status: 'active', startDate: '2026-02', notes: 'ไม่มีข้อมูลค่างวดชัดเจน', createdAt: new Date().toISOString() },
  { id: 'loan_10', name: 'LBK', originalAmount: 0, currentBalance: 0, monthlyPayment: 1400, interestRate: 0, color: '#9333ea', status: 'active', startDate: '2026-02', notes: 'ไม่มียอดต้นทุน', createdAt: new Date().toISOString() },
  { id: 'loan_11', name: 'UCH', originalAmount: 0, currentBalance: 0, monthlyPayment: 0, interestRate: 0, color: '#64748b', status: 'active', startDate: '2026-02', notes: 'ชำระไม่สม่ำเสมอ', createdAt: new Date().toISOString() }
];

// ─── API HELPERS ─────────────────────────────────────────────
async function apiCall(action, data = null) {
  if (!SCRIPT_URL) {
    console.warn('SCRIPT_URL not configured — using localStorage only');
    return null;
  }
  
  try {
    let url = `${SCRIPT_URL}?action=${action}`;
    const options = {
      method: data ? 'POST' : 'GET',
      headers: { 'Content-Type': 'text/plain' },
    };
    
    if (data) {
      options.body = JSON.stringify(data);
    }
    
    const response = await fetch(url, options);
    const result = await response.json();
    
    if (result.error) {
      console.error('API Error:', result.error);
      return null;
    }
    
    return result;
  } catch (error) {
    console.error('API Call Failed:', error);
    return null;
  }
}

// ─── STORAGE HELPERS (Hybrid: Google Sheet + localStorage cache) ──
const DB = {
  _cache: {
    loans: null,
    payments: null,
    lastSync: null
  },
  
  // ─── Check if Google Sheet is configured ───
  isOnline() {
    return !!SCRIPT_URL;
  },
  
  // ─── LOANS ───
  getLoans() {
    // Return from cache first
    if (this._cache.loans !== null) {
      return this._cache.loans;
    }
    // Fallback to localStorage
    const raw = localStorage.getItem('dt_loans');
    if (raw) {
      try { 
        this._cache.loans = JSON.parse(raw);
        return this._cache.loans;
      } catch { }
    }
    return null;
  },
  
  async getLoansAsync() {
    if (this.isOnline()) {
      const result = await apiCall('getLoans');
      if (result && Array.isArray(result)) {
        this._cache.loans = result;
        localStorage.setItem('dt_loans', JSON.stringify(result));
        return result;
      }
    }
    return this.getLoans();
  },
  
  saveLoans(loans) {
    this._cache.loans = loans;
    localStorage.setItem('dt_loans', JSON.stringify(loans));
    
    // Async save to Google Sheet
    if (this.isOnline()) {
      apiCall('saveLoans', loans).then(result => {
        if (result?.success) {
          console.log('✅ Loans synced to Google Sheet');
        }
      });
    }
  },
  
  async saveLoansAsync(loans) {
    this._cache.loans = loans;
    localStorage.setItem('dt_loans', JSON.stringify(loans));
    
    if (this.isOnline()) {
      const result = await apiCall('saveLoans', loans);
      return result?.success ?? false;
    }
    return true;
  },
  
  // ─── PAYMENTS ───
  getPayments() {
    if (this._cache.payments !== null) {
      return this._cache.payments;
    }
    const raw = localStorage.getItem('dt_payments');
    if (raw) {
      try { 
        this._cache.payments = JSON.parse(raw);
        return this._cache.payments;
      } catch { }
    }
    return [];
  },
  
  async getPaymentsAsync() {
    if (this.isOnline()) {
      const result = await apiCall('getPayments');
      if (result && Array.isArray(result)) {
        this._cache.payments = result;
        localStorage.setItem('dt_payments', JSON.stringify(result));
        return result;
      }
    }
    return this.getPayments();
  },
  
  savePayments(payments) {
    this._cache.payments = payments;
    localStorage.setItem('dt_payments', JSON.stringify(payments));
    
    if (this.isOnline()) {
      apiCall('savePayments', payments).then(result => {
        if (result?.success) {
          console.log('✅ Payments synced to Google Sheet');
        }
      });
    }
  },
  
  async savePaymentsAsync(payments) {
    this._cache.payments = payments;
    localStorage.setItem('dt_payments', JSON.stringify(payments));
    
    if (this.isOnline()) {
      const result = await apiCall('savePayments', payments);
      return result?.success ?? false;
    }
    return true;
  },
  
  // ─── UPSERT PAYMENT (1 loan + 1 period = 1 record) ───
  upsertPayment(payment) {
    const payments = this.getPayments();
    const idx = payments.findIndex(
      p => p.loanId === payment.loanId && p.period === payment.period
    );
    if (idx !== -1) {
      payments[idx] = { ...payments[idx], ...payment, id: payments[idx].id, updatedAt: new Date().toISOString() };
    } else {
      payments.push(payment);
    }
    this.savePayments(payments);
    return idx !== -1 ? payments[idx] : payment;
  },
  
  async upsertPaymentAsync(payment) {
    if (this.isOnline()) {
      const result = await apiCall('upsertPayment', payment);
      if (result?.success) {
        // Refresh cache
        await this.getPaymentsAsync();
        return result.payment;
      }
    }
    return this.upsertPayment(payment);
  },
  
  // ─── DEDUPE PAYMENTS ───
  dedupePayments() {
    const payments = this.getPayments();
    const seen = {};
    const result = [];
    let removed = 0;
    
    payments.forEach(p => {
      const key = `${p.loanId}__${p.period}`;
      if (seen[key] === undefined) {
        seen[key] = result.length;
        result.push(p);
      } else {
        const existing = result[seen[key]];
        const tNew = new Date(p.updatedAt || p.createdAt || 0).getTime();
        const tOld = new Date(existing.updatedAt || existing.createdAt || 0).getTime();
        if (tNew >= tOld) result[seen[key]] = p;
        removed++;
      }
    });
    
    if (removed > 0) this.savePayments(result);
    return removed;
  },
  
  // ─── INITIALIZE ───
  init() {
    // If no local data, use seed
    if (!this.getLoans()) {
      this.saveLoans(SEED_LOANS);
    }
    this.migrateNames();
    this.migrateRateToAnnual();
    this.dedupePayments();
  },
  
  async initAsync() {
    // Try to load from Google Sheet first
    if (this.isOnline()) {
      showLoading('กำลังโหลดข้อมูลจาก Google Sheet...');
      
      try {
        const [loans, payments] = await Promise.all([
          this.getLoansAsync(),
          this.getPaymentsAsync()
        ]);
        
        // If Google Sheet is empty but localStorage has data, migrate
        if ((!loans || loans.length === 0) && localStorage.getItem('dt_loans')) {
          const localLoans = JSON.parse(localStorage.getItem('dt_loans'));
          const localPayments = JSON.parse(localStorage.getItem('dt_payments') || '[]');
          
          if (localLoans && localLoans.length > 0) {
            const migrate = confirm(
              '🔄 พบข้อมูลใน localStorage แต่ Google Sheet ว่างเปล่า\n\n' +
              'ต้องการย้ายข้อมูลไป Google Sheet ไหม?\n\n' +
              `📦 ${localLoans.length} รายการหนี้\n` +
              `📝 ${localPayments.length} ประวัติชำระ`
            );
            
            if (migrate) {
              await this.saveLoansAsync(localLoans);
              await this.savePaymentsAsync(localPayments);
              toast('✅ ย้ายข้อมูลไป Google Sheet เรียบร้อย', 'success');
            }
          }
        }
        
        hideLoading();
      } catch (error) {
        console.error('Failed to load from Google Sheet:', error);
        hideLoading();
        toast('⚠️ โหลดจาก Google Sheet ไม่ได้ ใช้ข้อมูล local', 'warning');
      }
    }
    
    // Run normal init
    this.init();
  },
  
  // ─── MIGRATIONS ───
  migrateNames() {
    const RENAME_MAP = {
      loan_1: 'KT1800', loan_2: 'KT2200', loan_3: 'CI1800', loan_4: 'UMP',
      loan_5: 'KB5281', loan_6: 'KB4286', loan_7: 'KB9885', loan_8: 'KBL',
      loan_9: 'TKKP', loan_10: 'LBK', loan_11: 'UCH'
    };
    const loans = this.getLoans();
    if (!loans) return;
    let changed = false;
    loans.forEach(l => {
      const newName = RENAME_MAP[l.id];
      if (newName && l.name !== newName) {
        l.name = newName;
        changed = true;
      }
    });
    if (changed) this.saveLoans(loans);
  },
  
  migrateRateToAnnual() {
    const loans = this.getLoans();
    if (!loans) return;
    const MIGRATED_KEY = 'dt_rate_migrated_v2';
    if (localStorage.getItem(MIGRATED_KEY)) return;
    
    let changed = false;
    loans.forEach(l => {
      if (l.interestRate > 0 && l.interestRate < 12) {
        l.interestRate = l.interestRate * 12;
        changed = true;
      }
    });
    if (changed) this.saveLoans(loans);
    localStorage.setItem(MIGRATED_KEY, '1');
  },
  
  // ─── RESET ───
  reset() {
    localStorage.removeItem('dt_loans');
    localStorage.removeItem('dt_payments');
    this._cache.loans = null;
    this._cache.payments = null;
    
    if (this.isOnline()) {
      apiCall('resetData');
    }
    
    this.init();
  },
  
  // ─── SYNC STATUS ───
  async checkSync() {
    if (!this.isOnline()) return { synced: false, reason: 'offline' };
    
    const result = await apiCall('getAllData');
    if (!result) return { synced: false, reason: 'api_error' };
    
    const localLoans = this.getLoans()?.length || 0;
    const localPayments = this.getPayments()?.length || 0;
    const remoteLoans = result.loans?.length || 0;
    const remotePayments = result.payments?.length || 0;
    
    return {
      synced: true,
      local: { loans: localLoans, payments: localPayments },
      remote: { loans: remoteLoans, payments: remotePayments }
    };
  },
  
  // ─── FORCE SYNC ───
  async forceSync(direction = 'upload') {
    if (!this.isOnline()) {
      toast('❌ ไม่ได้เชื่อมต่อ Google Sheet', 'error');
      return false;
    }
    
    showLoading(direction === 'upload' ? 'กำลัง upload...' : 'กำลัง download...');
    
    try {
      if (direction === 'upload') {
        await this.saveLoansAsync(this.getLoans() || []);
        await this.savePaymentsAsync(this.getPayments() || []);
        toast('✅ Upload ไป Google Sheet เรียบร้อย', 'success');
      } else {
        await this.getLoansAsync();
        await this.getPaymentsAsync();
        toast('✅ Download จาก Google Sheet เรียบร้อย', 'success');
      }
      hideLoading();
      return true;
    } catch (error) {
      hideLoading();
      toast('❌ Sync ไม่สำเร็จ: ' + error.message, 'error');
      return false;
    }
  }
};

// ─── COMPUTATION HELPERS ─────────────────────────────────────
const Calc = {
  toMonthlyRate(annualRate) {
    return annualRate / 12;
  },
  monthlyInterest(balance, annualRate) {
    const monthlyRate = this.toMonthlyRate(annualRate);
    return balance * (monthlyRate / 100);
  },
  principal(payment, interest) {
    return payment - interest;
  },
  progressPct(original, remaining) {
    if (!original || original <= 0) return 0;
    const pct = ((original - remaining) / original) * 100;
    return Math.min(Math.max(pct, 0), 100);
  },
  fmt(n, decimals = 2) {
    if (n === null || n === undefined || isNaN(n)) return '-';
    return Number(n).toLocaleString('th-TH', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });
  },
  sum(arr, key) {
    return arr.reduce((s, x) => s + (Number(x[key]) || 0), 0);
  },
  totalInterestPaid(loanId) {
    return DB.getPayments()
      .filter(p => p.loanId === loanId)
      .reduce((s, p) => s + (Number(p.interest) || 0), 0);
  },
  totalPrincipalPaid(loanId) {
    return DB.getPayments()
      .filter(p => p.loanId === loanId)
      .reduce((s, p) => s + (Number(p.principal) || 0), 0);
  },
  monthsToPayoff(balance, payment, annualRate) {
    if (payment <= 0 || balance <= 0) return null;
    const monthlyRate = this.toMonthlyRate(annualRate);
    const r = monthlyRate / 100;
    if (r === 0) return Math.ceil(balance / payment);
    const n = -Math.log(1 - (r * balance) / payment) / Math.log(1 + r);
    return isFinite(n) && n > 0 ? Math.ceil(n) : null;
  }
};

// ─── LOADING INDICATOR ───────────────────────────────────────
function showLoading(msg = 'กำลังโหลด...') {
  let overlay = document.getElementById('loading-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'loading-overlay';
    overlay.innerHTML = `
      <div style="background:white;padding:24px 40px;border-radius:12px;box-shadow:0 4px 20px rgba(0,0,0,0.15);text-align:center">
        <div style="font-size:32px;margin-bottom:12px">⏳</div>
        <div id="loading-msg" style="font-size:14px;color:#555">${msg}</div>
      </div>
    `;
    overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;z-index:9999';
    document.body.appendChild(overlay);
  } else {
    document.getElementById('loading-msg').textContent = msg;
    overlay.style.display = 'flex';
  }
}

function hideLoading() {
  const overlay = document.getElementById('loading-overlay');
  if (overlay) overlay.style.display = 'none';
}

// ─── TOAST ───────────────────────────────────────────────────
function toast(msg, type = 'default', duration = 3000) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  const icons = { success: '✅', error: '❌', warning: '⚠️', default: 'ℹ️' };
  el.innerHTML = `<span>${icons[type] || icons.default}</span><span>${msg}</span>`;
  container.appendChild(el);
  setTimeout(() => {
    el.style.animation = 'fadeOut .3s ease forwards';
    el.addEventListener('animationend', () => el.remove());
  }, duration);
}

// ─── MODAL ───────────────────────────────────────────────────
function openModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('open');
}

function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('open');
}

document.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal-overlay')) {
    e.target.classList.remove('open');
  }
});

// ─── TABS ────────────────────────────────────────────────────
function initTabs(containerSel) {
  const container = document.querySelector(containerSel);
  if (!container) return;

  const tabIds = [...container.querySelectorAll('.tab-btn')]
    .map(btn => btn.dataset.tab)
    .filter(Boolean);

  tabIds.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    const isActive = el.classList.contains('active');
    el.style.display = isActive ? '' : 'none';
  });

  container.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      tabIds.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        if (id === btn.dataset.tab) {
          el.classList.add('active');
          el.style.display = '';
        } else {
          el.classList.remove('active');
          el.style.display = 'none';
        }
      });
    });
  });
}

// ─── SHARED NAV ACTIVE STATE ─────────────────────────────────
function setActiveNav() {
  const page = location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.navbar-nav a').forEach(a => {
    a.classList.remove('active');
    if (a.getAttribute('href') === page) a.classList.add('active');
  });
}

// ─── NUMBER INPUT ────────────────────────────────────────────
function initNumericInputs() {
  document.querySelectorAll('input[data-numeric]').forEach(input => {
    input.addEventListener('blur', () => {
      const val = parseFloat(input.value.replace(/,/g, ''));
      if (!isNaN(val)) input.value = val;
    });
  });
}

// ─── GENERATE UNIQUE ID ──────────────────────────────────────
function genId(prefix = 'id') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

// ─── DATE HELPERS ────────────────────────────────────────────
const DateHelper = {
  toThai(ym) {
    if (!ym) return '-';
    const [y, m] = ym.split('-');
    return `${parseInt(m)}/${y}`;
  },
  currentYM() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  },
  addMonths(ym, n) {
    const [y, m] = ym.split('-').map(Number);
    const d = new Date(y, m - 1 + n, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  },
  compare(a, b) {
    return a < b ? -1 : a > b ? 1 : 0;
  }
};

// ─── SYNC STATUS INDICATOR ───────────────────────────────────
function renderSyncStatus() {
  let indicator = document.getElementById('sync-indicator');
  if (!indicator) {
    indicator = document.createElement('div');
    indicator.id = 'sync-indicator';
    indicator.style.cssText = 'position:fixed;bottom:16px;right:16px;padding:8px 16px;border-radius:20px;font-size:12px;font-weight:600;cursor:pointer;z-index:100;box-shadow:0 2px 8px rgba(0,0,0,0.15);';
    indicator.onclick = showSyncModal;
    document.body.appendChild(indicator);
  }
  
  if (DB.isOnline()) {
    indicator.style.background = '#E8F5E9';
    indicator.style.color = '#2E7D32';
    indicator.innerHTML = '☁️ Google Sheet';
  } else {
    indicator.style.background = '#FFF3E0';
    indicator.style.color = '#E65100';
    indicator.innerHTML = '💾 Local Only';
  }
}

function showSyncModal() {
  let modal = document.getElementById('modal-sync');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'modal-sync';
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal" style="max-width:400px">
        <div class="modal-header">
          <div class="modal-title">☁️ สถานะการซิงค์</div>
          <button class="btn btn-ghost" onclick="closeModal('modal-sync')">✕</button>
        </div>
        <div class="modal-body" id="sync-modal-body">
          <div style="text-align:center;padding:20px">⏳ กำลังตรวจสอบ...</div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-outline" onclick="DB.forceSync('download').then(()=>{location.reload()})">⬇️ Download จาก Sheet</button>
          <button class="btn btn-primary" onclick="DB.forceSync('upload')">⬆️ Upload ไป Sheet</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }
  
  openModal('modal-sync');
  
  // Check sync status
  DB.checkSync().then(status => {
    const body = document.getElementById('sync-modal-body');
    if (!status.synced) {
      body.innerHTML = `
        <div class="alert alert-warning">
          ⚠️ ${status.reason === 'offline' ? 'ยังไม่ได้ตั้งค่า Google Sheet' : 'เชื่อมต่อไม่ได้'}
        </div>
        <p class="text-sm text-muted">ดู README ในโฟลเดอร์ <code>google-apps-script</code> สำหรับวิธีตั้งค่า</p>
      `;
    } else {
      body.innerHTML = `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">
          <div class="card" style="padding:16px;text-align:center">
            <div class="text-xs text-muted">💾 Local</div>
            <div class="fw-700">${status.local.loans} หนี้</div>
            <div class="text-sm text-muted">${status.local.payments} ชำระ</div>
          </div>
          <div class="card" style="padding:16px;text-align:center">
            <div class="text-xs text-muted">☁️ Google Sheet</div>
            <div class="fw-700">${status.remote.loans} หนี้</div>
            <div class="text-sm text-muted">${status.remote.payments} ชำระ</div>
          </div>
        </div>
        ${status.local.loans !== status.remote.loans || status.local.payments !== status.remote.payments
          ? '<div class="alert alert-warning">⚠️ ข้อมูลไม่ตรงกัน — ควร sync</div>'
          : '<div class="alert alert-success">✅ ข้อมูลตรงกัน</div>'
        }
      `;
    }
  });
}

// ─── INIT ────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  setActiveNav();
  initNumericInputs();
  renderSyncStatus();
  
  // Initialize with async loading from Google Sheet
  await DB.initAsync();
  
  // Page-specific boot
  if (typeof pageInit === 'function') pageInit();
});
