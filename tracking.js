const STEP_NAMES = {
  0: 'Form received',
  1: 'Visa process information',
  2: 'Supporting documents',
  3: 'Final review'
};

const STEP_PAGES = {
  1: 'process-initiation.html',
  2: 'file-submission.html',
  3: 'after-visa-approval.html'
};

function showTrackingError(message) {
  const result = document.querySelector('#tracking-result');
  result.hidden = false;
  result.innerHTML = `<strong>Could not search tracking ID</strong><p>${message}</p>`;
}

document.querySelector('#tracking-search-form')?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const result = document.querySelector('#tracking-result');
  const trackingId = document.querySelector('#search-tracking-id').value.trim();
  result.hidden = false;
  result.textContent = 'Searching...';

  try {
    const supabase = window.requireVfxSupabase();
    const { data, error } = await supabase.rpc('get_tracking_status', { p_tracking_id: trackingId });
    if (error) throw error;
    const record = data?.[0];

    if (!record) {
      result.innerHTML = '<strong>Tracking ID not found</strong><p>Please check the ID and search again.</p>';
      return;
    }

    const currentStep = Number(record.current_step);
    const stage = STEP_NAMES[currentStep] || STEP_NAMES[0];
    if (currentStep === 0) {
      result.innerHTML = `<span class="status-badge status-pending">${stage}</span><h2>Your form was accepted</h2><p>Our team is reviewing your form. Please wait until the next part of your application is opened.</p>`;
      return;
    }
    const nextMessage = currentStep < 3
      ? 'Complete the information requested below, then upload your payment confirmation.'
      : 'Review the final information and upload your payment confirmation.';
    result.innerHTML = `<span class="status-badge status-pending">${stage}</span><h2>Your application is ready for ${stage.toLowerCase()}</h2><p>${nextMessage}</p><a class="primary-btn" href="${STEP_PAGES[currentStep]}">Continue application</a>`;
  } catch (error) {
    console.error('Tracking lookup failed:', error);
    showTrackingError(error.message);
  }
});
