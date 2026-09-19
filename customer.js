const CUSTOMER_ACCOUNTS_KEY = 'vfxGlobalCustomerAccounts';

function readAccounts() {
  try {
    return JSON.parse(localStorage.getItem(CUSTOMER_ACCOUNTS_KEY) || '[]');
  } catch (error) {
    return [];
  }
}

document.querySelector('#customer-login-form')?.addEventListener('submit', (event) => {
  event.preventDefault();
  const username = document.querySelector('#customer-username').value.trim();
  const password = document.querySelector('#customer-password').value;
  const message = document.querySelector('#customer-login-message');
  const account = readAccounts().find((entry) => entry.username === username && entry.password === password);

  if (!account) {
    message.textContent = 'Incorrect username or password. Please contact support.';
    return;
  }

  document.querySelector('#customer-login-screen').hidden = true;
  document.querySelector('#customer-content').hidden = false;
  message.textContent = '';
});
