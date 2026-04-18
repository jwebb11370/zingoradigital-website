/* ========================================
   ACCOUNT.JS — tab switching & form logic
   ======================================== */
(function () {
  'use strict';

  // ---- Tab switching ----
  const tabs      = document.querySelectorAll('.account-tab');
  const loginForm = document.getElementById('loginForm');
  const regForm   = document.getElementById('registerForm');

  tabs.forEach(function (tab) {
    tab.addEventListener('click', function () {
      tabs.forEach(function (t) { t.classList.remove('active'); });
      tab.classList.add('active');

      if (tab.dataset.tab === 'login') {
        loginForm.classList.remove('hidden');
        regForm.classList.add('hidden');
      } else {
        loginForm.classList.add('hidden');
        regForm.classList.remove('hidden');
      }
    });
  });

  // ---- Basic client-side validation ----
  function showError(input, message) {
    input.classList.add('error');
    var existing = input.parentElement.querySelector('.form-error');
    if (existing) existing.remove();
    var span = document.createElement('span');
    span.className = 'form-error';
    span.textContent = message;
    input.parentElement.appendChild(span);
  }

  function clearErrors(form) {
    form.querySelectorAll('.error').forEach(function (el) {
      el.classList.remove('error');
    });
    form.querySelectorAll('.form-error').forEach(function (el) {
      el.remove();
    });
  }

  // Login form
  if (loginForm) {
    loginForm.addEventListener('submit', function (e) {
      e.preventDefault();
      clearErrors(loginForm);

      var email    = loginForm.querySelector('#login-email');
      var password = loginForm.querySelector('#login-password');
      var valid    = true;

      if (!email.value || !email.value.includes('@')) {
        showError(email, 'Please enter a valid email.');
        valid = false;
      }
      if (!password.value || password.value.length < 1) {
        showError(password, 'Password is required.');
        valid = false;
      }

      if (valid) {
        // TODO: Connect to your auth backend
        console.log('Login submitted', { email: email.value });
      }
    });
  }

  // Register form
  if (regForm) {
    regForm.addEventListener('submit', function (e) {
      e.preventDefault();
      clearErrors(regForm);

      var first    = regForm.querySelector('#reg-first');
      var last     = regForm.querySelector('#reg-last');
      var email    = regForm.querySelector('#reg-email');
      var password = regForm.querySelector('#reg-password');
      var confirm  = regForm.querySelector('#reg-confirm');
      var terms    = regForm.querySelector('input[name="terms"]');
      var valid    = true;

      if (!first.value.trim()) {
        showError(first, 'First name is required.');
        valid = false;
      }
      if (!last.value.trim()) {
        showError(last, 'Last name is required.');
        valid = false;
      }
      if (!email.value || !email.value.includes('@')) {
        showError(email, 'Please enter a valid email.');
        valid = false;
      }
      if (!password.value || password.value.length < 8) {
        showError(password, 'Password must be at least 8 characters.');
        valid = false;
      }
      if (password.value !== confirm.value) {
        showError(confirm, 'Passwords do not match.');
        valid = false;
      }
      if (!terms.checked) {
        showError(terms, 'You must agree to the terms.');
        valid = false;
      }

      if (valid) {
        // TODO: Connect to your auth backend
        console.log('Register submitted', {
          first: first.value,
          last: last.value,
          email: email.value
        });
      }
    });
  }
})();
