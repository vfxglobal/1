const STORAGE_KEY = 'vfxGlobalApplications';
const visaForm = document.querySelector('#visa-form');
const trackingNumber = document.querySelector('#tracking-number');
const fileInput = document.querySelector('#document-upload');
const paymentScreenshotInput = document.querySelector('#payment-ss');
const uploadName = document.querySelector('#upload-name');
const paymentScreenshotName = document.querySelector('#payment-ss-name');
const copyTrackingButton = document.querySelector('#copy-tracking');
const appList = document.querySelector('#application-list');
const AGENT_PASSWORD = '26452126';
const PAYMENT_SETTINGS_KEY = 'vfxGlobalPaymentSettings';

let supabase = null;

try {
  const hasSupabaseConfig = window.VFX_SUPABASE_URL &&
    !window.VFX_SUPABASE_URL.includes('YOUR-PROJECT-ID') &&
    window.VFX_SUPABASE_ANON_KEY &&
    !window.VFX_SUPABASE_ANON_KEY.includes('YOUR-ANON-KEY');

  if (window.supabase && hasSupabaseConfig) {
    supabase = window.supabase.createClient(window.VFX_SUPABASE_URL, window.VFX_SUPABASE_ANON_KEY);
  }
} catch (error) {
  console.warn('Supabase is not configured. Using demo storage.', error);
}

const useSupabase = !!supabase;

function readApplications() {
  if (useSupabase) {
    return [];
  }

  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch (error) {
    console.warn('Could not read saved applications.', error);
    return [];
  }
}

function writeApplications(applications) {
  if (useSupabase) {
    return;
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(applications));
}

function createTrackingNumber() {
  const digits = Math.floor(100000 + Math.random() * 900000);
  return `VFX-IND-${digits}`;
}

function readPaymentSettings() {
  try {
    const saved = localStorage.getItem(PAYMENT_SETTINGS_KEY);
    return saved ? JSON.parse(saved) : { bankAccount: '', upiId: '' };
  } catch (error) {
    return { bankAccount: '', upiId: '' };
  }
}

function loadPaymentSettings() {
  const settings = readPaymentSettings();
  const bankInput = document.querySelector('#agent-bank-account');
  const upiInput = document.querySelector('#agent-upi-id');
  if (bankInput) bankInput.value = settings.bankAccount || '';
  if (upiInput) upiInput.value = settings.upiId || '';
}

function getStatusClass(status) {
  if (status === 'Approved') return 'status-approved';
  if (status === 'Documents Needed') return 'status-docs';
  return 'status-pending';
}

async function fetchApplications() {
  if (!useSupabase) {
    return readApplications();
  }

  const { data, error } = await supabase.from('applications').select('*').order('created_at', { ascending: false });

  if (error) {
    console.error('Supabase fetch failed:', error);
    return [];
  }

  return data;
}

async function saveApplication(formData) {
  if (!useSupabase) {
    const applications = readApplications();
    applications.push(formData);
    writeApplications(applications);
    return;
  }

  const { error } = await supabase.from('applications').insert([formData]);
  if (error) {
    console.error('Supabase insert failed:', error);
    throw error;
  }
}

async function updateApplicationStatus(name, status) {
  if (!useSupabase) {
    const applications = readApplications();
    const index = applications.findIndex((app) => app.name === name);
    if (index >= 0) {
      applications[index].status = status;
      writeApplications(applications);
    }
    return;
  }

  const { error } = await supabase.from('applications').update({ status }).eq('name', name);
  if (error) {
    console.error('Supabase update failed:', error);
    throw error;
  }
}

async function renderApplications() {
  if (!appList) return;

  const applications = await fetchApplications();

  appList.innerHTML = applications.length
    ? applications
        .slice()
        .reverse()
        .map(
          (app) => `
            <article class="application-card">
              <div class="app-main">
                <h3>${app.name}</h3>
                <div class="app-meta">
                  <span>${app.visa}</span>
                  <span>•</span>
                  <span>${app.country}</span>
                </div>
              </div>

              <div class="app-status">
                <span class="status-badge ${getStatusClass(app.status)}">${app.status}</span>
              </div>

              <div class="app-date">
                <strong>${app.date}</strong>
                <p>Payment: ${app.payment}</p>
              </div>

              <div class="app-actions">
                <button class="action-btn review" type="button">Review</button>
                <button class="action-btn approve" type="button">Approve</button>
                <button class="action-btn reject" type="button">Reject</button>
              </div>
            </article>
          `
        )
        .join('')
    : '<div class="empty-state">No applications yet.</div>';

  appList.querySelectorAll('.action-btn.approve').forEach((button) => {
    button.addEventListener('click', async () => {
      const card = button.closest('.application-card');
      const name = card.querySelector('h3')?.textContent;
      if (name) {
        await updateApplicationStatus(name, 'Approved');
        renderApplications();
      }
    });
  });

  appList.querySelectorAll('.action-btn.reject').forEach((button) => {
    button.addEventListener('click', async () => {
      const card = button.closest('.application-card');
      const name = card.querySelector('h3')?.textContent;
      if (name) {
        await updateApplicationStatus(name, 'Documents Needed');
        renderApplications();
      }
    });
  });
}

if (fileInput) {
  fileInput.addEventListener('change', () => {
    const [file] = fileInput.files;
    uploadName.textContent = file ? file.name : 'No file selected';
  });
}

if (paymentScreenshotInput) {
  paymentScreenshotInput.addEventListener('change', () => {
    const [file] = paymentScreenshotInput.files;
    if (paymentScreenshotName) {
      paymentScreenshotName.textContent = file ? file.name : 'No file selected';
    }
  });
}

copyTrackingButton?.addEventListener('click', async () => {
  try {
    const value = trackingNumber.textContent || 'VFX-IND-000000';
    copyTrackingButton.classList.add('is-copying');
    await navigator.clipboard.writeText(value);
    const originalText = copyTrackingButton.textContent;
    copyTrackingButton.textContent = 'Copied';

    window.setTimeout(() => {
      copyTrackingButton.textContent = originalText;
      copyTrackingButton.classList.remove('is-copying');
    }, 1500);
  } catch (error) {
    console.error('Clipboard copy failed', error);
  }
});

visaForm?.addEventListener('submit', async (event) => {
  event.preventDefault();

  if (!visaForm.checkValidity()) {
    visaForm.reportValidity();
    return;
  }

  const trackingId = createTrackingNumber();
  if (trackingNumber) trackingNumber.textContent = trackingId;

  const selectedMethod = document.querySelector('input[name="payment-method"]:checked');
  const formData = {
    name: document.querySelector('#full-name')?.value || '',
    email: document.querySelector('#email')?.value || '',
    phone: document.querySelector('#phone')?.value || '',
    aadhaar: document.querySelector('#aadhaar')?.value || '',
    country: document.querySelector('#country')?.value || '',
    visa: document.querySelector('#visa-type')?.value || '',
    payment: selectedMethod ? selectedMethod.value : 'Not selected',
    paymentProof: paymentScreenshotInput?.files?.[0]?.name || 'No screenshot uploaded',
    status: 'Form Submitted',
    stage: 'Form filling complete',
    fee: 20,
    installments: {
      first: 150,
      second: 200,
      third: 100
    },
    date: new Date().toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    }),
    created_at: new Date().toISOString()
  };

  try {
    await saveApplication(formData);

    const currentButton = visaForm.querySelector('button[type="submit"]');
    if (currentButton) {
      currentButton.textContent = 'Application Submitted';
      currentButton.disabled = true;
      currentButton.style.opacity = '0.8';
      currentButton.style.cursor = 'default';
    }

    if (selectedMethod) {
      const note = document.createElement('p');
      note.textContent = `Selected payment method: ${selectedMethod.value}. Company agent will confirm the final collection method.`;
      note.style.marginTop = '18px';
      note.style.color = '#5f697b';
      note.style.lineHeight = '1.7';
      note.style.fontSize = '0.92rem';
      visaForm.appendChild(note);
    }

    renderApplications();
  } catch (error) {
    alert('There was a problem saving your application. Please try again.');
  }
});

const agentLoginForm = document.querySelector('#agent-login-form');
const loginScreen = document.querySelector('#login-screen');
const dashboardScreen = document.querySelector('#dashboard-screen');
const logoutBtn = document.querySelector('#logout-btn');

  function statusBadge(status) {
    const normalized = status || 'Form Submitted';
    return `<span class="status-badge ${getStatusClass(normalized)}">${normalized}</span>`;
  }

async function renderAgentTable() {
  const tbody = document.querySelector('#agent-table-body');
  if (!tbody) return;

  const rows = await fetchApplications();

  tbody.innerHTML = rows.length
    ? rows
        .slice()
        .reverse()
        .map(
          (row) => `
          <tr>
            <td>${row.name || 'Unknown'}</td>
            <td>${row.visa || 'Visa'}</td>
            <td>${row.payment || 'Not selected'}</td>
            <td>${statusBadge(row.status || 'Form Submitted')}</td>
            <td>
              <div class="td-actions">
                <button class="approve" type="button">Approve</button>
                <button class="reject" type="button">Reject</button>
              </div>
            </td>
          </tr>
        `
        )
        .join('')
    : '<tr><td colspan="5">No applications submitted yet.</td></tr>';

  const total = rows.length;
  const pending = rows.filter((row) => (row.status || 'Form Submitted') !== 'Approved').length;
  const approved = rows.filter((row) => (row.status || 'Form Submitted') === 'Approved').length;

  const totalApps = document.querySelector('#total-apps');
  const pendingApps = document.querySelector('#pending-apps');
  const approvedApps = document.querySelector('#approved-apps');

  if (totalApps) totalApps.textContent = total;
  if (pendingApps) pendingApps.textContent = pending;
  if (approvedApps) approvedApps.textContent = approved;

  tbody.querySelectorAll('.approve').forEach((button) => {
    button.addEventListener('click', async () => {
      const row = button.closest('tr');
      const candidateName = row?.children[0]?.textContent || '';
      if (candidateName) {
        await updateApplicationStatus(candidateName, 'Approved');
        renderAgentTable();
        renderApplications();
      }
    });
  });

  tbody.querySelectorAll('.reject').forEach((button) => {
    button.addEventListener('click', async () => {
      const row = button.closest('tr');
      const candidateName = row?.children[0]?.textContent || '';
      if (candidateName) {
        await updateApplicationStatus(candidateName, 'Documents Needed');
        renderAgentTable();
        renderApplications();
      }
    });
  });
}

agentLoginForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const password = document.querySelector('#agent-password')?.value.trim();

  if (!password) {
    alert('Please enter the password.');
    return;
  }

  if (password !== AGENT_PASSWORD) {
    alert('Incorrect password.');
    return;
  }

  loginScreen.hidden = true;
  dashboardScreen.hidden = false;
  loadPaymentSettings();
  try {
    await renderAgentTable();
  } catch (error) {
    console.error('Could not load applications.', error);
  }
});

document.querySelector('#payment-settings-form')?.addEventListener('submit', (event) => {
  event.preventDefault();
  const bankAccount = document.querySelector('#agent-bank-account')?.value.trim() || '';
  const upiId = document.querySelector('#agent-upi-id')?.value.trim() || '';

  localStorage.setItem(PAYMENT_SETTINGS_KEY, JSON.stringify({ bankAccount, upiId }));
  const message = document.querySelector('#payment-settings-message');
  if (message) message.textContent = 'Payment methods saved for customer accounts.';
});

logoutBtn?.addEventListener('click', () => {
  if (dashboardScreen) dashboardScreen.hidden = true;
  if (loginScreen) loginScreen.hidden = false;
  const form = document.querySelector('#agent-login-form');
  if (form) form.reset();
});

renderApplications();
renderAgentTable();
