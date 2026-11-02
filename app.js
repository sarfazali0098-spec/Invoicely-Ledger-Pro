// --- PASSWORD RECOVERY LINK DETECTION (must run before Supabase clears the URL hash) ---
const INITIAL_HASH = window.location.hash || '';
let recoveryMode = /type=recovery/.test(INITIAL_HASH);
let linkError = '';
if (/error=|error_code=/.test(INITIAL_HASH)) {
  linkError = /otp_expired|expired/i.test(INITIAL_HASH)
    ? 'RESET LINK EXPIRED OR ALREADY USED. REQUEST A NEW ONE.'
    : 'RESET LINK INVALID. REQUEST A NEW ONE.';
}

// --- FAIL-SAFE: never leave the user on the loading screen ---
setTimeout(() => {
  const ls = document.getElementById('loading-screen');
  if (ls) ls.classList.add('hidden');
  const app = document.getElementById('app-layout');
  if (app && app.classList.contains('hidden')) showAuthScreen();
}, 2500);

// --- SUPABASE CONFIGURATION ---
const SUPABASE_URL = 'https://rbcxpsyzsdkhoyacfhpl.supabase.co';
const SUPABASE_KEY = 'sb_publishable_LxOBmIfaZLn8Pvsnqn1okw__MSruouP';
let supabaseClient = null;

// Wait for the window to load to ensure the SDK script is ready
window.addEventListener('load', () => {
  if (window.supabase) {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    // Fires when the user lands from a password-reset email link
    supabaseClient.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') { recoveryMode = true; showAuthScreen(); }
    });
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

function init() {
  initTheme();

  // Check session in background
  supabaseClient.auth.getSession().then(({ data: { session } }) => {
    if (recoveryMode) { showAuthScreen(); return; }          // reset link: show "new password" form
    if (session) { enterApp(session.user); return; }
    showAuthScreen();
    if (linkError) { setAuthMode('forgot'); showAuthMsg(linkError); }
  }).catch(err => { console.error("Session check failed:", err); showAuthScreen(); });
}

function showAuthScreen() {
  el.loadingScreen.classList.add('hidden');
  el.authScreen.classList.remove('hidden');
  if (recoveryMode && authMode !== 'recovery') setAuthMode('recovery');
}

async function enterApp(user) {
  state.user = user;
  loadProfile();
  el.loadingScreen.classList.add('hidden');
  el.authScreen.classList.add('hidden');
  el.appLayout.classList.remove('hidden');
  el.mobileNav.classList.remove('hidden');
  await loadDataFromSupabase();
  goToDashboard();
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
const MIN_PASS_LEN = 6;
let cooldownUntil = 0; // throttle for "send reset link"

const AUTH_UI = {
  login:    { title: 'ACCESS SYSTEM',      sub: 'Authenticate to access the ledger.',        btn: 'EXECUTE' },
  signup:   { title: 'NEW PROTOCOL',       sub: 'Create an account to start invoicing.',     btn: 'REGISTER' },
  forgot:   { title: 'RECOVER ACCESS',     sub: "Enter your email and we'll send a reset link.", btn: 'SEND RESET LINK' },
  recovery: { title: 'SET NEW PASSPHRASE', sub: 'Choose a new passphrase for your account.', btn: 'UPDATE PASSPHRASE' }
};

function showAuthMsg(text, ok = false) {
  el.authMsg.textContent = text;
  el.authMsg.classList.toggle('success-text', ok);
}

function setAuthMode(mode) {
  authMode = mode;
  const ui = AUTH_UI[mode];
  const $ = id => document.getElementById(id);
  el.authTitle.textContent = ui.title;
  el.authSubtitle.textContent = ui.sub;
  el.btnSubmitAuth.textContent = ui.btn;
  showAuthMsg('');

  $('auth-tabs').classList.toggle('hidden', mode === 'forgot' || mode === 'recovery');
  el.tabLogin.classList.toggle('active', mode === 'login');
  el.tabSignup.classList.toggle('active', mode === 'signup');

  $('group-email').classList.toggle('hidden', mode === 'recovery');
  $('group-pass').classList.toggle('hidden', mode === 'forgot');
  el.groupConfirmPass.classList.toggle('hidden', mode === 'login' || mode === 'forgot');
  $('auth-forgot-row').classList.toggle('hidden', mode !== 'login');
  $('auth-back-row').classList.toggle('hidden', mode !== 'forgot' && mode !== 'recovery');
  $('btn-back-login').textContent = mode === 'recovery' ? '✕ CANCEL' : '← BACK TO LOGIN';

  $('auth-pass-label').textContent = mode === 'recovery' ? 'NEW PASSPHRASE' : 'PASSPHRASE';
  $('auth-pass-confirm-label').textContent = mode === 'recovery' ? 'CONFIRM NEW PASSPHRASE' : 'CONFIRM PASSPHRASE';
  el.authPass.autocomplete = (mode === 'login') ? 'current-password' : 'new-password';
  el.authPass.value = ''; el.authPassConfirm.value = '';
}

el.tabLogin.addEventListener('click', () => setAuthMode('login'));
el.tabSignup.addEventListener('click', () => setAuthMode('signup'));
document.getElementById('btn-forgot').addEventListener('click', () => {
  setAuthMode('forgot');
  el.authEmail.focus();
});
document.getElementById('btn-back-login').addEventListener('click', async () => {
  if (authMode === 'recovery') {            // cancel the reset: drop the temporary recovery session
    recoveryMode = false;
    history.replaceState(null, '', window.location.pathname + window.location.search);
    await supabaseClient.auth.signOut();
  }
  setAuthMode('login');
});

// Show / hide password
document.querySelectorAll('.pass-toggle').forEach(btn => {
  btn.addEventListener('click', () => {
    const input = document.getElementById(btn.dataset.target);
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    btn.textContent = show ? 'HIDE' : 'SHOW';
  });
});

// Enter key submits the auth form
el.authScreen.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !el.btnSubmitAuth.disabled) { e.preventDefault(); el.btnSubmitAuth.click(); }
});

// Send a password-reset email (used by the login screen and by Settings)
async function sendResetEmail(email) {
  if (window.location.protocol === 'file:') {
    return { error: { message: 'OPEN THE APP FROM A WEBSITE (http/https), NOT AS A LOCAL FILE, TO USE PASSWORD RESET.' } };
  }
  const redirectTo = window.location.origin + window.location.pathname;
  return await supabaseClient.auth.resetPasswordForEmail(email, { redirectTo });
}
function friendlyAuthError(error) {
  const m = (error.message || '').toLowerCase();
  if (error.status === 429 || m.includes('rate limit') || m.includes('too many'))
    return 'TOO MANY REQUESTS. PLEASE WAIT A FEW MINUTES AND TRY AGAIN.';
  return error.message;
}

el.btnSubmitAuth.addEventListener('click', async () => {
  const email = el.authEmail.value.trim();
  const pass = el.authPass.value;
  const label = AUTH_UI[authMode].btn;

  // ---- Validation ----
  if (authMode === 'forgot') {
    if (!email) return showAuthMsg("ENTER YOUR EMAIL.");
    const wait = Math.ceil((cooldownUntil - Date.now()) / 1000);
    if (wait > 0) return showAuthMsg(`PLEASE WAIT ${wait}s BEFORE REQUESTING AGAIN.`);
  } else if (authMode === 'recovery') {
    if (pass.length < MIN_PASS_LEN) return showAuthMsg(`PASSPHRASE MUST BE AT LEAST ${MIN_PASS_LEN} CHARACTERS.`);
    if (pass !== el.authPassConfirm.value) return showAuthMsg("PASSPHRASES DO NOT MATCH.");
  } else if (!email || !pass) {
    return showAuthMsg("CREDENTIALS REQUIRED.");
  } else if (authMode === 'signup' && pass !== el.authPassConfirm.value) {
    return showAuthMsg("PASSPHRASES DO NOT MATCH.");
  }

  showAuthMsg('');
  el.btnSubmitAuth.textContent = "CONNECTING...";
  el.btnSubmitAuth.disabled = true;

  try {
    if (authMode === 'forgot') {
      const { error } = await sendResetEmail(email);
      if (error) {
        showAuthMsg(friendlyAuthError(error));
      } else {
        cooldownUntil = Date.now() + 60000;
        // Same message whether or not the email exists (prevents account enumeration)
        showAuthMsg("IF AN ACCOUNT EXISTS FOR THIS EMAIL, A RESET LINK HAS BEEN SENT. CHECK YOUR INBOX (AND SPAM).", true);
      }
    } else if (authMode === 'recovery') {
      const { data, error } = await supabaseClient.auth.updateUser({ password: pass });
      if (error) {
        showAuthMsg(friendlyAuthError(error));
      } else {
        recoveryMode = false;
        history.replaceState(null, '', window.location.pathname + window.location.search); // remove tokens from URL
        setAuthMode('login');
        await enterApp(data.user);
        showToast("PASSPHRASE UPDATED");
      }
    } else if (authMode === 'signup') {
      const { error } = await supabaseClient.auth.signUp({ email, password: pass });
      if (error) {
        showAuthMsg(friendlyAuthError(error));
      } else {
        setAuthMode('login');
        showToast("PROTOCOL INITIALIZED. PLEASE LOG IN.");
      }
    } else {
      const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password: pass });
      if (error) {
        showAuthMsg(friendlyAuthError(error));
      } else {
        await enterApp(data.user);
        showToast("AUTHENTICATED");
      }
    }
  } catch (err) {
    console.error("Auth error:", err);
    showAuthMsg("NETWORK ERROR. PLEASE TRY AGAIN.");
  }

  el.btnSubmitAuth.textContent = AUTH_UI[authMode].btn;
  el.btnSubmitAuth.disabled = false;
});

el.btnLogout.addEventListener('click', async () => { 
  await supabaseClient.auth.signOut();
  state.user = null; 
  state.invoices = [];
  state.clients = [];
  state.profile = { company_name: '', company_email: '', logo: '', logo_shape: 'logo-original' };
  el.appLayout.classList.add('hidden'); 
  el.mobileNav.classList.add('hidden'); 
  setAuthMode('login');
  el.authScreen.classList.remove('hidden'); 
});

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
  { name: 'Logout', action: () => { el.btnLogout.click(); } }
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
  // Company logo is shared by every invoice
  state.activeInvoice.logo = state.profile.logo || '';
  state.activeInvoice.logo_shape = state.profile.logo_shape || 'logo-original';
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

  renderLogo();
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

// --- COMPANY LOGO ---
const LOGO_MAX_BYTES = 5 * 1024 * 1024;   // reject files over 5 MB
const LOGO_MAX_DIM = 400;                 // resized so it stays small and prints sharp
const logoKey = () => `invoicely_profile_${state.user ? state.user.id : 'guest'}`;

function loadProfile() {
  try {
    const saved = JSON.parse(localStorage.getItem(logoKey()) || 'null');
    if (saved) state.profile = { ...state.profile, ...saved };
  } catch (e) { console.warn('Profile load failed', e); }
}
function saveProfile() {
  try { localStorage.setItem(logoKey(), JSON.stringify(state.profile)); }
  catch (e) { showToast("LOGO TOO LARGE TO SAVE ON THIS DEVICE", "error"); }
}

function renderLogo() {
  const inv = state.activeInvoice;
  if (!inv) return;
  const has = !!inv.logo;
  el.invoiceLogo.classList.toggle('hidden', !has);
  el.logoPlaceholder.classList.toggle('hidden', has);
  el.logoControls.classList.toggle('hidden', !has);
  if (has) {
    el.invoiceLogo.src = inv.logo;
    el.invoiceLogo.className = `invoice-logo ${inv.logo_shape || 'logo-original'}`;
    el.logoShape.value = inv.logo_shape || 'logo-original';
  } else {
    el.invoiceLogo.removeAttribute('src');
  }
}

function setLogo(dataUrl, shape) {
  state.activeInvoice.logo = dataUrl;
  state.activeInvoice.logo_shape = shape || state.activeInvoice.logo_shape || 'logo-original';
  state.profile.logo = state.activeInvoice.logo;
  state.profile.logo_shape = state.activeInvoice.logo_shape;
  saveProfile();
  renderLogo();
}

// Resize + compress the chosen image on a canvas, return a data URL
function processLogoFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('READ FAILED'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('NOT A VALID IMAGE'));
      img.onload = () => {
        const scale = Math.min(1, LOGO_MAX_DIM / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        const keepAlpha = /png|webp|gif|svg/.test(file.type);   // keep transparency
        resolve(keepAlpha ? canvas.toDataURL('image/png') : canvas.toDataURL('image/jpeg', 0.9));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

el.logoPlaceholder.addEventListener('click', () => el.logoInput.click());
el.invoiceLogo.addEventListener('click', () => el.logoInput.click());   // click logo to replace it

el.logoInput.addEventListener('change', async (e) => {
  const file = e.target.files && e.target.files[0];
  e.target.value = '';                       // allows re-selecting the same file later
  if (!file) return;
  if (!file.type.startsWith('image/')) return showToast("PLEASE CHOOSE AN IMAGE FILE", "error");
  if (file.size > LOGO_MAX_BYTES) return showToast("IMAGE TOO LARGE (MAX 5 MB)", "error");
  try {
    setLogo(await processLogoFile(file));
    showToast("LOGO ADDED");
  } catch (err) {
    showToast(err.message || "COULD NOT LOAD IMAGE", "error");
  }
});

el.logoShape.addEventListener('change', (e) => {
  state.activeInvoice.logo_shape = e.target.value;
  state.profile.logo_shape = e.target.value;
  saveProfile();
  renderLogo();
});

el.btnRemoveLogo.addEventListener('click', () => {
  state.activeInvoice.logo = '';
  state.profile.logo = '';
  saveProfile();
  renderLogo();
  showToast("LOGO REMOVED");
});

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

// CHANGE PASSWORD (sends a reset link to the logged-in user's email)
document.getElementById('btn-change-password').addEventListener('click', async (e) => {
  if (!state.user?.email) return showToast("NOT LOGGED IN", "error");
  const btn = e.currentTarget;
  btn.disabled = true;
  const { error } = await sendResetEmail(state.user.email);
  btn.disabled = false;
  if (error) showToast(friendlyAuthError(error), "error");
  else showToast("RESET LINK SENT TO " + state.user.email);
});
