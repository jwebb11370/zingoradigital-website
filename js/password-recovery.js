/* ========================================
   PASSWORD RECOVERY — static site recovery flow
   ======================================== */
(function () {
  'use strict';

  var SUPABASE_URL = 'https://ksiskhewcnznbvirfzgb.supabase.co';
  var SUPABASE_ANON_KEY = 'sb_publishable_XO_iEoxQv_EIxYzdO9h7LQ_yv41Gzyj';
  var REDIRECT_PATH = '/pages/account/reset-password.html';
  var SUPABASE_SDK_CANDIDATES = [
    'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',
    'https://unpkg.com/@supabase/supabase-js@2',
  ];
  var REQUEST_TIMEOUT_MS = 15000;
  var SCRIPT_TIMEOUT_MS = 8000;

  var supabaseClient = null;

  function withTimeout(promise, timeoutMs, timeoutMessage) {
    return new Promise(function (resolve, reject) {
      var finished = false;
      var timeoutId = window.setTimeout(function () {
        if (finished) return;
        finished = true;
        reject(new Error(timeoutMessage || 'request_timeout'));
      }, timeoutMs);

      Promise.resolve(promise)
        .then(function (value) {
          if (finished) return;
          finished = true;
          window.clearTimeout(timeoutId);
          resolve(value);
        })
        .catch(function (error) {
          if (finished) return;
          finished = true;
          window.clearTimeout(timeoutId);
          reject(error);
        });
    });
  }

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var script = document.createElement('script');
      var timeoutId = null;

      script.src = src;
      script.async = true;
      script.crossOrigin = 'anonymous';

      function clear() {
        if (timeoutId !== null) {
          window.clearTimeout(timeoutId);
          timeoutId = null;
        }
        script.onload = null;
        script.onerror = null;
      }

      script.onload = function () {
        clear();
        resolve(true);
      };

      script.onerror = function () {
        clear();
        reject(new Error('script_load_failed'));
      };

      timeoutId = window.setTimeout(function () {
        clear();
        reject(new Error('script_load_timeout'));
      }, SCRIPT_TIMEOUT_MS);

      document.head.appendChild(script);
    });
  }

  async function ensureSupabaseSdk() {
    if (window.supabase && typeof window.supabase.createClient === 'function') {
      return true;
    }

    for (var i = 0; i < SUPABASE_SDK_CANDIDATES.length; i += 1) {
      try {
        await loadScript(SUPABASE_SDK_CANDIDATES[i]);
        if (window.supabase && typeof window.supabase.createClient === 'function') {
          return true;
        }
      } catch (_) {
        // Try the next CDN candidate.
      }
    }

    return false;
  }

  function showBootstrapError(message) {
    var forgotStatus = document.getElementById('forgotPasswordStatus');
    var resetStatus = document.getElementById('resetPasswordStatus');
    var resetNote = document.getElementById('resetPasswordNote');
    var forgotForm = document.getElementById('forgotPasswordForm');
    var resetForm = document.getElementById('resetPasswordForm');

    setStatus(forgotStatus, 'error', message);
    setStatus(resetStatus, 'error', message);
    if (resetNote) {
      resetNote.textContent = message;
    }

    if (forgotForm) {
      var forgotButton = forgotForm.querySelector('button[type="submit"]');
      if (forgotButton) {
        forgotButton.disabled = true;
      }
    }

    if (resetForm) {
      var resetButton = resetForm.querySelector('button[type="submit"]');
      if (resetButton) {
        resetButton.disabled = true;
      }
    }
  }

  function setStatus(target, type, message) {
    if (!target) return;
    target.className = 'account-status account-status--' + type;
    target.textContent = message;
    target.classList.remove('hidden');
  }

  function clearStatus(target) {
    if (!target) return;
    target.textContent = '';
    target.className = 'account-status hidden';
  }

  function getRedirectTo() {
    return window.location.origin + REDIRECT_PATH;
  }

  async function handleForgotPassword() {
    var form = document.getElementById('forgotPasswordForm');
    if (!form) return;

    var emailInput = document.getElementById('forgot-email');
    var submitButton = form.querySelector('button[type="submit"]');
    var status = document.getElementById('forgotPasswordStatus');

    form.addEventListener('submit', async function (event) {
      event.preventDefault();
      clearStatus(status);
      emailInput.classList.remove('error');

      var email = (emailInput.value || '').trim();
      if (!email || email.indexOf('@') === -1) {
        emailInput.classList.add('error');
        setStatus(status, 'error', 'Please enter a valid email address.');
        return;
      }

      submitButton.disabled = true;
      submitButton.textContent = 'Sending...';

      try {
        var result = await withTimeout(
          supabaseClient.auth.resetPasswordForEmail(email, {
            redirectTo: getRedirectTo(),
          }),
          REQUEST_TIMEOUT_MS,
          'reset_email_timeout'
        );

        if (result.error) {
          setStatus(status, 'error', result.error.message || 'Unable to send reset email. Please try again.');
        } else {
          setStatus(status, 'success', 'If an account exists for this email address, a password reset link has been sent. Please check your inbox.');
          form.reset();
        }
      } catch (error) {
        setStatus(status, 'error', 'Unable to send reset email right now. Please try again in a moment.');
      } finally {
        submitButton.disabled = false;
        submitButton.textContent = 'Send Password Reset Link';
      }
    });
  }

  async function initializeResetPassword() {
    var form = document.getElementById('resetPasswordForm');
    if (!form) return;

    var passwordInput = document.getElementById('new-password');
    var confirmInput = document.getElementById('confirm-password');
    var submitButton = form.querySelector('button[type="submit"]');
    var status = document.getElementById('resetPasswordStatus');
    var note = document.getElementById('resetPasswordNote');
    var queryParams = new URLSearchParams(window.location.search || '');

    async function ensureRecoverySession() {
      var queryError = queryParams.get('error');
      var queryErrorCode = queryParams.get('error_code');
      if (queryError || queryErrorCode) {
        throw new Error('invalid_or_expired_link');
      }

      var hash = window.location.hash ? window.location.hash.substring(1) : '';
      var hashParams = new URLSearchParams(hash);
      var accessToken = hashParams.get('access_token');
      var refreshToken = hashParams.get('refresh_token');

      if (accessToken && refreshToken) {
        var setSessionResult = await withTimeout(
          supabaseClient.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          }),
          REQUEST_TIMEOUT_MS,
          'set_session_timeout'
        );
        if (setSessionResult.error) {
          throw setSessionResult.error;
        }
      }

      // Some Supabase templates provide token_hash/type instead of direct tokens.
      var tokenHash = queryParams.get('token_hash');
      var otpType = queryParams.get('type');
      if (tokenHash && otpType) {
        var verifyResult = await withTimeout(
          supabaseClient.auth.verifyOtp({
            token_hash: tokenHash,
            type: otpType,
          }),
          REQUEST_TIMEOUT_MS,
          'verify_otp_timeout'
        );
        if (verifyResult.error) {
          throw verifyResult.error;
        }
      }

      var sessionResult = await withTimeout(
        supabaseClient.auth.getSession(),
        REQUEST_TIMEOUT_MS,
        'session_lookup_timeout'
      );
      if (!sessionResult.data || !sessionResult.data.session) {
        throw new Error('missing_recovery_session');
      }
      return true;
    }

    try {
      await ensureRecoverySession();

      if (note) {
        note.textContent = 'Choose a new password to restore access to your account.';
      }
      clearStatus(status);
    } catch (error) {
      if (note) {
        note.textContent = 'This password reset link is invalid or has expired. Please request a new reset email.';
      }
      setStatus(status, 'error', 'This password reset link is invalid or has expired. Please request a new reset email.');
      // Keep fields visible so users can still type while requesting another link.
    }

    form.addEventListener('submit', async function (event) {
      event.preventDefault();
      clearStatus(status);
      passwordInput.classList.remove('error');
      confirmInput.classList.remove('error');

      var password = passwordInput.value || '';
      var confirmPassword = confirmInput.value || '';

      if (password.length < 8) {
        passwordInput.classList.add('error');
        setStatus(status, 'error', 'Your new password must be at least 8 characters long.');
        return;
      }

      if (password !== confirmPassword) {
        confirmInput.classList.add('error');
        setStatus(status, 'error', 'The password confirmation does not match.');
        return;
      }

      submitButton.disabled = true;
      submitButton.textContent = 'Updating Password...';

      try {
        await ensureRecoverySession();
        var updateResult = await withTimeout(
          supabaseClient.auth.updateUser({ password: password }),
          REQUEST_TIMEOUT_MS,
          'update_password_timeout'
        );
        if (updateResult.error) {
          setStatus(status, 'error', updateResult.error.message || 'Unable to update password. Please try again.');
        } else {
          setStatus(status, 'success', 'Your password has been updated successfully. Redirecting to sign in...');
          window.setTimeout(function () {
            window.location.href = '/pages/account/index.html';
          }, 1500);
        }
      } catch (error) {
        setStatus(status, 'error', 'Unable to update password at this time. Please try again.');
      } finally {
        submitButton.disabled = false;
        submitButton.textContent = 'Complete Password Reset';
      }
    });
  }

  async function bootstrapRecoveryFlow() {
    var sdkReady = await ensureSupabaseSdk();
    if (!sdkReady) {
      showBootstrapError('Password recovery is temporarily unavailable. Please try again shortly.');
      return;
    }

    try {
      supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    } catch (_) {
      showBootstrapError('Password recovery is temporarily unavailable. Please try again shortly.');
      return;
    }

    handleForgotPassword();
    initializeResetPassword();
  }

  bootstrapRecoveryFlow();
})();
