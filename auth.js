// ---------- KONFIGURASI TAILWIND ----------
tailwind.config = {
  darkMode: 'class', 
  theme: { 
    extend: { 
      colors: { 
        primary: {"50":"#eff6ff","100":"#dbeafe","200":"#bfdbfe","300":"#93c5fd","400":"#60a5fa","500":"#3b82f6","600":"#2563eb","700":"#1d4ed8","800":"#1e40af","900":"#1e3a8a","950":"#172554"} 
      } 
    } 
  }
}

// ---------- KONFIGURASI SUPABASE ----------
const SUPABASE_URL = 'https://pmxkyzgsauzxeidbjuhd.supabase.co'; 
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBteGt5emdzYXV6eGVpZGJqdWhkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjExMjMwNDAsImV4cCI6MjA3NjY5OTA0MH0.oXlVN7F-CXN6zDCuOOr8u2N6efIo9GWd9JyJ5O0_fyA'; 

let supabaseClient;

// Inisialisasi client
if (window.supabase) {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
} else {
    console.error("Supabase JS Library belum dimuat.");
}

// ---------- LOGIKA UMUM (Dark Mode & Init) ----------
document.addEventListener('DOMContentLoaded', () => {
  // Dark Mode Logic
  const themeToggle = document.getElementById('theme-toggle');
  const themeIcon = document.getElementById('theme-icon');
  const htmlEl = document.documentElement;

  if (themeToggle) {
    if (localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      htmlEl.classList.add('dark');
      if(themeIcon) { themeIcon.classList.remove('fa-sun'); themeIcon.classList.add('fa-moon'); }
    } else {
      htmlEl.classList.remove('dark');
      if(themeIcon) { themeIcon.classList.add('fa-sun'); themeIcon.classList.remove('fa-moon'); }
    }

    themeToggle.addEventListener('click', () => {
      if (htmlEl.classList.contains('dark')) {
        htmlEl.classList.remove('dark'); localStorage.theme = 'light';
        if(themeIcon) { themeIcon.classList.add('fa-sun'); themeIcon.classList.remove('fa-moon'); }
      } else {
        htmlEl.classList.add('dark'); localStorage.theme = 'dark';
        if(themeIcon) { themeIcon.classList.remove('fa-sun'); themeIcon.classList.add('fa-moon'); }
      }
    });
  }

  // ---------- LOGIKA HALAMAN LOGIN ----------
  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    const loginButton = document.getElementById('login-button');
    const loginText = document.getElementById('login-text');
    const loginSpinner = document.getElementById('login-spinner');
    const alertMessage = document.getElementById('alert-message');
    const passwordInput = document.getElementById('password'); 
    const togglePassword = document.getElementById('toggle-password');

    if(togglePassword) {
      togglePassword.addEventListener('click', () => {
        const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
        passwordInput.setAttribute('type', type);
        if (type === 'password') {
          togglePassword.classList.remove('fa-eye-slash'); togglePassword.classList.add('fa-eye');
        } else {
          togglePassword.classList.remove('fa-eye'); togglePassword.classList.add('fa-eye-slash');
        }
      });
    }

    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      loginButton.disabled = true;
      loginText.classList.add('hidden');
      loginSpinner.classList.remove('hidden');
      alertMessage.classList.add('hidden');

      const email = document.getElementById('email').value.trim();
      const password = passwordInput.value; 

      // PERBAIKAN: Menggunakan supabaseClient
      const { data, error } = await supabaseClient.auth.signInWithPassword({
        email: email, password: password,
      });

      if (error) {
        alertMessage.textContent = 'Login Gagal: ' + error.message;
        alertMessage.classList.remove('hidden');
        loginButton.disabled = false;
        loginText.classList.remove('hidden');
        loginSpinner.classList.add('hidden');
      } else {
        window.location.href = 'index.html'; 
      }
    });
  }

  // ---------- LOGIKA HALAMAN REGISTER ----------
  const registerForm = document.getElementById('register-form');
  if (registerForm) {
    const registerButton = document.getElementById('register-button');
    const registerText = document.getElementById('register-text');
    const registerSpinner = document.getElementById('register-spinner');
    const alertMessage = document.getElementById('alert-message');
    const successMessage = document.getElementById('success-message');
    const passwordInput = document.getElementById('password'); 
    const confirmPasswordInput = document.getElementById('confirm-password');
    const togglePassword = document.getElementById('toggle-password');
    const toggleConfirmPassword = document.getElementById('toggle-confirm-password');

    const toggleVisibility = (input, icon) => {
      const type = input.getAttribute('type') === 'password' ? 'text' : 'password';
      input.setAttribute('type', type);
      if (type === 'password') {
        icon.classList.remove('fa-eye-slash'); icon.classList.add('fa-eye');
      } else {
        icon.classList.remove('fa-eye'); icon.classList.add('fa-eye-slash');
      }
    };

    if(togglePassword) togglePassword.addEventListener('click', () => toggleVisibility(passwordInput, togglePassword));
    if(toggleConfirmPassword) toggleConfirmPassword.addEventListener('click', () => toggleVisibility(confirmPasswordInput, toggleConfirmPassword));

    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      registerButton.disabled = true;
      registerText.classList.add('hidden');
      registerSpinner.classList.remove('hidden');
      alertMessage.classList.add('hidden');
      successMessage.classList.add('hidden');

      const email = document.getElementById('email').value.trim();
      const password = passwordInput.value;
      const confirmPassword = confirmPasswordInput.value;

      const restoreButton = () => {
          registerButton.disabled = false;
          registerText.classList.remove('hidden');
          registerSpinner.classList.add('hidden');
      };
      
      if (password !== confirmPassword) {
        alertMessage.textContent = 'Daftar Gagal: Password tidak cocok.';
        alertMessage.classList.remove('hidden');
        restoreButton(); return;
      }
      
      // PERBAIKAN: Menggunakan supabaseClient
      const { data, error } = await supabaseClient.auth.signUp({
        email: email, password: password
      });

      if (error) {
        alertMessage.textContent = 'Daftar Gagal: ' + error.message;
        alertMessage.classList.remove('hidden');
        restoreButton(); 
      } else {
        successMessage.textContent = 'Daftar berhasil! Silakan cek email atau hubungi admin.';
        successMessage.classList.remove('hidden');
        registerForm.reset();
        restoreButton();
      }
    });
  }

  // ---------- LOGIKA RESET PASSWORD ----------
  const verifForm = document.getElementById('verif-form');
  if (verifForm) {
    const submitBtn = document.getElementById('submit-button');
    const btnText = document.getElementById('btn-text');
    const btnSpinner = document.getElementById('btn-spinner');
    const alertMessage = document.getElementById('alert-message');

    verifForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      submitBtn.disabled = true;
      btnText.classList.add('hidden');
      btnSpinner.classList.remove('hidden');
      
      try {
        const emailInput = document.getElementById('reset-email');
        const email = emailInput.value.trim();

        // PERBAIKAN: Menggunakan supabaseClient
        const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
            redirectTo: window.location.origin + '/reset-password.html',
        });

        if (error) throw error;

        alertMessage.className = 'p-3 rounded-lg text-sm border bg-green-100 border-green-400 text-green-700';
        alertMessage.innerHTML = `Link reset dikirim ke <b>${email}</b>`;
        alertMessage.classList.remove('hidden');
      } catch (error) {
        alertMessage.className = 'p-3 rounded-lg text-sm border bg-red-100 border-red-400 text-red-700';
        alertMessage.textContent = error.message;
        alertMessage.classList.remove('hidden');
      } finally {
        submitBtn.disabled = false;
        btnText.classList.remove('hidden');
        btnSpinner.classList.add('hidden');
      }
    });
  }
});
