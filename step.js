const USD_TO_INR = 85;

function createTrackingId() {
  return `VFX-IND-${Math.floor(100000 + Math.random() * 900000)}`;
}

function copyTrackingId(trackingId, button) {
  copyText(trackingId).then(() => {
    const originalText = button.textContent;
    button.textContent = 'Copied';
    button.disabled = true;
    window.setTimeout(() => {
      button.textContent = originalText;
      button.disabled = false;
    }, 1500);
  }).catch(() => {
    button.textContent = 'Copy failed';
  });
}

function copyText(value) {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(value);
  const helper = document.createElement('textarea');
  helper.value = value;
  helper.setAttribute('readonly', '');
  helper.style.position = 'fixed';
  helper.style.opacity = '0';
  document.body.appendChild(helper);
  helper.select();
  const copied = document.execCommand('copy');
  helper.remove();
  return copied ? Promise.resolve() : Promise.reject(new Error('Copy failed'));
}

function copyPaymentValue(value, button) {
  copyText(value).then(() => {
    const originalText = button.textContent;
    button.textContent = 'Copied';
    button.classList.add('is-copying');
    window.setTimeout(() => {
      button.textContent = originalText;
      button.classList.remove('is-copying');
    }, 1500);
  }).catch(() => {
    button.textContent = 'Copy failed';
  });
}

async function findTrackingRecord(trackingId) {
  const supabase = window.requireVfxSupabase();
  const { data, error } = await supabase.rpc('get_tracking_status', { p_tracking_id: trackingId });
  if (error) throw error;
  return data?.[0] || null;
}

function collectFormData(form) {
  const values = {};
  form.querySelectorAll('input, select, textarea').forEach((control) => {
    if (control.id && control.type !== 'file') values[control.id] = control.value;
  });
  return values;
}

async function uploadPaymentScreenshot(supabase, trackingId, stage, file) {
  if (!file) return null;
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-');
  const path = `${trackingId}/${stage}-${crypto.randomUUID()}-${safeName}`;
  const { error } = await supabase.storage.from('payment-screenshots').upload(path, file, {
    contentType: file.type || 'application/octet-stream',
    upsert: false
  });
  if (error) throw error;
  return path;
}

async function saveStageSubmission(supabase, form, trackingId, stage) {
  const screenshot = form.querySelector('#payment-screenshot')?.files?.[0] || null;
  const screenshotPath = await uploadPaymentScreenshot(supabase, trackingId, stage, screenshot);
  const { error } = await supabase.from('stage_submissions').insert({
    tracking_id: trackingId,
    stage,
    payment_method: form.querySelector('#payment-method-select')?.value || '',
    payment_screenshot_path: screenshotPath,
    form_data: collectFormData(form)
  });
  if (error) throw error;
}

async function renderPaymentMethods(form) {
  const container = form.querySelector('#payment-method-options');
  const supabase = window.requireVfxSupabase();
  const { data, error } = await supabase.from('payment_accounts').select('bank_account, upi_id, paypal').eq('id', 1).maybeSingle();
  if (error) throw error;
  const methods = [
    data?.bank_account && { name: 'Bank Account', value: data.bank_account },
    data?.upi_id && { name: 'UPI', value: data.upi_id },
    data?.paypal && { name: 'PayPal', value: data.paypal }
  ].filter(Boolean);
  const stage = Number(form.dataset.stage);
  const amount = stage === 0 ? 20 : stage === 1 ? 150 : 100;
  const amountInr = amount * USD_TO_INR;
  container.innerHTML = `<select id="payment-method-select" name="payment-method" required><option value="">Select payment method</option>${methods.map((method) => `<option value="${method.name}">${method.name}</option>`).join('')}</select><div id="selected-payment-detail" class="payment-detail-row" hidden></div><div class="fee-summary"><span>Fee</span><strong id="fee-amount">$${amount} (INR ${amountInr.toLocaleString('en-IN')})</strong></div>`;
  form.querySelector('#payment-method-message').textContent = methods.length ? 'Choose one method to view its payment details.' : 'Payment methods are not configured yet.';
  const select = container.querySelector('#payment-method-select');
  const detail = container.querySelector('#selected-payment-detail');
  select.addEventListener('change', () => {
    const selected = methods.find((method) => method.name === select.value);
    if (!selected) { detail.hidden = true; return; }
    detail.hidden = false;
    detail.innerHTML = `<div class="payment-detail-copy"><span class="payment-detail-label">${selected.name} details</span><strong>${selected.value}</strong></div><button class="copy-payment" type="button">Copy</button>`;
    detail.querySelector('.copy-payment').addEventListener('click', (event) => copyPaymentValue(selected.value, event.currentTarget));
  });
}

document.querySelectorAll('form[data-stage]').forEach((form) => {
  const stage = Number(form.dataset.stage);
  const stageCopy = {
    0: { eyebrow: 'Application part 1', title: 'Form filling' },
    1: { eyebrow: 'Application part 2', title: 'Visa process information' },
    2: { eyebrow: 'Application part 3', title: 'Supporting documents' },
    3: { eyebrow: 'Application part 4', title: 'Final review' }
  }[stage];
  const heading = form.closest('main')?.querySelector('.step-heading');
  if (stageCopy && heading) {
    const eyebrow = heading.querySelector('.eyebrow');
    const title = heading.querySelector('h1');
    if (eyebrow) eyebrow.textContent = stageCopy.eyebrow;
    if (title) title.textContent = stageCopy.title;
  }
  const paymentLabel = form.querySelector('label[for="payment-screenshot"]');
  if (paymentLabel) paymentLabel.textContent = 'Payment screenshot required';
  const submitButton = form.querySelector('button[type="submit"]');
  const paymentScreenshot = form.querySelector('#payment-screenshot');
  if (submitButton && paymentScreenshot) submitButton.disabled = true;
  renderPaymentMethods(form).catch((error) => {
    console.error('Payment methods load failed:', error);
    form.querySelector('#payment-method-message').textContent = error.message;
  });

  form.querySelectorAll('input[type="file"]').forEach((input) => input.addEventListener('change', () => {
    const status = input.closest('.document-item, .upload-wrap')?.querySelector('.upload-status, #payment-screenshot-name');
    if (status) status.textContent = input.files.length ? 'Uploaded' : 'Missing';
    if (input === paymentScreenshot && submitButton) {
      submitButton.disabled = !input.files.length;
      submitButton.title = input.files.length ? '' : 'Upload your payment screenshot first';
    }
  }));

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const message = form.querySelector('#step-message');
    if (!form.checkValidity()) { form.reportValidity(); return; }

    try {
      let trackingId = form.querySelector('#tracking-id')?.value.trim();
      const record = stage > 0 ? await findTrackingRecord(trackingId) : null;
      if (stage > 0 && !record) { message.textContent = 'Tracking ID not found. Check the ID and try again.'; return; }
      if (stage > 0 && Number(record.current_step) < stage) {
        message.textContent = 'This part of your application is not open yet. Please check your tracking ID for the latest status.';
        return;
      }
      if (!form.querySelector('#payment-screenshot')?.files?.length) {
        message.textContent = 'Please upload your payment screenshot before submitting this form.';
        form.querySelector('#payment-screenshot')?.focus();
        return;
      }
      if (stage === 2) {
        const missing = [...form.querySelectorAll('input[type="file"][data-required="true"]')].filter((input) => !input.files.length);
        if (missing.length) { message.textContent = 'Please upload every document marked Required.'; return; }
      }

      const supabase = window.requireVfxSupabase();
      if (stage === 0) {
        const formData = {
          full_name: form.querySelector('#full-name')?.value.trim() || '',
          email: form.querySelector('#email')?.value.trim() || '',
          phone: form.querySelector('#phone')?.value.trim() || '',
          passport: form.querySelector('#passport')?.value.trim() || '',
          identity: form.querySelector('#identity')?.value.trim() || '',
          visa_type: form.querySelector('#visa-type')?.value || '',
          purpose: form.querySelector('#purpose')?.value.trim() || '',
          address: form.querySelector('#address')?.value.trim() || '',
          payment_method: form.querySelector('#payment-method-select')?.value || ''
        };
        const { data, error } = await supabase.rpc('find_or_create_tracking_record', {
          p_full_name: formData.full_name || '',
          p_email: formData.email || '',
          p_phone: formData.phone || '',
          p_passport_number: formData.passport || '',
          p_form_data: formData
        });
        if (error) throw error;
        const result = data?.[0];
        if (!result) throw new Error('Could not create or find the tracking record.');
        trackingId = result.tracking_id;
        const hasScreenshot = Boolean(form.querySelector('#payment-screenshot')?.files?.length);
        if (!result.already_exists || hasScreenshot) await saveStageSubmission(supabase, form, trackingId, stage);
        if (result.already_exists) {
          message.innerHTML = `<div class="result-heading"><span class="result-icon">&#10003;</span><div><span class="success-title">Your form was already received</span><span class="success-copy">Keep your tracking ID and wait for the next part to be opened.</span></div></div><div class="tracking-id-card"><span class="generated-tracking-label">Your Tracking ID</span><strong class="generated-tracking-id">${trackingId}</strong><button class="secondary-btn copy-tracking-result" type="button">Copy Tracking ID</button></div>`;
        } else {
          message.innerHTML = `<div class="result-heading"><span class="result-icon">&#10003;</span><div><span class="success-title">Your form was accepted</span><span class="success-copy">Keep your tracking ID. We will open the next part after review.</span></div></div><div class="tracking-id-card"><span class="generated-tracking-label">Your Tracking ID</span><strong class="generated-tracking-id">${trackingId}</strong><button class="secondary-btn copy-tracking-result" type="button">Copy Tracking ID</button></div>`;
        }
        const copyButton = message.querySelector('.copy-tracking-result');
        copyButton?.addEventListener('click', () => copyTrackingId(trackingId, copyButton));
      } else {
        await saveStageSubmission(supabase, form, trackingId, stage);
        message.textContent = 'Your information was submitted successfully. We will review it before opening the next part.';
      }
    } catch (error) {
      console.error('Supabase submission failed:', error);
      message.textContent = error.message;
    }
  });
});

document.querySelectorAll('.mini-link').forEach((link) => {
  link.href = 'tracking-id.html';
  link.textContent = 'Track application';
});
