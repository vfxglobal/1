const STEP_NAMES = {
  0: 'Form received',
  1: 'Visa process information',
  2: 'Supporting documents',
  3: 'Final review'
};

const loginScreen = document.querySelector('#login-screen');
const dashboardScreen = document.querySelector('#dashboard-screen');
const loginForm = document.querySelector('#agent-login-form');
const AGENT_PASSWORD = '26452126';

function showDashboard() {
  loginScreen.hidden = true;
  dashboardScreen.hidden = false;
}

function showMessage(selector, message) {
  const element = document.querySelector(selector);
  if (element) element.textContent = message;
}

async function renderTrackingRows() {
  const tbody = document.querySelector('#agent-table-body');
  const supabase = window.requireVfxSupabase();
  const { data, error } = await supabase
    .from('tracking_records')
    .select('tracking_id, full_name, email, phone, passport_number, current_step')
    .order('created_at', { ascending: false });
  if (error) throw error;
  const { data: submissions, error: submissionsError } = await supabase
    .from('stage_submissions')
    .select('tracking_id, stage, payment_method, form_data, created_at')
    .order('created_at', { ascending: false });
  if (submissionsError) throw submissionsError;
  const latestSubmission = new Map();
  (submissions || []).forEach((submission) => {
    const key = `${submission.tracking_id}:${submission.stage}`;
    if (!latestSubmission.has(key)) latestSubmission.set(key, submission);
  });

  tbody.innerHTML = data.length
    ? data.map((record) => {
      const activities = [0, 1, 2, 3]
        .map((stage) => latestSubmission.get(`${record.tracking_id}:${stage}`))
        .filter(Boolean);
      const activityText = activities.length
        ? activities.map((activity) => `${STEP_NAMES[activity.stage]} received<br>Payment: ${activity.payment_method || 'Not recorded'}`).join('<br><br>')
        : 'No submission received yet';
      return `<tr><td><strong>${record.tracking_id}</strong><small>${record.full_name || 'Unknown'}<br>${record.email || ''}<br>${record.phone || ''}<br>${record.passport_number || ''}</small></td><td><span class="agent-current-stage">${STEP_NAMES[record.current_step] || STEP_NAMES[0]}</span><small class="agent-activity">${activityText}</small></td><td><select class="application-step" data-tracking-id="${record.tracking_id}"><option value="0" ${record.current_step === 0 ? 'selected' : ''}>Form received</option><option value="1" ${record.current_step === 1 ? 'selected' : ''}>Visa process</option><option value="2" ${record.current_step === 2 ? 'selected' : ''}>Documents</option><option value="3" ${record.current_step === 3 ? 'selected' : ''}>Final review</option></select><button class="save-application" type="button" data-tracking-id="${record.tracking_id}">Set available stage</button><button class="delete-application" type="button" data-tracking-id="${record.tracking_id}">Delete</button></td></tr>`;
    }).join('')
    : '<tr><td colspan="3">No tracking IDs submitted yet.</td></tr>';

  tbody.querySelectorAll('.save-application').forEach((button) => button.addEventListener('click', async () => {
    const select = tbody.querySelector(`.application-step[data-tracking-id="${button.dataset.trackingId}"]`);
    try {
      const { error: updateError } = await supabase
        .from('tracking_records')
        .update({ current_step: Number(select.value), updated_at: new Date().toISOString() })
        .eq('tracking_id', button.dataset.trackingId);
      if (updateError) throw updateError;
      showMessage('#agent-save-message', `${button.dataset.trackingId} is now marked ${STEP_NAMES[select.value]}.`);
    } catch (error) {
      console.error('Tracking stage update failed:', error);
      showMessage('#agent-save-message', `Could not save stage: ${error.message}`);
    }
  }));

  tbody.querySelectorAll('.delete-application').forEach((button) => button.addEventListener('click', async () => {
    const trackingId = button.dataset.trackingId;
    if (!trackingId || !window.confirm(`Delete ${trackingId} and all data linked to it?`)) return;
    try {
      const { data: submissions, error: submissionsError } = await supabase
        .from('stage_submissions')
        .select('payment_screenshot_path')
        .eq('tracking_id', trackingId);
      if (submissionsError) throw submissionsError;
      const screenshotPaths = (submissions || [])
        .map((submission) => submission.payment_screenshot_path)
        .filter(Boolean);
      if (screenshotPaths.length) {
        const { error: storageError } = await supabase.storage
          .from('payment-screenshots')
          .remove(screenshotPaths);
        if (storageError) throw storageError;
      }
      const { error: deleteError } = await supabase
        .from('tracking_records')
        .delete()
        .eq('tracking_id', trackingId);
      if (deleteError) throw deleteError;
      showMessage('#agent-save-message', `${trackingId} and its linked data were deleted.`);
      await renderTrackingRows();
    } catch (error) {
      console.error('Tracking record deletion failed:', error);
      showMessage('#agent-save-message', `Could not delete tracking record: ${error.message}`);
    }
  }));
}

async function loadPaymentSettings() {
  const supabase = window.requireVfxSupabase();
  const { data, error } = await supabase.from('payment_accounts').select('bank_account, upi_id, paypal').eq('id', 1).maybeSingle();
  if (error) throw error;
  document.querySelector('#agent-bank-account').value = data?.bank_account || '';
  document.querySelector('#agent-upi-id').value = data?.upi_id || '';
  document.querySelector('#agent-paypal').value = data?.paypal || '';
}

loginForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    if (document.querySelector('#agent-password').value !== AGENT_PASSWORD) {
      throw new Error('Incorrect agent password.');
    }
    const supabase = window.requireVfxSupabase();
    const { error } = await supabase.auth.signInWithPassword({
      email: window.VFX_AGENT_EMAIL,
      password: AGENT_PASSWORD
    });
    if (error) throw error;
    await Promise.all([loadPaymentSettings(), renderTrackingRows()]);
    showDashboard();
  } catch (error) {
    console.error('Agent login failed:', error);
    showMessage('#agent-login-message', error.message);
  }
});

document.querySelector('#payment-settings-form')?.addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    const supabase = window.requireVfxSupabase();
    const { error } = await supabase.from('payment_accounts').upsert({
      id: 1,
      bank_account: document.querySelector('#agent-bank-account').value.trim(),
      upi_id: document.querySelector('#agent-upi-id').value.trim(),
      paypal: document.querySelector('#agent-paypal').value.trim(),
      updated_at: new Date().toISOString()
    });
    if (error) throw error;
    showMessage('#payment-settings-message', 'Payment methods saved.');
  } catch (error) {
    console.error('Payment settings update failed:', error);
    showMessage('#payment-settings-message', `Could not save payment methods: ${error.message}`);
  }
});

document.querySelector('#logout-btn')?.addEventListener('click', async () => {
  await window.requireVfxSupabase().auth.signOut();
  dashboardScreen.hidden = true;
  loginScreen.hidden = false;
  loginForm.reset();
});

async function restoreAgentSession() {
  try {
    const supabase = window.requireVfxSupabase();
    const { data } = await supabase.auth.getSession();
    if (!data.session) return;
    await Promise.all([loadPaymentSettings(), renderTrackingRows()]);
    showDashboard();
  } catch (error) {
    console.error('Could not restore agent session.', error);
  }
}

restoreAgentSession();
