// --- FAIL-SAFE: ONLY hide loading screen. NEVER force Auth screen. ---
setTimeout(() => {
  const ls = document.getElementById('loading-screen');
  if (ls) ls.classList.add('hidden');
}, 3000);

// --- SUPABASE CONFIGURATION ---
const SUPABASE_URL = 'https://rbcxpsyzsdkhoyacfhpl.supabase.co';
const SUPABASE_KEY = 'sb_publishable_LxOBmIfaZLn8Pvsnqn1okw__MSruouP';
let supabaseClient = null;

// Wait for the window to load to ensure the SDK script is ready
window.addEventListener('load', () => {
  if (window.supabase) {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    init(); // Start the app only after Supabase is ready
  } else {
    console.error("Supabase SDK not found. Did you add the script tag to index.html?");
  }
});

// --- STATE ---
let state = {
  invoices: [],
  clients: [],
  activeInvoice: null,
  user: null,
  profile: { company_name: '', company_email: '', logo: '', logo_shape: 'logo-original' },
  quickItems: [{ desc: 'Web Design', qty: 1, rate: 500 }, { desc: 'Consulting', qty: 1, rate: 100 }],
  searchQuery: ''
};

const el = {
  loadingScreen: document.getElementById('loading-screen'),
  authScreen: document.getElementById('auth-screen'),
  appLayout: document.getElementById('app-layout'),
  mobileNav: document.getElementById('mobile-nav'),
  viewDashboard: document.getElementById('view-dashboard'),
  viewClients: document.getElementById('view-clients'),
  viewEditor: document.getElementById('view-editor'),
  pageTitle: document.getElementById('page-title'),
  navDashboard: document.getElementById('nav-dashboard'),
  navClients: document.getElementById('nav-clients'),
  navEditor: document.getElementById('nav-editor'),
  btnSettings: document.getElementById('btn-settings'),
  btnLogout: document.getElementById('btn-logout'),
  btnCreate: document.getElementById('btn-create'),
  btnCmdPalette: document.getElementById('btn-cmd-palette'),
  btnThemeToggle: document.getElementById('btn-theme-toggle'),
  mobNavDash: document.getElementById('mob-nav-dash'),
  mobNavNew: document.getElementById('mob-nav-new'),
  mobNavClients: document.getElementById('mob-nav-clients'),
  mobNavSettings: document.getElementById('mob-nav-settings'),
  mobNavLogout: document.getElementById('mob-nav-logout'), 
  authTitle: document.getElementById('auth-title'),
  authSubtitle: document.getElementById('auth-subtitle'),
  tabLogin: document.getElementById('tab-login'),
  tabSignup: document.getElementById('tab-signup'),
  authEmail: document.getElementById('auth-email'),
  authPass: document.getElementById('auth-pass'),
  groupConfirmPass: document.getElementById('group-confirm-pass'),
  authPassConfirm: document.getElementById('auth-pass-confirm'),
  authMsg: document.getElementById('auth-msg'),
  btnSubmitAuth: document.getElementById('btn-submit-auth'),
  statPaid: document.getElementById('stat-paid'),
  statPending: document.getElementById('stat-pending'),
  statOverdue: document.getElementById('stat-overdue'),
  searchInput: document.getElementById('search-input'),
  invoiceList: document.getElementById('invoice-list'),
  emptyState: document.getElementById('empty-state'),
  chartBody: document.getElementById('chart-body'),
  clientList: document.getElementById('client-list'),
  btnAddClient: document.getElementById('btn-add-client'),
  invoicePaper: document.getElementById('invoice-paper'),
  companyName: document.getElementById('company-name'),
  companyEmail: document.getElementById('company-email'),
  logoWrapper: document.getElementById('logo-wrapper'),
  invoiceLogo: document.getElementById('invoice-logo'),
  logoPlaceholder: document.getElementById('logo-placeholder'),
  logoInput: document.getElementById('logo-input'),
  logoControls: document.getElementById('logo-controls'),
  logoShape: document.getElementById('logo-shape'),
  btnRemoveLogo: document.getElementById('btn-remove-logo'),
  invNumber: document.getElementById('inv-number'),
  invDate: document.getElementById('inv-date'),
  clientSelect: document.getElementById('client-select'),
  clientName: document.getElementById('client-name'),
  clientAddress: document.getElementById('client-address'),
  itemsBody: document.getElementById('items-body'),
  quickItemsContainer: document.getElementById('quick-items-container'),
  discount: document.getElementById('discount'),
  taxPercent: document.getElementById('tax-percent'),
  totalSubtotal: document.getElementById('total-subtotal'),
  totalTax: document.getElementById('total-tax'),
  totalGrand: document.getElementById('total-grand'),
  invoiceNotes: document.getElementById('invoice-notes'),
  watermark: document.getElementById('watermark'),
  modalSettings: document.getElementById('modal-settings'),
  modalClient: document.getElementById('modal-client'),
  modalCommand: document.getElementById('modal-command'),
  cmdInput: document.getElementById('cmd-input'),
  cmdList: document.getElementById('cmd-list'),
  btnExportJson: document.getElementById('btn-export-json'),
  btnExportCsv: document.getElementById('btn-export-csv'),
  importJson: document.getElementById('import-json'),
  toastContainer: document.getElementById('toast-container')
};

let authMode = 'login';
const CURRENCIES = { INR: '₹', USD: '$', EUR: '€', GBP: '£' };

function showToast(msg, type = 'success') {
  const t = document.createElement('div'); t.className = `toast ${type}`; t.textContent = msg;
  el.toastContainer.appendChild(t); setTimeout(() => t.remove(), 3000);
}
function formatMoney(amount) {
  const sym = CURRENCIES[state.activeInvoice?.currency || 'INR'];
  return sym + Number(amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// --- NON-BLOCKING INITIALIZATION ---
async function init() {
  initTheme();
  
  try {
    const { data: { session } } = await supabaseClient.auth.getSession();
    el.loadingScreen.classList.add('hidden');

    if (session) {
      state.user = session.user;
      el.authScreen.classList.add('hidden');
      el.appLayout.classList.remove('hidden');
      el.mobileNav.classList.remove('hidden');
      await loadDataFromSupabase();
      goToDashboard();
    } else {
      el.appLayout.classList.add('hidden');
      el.mobileNav.classList.add('hidden');
      el.authScreen.classList.remove('hidden');
    }
  } catch (err) {
    console.error("Auth check failed:", err);
    el.loadingScreen.classList.add('hidden');
    el.authScreen.classList.remove('hidden');
  }
}

function initTheme() {
  const saved = localStorage.getItem('invoicely_theme') || 'dark';
  document.body.setAttribute('data-theme', saved);
}

el.btnThemeToggle.addEventListener('click', () => {
  const cur = document.body.getAttribute('data-theme');
  const next = cur === 'dark' ? 'light' : 'dark';
  document.body.setAttribute('data-theme', next);
  localStorage.setItem('invoicely_theme', next);
});

// --- AUTHENTICATION ---
el.tabLogin.addEventListener('click', () => { 
  authMode='login'; el.tabLogin.classList.add('active'); el.tabSignup.classList.remove('active'); 
  el.btnSubmitAuth.textContent='EXECUTE'; el.groupConfirmPass.classList.add('hidden');
  el.authTitle.textContent = 'ACCESS SYSTEM'; el.authMsg.textContent=''; 
});

el.tabSignup.addEventListener('click', () => { 
  authMode='signup'; el.tabSignup.classList.add('active'); el.tabLogin.classList.remove('active'); 
  el.btnSubmitAuth.textContent='REGISTER'; el.groupConfirmPass.classList.remove('hidden');
  el.authTitle.textContent = 'NEW PROTOCOL'; el.authMsg.textContent=''; 
});

el.btnSubmitAuth.addEventListener('click', async () => {
  const email = el.authEmail.value.trim();
  const pass = el.authPass.value;
  if (!email || !pass) return el.authMsg.textContent = "CREDENTIALS REQUIRED.";
  
  el.btnSubmitAuth.textContent = "CONNECTING...";
  el.btnSubmitAuth.disabled = true;

  if (authMode === 'signup') {
    if (pass !== el.authPassConfirm.value) {
      el.authMsg.textContent = "PASSPHRASES DO NOT MATCH.";
      el.btnSubmitAuth.textContent = 'REGISTER'; el.btnSubmitAuth.disabled = false;
      return;
    }
    
    const { data, error } = await supabaseClient.auth.signUp({ email, password: pass });
    if (error) {
      el.authMsg.textContent = error.message;
    } else {
      showToast("PROTOCOL INITIALIZED. PLEASE LOG IN.");
      el.tabLogin.click();
    }
  } else {
    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password: pass });
    if (error) {
      el.authMsg.textContent = error.message;
    } else {
      state.user = data.user;
      el.authScreen.classList.add('hidden');
      el.appLayout.classList.remove('hidden');
      el.mobileNav.classList.remove('hidden'); 
      await loadDataFromSupabase();
      goToDashboard();
      showToast("AUTHENTICATED");
    }
  }

  el.btnSubmitAuth.textContent = authMode === 'signup' ? 'REGISTER' : 'EXECUTE';
  el.btnSubmitAuth.disabled = false;
});

// --- FIXED: CENTRAL LOGOUT LOGIC ---
async function handleLogout() {
  try {
    await supabaseClient.auth.signOut();
  } catch (e) {
    console.error(e);
  }
  state.user = null; 
  state.invoices = [];
  state.clients = [];
  el.appLayout.classList.add('hidden'); 
  el.mobileNav.classList.add('hidden'); 
  el.authScreen.classList.remove('hidden'); 
  el.authMsg.textContent = '';
}

el.btnLogout.addEventListener('click', handleLogout);
if (el.mobNavLogout) el.mobNavLogout.addEventListener('click', handleLogout);

// --- SUPABASE DATA FETCHING ---
async function loadDataFromSupabase() {
  if (!state.user) return;
  try {
    const { data: invData, error: invError } = await supabaseClient
      .from('invoices').select('*').eq('user_id', state.user.id).order('created_at', { ascending: false });
    if (!invError) state.invoices = invData;

    const { data: cliData, error: cliError } = await supabaseClient
      .from('clients').select('*').eq('user_id', state.user.id).order('name', { ascending: true });
    if (!cliError) state.clients = cliData;

    renderDashboard();
  } catch (err) {
    console.error("Data load error:", err);
  }
}

// --- NAVIGATION ---
function resetNavStates() {
  [el.navDashboard, el.navClients, el.navEditor, el.mobNavDash, el.mobNavNew, el.mobNavClients].forEach(btn => btn.classList.remove('active'));
}
function goToDashboard() {
  resetNavStates();
  el.navDashboard.classList.add('active'); el.mobNavDash.classList.add('active');
  el.viewClients.classList.add('hidden'); el.viewEditor.classList.add('hidden'); el.viewDashboard.classList.remove('hidden');
  el.pageTitle.textContent = 'DASHBOARD';
  renderDashboard();
}
function goToClients() {
  resetNavStates();
  el.navClients.classList.add('active'); el.mobNavClients.classList.add('active');
  el.viewDashboard.classList.add('hidden'); el.viewEditor.classList.add('hidden'); el.viewClients.classList.remove('hidden');
  el.pageTitle.textContent = 'CLIENT DIRECTORY';
  renderClients();
}
function goToEditor() {
  resetNavStates();
  el.navEditor.classList.add('active'); el.mobNavNew.classList.add('active');
  el.viewDashboard.classList.add('hidden'); el.viewClients.classList.add('hidden'); el.viewEditor.classList.remove('hidden');
  el.pageTitle.textContent = 'EDITOR';
}

el.navDashboard.addEventListener('click', goToDashboard);
el.mobNavDash.addEventListener('click', goToDashboard);
el.navClients.addEventListener('click', goToClients);
el.mobNavClients.addEventListener('click', goToClients);

// --- COMMAND PALETTE ---
const commands = [
  { name: 'Go to Dashboard', action: goToDashboard, shortcut: 'G D' },
  { name: 'Go to Clients', action: goToClients, shortcut: 'G C' },
  { name: 'Create New Invoice', action: () => openEditor(null), shortcut: 'N' },
  { name: 'Export JSON Backup', action: () => { el.btnExportJson.click(); } },
  { name: 'Export CSV', action: () => { el.btnExportCsv.click(); } },
  { name: 'Toggle Theme', action: () => { el.btnThemeToggle.click(); } },
  { name: 'Logout', action: () => { handleLogout(); } }
];
function openCommandPalette() {
  el.modalCommand.classList.remove('hidden');
  el.cmdInput.value = '';
  renderCommands(commands);
  el.cmdInput.focus();
}
function renderCommands(list) {
  el.cmdList.innerHTML = '';
  list.forEach((cmd) => {
    const li = document.createElement('li');
    li.innerHTML = `${cmd.name} ${cmd.shortcut ? `<span>${cmd.shortcut}</span>` : ''}`;
    li.onclick = () => { cmd.action(); el.modalCommand.classList.add('hidden'); };
    el.cmdList.appendChild(li);
  });
}
el.cmdInput.addEventListener('input', (e) => {
  const q = e.target.value.toLowerCase();
  const filtered = commands.filter(c => c.name.toLowerCase().includes(q));
  renderCommands(filtered);
});
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
    e.preventDefault();
    if (el.modalCommand.classList.contains('hidden')) openCommandPalette();
    else el.modalCommand.classList.add('hidden');
  }
  if (e.key === 'Escape' && !el.modalCommand.classList.contains('hidden')) el.modalCommand.classList.add('hidden');
});
el.btnCmdPalette.addEventListener('click', openCommandPalette);

// --- DASHBOARD ---
el.searchInput.addEventListener('input', (e) => { state.searchQuery = e.target.value.toLowerCase(); renderDashboard(); });

function renderDashboard() {
  el.invoiceList.innerHTML = '';
  let paid = 0, pending = 0, overdue = 0;
  const today = new Date();
  
  state.invoices.forEach(i => {
    const invDate = new Date(i.date);
    let status = i.status || 'Draft';
    if (status === 'Pending' && invDate < today) status = 'Overdue';

    if (status === 'Paid') paid += (i.grand_total || 0);
    else if (status === 'Overdue') overdue += (i.grand_total || 0);
    else if (status === 'Pending') pending += (i.grand_total || 0);
  });

  el.statPaid.textContent = '₹' + paid.toLocaleString('en-IN');
  el.statPending.textContent = '₹' + pending.toLocaleString('en-IN');
  el.statOverdue.textContent = '₹' + overdue.toLocaleString('en-IN');

  generateChart();

  const filtered = state.invoices.filter(i => (i.client_name || 'Unnamed').toLowerCase().includes(state.searchQuery));

  if (filtered.length === 0) { el.emptyState.classList.remove('hidden'); } 
  else { el.emptyState.classList.add('hidden'); }

  filtered.sort((a,b) => new Date(b.date) - new Date(a.date)).forEach(inv => {
    const tr = document.createElement('tr');
    const sym = CURRENCIES[inv.currency || 'INR'];
    let status = inv.status || 'Draft';
    if (status === 'Pending' && new Date(inv.date) < today) status = 'Overdue';

    tr.innerHTML = `
      <td style="font-family:var(--font-head); font-size:11px; color:var(--text-secondary);">#${inv.invoice_number || inv.id.substring(0,6)}</td>
      <td>${new Date(inv.date).toLocaleDateString()}</td>
      <td style="font-weight:500;">${inv.client_name || 'UNNAMED'}</td>
      <td><span class="badge badge-${status.toLowerCase()}">${status.toUpperCase()}</span></td>
      <td class="text-right" style="font-family:var(--font-head); font-weight:600;">${sym}${Number(inv.grand_total).toLocaleString('en-IN')}</td>
      <td class="text-right"><button class="action-btn" onclick="deleteInvoice(event, '${inv.id}')">✕</button></td>
    `;
    tr.addEventListener('click', (e) => { if(!e.target.classList.contains('action-btn')) openEditor(inv); });
    el.invoiceList.appendChild(tr);
  });
}

function generateChart() {
  el.chartBody.innerHTML = '';
  const months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
  const now = new Date();
  let data = [];

  for (let i = 5; i >= 0; i--) {
    let d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    let m = d.getMonth(); let y = d.getFullYear();
    let total = 0;
    
    state.invoices.forEach(inv => {
      let invDate = new Date(inv.date);
      if (invDate.getMonth() === m && invDate.getFullYear() === y) { total += (inv.grand_total || 0); }
    });
    data.push({ label: months[m], value: total });
  }

  const maxVal = Math.max(...data.map(d => d.value), 1000); 

  data.forEach(d => {
    const heightPct = (d.value / maxVal) * 100;
    const div = document.createElement('div');
    div.className = 'chart-bar-group';
    div.innerHTML = `
      <div class="chart-bar" style="height: ${heightPct}%;" title="${formatMoney(d.value)}"></div>
      <div class="chart-label">${d.label}</div>
    `;
    el.chartBody.appendChild(div);
  });
}

window.deleteInvoice = async function(e, id) {
  e.stopPropagation();
  if (confirm("DELETE RECORD?")) {
    const { error } = await supabaseClient.from('invoices').delete().eq('id', id);
    if (!error) {
      state.invoices = state.invoices.filter(i => i.id !== id);
      renderDashboard(); showToast("RECORD DELETED");
    } else {
      showToast("ERROR DELETING", "error");
    }
  }
};

// --- CLIENTS ---
function renderClients() {
  el.clientList.innerHTML = '';
  if (state.clients.length === 0) {
    el.clientList.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:20px; color:var(--text-secondary);">No clients saved yet.</td></tr>`;
    return;
  }
  state.clients.forEach(c => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="font-weight:600;">${c.name}</td>
      <td>${c.email || '-'}</td>
      <td>${c.address || '-'}</td>
      <td class="text-right"><button class="action-btn" onclick="deleteClient(event, '${c.id}')">✕</button></td>
    `;
    el.clientList.appendChild(tr);
  });
}

el.btnAddClient.addEventListener('click', () => {
  document.getElementById('client-form-name').value = '';
  document.getElementById('client-form-email').value = '';
  document.getElementById('client-form-address').value = '';
  el.modalClient.classList.remove('hidden');
});

document.getElementById('btn-save-client').addEventListener('click', async () => {
  const name = document.getElementById('client-form-name').value.trim();
  const email = document.getElementById('client-form-email').value.trim();
  const address = document.getElementById('client-form-address').value.trim();
  if(!name) return showToast("CLIENT NAME REQUIRED", "error");

  const newClient = { name, email, address, user_id: state.user.id };
  const { data, error } = await supabaseClient.from('clients').insert([newClient]).select();
  
  if (error) {
    showToast("ERROR SAVING CLIENT", "error");
  } else {
    state.clients.push(data[0]);
    el.modalClient.classList.add('hidden');
    renderClients();
    showToast("CLIENT SAVED");
  }
});

window.deleteClient = async function(e, id) {
  e.stopPropagation();
  if(confirm("DELETE CLIENT?")) {
    const { error } = await supabaseClient.from('clients').delete().eq('id', id);
    if (!error) {
      state.clients = state.clients.filter(c => c.id !== id);
      renderClients(); showToast("CLIENT DELETED");
    } else {
      showToast("ERROR DELETING", "error");
    }
  }
};

// --- EDITOR ---
el.btnCreate.addEventListener('click', () => { if (!state.user) { el.authScreen.classList.remove('hidden'); return; } openEditor(null); });
el.mobNavNew.addEventListener('click', () => { el.btnCreate.click(); });

function openEditor(inv = null) {
  goToEditor();
  if (inv) {
    state.activeInvoice = JSON.parse(JSON.stringify(inv));
    state.activeInvoice.isNew = false;
  } else {
    state.activeInvoice = {
      id: crypto.randomUUID(),
      isNew: true, 
      invoice_number: `INV-${new Date().getFullYear()}-${Math.floor(Math.random()*1000)}`,
      date: new Date().toISOString().split('T')[0],
      company_name: '', company_email: '', logo: '', logo_shape: 'logo-original',
      client_name: '', client_address: '', items: [{ desc: '', qty: 1, rate: 0 }],
      discount: 0, tax_percent: 0, notes: '', currency: 'INR', status: 'Draft', template: 'template-modern'
    };
  }
  renderEditor();
}

function populateClientDropdown() {
  el.clientSelect.innerHTML = `<option value="">-- Select Saved Client --</option>`;
  state.clients.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.id; opt.textContent = c.name;
    el.clientSelect.appendChild(opt);
  });
}

el.clientSelect.addEventListener('change', (e) => {
  const clientId = e.target.value;
  if (!clientId) return;
  const client = state.clients.find(c => c.id === clientId);
  if (client) {
    el.clientName.value = client.name;
    el.clientAddress.value = client.address || client.email;
    state.activeInvoice.client_name = client.name;
    state.activeInvoice.client_address = client.address || client.email;
  }
});

function setupCustomDropdown(id, labelId, callback) {
  const container = document.getElementById(id);
  const btn = container.querySelector('.dropdown-btn');
  const label = document.getElementById(labelId);
  const items = container.querySelectorAll('.dropdown-menu li');

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    document.querySelectorAll('.custom-dropdown').forEach(d => { if (d.id !== id) d.classList.remove('active'); });
    container.classList.toggle('active');
  });

  items.forEach(item => {
    item.addEventListener('click', () => {
      const val = item.dataset.value;
      label.textContent = item.textContent;
      items.forEach(i => i.classList.remove('selected'));
      item.classList.add('selected');
      container.classList.remove('active');
      callback(val);
    });
  });
}
document.addEventListener('click', () => { document.querySelectorAll('.custom-dropdown').forEach(d => d.classList.remove('active')); });

setupCustomDropdown('dd-template', 'label-template', (val) => { state.activeInvoice.template = val; el.invoicePaper.className = `invoice-paper ${val}`; });
setupCustomDropdown('dd-currency', 'label-currency', (val) => { state.activeInvoice.currency = val; renderEditor(); });
setupCustomDropdown('dd-status', 'label-status', (val) => { state.activeInvoice.status = val; toggleWatermark(val); });

function toggleWatermark(status) {
  if (status === 'Paid') el.watermark.classList.add('show');
  else el.watermark.classList.remove('show');
}

function renderEditor() {
  const inv = state.activeInvoice;
  el.invoicePaper.className = `invoice-paper ${inv.template}`;
  
  document.querySelector(`#dd-template li[data-value="${inv.template}"]`).click();
  document.querySelector(`#dd-currency li[data-value="${inv.currency}"]`).click();
  document.querySelector(`#dd-status li[data-value="${inv.status}"]`).click();

  populateClientDropdown();
  renderQuickItems();

  el.companyName.value = inv.company_name || ''; el.companyEmail.value = inv.company_email || '';
  el.invNumber.value = inv.invoice_number || ''; el.invDate.value = inv.date;
  el.clientName.value = inv.client_name; el.clientAddress.value = inv.client_address;
  el.discount.value = inv.discount || 0; el.taxPercent.value = inv.tax_percent || 0;
  el.invoiceNotes.value = inv.notes || '';

  el.itemsBody.innerHTML = '';
  inv.items.forEach((item, index) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><input type="text" value="${item.desc}" placeholder="Item description" data-index="${index}" data-field="desc"></td>
      <td><input type="number" value="${item.qty}" placeholder="1" min="1" data-index="${index}" data-field="qty"></td>
      <td><input type="number" value="${item.rate}" placeholder="0" min="0" data-index="${index}" data-field="rate"></td>
      <td class="item-amount">${formatMoney(item.qty * item.rate)}</td>
      <td class="no-print"><button class="action-btn" onclick="removeItem(${index})">✕</button></td>
    `;
    el.itemsBody.appendChild(tr);
  });

  document.querySelectorAll('#items-body input').forEach(input => {
    input.addEventListener('input', (e) => {
      const idx = e.target.dataset.index; const field = e.target.dataset.field;
      if (field === 'desc') inv.items[idx].desc = e.target.value;
      else inv.items[idx][field] = Number(e.target.value) || 0;
      calculateTotals();
    });
  });

  el.clientName.addEventListener('input', (e) => { inv.client_name = e.target.value; });
  el.companyName.addEventListener('input', (e) => { inv.company_name = e.target.value; });
  el.companyEmail.addEventListener('input', (e) => { inv.company_email = e.target.value; });
  el.invDate.addEventListener('input', (e) => { inv.date = e.target.value; });
  el.clientAddress.addEventListener('input', (e) => { inv.client_address = e.target.value; });
  el.discount.addEventListener('input', (e) => { inv.discount = Number(e.target.value) || 0; calculateTotals(); });
  el.taxPercent.addEventListener('input', (e) => { inv.tax_percent = Number(e.target.value) || 0; calculateTotals(); });
  el.invoiceNotes.addEventListener('input', (e) => { inv.notes = e.target.value; });

  calculateTotals();
}

function renderQuickItems() {
  el.quickItemsContainer.innerHTML = '';
  state.quickItems.forEach(item => {
    const btn = document.createElement('button');
    btn.className = 'quick-btn'; btn.textContent = item.desc.toUpperCase();
    btn.onclick = () => { state.activeInvoice.items.push({ ...item }); renderEditor(); };
    el.quickItemsContainer.appendChild(btn);
  });
}

// MATH & ACTIONS
function calculateTotals() {
  const inv = state.activeInvoice;
  let subtotal = 0;
  const rows = el.itemsBody.querySelectorAll('tr');

  inv.items.forEach((item, idx) => {
    const amt = item.qty * item.rate;
    subtotal += amt;
    if (rows[idx]) rows[idx].querySelector('.item-amount').textContent = formatMoney(amt);
  });

  const discount = inv.discount || 0;
  const taxable = Math.max(0, subtotal - discount);
  const tax = taxable * ((inv.tax_percent || 0) / 100);
  const grand = taxable + tax;

  inv.subtotal = subtotal; inv.tax_amount = tax; inv.grand_total = grand;

  el.totalSubtotal.textContent = formatMoney(subtotal);
  el.totalTax.textContent = formatMoney(tax);
  el.totalGrand.textContent = formatMoney(grand);
}

window.removeItem = function(idx) {
  if (state.activeInvoice.items.length === 1) return showToast("MIN 1 ITEM REQUIRED", "error");
  state.activeInvoice.items.splice(idx, 1); renderEditor();
};
document.getElementById('btn-add-item').addEventListener('click', () => { state.activeInvoice.items.push({ desc: '', qty: 1, rate: 0 }); renderEditor(); });
document.getElementById('btn-print').addEventListener('click', () => window.print());

// SAVE INVOICE TO SUPABASE
document.getElementById('btn-save').addEventListener('click', async () => {
  const inv = state.activeInvoice;
  const btn = document.getElementById('btn-save');
  btn.textContent = "SAVING...";

  const payload = {
    user_id: state.user.id, invoice_number: inv.invoice_number, date: inv.date,
    company_name: inv.company_name, company_email: inv.company_email, client_name: inv.client_name,
    client_address: inv.client_address, items: inv.items, discount: inv.discount,
    tax_percent: inv.tax_percent, subtotal: inv.subtotal, tax_amount: inv.tax_amount,
    grand_total: inv.grand_total, notes: inv.notes, currency: inv.currency,
    status: inv.status, template: inv.template
  };

  if (inv.isNew) {
    const { data, error } = await supabaseClient.from('invoices').insert([payload]).select();
    if (!error) {
      state.invoices.unshift(data[0]);
      goToDashboard(); showToast("RECORD SAVED");
    } else { showToast("ERROR SAVING", "error"); }
  } else {
    const { error } = await supabaseClient.from('invoices').update(payload).eq('id', inv.id);
    if (!error) {
      const i = state.invoices.findIndex(x => x.id === inv.id);
      if (i > -1) state.invoices[i] = { ...inv, ...payload };
      goToDashboard(); showToast("RECORD UPDATED");
    } else { showToast("ERROR UPDATING", "error"); }
  }
  btn.textContent = "SAVE RECORD";
});

// EXPORT/IMPORT
el.btnExportJson.addEventListener('click', () => {
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state.invoices));
  const a = document.createElement('a'); a.href = dataStr; a.download = "ledger_backup.json"; a.click();
  showToast("BACKUP EXPORTED");
});
el.btnExportCsv.addEventListener('click', () => {
  if (state.invoices.length === 0) return showToast("NO DATA", "error");
  let csv = "data:text/csv;charset=utf-8,ID,DATE,CLIENT,STATUS,AMOUNT,CURRENCY\n";
  state.invoices.forEach(i => { csv += `${i.invoice_number},${i.date},"${i.client_name || 'Unnamed'}",${i.status},${i.grand_total},${i.currency}\n`; });
  const a = document.createElement('a'); a.href = encodeURI(csv); a.download = "ledger_export.csv"; a.click();
  showToast("CSV EXPORTED");
});

// MODAL BUTTONS
el.btnSettings.addEventListener('click', () => el.modalSettings.classList.remove('hidden'));
el.mobNavSettings.addEventListener('click', () => el.modalSettings.classList.remove('hidden'));
document.getElementById('btn-close-settings').addEventListener('click', () => el.modalSettings.classList.add('hidden'));
document.getElementById('btn-close-client').addEventListener('click', () => el.modalClient.classList.add('hidden'));