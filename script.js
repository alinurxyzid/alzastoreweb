// =============== [WAJIB DIISI] ===============
const MAIN_ADMIN_ID = 'cbb9f0e0-8155-41fd-8eb7-9aab185c665c';
// ===============================================

// =========================================================
// UTILITY FUNCTIONS (Wajib ada dan diletakkan di bagian atas)
// =========================================================

let laporanPage = 0;
const laporanPerPage = 10;

// Pastikan fungsi formatDate Anda terlihat seperti ini:
function formatDate(timestamp) {
    if (!timestamp) return '-';
    
    const date = new Date(timestamp);
    
    const formatter = new Intl.DateTimeFormat('id-ID', {
        timeZone: 'Asia/Jakarta',
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23'
    });

    const parts = formatter.formatToParts(date).reduce((acc, p) => {
        acc[p.type] = p.value;
        return acc;
    }, {});
    
    return `${parts.day} ${parts.month} ${parts.year}, ${parts.hour}:${parts.minute}`;
}

/**
 * Mengembalikan timestamp dalam format string PostgreSQL (YYYY-MM-DD HH:MM:SS)
 * yang dipaksa ke zona waktu Asia/Jakarta untuk penyimpanan data.
 */
function getWibTimestampString() {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Jakarta',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hourCycle: 'h23'
    });

    const parts = formatter.formatToParts(now).reduce((acc, p) => {
        if (p.type === 'day') acc.day = p.value;
        if (p.type === 'month') acc.month = p.value;
        if (p.type === 'year') acc.year = p.value;
        if (p.type === 'hour') acc.hour = p.value;
        if (p.type === 'minute') acc.minute = p.value;
        if (p.type === 'second') acc.second = p.value;
        return acc;
    }, {});
    
    // Format YYYY-MM-DD HH:MM:SS (WIB)
    return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;
}

/**
 * Memformat angka menjadi mata uang Rupiah.
 */
function formatCurrency(amount) {
    if (amount === null || amount === undefined || isNaN(amount)) return 'Rp 0';
    return new Intl.NumberFormat('id-ID', { 
        style: 'currency', 
        currency: 'IDR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(amount);
}

// =========================================================

// Variabel global
let currentUserId = null;
let globalCurrentUserName = 'Kasir';
let userPermissions = {
    role: '',          
    can_manage_stok: false,
    can_manage_laporan: false,
    can_see_finances: false
};

// Global state
let globalProdukCache = []; 
let globalLaporanCache = []; 
let keranjang = []; 
let lastProcessedCart = []; 
let lastProcessedPembeli = ' '; 

// Chart.js instance
let salesChart = null;

// ---------- DOM Elements (Referensi Awal) ----------
const loadingEl = document.getElementById('loading');
const loadingText = document.getElementById('loading-text');
const navButtons = document.querySelectorAll('.nav-btn');
const stokTable = document.getElementById('stokTable');
const kasirTable = document.getElementById('kasirTable');
const laporanTable = document.getElementById('laporanTable');

// Note: Elemen di bawah ini akan diambil ulang di dalam fungsi agar selalu fresh
const kasirProdukDropdownEl = document.getElementById('kasirProdukDropdown');
const formStok = document.getElementById('formStok');

// Dashboard Elements
const totalProdukEl = document.getElementById('totalProduk');
const totalPenjualanEl = document.getElementById('totalPenjualan');
const totalKeuntunganEl = document.getElementById('totalKeuntungan');
const dashboardRecentEl = document.getElementById('dashboardRecent');
const salesChartCanvas = document.getElementById('salesChart');

// Stok Form Elements
const stokIdEl = document.getElementById('stokId');
const stokNamaEl = document.getElementById('stokNama');
const stokModalEl = document.getElementById('stokModal');
const stokHargaEl = document.getElementById('stokHarga');
const stokDiskonEl = document.getElementById('stokDiskon');
const stokJumlahEl = document.getElementById('stokJumlah');
const stokButtonTextEl = document.getElementById('stokButtonText');
const varianContainer = document.getElementById('varianContainer');
const tambahVarianBtn = document.getElementById('tambahVarianBtn');
const varianInfo = document.getElementById('varianInfo');

// Kasir Form Elements
const kasirQtyEl = document.getElementById('kasirQty');

// Receipt Modal Elements
const receiptModal = document.getElementById('receiptModal');
const receiptDateEl = document.getElementById('receiptDate');
const receiptItemsEl = document.getElementById('receiptItems');
const receiptTotalEl = document.getElementById('receiptTotal');
const receiptKasirNameEl = document.getElementById('receiptKasirName');
const receiptNamaPembeliEl = document.getElementById('receiptNamaPembeli');

// Confirm Modal Elements
const confirmModal = document.getElementById('confirmModal');
const confirmModalYesBtn = document.getElementById('confirmModalYesBtn');
const confirmModalNoBtn = document.getElementById('confirmModalNoBtn');
const closeConfirmBtn = document.getElementById('closeConfirmBtn');

// Keranjang Elements
const keranjangContainer = document.getElementById('keranjangContainer');
const keranjangTable = document.getElementById('keranjangTable');
const keranjangTotal = document.getElementById('keranjangTotal');
const prosesKeranjangBtn = document.getElementById('prosesKeranjangBtn');
const clearKeranjangBtn = document.getElementById('clearKeranjangBtn');

// ---------- SWEETALERT MIXINS ----------
const Toast = Swal.mixin({
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    timer: 3000,
    timerProgressBar: true,
    didOpen: (toast) => {
        toast.addEventListener('mouseenter', Swal.stopTimer)
        toast.addEventListener('mouseleave', Swal.resumeTimer)
    }
});

// ---------- HELPER FUNCTIONS ----------

function showLoading(text = 'Memuat...') {
  if(loadingText) loadingText.textContent = text;
  if(loadingEl) {
      loadingEl.classList.remove('hidden');
      loadingEl.classList.remove('opacity-0');
  }
}

function hideLoading() {
  if(loadingEl) {
      loadingEl.classList.add('opacity-0');
      setTimeout(() => {
        loadingEl.classList.add('hidden');
      }, 300);
  }
}

// Fungsi untuk ganti halaman (Tab Switcher)
function showPage(pageId) {
    // 1. Sembunyikan semua halaman
    document.querySelectorAll('.page, section').forEach(el => {
        if (el.id !== 'loading' && el.id !== 'receiptModal' && !el.id.startsWith('modal')) {
             el.classList.add('hidden');
             el.classList.remove('active', 'animate-fade-in'); 
        }
    });

    // 2. Munculkan halaman target
    const target = document.getElementById(pageId);
    if (target) {
        target.classList.remove('hidden');
        target.classList.add('active', 'animate-fade-in');
    }

    // 3. Update tombol navigasi aktif (Hanya Toggles kelas 'active' dan warna teks inaktif)
    document.querySelectorAll('.nav-btn').forEach(btn => {
        const isActive = (btn.dataset.page === pageId);
        
        // Kelas inaktif (abu-abu gelap) harus tetap dikelola di JS karena tidak ada di CSS .nav-btn.active
        const inactiveClasses = ['text-slate-600', 'dark:text-slate-300'];

        // A. Kelola Kelas 'active' (CSS akan menangani warna Biru dan Putih)
        btn.classList.toggle('active', isActive);

        // B. Kelola Warna Teks Inaktif (Kebalikannya)
        // Jika aktif, hapus warna inaktif. Jika inaktif, tambahkan warna inaktif.
        btn.classList.toggle(inactiveClasses[0], !isActive); // text-slate-600
        btn.classList.toggle(inactiveClasses[1], !isActive); // dark:text-slate-300
        
        // [CLEANUP] Hapus kelas Tailwind background/text yang berlebihan dari versi sebelumnya 
        // agar CSS .active tidak terganggu oleh kelas Tailwind yang tersisa.
        btn.classList.remove('bg-blue-600', 'dark:bg-blue-700', 'text-white', 'bg-slate-100', 'dark:bg-slate-700', 'text-blue-600', 'dark:text-blue-400');
    });

    // ============================================================
    // [PENTING] LOGIKA KHUSUS PER HALAMAN (LOAD DATA OTOMATIS)
    // ============================================================
    
    if (pageId === 'dashboard') {
        loadDashboard();
    } 
    else if (pageId === 'stok') {
        loadStok();
    } 
    else if (pageId === 'laporan') {
        loadLaporan();
    } 
    else if (pageId === 'preorder') {
        loadPreorders();
    }
}

function formatRupiah(number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency', currency: 'IDR',
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(number || 0);
}

function formatTanggal(dateInput) {
    const date = new Date(dateInput);
    return date.toLocaleString('id-ID', {
        timeZone: 'Asia/Jakarta',
        day: 'numeric', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });
}

function escapeHtml(text) {
  if (text == null) return '';
  return String(text)
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

// =========================================================
// INITIALIZATION (GANTI SELURUH BLOK INI)
// =========================================================
document.addEventListener('DOMContentLoaded', async () => {
    // Registrasi Plugin Chart.js (jika ada)
    if (typeof Chart !== 'undefined' && typeof ChartZoom !== 'undefined') {
        Chart.register(ChartZoom);
    }
    
    const mainContent = document.getElementById('main-content');
    
    // -----------------------------------------------------------
    // 1. CEK SESI LOGIN
    // -----------------------------------------------------------
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      window.location.href = 'login.html'; 
      return;
    }
    currentUserId = session.user.id;

    // -----------------------------------------------------------
    // 2. AMBIL DATA PROFIL (PENTING: JANGAN DIHAPUS)
    // -----------------------------------------------------------
    // Inilah bagian yang sebelumnya hilang sehingga menyebabkan error "profile is not defined"
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('role, nama, can_manage_stok, can_manage_laporan, can_see_finances') 
      .eq('id', session.user.id)
      .single();

    // Validasi jika profil gagal diambil atau error koneksi
    if (error || !profile) {
      Swal.fire('Gagal', 'Gagal memverifikasi status profil Anda. Silakan login kembali.', 'error').then(() => {
          supabase.auth.signOut().then(() => window.location.href = 'login.html');
      });
      return;
    }
    
    // Cek apakah akun statusnya pending
    if (profile.role !== 'approved' && profile.role !== 'admin') {
      Swal.fire('Pending', 'Akun Anda masih menunggu persetujuan Admin.', 'warning').then(() => {
          supabase.auth.signOut().then(() => window.location.href = 'login.html');
      });
      return;
    }

    // -----------------------------------------------------------
    // 3. SIMPAN IZIN KE VARIABEL GLOBAL
    // -----------------------------------------------------------
    globalCurrentUserName = profile.nama || 'Kasir';
    
    // Kita mengisi variabel global userPermissions dengan data yang baru saja diambil
    userPermissions = {
        role: profile.role, // Simpan role (admin/approved)
        can_manage_stok: profile.can_manage_stok,
        can_manage_laporan: profile.can_manage_laporan, // Izin Hapus Laporan
        can_see_finances: profile.can_see_finances
    };
    
    // Tampilkan Konten Utama setelah data siap
    mainContent.classList.remove('hidden');

    // Sembunyikan Menu Admin jika bukan Admin Utama
    if (currentUserId !== MAIN_ADMIN_ID) {
        const adminNavButton = document.querySelector('.nav-btn[data-page="admin"]');
        if (adminNavButton) adminNavButton.classList.add('hidden');
        const adminPageSection = document.getElementById('admin');
        if(adminPageSection) adminPageSection.classList.add('hidden');
    }

    // Terapkan UI berdasarkan izin (sembunyikan tombol stok/keuntungan jika tidak ada izin)
    applyUiPermissions();

    // -----------------------------------------------------------
    // 4. SETUP AUTO LOGOUT (INACTIVITY TIMER)
    // -----------------------------------------------------------
    let inactivityTimer; 
    const INACTIVITY_TIMEOUT = 1200000; // 20 Menit

    async function forceLogout() {
          console.log("Timeout: Logout paksa.");
          // Hapus semua listener agar tidak menumpuk
          window.removeEventListener('mousemove', resetInactivityTimer);
          window.removeEventListener('mousedown', resetInactivityTimer);
          window.removeEventListener('keypress', resetInactivityTimer);
          window.removeEventListener('scroll', resetInactivityTimer);
          window.removeEventListener('touchstart', resetInactivityTimer);

          await Swal.fire({
              icon: 'warning',
              title: 'Sesi Habis',
              text: 'Silakan login kembali',
              confirmButtonText: 'OK',
              confirmButtonColor: '#2563eb',
              allowOutsideClick: false
          });
          await supabase.auth.signOut();
          window.location.href = 'login.html';
    }

    function resetInactivityTimer() {
          clearTimeout(inactivityTimer);
          inactivityTimer = setTimeout(forceLogout, INACTIVITY_TIMEOUT);
    }

    // Mulai Timer
    resetInactivityTimer();
    window.addEventListener('mousemove', resetInactivityTimer);
    window.addEventListener('mousedown', resetInactivityTimer);
    window.addEventListener('keypress', resetInactivityTimer);
    window.addEventListener('scroll', resetInactivityTimer);
    window.addEventListener('touchstart', resetInactivityTimer);

    // -----------------------------------------------------------
    // 5. LOAD DATA AWAL APLIKASI
    // -----------------------------------------------------------
    showLoading('Menghubungkan ke database...');
    try {
        await refreshAllData();
        showPage('dashboard');
        const footerEl = document.getElementById('main-footer');
        if (footerEl) footerEl.classList.remove('hidden');
    } catch (err) {
        console.error('Init error:', err);
        Swal.fire('Error Init', err.message, 'error');
    } finally {
        hideLoading();
    }

    // -----------------------------------------------------------
    // 6. SETUP EVENT LISTENERS (TOMBOL & FORM)
    // -----------------------------------------------------------

    const safeBind = (id, event, func) => {
        const el = document.getElementById(id);
        if (el) el.addEventListener(event, func);
    };

    // Navigasi Menu
    navButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            showPage(btn.dataset.page);
            if(btn.dataset.page === 'dashboard') loadDashboard();
            if(btn.dataset.page === 'admin') loadAdminUsers();
        });
    });

    // Form Listener STOK
    safeBind('formStok', 'submit', handleStokSubmit);

    // Form Listener KASIR (Clone untuk Reset Event Lama)
    const oldFormKasir = document.getElementById('formKasir');
    if (oldFormKasir) {
        const newFormKasir = oldFormKasir.cloneNode(true);
        oldFormKasir.parentNode.replaceChild(newFormKasir, oldFormKasir);
    }
    
    // Re-bind Event Kasir Baru
    const freshFormKasir = document.getElementById('formKasir');
    if (freshFormKasir) {
        const btnTambah = freshFormKasir.querySelector('button'); 
        const inputQty = document.getElementById('kasirQty');

        // Klik Tombol Tambah
        if(btnTambah) {
            btnTambah.type = 'button'; 
            btnTambah.addEventListener('click', (e) => {
                e.preventDefault(); 
                handleAddToCart(e);
            });
        }

        // Tekan Enter di Qty
        if(inputQty) {
            inputQty.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault(); 
                    handleAddToCart(e); 
                }
            });
        }

        // Tombol Clear Form
        const btnClearKasir = document.getElementById('kasirClear'); 
        if(btnClearKasir) {
            btnClearKasir.type = 'button';
            btnClearKasir.addEventListener('click', () => {
                freshFormKasir.reset();
                const searchEl = document.getElementById('kasirProdukSearch');
                const idEl = document.getElementById('kasirSelectedProdukId');
                const qtyEl = document.getElementById('kasirQty');
                
                if(searchEl) searchEl.value = '';
                if(idEl) idEl.value = '';
                if(qtyEl) qtyEl.value = 1;
            });
        }

        // Live Search Produk
        const freshSearchEl = document.getElementById('kasirProdukSearch');
        if (freshSearchEl) {
            freshSearchEl.addEventListener('input', handleProdukSearch);
            freshSearchEl.addEventListener('focus', handleProdukSearch);
            freshSearchEl.addEventListener('blur', () => {
                setTimeout(hideProdukDropdown, 200); 
            });
        }

        // Input Nama Pembeli
        const kasirNamaInput = document.getElementById('kasirNamaPembeli');
        if (kasirNamaInput) {
            kasirNamaInput.addEventListener('input', updateKeranjangPembeliDisplay);
        }
    }

    // Binding Tombol Lainnya
    safeBind('exportExcelBtn', 'click', exportToExcel);
    safeBind('laporanFilterBtn', 'click', () => loadLaporan(false)); // Fix bind filter
    safeBind('closeModalBtn', 'click', () => closeReceiptModal(true));
    safeBind('printReceiptBtn', 'click', printReceipt);
    safeBind('exportJpgBtn', 'click', exportReceiptAsJpg);

    safeBind('confirmModalYesBtn', 'click', handleConfirmYes);
    safeBind('confirmModalNoBtn', 'click', handleConfirmNo);
    safeBind('closeConfirmBtn', 'click', handleConfirmNo);

    safeBind('prosesKeranjangBtn', 'click', handleProsesKeranjang);
    safeBind('clearKeranjangBtn', 'click', handleClearKeranjang);

    safeBind('tambahVarianBtn', 'click', tambahVarianInput);
    
    // Logout Logic
    safeBind('logout-button', 'click', () => {
        const modal = document.getElementById('logoutConfirmModal');
        if(modal) modal.classList.remove('hidden');
    });
    safeBind('logoutModalYesBtn', 'click', async () => {
        const modal = document.getElementById('logoutConfirmModal');
        if(modal) modal.classList.add('hidden');
        showLoading('Anda sedang logout...');
        const { error } = await supabase.auth.signOut();
        if (error) { alert('Gagal logout: ' + error.message); hideLoading(); } 
        else { window.location.href = 'login.html'; }
    });
    safeBind('logoutModalNoBtn', 'click', () => {
        const modal = document.getElementById('logoutConfirmModal');
        if(modal) modal.classList.add('hidden');
    });

    // Set Default Tanggal Laporan (Hari Ini)
    const today = new Date().toISOString().split('T')[0];
    const tglMulai = document.getElementById('laporanTglMulai');
    const tglSelesai = document.getElementById('laporanTglSelesai');

    if(tglMulai) tglMulai.value = today;
    if(tglSelesai) tglSelesai.value = today;
});

// ---------- MAIN FUNCTIONS ----------

async function refreshAllData() {
    showLoading('Memperbarui data...');
    try {
        await loadStok(); 
        await Promise.all([
          loadKasirHistory(),
          loadLaporan(),
          loadDashboard()
        ]);
    } catch (err) {
        console.error('refreshAllData error', err);
        Swal.fire('Gagal Load Data', err.message, 'error');
    } finally {
        hideLoading();
    }
}

function applyUiPermissions() {
    if (!userPermissions.can_manage_stok) {
        if (formStok) formStok.classList.add('hidden');
    }
    const isNotMainAdmin = currentUserId !== MAIN_ADMIN_ID;
    if (!userPermissions.can_see_finances && isNotMainAdmin) {
        if (totalKeuntunganEl) totalKeuntunganEl.closest('.bg-white').classList.add('hidden');
        if (stokModalEl) stokModalEl.classList.add('hidden');
    }
}

// === DASHBOARD & CHART ===

async function loadDashboard() {
    try {
        const { data: produk, error: prodErr } = await supabase.from('produk').select('id');
        if (prodErr) throw prodErr;

        const { data: transaksi, error: transErr } = await supabase.from('transaksi').select('total, keuntungan, created_at, produk_id, qty');
        if (transErr) throw transErr;
        
        const totalProduk = produk ? produk.length : 0;
        const totalPenjualan = transaksi ? transaksi.reduce((s, t) => s + Number(t.total || 0), 0) : 0;
        const totalKeuntungan = transaksi ? transaksi.reduce((s, t) => s + Number(t.keuntungan || 0), 0) : 0;

        totalProdukEl.textContent = totalProduk;
        totalPenjualanEl.textContent = formatRupiah(totalPenjualan);
        totalKeuntunganEl.textContent = formatRupiah(totalKeuntungan);

        const sorted = [...transaksi].sort((a,b)=> new Date(b.created_at) - new Date(a.created_at)).slice(0, 5);
        const prodMap = globalProdukCache.reduce((m,p)=> (m[p.id]=p.nama, m), {});
        
        if(sorted.length === 0) {
            dashboardRecentEl.innerHTML = `<p class="text-sm text-slate-500 dark:text-slate-400 text-center">Belum ada transaksi.</p>`;
        } else {
            dashboardRecentEl.innerHTML = sorted.map(t => {
                const name = prodMap[t.produk_id] || 'Produk Dihapus';
                const total = Number(t.total || 0);
                return `
                  <div class="flex items-center gap-3">
                      <div class="p-2 bg-slate-100 dark:bg-slate-700 rounded-full">
                          <i class="fa-solid fa-receipt text-slate-500 dark:text-slate-400"></i>
                      </div>
                      <div>
                          <p class="font-medium text-sm">${escapeHtml(name)} (${t.qty} pcs)</p>
                          <p class="font-bold text-base text-green-600 dark:text-green-400">${formatRupiah(total)}</p>
                      </div>
                      <span class="text-xs text-slate-400 ml-auto">${formatTanggal(t.created_at)}</span>
                  </div>
                `;
            }).join('');
        }
        updateSalesChart(transaksi || []);
    } catch (err) {
        console.error('loadDashboard error', err);
        dashboardRecentEl.innerHTML = `<p class="text-sm text-red-500">Gagal memuat data.</p>`;
    }
}

function updateSalesChart(transaksi) {
    const labels = [];
    const dataSales = [];
    const today = new Date();
    const salesByDay = {};

    for (let i = 29; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const label = d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
        labels.push(label);
        salesByDay[label] = 0;
    }

    transaksi.forEach(t => {
        const tDate = new Date(t.created_at);
        const diffTime = Math.abs(today.getTime() - tDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays <= 30) {
            const label = tDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
            if (salesByDay.hasOwnProperty(label)) {
                salesByDay[label] += Number(t.total || 0);
            }
        }
    });

    labels.forEach(label => dataSales.push(salesByDay[label]));
    
    if (salesChart) salesChart.destroy();
    
    const isDark = document.documentElement.classList.contains('dark');
    const gridColor = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
    const labelColor = isDark ? '#cbd5e1' : '#475569'; 

    salesChart = new Chart(salesChartCanvas, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Penjualan',
                data: dataSales,
                fill: true,
                backgroundColor: 'rgba(59, 130, 246, 0.2)',
                borderColor: 'rgba(59, 130, 246, 1)',
                tension: 0.3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { ticks: { color: labelColor, callback: (v)=> `Rp ${v/1000}k` }, grid: { color: gridColor } },
                x: { ticks: { color: labelColor }, grid: { display: false }, min: 23, max: 29 }
            },
            plugins: {
                legend: { display: false },
                zoom: { pan: { enabled: true, mode: 'x', threshold: 10 }, zoom: { mode: 'x', wheel: { enabled: true }, pinch: { enabled: true } } }
            }
        }
    });
}

// === ADMIN MANAGEMENT ===

async function loadAdminUsers() {
    const adminTable = document.getElementById('adminUsersTable');
    if (!adminTable) return;

    if (currentUserId !== MAIN_ADMIN_ID) {
        adminTable.innerHTML = `<tr><td colspan="5" class="p-3 text-center text-red-500">Akses ditolak.</td></tr>`;
        return;
    }

    showLoading('Memuat daftar user...');
    try {
        const { data, error } = await supabase
            .from('profiles')
            .select('id, email, role, nama, can_manage_stok, can_manage_laporan, can_see_finances')
            .order('email', { ascending: true });

        if (error) throw error;

        adminTable.innerHTML = data.map(profile => {
            const isPending = profile.role === 'pending';
            const isMainAdminRow = profile.id === MAIN_ADMIN_ID;
            const isPermissionDisabled = isPending || isMainAdminRow; 

            const checkboxClass = "w-4 h-4 text-blue-600 rounded focus:ring-blue-500 cursor-pointer";
            const labelClass = "ml-2 text-sm font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap cursor-pointer";

            const stokCheck = `<div class="flex items-center py-1"><input id="stok_${profile.id}" type="checkbox" ${profile.can_manage_stok ? 'checked' : ''} ${isPermissionDisabled ? 'disabled' : ''} class="${checkboxClass}"><label for="stok_${profile.id}" class="${labelClass}">Kelola Stok</label></div>`;
            const laporanCheck = `<div class="flex items-center py-1"><input id="laporan_${profile.id}" type="checkbox" ${profile.can_manage_laporan ? 'checked' : ''} ${isPermissionDisabled ? 'disabled' : ''} class="${checkboxClass}"><label for="laporan_${profile.id}" class="${labelClass}">Hapus Laporan</label></div>`;
            const financeCheck = `<div class="flex items-center py-1"><input id="finance_${profile.id}" type="checkbox" ${profile.can_see_finances ? 'checked' : ''} ${isPermissionDisabled ? 'disabled' : ''} class="${checkboxClass}"><label for="finance_${profile.id}" class="${labelClass}">Lihat Modal/Keuntungan</label></div>`;

            const saveBtn = `<button title="Simpan Perubahan" class="bg-blue-600 text-white px-3 py-2 rounded text-xs hover:bg-blue-700 shadow-sm" onclick="updateUserProfile('${profile.id}')"><i class="fa-solid fa-floppy-disk"></i></button>`;
            
            let actionButton;
            if (isPending) {
                actionButton = `<div class="flex gap-2 items-center">${saveBtn}<button class="bg-green-600 text-white px-3 py-2 rounded text-xs hover:bg-green-700 shadow-sm" title="Setujui User" onclick="approveUser('${profile.id}')"><i class="fa-solid fa-check"></i></button><button class="bg-red-600 text-white px-3 py-2 rounded text-xs hover:bg-red-700 shadow-sm" title="Tolak/Hapus" onclick="deleteUser('${profile.id}', '${escapeHtml(profile.email)}')"><i class="fa-solid fa-times"></i></button></div>`;
            } else if (isMainAdminRow) {
                actionButton = `<div class="flex gap-2 items-center">${saveBtn}<span class="text-xs text-blue-500 italic font-semibold ml-1">(Admin Utama)</span></div>`;
            } else {
                actionButton = `<div class="flex gap-2 items-center">${saveBtn}<button class="bg-red-600 text-white px-3 py-2 rounded text-xs hover:bg-red-700 shadow-sm" title="Hapus User" onclick="deleteUser('${profile.id}', '${escapeHtml(profile.email)}')"><i class="fa-solid fa-trash"></i></button></div>`;
            }

            const statusHtml = isPending 
                ? `<span class="text-xs font-bold px-3 py-1 rounded-full bg-yellow-100 text-yellow-700 border border-yellow-200">${profile.role.toUpperCase()}</span>` 
                : `<span class="text-xs font-bold px-3 py-1 rounded-full bg-green-100 text-green-700 border border-green-200">${profile.role.toUpperCase()}</span>`;

            return `
                <tr class="hover:bg-slate-50 dark:hover:bg-slate-700/50 border-b dark:border-slate-700 align-top">
                    <td class="p-4" data-label="User">
                        <p class="font-medium text-sm text-slate-800 dark:text-slate-200 break-all">${escapeHtml(profile.email)}</p>
                        <p class="text-[10px] text-slate-400 font-mono mt-1 select-all">${profile.id}</p>
                    </td>
                    <td class="p-4" data-label="Nama Kasir">
                        <input type="text" id="nama_${profile.id}" value="${escapeHtml(profile.nama || '')}" class="w-full border p-2 rounded text-sm bg-white dark:bg-slate-800 dark:border-slate-600 focus:ring-2 focus:ring-blue-500" placeholder="Nama...">
                    </td>
                    <td class="p-4" data-label="Status">${statusHtml}</td>
                    <td class="p-4" data-label="Izin">
                        <div class="flex flex-col gap-1">
                            ${stokCheck}${laporanCheck}${financeCheck}
                        </div>
                    </td>
                    <td class="p-4" data-label="Aksi">${actionButton}</td>
                </tr>`;
        }).join('');
    } catch (err) {
        adminTable.innerHTML = `<tr><td colspan="5" class="p-3 text-center text-red-500">Error: ${err.message}</td></tr>`;
    } finally {
        hideLoading();
    }
}

window.approveUser = async function(userId) {
    const result = await Swal.fire({
        title: 'Setujui User?',
        text: "User akan dapat mengakses sistem.",
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#16a34a',
        cancelButtonColor: '#64748b',
        confirmButtonText: 'Ya, Setujui'
    });

    if (!result.isConfirmed) return;

    showLoading('Menyetujui...');
    try {
        const { error } = await supabase.from('profiles').update({ role: 'approved' }).eq('id', userId);
        if (error) throw error;
        
        Toast.fire({ icon: 'success', title: 'User berhasil disetujui' });
        await loadAdminUsers();
    } catch (err) { Swal.fire('Gagal', err.message, 'error'); } finally { hideLoading(); }
}

window.updateUserProfile = async function(profileId) {
    const namaBaru = document.getElementById(`nama_${profileId}`).value.trim();
    if(!namaBaru) return Swal.fire('Validasi', 'Nama tidak boleh kosong', 'warning');

    showLoading('Menyimpan...');
    try {
        let dataToUpdate = { nama: namaBaru };
        
        const stokEl = document.getElementById(`stok_${profileId}`);
        const laporanEl = document.getElementById(`laporan_${profileId}`);
        const financeEl = document.getElementById(`finance_${profileId}`);
        
        if (stokEl && !stokEl.disabled) dataToUpdate.can_manage_stok = stokEl.checked;
        if (laporanEl && !laporanEl.disabled) dataToUpdate.can_manage_laporan = laporanEl.checked;
        if (financeEl && !financeEl.disabled) dataToUpdate.can_see_finances = financeEl.checked;

        const { error } = await supabase.from('profiles').update(dataToUpdate).eq('id', profileId);
        if (error) throw error;
        
        Toast.fire({ icon: 'success', title: 'Profil diperbarui!' });
        
        if(profileId === currentUserId) globalCurrentUserName = namaBaru;
    } catch (err) { Swal.fire('Gagal', err.message, 'error'); await loadAdminUsers(); } finally { hideLoading(); }
}

window.deleteUser = async function(userId, email) {
    const result = await Swal.fire({
        title: 'Hapus User?',
        text: `Yakin ingin menghapus '${email}'? Tindakan ini PERMANEN.`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#dc2626',
        cancelButtonColor: '#64748b',
        confirmButtonText: 'Ya, Hapus!'
    });

    if (!result.isConfirmed) return;

    showLoading('Menghapus...');
    try {
        const { error } = await supabase.rpc('delete_user_by_id', { user_id_to_delete: userId });
        if (error) throw error;
        
        Swal.fire('Terhapus!', 'User telah dihapus.', 'success');
        await loadAdminUsers();
    } catch (err) { Swal.fire('Gagal', err.message, 'error'); } finally { hideLoading(); }
}

// === STOK MANAGEMENT ===

async function loadStok() {
    try {
        const { data, error } = await supabase.from('produk').select('*').order('id', { ascending: false });
        if (error) throw error;
        globalProdukCache = data || [];
        
        stokTable.innerHTML = globalProdukCache.map(p => {
            const canSee = userPermissions.can_see_finances;
            const modalHtml = canSee ? formatRupiah(p.modal) : '-';
            const canManage = userPermissions.can_manage_stok;
            const disabled = canManage ? '' : 'disabled';
            const btnClass = canManage ? 'hover:scale-105' : 'opacity-50 cursor-not-allowed';

            const diskonVal = p.diskon_persen || 0;
            const diskonHtml = diskonVal > 0 
                ? `<span class="inline-block bg-red-100 text-red-600 text-xs font-bold px-2 py-1 rounded-full border border-red-200">-${diskonVal}%</span>`
                : `<span class="text-slate-400">-</span>`;

            return `
              <tr class="${p.stok === 0 ? 'bg-red-100 dark:bg-red-900/30' : ''} hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                <td class="p-3 text-sm">${p.id}</td>
                <td class="p-3 font-medium">${escapeHtml(p.nama)}</td>
                <td class="p-3 text-slate-600 dark:text-slate-400">${modalHtml}</td>
                <td class="p-3 text-green-600 font-semibold">${formatRupiah(p.harga_jual)}</td>
                
                <td class="p-3 text-center align-middle">
                    ${diskonHtml}
                </td>

                <td class="p-3 text-center ${p.stok < 3 ? 'text-red-500 font-bold' : ''}">${p.stok}</td>
                
                <td class="p-3 text-center">
                   <div class="flex justify-center gap-2">
                      <button class="bg-yellow-500 text-white px-2 py-1 rounded text-xs ${btnClass}" onclick="prepareEdit(${p.id})" ${disabled}>
                          <i class="fa-solid fa-pencil"></i>
                      </button>
                      <button class="bg-red-600 text-white px-2 py-1 rounded text-xs ${btnClass}" onclick="hapusProduk(${p.id})" ${disabled}>
                          <i class="fa-solid fa-trash"></i>
                      </button>
                   </div>
                </td>
              </tr>`;
        }).join('');
        
        // UPDATE PENCARIAN KASIR
        populateKasirProducts(globalProdukCache); 
    } catch (err) {
        console.error(err);
        stokTable.innerHTML = `<tr><td colspan="7" class="p-3 text-center text-red-500">Gagal memuat stok.</td></tr>`;
    }
}

async function handleStokSubmit(ev) {
    ev.preventDefault();
    const id = stokIdEl.value;
    const nama = stokNamaEl.value.trim();
    const modal = Number(stokModalEl.value) || 0;
    const harga_jual = Number(stokHargaEl.value) || 0;
    const diskon_persen = Number(stokDiskonEl.value) || 0; 
    const stok = parseInt(stokJumlahEl.value) || 0;
    
    const varianRows = document.querySelectorAll('.varian-row');
    const varianList = Array.from(varianRows).map(row => ({
        varianNama: row.querySelector('.varian-nama').value.trim(),
        varianStok: parseInt(row.querySelector('.varian-stok').value) || 0
    })).filter(v => v.varianNama);

    if (!nama) return Swal.fire('Validasi', 'Nama produk wajib diisi', 'warning');
    if ([modal, harga_jual, stok, diskon_persen].some(v => v < 0)) return Swal.fire('Validasi', 'Angka tidak boleh negatif', 'warning');

    showLoading('Menyimpan...');
    try {
        if (id) {
            const { error } = await supabase.from('produk')
                .update({ nama, modal, harga_jual, stok, diskon_persen }) 
                .eq('id', id);
            if (error) throw error;
        } else {
            let productsToInsert = [];
            if (varianList.length > 0) {
                productsToInsert = varianList.map(v => ({
                    nama: `${nama} - ${v.varianNama}`, modal, harga_jual, stok: v.varianStok, diskon_persen
                }));
            } else {
                productsToInsert.push({ nama, modal, harga_jual, stok, diskon_persen });
            }
            const { error } = await supabase.from('produk').insert(productsToInsert);
            if (error) throw error;
        }
        
        formStok.reset();
        stokIdEl.value = '';
        stokButtonTextEl.textContent = 'Simpan Produk Baru';
        varianContainer.innerHTML = '';
        varianInfo.classList.remove('hidden');
        tambahVarianBtn.disabled = false;
        
        await refreshAllData();
        showPage('stok');
        Toast.fire({ icon: 'success', title: 'Produk berhasil disimpan' });

    } catch (err) { Swal.fire('Gagal', err.message, 'error'); hideLoading(); }
}

function tambahVarianInput() {
    varianInfo.classList.add('hidden');
    const div = document.createElement('div');
    div.className = 'varian-row grid grid-cols-3 gap-2';
    div.innerHTML = `
        <input type="text" class="varian-nama col-span-2 border p-2 rounded bg-white dark:bg-slate-800 dark:border-slate-600" placeholder="Nama Varian">
        <div class="col-span-1 flex gap-2 items-center">
            <input type="number" class="varian-stok w-full border p-2 rounded bg-white dark:bg-slate-800 dark:border-slate-600" placeholder="Stok">
            <button type="button" class="bg-red-500 text-white w-6 h-6 rounded-full flex-shrink-0" onclick="this.closest('.varian-row').remove(); if(varianContainer.children.length===0) varianInfo.classList.remove('hidden');"><i class="fa-solid fa-times"></i></button>
        </div>`;
    varianContainer.appendChild(div);
}

window.prepareEdit = async function(id) {
    let data = globalProdukCache.find(p => p.id === id);
    if (!data) return Swal.fire('Error', 'Data tidak ditemukan di cache.', 'error');
    
    stokIdEl.value = data.id;
    stokNamaEl.value = data.nama;
    stokModalEl.value = data.modal;
    stokHargaEl.value = data.harga_jual;
    stokDiskonEl.value = data.diskon_persen || 0; 
    stokJumlahEl.value = data.stok;
    stokButtonTextEl.textContent = `Update (ID: ${data.id})`;
    
    tambahVarianBtn.disabled = true;
    varianContainer.innerHTML = '';
    varianInfo.textContent = 'Mode edit hanya untuk 1 produk.';
    varianInfo.classList.remove('hidden');
    showPage('stok');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

window.hapusProduk = async function(id) {
    const result = await Swal.fire({
        title: 'Hapus Produk?',
        text: "Data yang dihapus tidak bisa dikembalikan.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#dc2626',
        cancelButtonColor: '#64748b',
        confirmButtonText: 'Ya, Hapus!'
    });

    if (!result.isConfirmed) return;

    showLoading('Menghapus...');
    try {
        const { error } = await supabase.from('produk').delete().eq('id', id);
        if (error) throw error;
        await refreshAllData();
        Toast.fire({ icon: 'success', title: 'Produk dihapus' });
    } catch (err) { 
        Swal.fire('Gagal', 'Mungkin ada transaksi terkait produk ini.', 'error'); 
    } finally { hideLoading(); }
}

// === KASIR LOGIC ===

function populateKasirProducts(produkList) {
    // Search handled by handleProdukSearch
}

function handleProdukSearch(e) {
    const term = (e.target.value || '').toLowerCase();
    const filtered = globalProdukCache.filter(p => p.nama.toLowerCase().includes(term));
    renderProdukDropdown(filtered.slice(0, 100));
}

function renderProdukDropdown(list) {
    // AMBIL ELEMEN LANGSUNG (Agar aman jika form di-refresh)
    const dropdownEl = document.getElementById('kasirProdukDropdown');
    
    if (list.length === 0) {
        dropdownEl.innerHTML = `<div class="px-4 py-2 text-sm text-slate-500 dark:text-slate-400">Produk tidak ditemukan.</div>`;
        dropdownEl.classList.remove('hidden');
        return;
    }
    const html = list.map(p => {
        const isHabis = p.stok === 0;

        // PERUBAHAN DI SINI:
        // Light Mode: hover:bg-blue-100
        // Dark Mode: dark:hover:bg-blue-600 dark:hover:text-white
        const style = isHabis 
            ? 'bg-gray-200 dark:bg-slate-700 opacity-60 cursor-not-allowed' 
            : 'hover:bg-blue-100 dark:hover:bg-blue-600 dark:hover:text-white cursor-pointer transition-colors';
        
        const diskon = p.diskon_persen || 0;
        let hargaTampil = formatRupiah(p.harga_jual);
        
        if (diskon > 0) {
            const hargaDiskon = p.harga_jual - (p.harga_jual * diskon / 100);
            hargaTampil = `<span class="line-through text-xs text-red-400 mr-1">${formatRupiah(p.harga_jual)}</span> 
                           <span class="font-bold">${formatRupiah(hargaDiskon)}</span> 
                           <span class="text-[10px] bg-red-100 text-red-600 px-1 rounded ml-1">-${diskon}%</span>`;
        }

        const click = isHabis ? '' : `onmousedown="selectProduk(${p.id}, '${escapeHtml(p.nama)}', ${p.harga_jual}, ${diskon})"`;
        
        return `
            <div class="px-4 py-2 border-b border-slate-100 dark:border-slate-700 ${style}" ${click}>
                <p class="font-medium">${escapeHtml(p.nama)} ${isHabis ? '(Habis)' : ''}</p>
                <p class="text-sm text-green-600 dark:text-green-400">Stok: ${p.stok} | ${hargaTampil}</p>
            </div>`;
    }).join('');
    dropdownEl.innerHTML = html;
    dropdownEl.classList.remove('hidden');
}

window.selectProduk = function(id, nama, harga, diskon = 0) {
    const hargaDiskon = harga - (harga * diskon / 100);
    const teksHarga = diskon > 0 ? `${formatRupiah(hargaDiskon)} (Disc ${diskon}%)` : formatRupiah(harga);
    
    // PERBAIKAN: Ambil elemen langsung
    const searchInput = document.getElementById('kasirProdukSearch');
    const idInput = document.getElementById('kasirSelectedProdukId');
    const qtyInput = document.getElementById('kasirQty');
    const dropdownEl = document.getElementById('kasirProdukDropdown');

    if(searchInput) searchInput.value = `${nama} - ${teksHarga}`;
    if(idInput) idInput.value = id;
    
    if(dropdownEl) {
        dropdownEl.classList.add('hidden');
        dropdownEl.innerHTML = '';
    }
    
    if(qtyInput) {
        qtyInput.focus();
        qtyInput.select();
    }
}

function hideProdukDropdown() {
    // Pakai getElementById agar selalu dapat elemen aktif
    const el = document.getElementById('kasirProdukDropdown');
    if(el) {
        el.classList.add('hidden');
        el.innerHTML = '';
    }
}

// --- Update Load History agar Struk Lama Aman ---
async function loadKasirHistory() {
    try {
        const { data, error } = await supabase
            .from('transaksi')
            .select('id, produk_id, qty, total, created_at, keuntungan, nota_id, nama_pembeli, diskon_persen, harga_jual_history, produk:produk_id(nama, harga_jual)')
            .order('created_at', { ascending: false })
            .limit(100);

        if (error) throw error;

        // Grouping Data
        const grouped = (data || []).reduce((acc, t) => {
            const nid = t.nota_id || t.created_at; // Fallback jika nota_id kosong (data jadul)
            if (!acc[nid]) {
                acc[nid] = {
                    nota_id: nid, // Pastikan ID ini terbawa
                    items: [],
                    total: 0,
                    qty: 0,
                    created_at: t.created_at,
                    nama_pembeli: t.nama_pembeli
                };
            }
            acc[nid].items.push(t);
            acc[nid].total += Number(t.total || 0);
            acc[nid].qty += Number(t.qty || 0);
            return acc;
        }, {});

        const sorted = Object.values(grouped).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        const tableBody = document.getElementById('kasirTable');
        if(!tableBody) return;

        tableBody.innerHTML = sorted.slice(0, 20).map(n => {
            const names = n.items.map(i => {
                const namaProduk = i.produk?.nama || 'Produk Dihapus';
                return `<span class="block text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap">• ${escapeHtml(namaProduk)} (${i.qty}x)</span>`;
            }).join('');

            // Data untuk Reprint Struk
            const reprintData = n.items.map(t => ({
                nama: t.produk?.nama || 'Produk Dihapus',
                qty: t.qty,
                total: t.total, 
                harga_satuan: (Number(t.total) / Number(t.qty)), // Hitung balik harga satuan
                diskon_persen: t.diskon_persen || 0,
                harga_asli: t.harga_jual_history
            }));

            // [KUNCI PERBAIKAN]
            const jsonItems = JSON.stringify(reprintData).replace(/"/g, '&quot;');
            const buyerSafe = escapeHtml(n.nama_pembeli || ' ');
            const notaSafe = n.nota_id || ''; 

            return `
             <tr class="hover:bg-slate-50 dark:hover:bg-slate-700/50 border-b dark:border-slate-700 align-top transition-colors duration-150">
                <td class="p-3 align-middle">${names}</td>
                <td class="p-3 align-middle"><span class="font-medium">${buyerSafe}</span></td>
                <td class="p-3 align-middle text-center">${n.qty}</td>
                <td class="p-3 align-middle font-semibold text-slate-700 dark:text-slate-200">${formatRupiah(n.total)}</td>
                <td class="p-3 align-middle text-xs text-slate-500 whitespace-nowrap">${formatTanggal(n.created_at)}</td>
                <td class="p-3 align-middle text-center">
                   <button class="bg-sky-500 text-white px-3 py-1.5 rounded-md text-xs font-medium hover:bg-sky-600 transition-all shadow-sm flex items-center justify-center gap-1 mx-auto"
                           title="Cetak Ulang Struk"
                           onclick='reprintReceipt(${jsonItems}, "${n.created_at}", "${buyerSafe}", "${notaSafe}")'>
                     <i class="fa-solid fa-print"></i> Struk
                   </button>
                </td>
             </tr>`;
        }).join('');

    } catch (err) {
        console.error('loadKasirHistory error:', err);
    }
}

// Fungsi Wrapper Reprint (Menjembatani tombol history ke modal struk)
window.reprintReceipt = function(items, date, buyer, notaId) {
    showReceiptModal(items, date, buyer, null); 
    
    // Jika Nota ID (dari DB) ada, paksa tampil di struk lama (walaupun struk biasa)
   const labelNota = document.getElementById('labelNota');
    const valueNota = document.getElementById('receiptNota');
    
    if(notaId && notaId.startsWith('PO-')) {
        if(labelNota) labelNota.classList.remove('hidden');
        if(valueNota) {
            valueNota.classList.remove('hidden');
            valueNota.textContent = notaId;
        }
    } else {
        // Jika bukan PO (misal ID random UUID), pastikan tetap tersembunyi
        if(labelNota) labelNota.classList.add('hidden');
        if(valueNota) {
            valueNota.classList.add('hidden');
            valueNota.textContent = '';
        }
    }
}

function handleAddToCart(ev) {
    // Pastikan event berhenti di sini
    if (ev) {
        ev.preventDefault();
        ev.stopImmediatePropagation();
    }

    // Ambil elemen segar dari DOM
    const idEl = document.getElementById('kasirSelectedProdukId');
    const qtyEl = document.getElementById('kasirQty');
    const searchEl = document.getElementById('kasirProdukSearch');
    
    // Konversi nilai
    const pid = Number(idEl.value);
    const qtyInput = parseInt(qtyEl.value);
    const qty = isNaN(qtyInput) ? 0 : qtyInput; 
    
    // Validasi
    if(!pid) return Swal.fire('Info', 'Pilih produk terlebih dahulu.', 'info');
    if(qty <= 0) return Swal.fire('Info', 'Jumlah harus lebih dari 0.', 'warning');
    
    const prod = globalProdukCache.find(p => p.id === pid);
    if(!prod) return Swal.fire('Error', 'Produk tidak ditemukan (Mungkin terhapus).', 'error');
    
    // Cek Stok Lokal (Apa yang sudah ada di keranjang + yang mau ditambah)
    const idx = keranjang.findIndex(i => i.produk_id === pid);
    const currentQtyInCart = idx > -1 ? keranjang[idx].qty : 0;
    const totalPermintaan = currentQtyInCart + qty;
    
    if(prod.stok < totalPermintaan) {
        return Swal.fire({
            icon: 'warning',
            title: 'Stok Kurang',
            text: `Sisa Stok: ${prod.stok}. (Di keranjang: ${currentQtyInCart}, Ditambah: ${qty})`
        });
    }
    
    // Logika Diskon & Harga
    const diskon = Number(prod.diskon_persen || 0);
    const hargaFinal = Number(prod.harga_jual) - (Number(prod.harga_jual) * diskon / 100);

    // Masukkan ke Keranjang
    if(idx > -1) {
        keranjang[idx].qty += qty;
    } else {
        keranjang.push({ 
            produk_id: pid, 
            nama: prod.nama, 
            harga_jual: hargaFinal, 
            harga_asli: Number(prod.harga_jual), 
            diskon_persen: diskon, 
            modal: Number(prod.modal), 
            qty: qty 
        });
    }
    
    // Reset Form (Hanya bagian produk)
    searchEl.value = '';
    idEl.value = '';
    qtyEl.value = 1;
    
    renderKeranjang();
    
    // Fokus kembali ke pencarian untuk scan/ketik barang berikutnya
    searchEl.focus();
    
    Toast.fire({ icon: 'success', title: 'Masuk keranjang' });
}

function updateKeranjangPembeliDisplay() {
    const input = document.getElementById('kasirNamaPembeli');
    const disp = document.getElementById('keranjangNamaPembeli');
    if(!input || !disp) return;
    const span = disp.querySelector('span');
    const val = input.value.trim();
    
    span.textContent = val || 'Umum';
    if(val) { span.classList.remove('italic','text-slate-500'); span.classList.add('font-bold'); }
    else { span.classList.add('italic','text-slate-500'); span.classList.remove('font-bold'); }
    
    if(keranjang.length > 0) disp.classList.remove('hidden'); else disp.classList.add('hidden');
}

function renderKeranjang() {
    if (keranjang.length === 0) {
        keranjangContainer.classList.add('hidden');
        updateKeranjangPembeliDisplay();
        return;
    }

    let tot = 0;

    keranjangTable.innerHTML = keranjang.map((item, i) => {
        const sub = item.harga_jual * item.qty;
        tot += sub;

        const diskonBadge = item.diskon_persen > 0
            ? `<span class="inline-block bg-red-100 text-red-600 text-xs font-bold px-2 py-1 rounded-full border border-red-200">-${item.diskon_persen}%</span>`
            : `<span class="text-slate-400">-</span>`;

        return `
            <tr class="hover:bg-slate-50 dark:hover:bg-slate-700/50 border-b dark:border-slate-700 transition-colors">
                <td class="p-3 font-medium">${escapeHtml(item.nama)}</td>
                <td class="p-3 text-slate-700 dark:text-slate-300">${formatRupiah(item.harga_jual)}</td>
                <td class="p-3 text-center align-middle">${diskonBadge}</td>
                <td class="p-3 text-center">${item.qty}</td>
                <td class="p-3 font-semibold text-green-600 dark:text-green-400">${formatRupiah(sub)}</td>
                <td class="p-3">
                    <button class="text-red-500 hover:text-red-700 p-2 hover:bg-red-50 rounded-full transition-all" 
                            onclick="handleHapusKeranjangItem(${i})"
                            title="Hapus Item">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </td>
            </tr>`;
    }).join('');

    keranjangTotal.textContent = formatRupiah(tot);
    keranjangContainer.classList.remove('hidden');
    updateKeranjangPembeliDisplay();
}

window.handleHapusKeranjangItem = function(i) {
    keranjang.splice(i, 1);
    renderKeranjang();
}

function handleClearKeranjang() {
    if (keranjang.length === 0) return;
    Swal.fire({
        title: 'Kosongkan Keranjang?',
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Ya'
    }).then((result) => {
        if(result.isConfirmed) {
            keranjang = [];
            document.getElementById('kasirNamaPembeli').value = '';
            const searchEl = document.getElementById('kasirProdukSearch');
            const idEl = document.getElementById('kasirSelectedProdukId');
            if(searchEl) searchEl.value = '';
            if(idEl) idEl.value = '';
            renderKeranjang();
        }
    });
}

async function handleProsesKeranjang() {
    if(keranjang.length === 0) return Swal.fire('Info', 'Keranjang kosong', 'info');
    
    const btnProses = document.getElementById('prosesKeranjangBtn');
    const buyer = document.getElementById('kasirNamaPembeli').value.trim() || null;
    
    btnProses.disabled = true;
    btnProses.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Memproses...';
    
    showLoading('Proses Transaksi...');
    
    try {
        const ids = keranjang.map(i => i.produk_id);
        const { data: latest } = await supabase.from('produk').select('id, nama, stok, harga_jual, modal, diskon_persen').in('id', ids);
        
        let errMsg = '';
        const items = [];
        const notaId = crypto.randomUUID();
        
        for(const k of keranjang) {
            const db = latest.find(p => p.id === k.produk_id);
            
            if(!db) {
                errMsg += `Produk ${k.nama} hilang dari database.\n`;
            } else {
                const stokAwal = parseInt(db.stok);
                const qtyBeli = parseInt(k.qty);
                
                if(stokAwal < qtyBeli) {
                    errMsg += `Stok ${k.nama} kurang (Sisa: ${stokAwal}, Beli: ${qtyBeli}).\n`;
                } else {
                    const sisaStok = stokAwal - qtyBeli;
                    console.log(`Produk: ${db.nama} | Stok Awal: ${stokAwal} | Beli: ${qtyBeli} | Sisa: ${sisaStok}`);

                    const diskonDb = Number(db.diskon_persen || 0);
                    const hargaJualDb = Number(db.harga_jual);
                    const modalDb = Number(db.modal);
                    const hargaFinalDb = hargaJualDb - (hargaJualDb * diskonDb / 100);
                    
                    items.push({ 
                        ...k, 
                        stok_baru: sisaStok,
                        harga_jual_final: hargaFinalDb,
                        harga_asli: hargaJualDb,
                        diskon_persen: diskonDb,
                        modal: modalDb 
                    });
                }
            }
        }
        
        if(errMsg) { 
            throw new Error(errMsg); 
        }
        
        const promises = items.map(i => {
             const total = Number(i.harga_jual_final) * Number(i.qty);
             const untung = (Number(i.harga_jual_final) - Number(i.modal)) * Number(i.qty);
             
             return Promise.all([
                 supabase.from('transaksi').insert({ 
                     produk_id: i.produk_id, 
                     qty: i.qty, 
                     total: total, 
                     keuntungan: untung, 
                     nota_id: notaId, 
                     nama_pembeli: buyer,
                     diskon_persen: i.diskon_persen,
                     
                     // [BARU] SIMPAN ARSIP HARGA SAAT INI
                     modal_history: i.modal, 
                     harga_jual_history: i.harga_asli // Harga sebelum diskon
                 }),
                 
                 supabase.from('produk').update({ stok: i.stok_baru }).eq('id', i.produk_id)
             ]);
        });
        
        await Promise.all(promises);
        
        lastProcessedCart = [...items];
        lastProcessedPembeli = buyer || ' ';
        
        keranjang = [];
        const searchEl = document.getElementById('kasirProdukSearch');
        const idEl = document.getElementById('kasirSelectedProdukId');
        if(searchEl) searchEl.value = '';
        if(idEl) idEl.value = '';
        document.getElementById('kasirNamaPembeli').value = '';
        renderKeranjang();

        hideLoading();
        
        confirmModal.classList.remove('hidden');
        
    } catch (err) { 
        console.error(err);
        Swal.fire('Gagal', err.message, 'error'); 
        hideLoading();
        await loadStok(); 
    } finally {
        btnProses.disabled = false;
        btnProses.innerHTML = '<i class="fa-solid fa-check-double"></i> Bayar Lunas';
    }
}

// === LAPORAN & EXPORT ===

// Ganti seluruh fungsi loadLaporan yang ada di script.js

async function loadLaporan(append = false) {
    const tglMulai = document.getElementById('laporanTglMulai').value;
    const tglSelesai = document.getElementById('laporanTglSelesai').value;

    if (!append) {
        laporanPage = 0;
        document.getElementById('laporanTable').innerHTML = '';
        const btnMore = document.getElementById('btnLoadMore');
        if(btnMore) btnMore.classList.add('hidden');
    }
    
    showLoading('Memuat Laporan...');

    const from = laporanPage * laporanPerPage;
    const to = from + laporanPerPage - 1;

    try {
        let query = supabase.from('transaksi').select('*');

        if (tglMulai) query = query.gte('created_at', `${tglMulai}T00:00:00`);
        if (tglSelesai) query = query.lte('created_at', `${tglSelesai}T23:59:59`);

        query = query.order('created_at', { ascending: false }).range(from, to);

        const { data: transactions, error } = await query;

        if (error) throw error;

        const laporanTable = document.getElementById('laporanTable');
        
        if (!append) {
            globalLaporanCache = transactions; 
        } else {
            globalLaporanCache = [...globalLaporanCache, ...transactions];
        }

        const prodMap = globalProdukCache.reduce((m,p)=> (m[p.id]=p.nama, m), {});

        if (transactions.length === 0 && !append) {
            laporanTable.innerHTML = '<tr><td colspan="10" class="text-center p-4 italic text-slate-500">Tidak ada data transaksi pada periode ini.</td></tr>';
        }

        // --- PERBAIKAN LOGIKA IZIN ---
        let izinHapus = false;
        if (typeof userPermissions !== 'undefined') {
             // 1. Cek Admin Utama
             const isMainAdmin = (currentUserId === MAIN_ADMIN_ID) || (userPermissions.role === 'admin');
             // 2. Cek Checkbox Profil (can_manage_laporan)
             const hasPermission = userPermissions.can_manage_laporan;

             if (isMainAdmin || hasPermission) {
                 izinHapus = true;
             }
        }

        transactions.forEach(item => {
            let productName = item.nama_produk;
            if (!productName && item.produk_id) {
                productName = prodMap[item.produk_id];
            }
            const finalProductName = productName || `[ID: ${item.produk_id || '???'}]`;
            
            const modalValue = parseFloat(item.modal_history) || 0; 
            const hargaJualValue = parseFloat(item.harga_jual_history) || 0;
            const diskonValue = parseFloat(item.diskon_persen) || 0;
            const laba = parseFloat(item.keuntungan || 0);

            let actionHtml;
            if (izinHapus) {
                actionHtml = `
                    <button onclick="deleteTransaksi('${item.id}', ${item.produk_id}, ${item.qty})"
                            class="bg-red-100 text-red-600 px-3 py-1 rounded hover:bg-red-200 transition text-xs font-bold"
                            title="Hapus Transaksi">
                        Hapus
                    </button>
                `;
            } else {
                actionHtml = `
                    <button disabled
                            class="bg-slate-200 text-slate-400 px-3 py-1 rounded cursor-not-allowed text-xs font-bold"
                            title="Butuh Izin Hapus Laporan">
                        Hapus
                    </button>
                `;
            }

            const row = document.createElement('tr');
            row.innerHTML = `
                <td class="p-3 text-xs whitespace-nowrap">${formatDate(item.created_at)}</td>
                <td class="p-3 font-medium">${escapeHtml(finalProductName)}</td>
                <td class="p-3">${escapeHtml(item.nama_pembeli || 'Umum')}</td>
                <td class="p-3 text-right">${formatCurrency(modalValue)}</td>
                <td class="p-3 text-right">${formatCurrency(hargaJualValue)}</td>
                <td class="p-3 text-center">${diskonValue}%</td>
                <td class="p-3 text-center">${item.qty}</td>
                <td class="p-3 text-right font-bold">${formatCurrency(item.total)}</td> 
                <td class="p-3 text-right font-semibold text-green-600 dark:text-green-400">
                    ${formatCurrency(laba)} 
                </td>
                <td class="p-3 text-center">${actionHtml}</td>
            `;
            laporanTable.appendChild(row);
        });

        updateLoadMoreButton(transactions.length === laporanPerPage);

    } catch (error) {
        console.error(error);
        Swal.fire('Error', `Gagal memuat laporan: ${error.message}`, 'error');
    } finally {
        hideLoading();
    }
}

function updateLoadMoreButton(show) {
    let btn = document.getElementById('btnLoadMore');
    
    // 1. Cari elemen pembungkus tabel (yang ada scroll-nya)
    const tbody = document.getElementById('laporanTable');
    const table = tbody.closest('table');
    const scrollContainer = tbody.closest('.overflow-x-auto');
    const mainCard = scrollContainer ? scrollContainer.parentNode : table.parentNode;

    if (!btn) {
        btn = document.createElement('button');
        btn.id = 'btnLoadMore';
        
        // 2. Styling agar Full Width (w-full) dan nyaman ditekan di HP (py-3)
        btn.className = "w-full block py-3 mt-4 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl text-sm font-bold shadow-sm border border-slate-200 dark:border-slate-600 hover:bg-slate-200 dark:hover:bg-slate-600 transition-all cursor-pointer";
        
        btn.innerHTML = '<i class="fa-solid fa-circle-chevron-down mr-2"></i> Muat Lebih Banyak Data';
        
        btn.onclick = () => { 
            laporanPage++; 
            loadLaporan(true); 
        };
        if (scrollContainer) {
            scrollContainer.insertAdjacentElement('afterend', btn);
        } else {
            mainCard.appendChild(btn);
        }
    }
    
    // Tampilkan atau sembunyikan sesuai kondisi
    if (show) {
        btn.classList.remove('hidden');
    } else {
        btn.classList.add('hidden');
    }
}
// Ganti seluruh fungsi deleteTransaksi() Anda di script.js:

async function deleteTransaksi(transaksiId, produkId, qty) {
    // 1. Konfirmasi Hapus
    const result = await Swal.fire({
        title: 'Yakin Hapus Transaksi?',
        text: "Tindakan ini permanen. Stok produk akan dikembalikan jika ini bukan transaksi DP.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'Ya, Hapus!',
        cancelButtonText: 'Batal'
    });

    if (!result.isConfirmed) {
        return;
    }

    showLoading('Menghapus transaksi...');

    try {
        // --- STEP 2: Ambil Detail Transaksi untuk Identifikasi Tipe dan Nota ---
        const { data: detailTrans, error: detailErr } = await supabase
            .from('transaksi')
            // Penting: Ambil nota_id untuk mencari PO jika ini transaksi Pelunasan
            .select('nama_pembeli, produk_id, qty, nota_id') 
            .eq('id', transaksiId)
            .single();

        if (detailErr || !detailTrans) {
            // Lanjutkan menghapus jika gagal mengambil detail, tapi berikan peringatan.
            console.error("Gagal mengambil detail transaksi:", detailErr);
        }

        // Cek Tipe Transaksi
        const buyerName = detailTrans?.nama_pembeli || '';
        const isDpTransaction = buyerName.includes('(DP PO)');
        const isPelunasanTransaction = buyerName.includes('(PELUNASAN)');
        
        // Hanya kembalikan stok jika BUKAN DP PO
        const shouldRestoreStock = !isDpTransaction; 
        
        // 3. Hapus Transaksi Utama
        const { error: deleteError } = await supabase
            .from('transaksi')
            .delete()
            .eq('id', transaksiId);

        if (deleteError) throw deleteError;

        
        // --- 4. LOGIKA PENGEMBALIAN STOK AKURAT ---
        
        if (shouldRestoreStock) {
            
            if (isPelunasanTransaction) {
                // A. Pelunasan PO: Ambil detail PO dan kembalikan SEMUA item di dalamnya
                
                if (!detailTrans.nota_id) {
                    throw new Error("Gagal mengembalikan stok: nota_id Pelunasan tidak ditemukan.");
                }

                // Ambil detail PO dari tabel preorder
                const { data: poDetail, error: poErr } = await supabase
                    .from('preorder')
                    .select('items_json')
                    .eq('nota_id', detailTrans.nota_id)
                    .single();

                if (poErr || !poDetail || !Array.isArray(poDetail.items_json)) {
                    console.error("Gagal mendapatkan detail PO untuk pengembalian stok:", poErr);
                    throw new Error("Gagal mengembalikan stok PO karena data item PO tidak ditemukan.");
                }
                
                // Loop dan kembalikan stok untuk setiap item di PO
                const itemsToRestore = poDetail.items_json;
                let itemsRestoredCount = 0;

                for (const item of itemsToRestore) {
                    const currentProductId = item.produk_id;
                    const currentQty = item.qty;

                    // Fetch current stock
                    const { data: produk, error: fetchError } = await supabase
                        .from('produk')
                        .select('stok')
                        .eq('id', currentProductId)
                        .single();

                    if (!fetchError && produk) {
                        const newStock = produk.stok + currentQty;
                        const { error: updateError } = await supabase
                            .from('produk')
                            .update({ stok: newStock })
                            .eq('id', currentProductId);
                        
                        if (!updateError) {
                            itemsRestoredCount++;
                        }
                    } else {
                        console.warn(`Produk ID ${currentProductId} tidak ditemukan untuk dikembalikan stoknya.`);
                    }
                }
                
                if (itemsRestoredCount > 0) {
                     Swal.fire('Terhapus!', `Transaksi Pelunasan PO berhasil dihapus. ${itemsRestoredCount} jenis produk telah dikembalikan stoknya.`, 'success');
                } else {
                     Swal.fire('Terhapus!', 'Transaksi Pelunasan PO berhasil dihapus, namun tidak ada stok produk yang berhasil dikembalikan (cek konsol).', 'warning');
                }

            } else {
                // B. Penjualan Reguler: Kembalikan stok berdasarkan QTY Transaksi
                
                const restoreProdukId = detailTrans.produk_id;
                const restoreQty = detailTrans.qty; 
                
                const { data: produk, error: fetchError } = await supabase
                    .from('produk')
                    .select('stok')
                    .eq('id', restoreProdukId)
                    .single();

                if (fetchError || !produk) {
                    console.warn(`Produk ID ${restoreProdukId} tidak ditemukan di tabel produk. Hanya menghapus transaksi.`);
                } else {
                    const newStock = produk.stok + restoreQty;
                    const { error: updateError } = await supabase
                        .from('produk')
                        .update({ stok: newStock })
                        .eq('id', restoreProdukId);

                    if (updateError) throw updateError;
                    
                    Swal.fire('Terhapus!', 'Transaksi Penjualan berhasil dihapus dan stok telah dikembalikan.', 'success');
                }
            }
        } else {
            // Transaksi DP PO: Stok tidak dikembalikan
            Swal.fire(
                'Terhapus!',
                'Transaksi DP PO berhasil dihapus. Stok tidak diubah.',
                'success'
            );
        }

        loadLaporan(); // Muat ulang laporan setelah aksi
        
    } catch (error) {
        console.error("Error saat menghapus transaksi:", error);
        Swal.fire(
            'Gagal!',
            `Gagal menghapus transaksi: ${error.message}.`,
            'error'
        );
    } finally {
        hideLoading();
    }
}

/**
 * Memuat dan menampilkan detail struk di modal.
 */
async function viewReceipt(transaksiId, tipe) {
    const receiptModal = document.getElementById('receiptModal');
    const receiptContent = document.getElementById('receiptContent');

    showLoading('Memuat detail struk...');

    try {
        // Tampilkan modal struk
        receiptModal.classList.remove('hidden');
        
        // Atur event listener untuk tombol tutup modal
        document.getElementById('closeModalBtn').onclick = () => {
            receiptModal.classList.add('hidden');
        };
        
        // --- LOGIKA FETCH DATA STRUK ---
        
        // Contoh: Mengambil data transaksi berdasarkan ID
        const { data: receiptData, error } = await supabase
            .from('transaksi')
            .select('*')
            .eq('id', transaksiId)
            .single();

        if (error || !receiptData) {
             throw new Error('Data struk tidak ditemukan.');
        }

        // --- Di sini Anda perlu memanggil fungsi untuk membangun HTML struk ---
        // Karena saya tidak punya fungsi buildReceiptHTML(), saya berikan placeholder detail
        receiptContent.innerHTML = `
            <div class="max-w-xs mx-auto text-center p-2">
                <h4 class="font-bold text-lg mb-2">DETAIL TRANSAKSI</h4>
                <p>ID: ${transaksiId}</p>
                <p>Tipe: ${tipe}</p>
                <p>Total: ${formatCurrency(receiptData.total || receiptData.total_harga)}</p>
                <p class="mt-4 text-sm text-yellow-600">
                    Sistem siap mencetak. Lanjutkan implementasi fungsi buildReceiptHTML().
                </p>
            </div>
        `;

    } catch (error) {
        receiptContent.innerHTML = `<div class="p-4 text-center text-red-600">Gagal memuat: ${error.message}</div>`;
    } finally {
        hideLoading();
    }
}

window.hapusLaporan = async function(id) {
    const result = await Swal.fire({
        title: 'Hapus Transaksi?',
        text: "Stok TIDAK akan kembali otomatis.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#dc2626',
        confirmButtonText: 'Hapus'
    });

    if(!result.isConfirmed) return;

    showLoading('Menghapus...');
    try {
        const { error } = await supabase.from('transaksi').delete().eq('id', id);
        if(error) throw error;
        await refreshAllData();
        Toast.fire({ icon: 'success', title: 'Transaksi dihapus' });
    } catch(e) { Swal.fire('Gagal', e.message, 'error'); } finally { hideLoading(); }
}

function handleConfirmYes() {
    confirmModal.classList.add('hidden');
    const items = lastProcessedCart.map(i => ({ 
        nama: i.nama, 
        qty: i.qty, 
        total: i.harga_jual_final * i.qty, 
        harga_satuan: i.harga_jual_final,
        diskon_persen: i.diskon_persen, 
        harga_asli: i.harga_asli 
    }));
    showReceiptModal(items, new Date(), lastProcessedPembeli);
}

function handleConfirmNo() {
    confirmModal.classList.add('hidden');
    refreshAllData();
}

// === STRUK & PRINT LOGIC ===

function closeReceiptModal(refresh) {
    receiptModal.classList.add('hidden');
    if(refresh) refreshAllData();
}

function printReceipt() { window.print(); }

async function exportReceiptAsJpg() {
    showLoading('Export JPG...');
    const original = document.getElementById('receiptContent');
    const wrapper = document.createElement('div');
    const isDark = document.documentElement.classList.contains('dark');
    
    wrapper.style.cssText = "position:absolute;left:-9999px;top:0;width:" + (original.offsetWidth + 32) + "px;background-color:" + (isDark ? '#1e293b' : '#fff');
    if(isDark) wrapper.classList.add('dark','text-slate-200');
    
    const clone = original.cloneNode(true);
    clone.style.padding = "16px";
    wrapper.appendChild(clone);
    document.body.appendChild(wrapper);
    
    try {
        const canvas = await html2canvas(clone, { scale: 3, backgroundColor: isDark?'#1e293b':'#fff', useCORS: true });
        const link = document.createElement('a');
        link.href = canvas.toDataURL('image/jpeg', 0.9);
        link.download = `struk-${Date.now()}.jpg`;
        link.click();
    } catch(e) { Swal.fire('Gagal JPG', e.message, 'error'); }
    finally { document.body.removeChild(wrapper); hideLoading(); }
}

function exportToExcel() {
    if (globalLaporanCache.length === 0) return Swal.fire('Info', 'Data kosong', 'info');
    const canSee = userPermissions.can_see_finances;
    
    const data = globalLaporanCache.map(t => ({
        "Tanggal": formatTanggal(t.created_at),
        "Produk": t.produk?.nama || 'Produk Dihapus',
        "Pembeli": t.nama_pembeli || '',
        
        "Modal Satuan": canSee ? (t.modal_history || 0) : '-',
        "Harga Normal": t.harga_jual_history || 0,
        "Diskon (%)": t.diskon_persen || 0,
        
        "Qty": t.qty,
        "Total Akhir": t.total,
        "Laba Bersih": canSee ? t.keuntungan : ''
    }));
    
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Laporan Penjualan");
    XLSX.writeFile(wb, "Laporan_Alza_Store.xlsx");
}

/* ========================================= */
/* FITUR PRE-ORDER (PO) SYSTEM - FINAL       */
/* ========================================= */

// --- A. LOGIKA STRUK UNIFIED (KASIR BIASA & PO JADI SATU) ---
/**
 * Menampilkan Modal Struk.
 * @param {Array} items - Array barang
 * @param {Date} date - Tanggal transaksi
 * @param {String} buyer - Nama pembeli
 * @param {Object|null} poData - Data khusus PO (jika null = struk biasa)
 */
function showReceiptModal(items, date, buyer, poData = null) {
    // 1. Reset Tampilan
    const poSection = document.getElementById('receiptPOInfo');
    if(poSection) poSection.classList.add('hidden');
    
    const titleEl = document.getElementById('receiptTitle');
    if(titleEl) titleEl.textContent = 'STRUK PEMBAYARAN';

    // 2. Isi Data Dasar
    document.getElementById('receiptDate').textContent = formatTanggal(date);
    document.getElementById('receiptNamaPembeli').textContent = buyer || ' ';
    
    if(document.getElementById('receiptKasirName')) {
        document.getElementById('receiptKasirName').textContent = typeof globalCurrentUserName !== 'undefined' ? globalCurrentUserName : 'Admin';
    }

    // --- [LOGIKA BARU: SEMBUNYIKAN NOTA JIKA BUKAN PO] ---
    const labelNota = document.getElementById('labelNota');
    const valueNota = document.getElementById('receiptNota');
    let finalNotaId = '';

    if (poData) {
        // Jika PO, TAMPILKAN Nota ID (Contoh: PO-12345)
        finalNotaId = poData.nota_id;
        if(labelNota) labelNota.classList.remove('hidden');
        if(valueNota) valueNota.classList.remove('hidden');
    } else {
        // Jika Transaksi Biasa, SEMBUNYIKAN Nota ID, TIDAK perlu generate ID baru di sini.
        if(labelNota) labelNota.classList.add('hidden');
        if(valueNota) valueNota.classList.add('hidden');
    }

    // Set Nota (Ini akan diisi dari reprintReceipt jika ada data lama)
    if(valueNota) valueNota.textContent = finalNotaId; 
    // -----------------------------------------------------

    // 3. Render Daftar Barang
    let sum = 0;
    const itemsEl = document.getElementById('receiptItems');
    itemsEl.innerHTML = items.map(i => {
        const hargaSatuan = i.harga_jual_final || i.harga_satuan || i.harga_jual;
        const hargaAsli = i.harga_asli || i.harga_jual_history || hargaSatuan;
        const diskon = i.diskon_persen || 0;
        const qty = i.qty;
        
        const subtotal = hargaSatuan * qty;
        sum += subtotal;

        let infoHarga = `${qty} x ${formatRupiah(hargaSatuan)}`;
        if (diskon > 0) {
            infoHarga = `
                <div>${qty} x ${formatRupiah(hargaSatuan)}</div>
                <div class="text-[10px] text-slate-500">
                    <span class="line-through">${formatRupiah(hargaAsli)}</span> 
                    <span class="italic">(-${diskon}%)</span>
                </div>`;
        }

        return `
            <tr class="border-b border-dashed border-slate-300 dark:border-slate-600">
                <td class="py-1 align-top w-[60%]">
                    <div class="font-medium leading-tight">${escapeHtml(i.nama)}</div>
                    <div class="text-xs text-slate-500">${infoHarga}</div>
                </td>
                <td class="py-1 align-top text-right font-medium">
                    ${formatRupiah(subtotal)}
                </td>
            </tr>`;
    }).join('');

    // 4. Isi Total
    const finalTotal = poData ? poData.total : sum;
    document.getElementById('receiptTotal').textContent = formatRupiah(finalTotal);

    // 5. [LOGIKA PO]
    if (poData && poSection) {
        poSection.classList.remove('hidden');
        
        const judul = poData.status === 'LUNAS' ? 'PELUNASAN PO' : 'BUKTI DP (PO)';
        if(titleEl) titleEl.textContent = judul;

        document.getElementById('receiptDP').textContent = formatRupiah(poData.dp);
        document.getElementById('receiptSisa').textContent = formatRupiah(poData.sisa);
        document.getElementById('receiptStatus').textContent = poData.status;
        
        let infoTambahan = poData.estimasi ? `Estimasi: ${formatTanggal(poData.estimasi).split(',')[0]}` : '';
        if(poData.catatan) {
            infoTambahan += `<br>
            <div class="mt-1 pt-1 border-t border-dotted border-slate-300 text-left">
                <span class="font-bold text-[10px]">Note:</span> 
                <span class="italic">${escapeHtml(poData.catatan)}</span>
            </div>`;
        }
        document.getElementById('receiptEstimasi').innerHTML = infoTambahan;
    }

    // 6. Tampilkan Modal
    document.getElementById('receiptModal').classList.remove('hidden');
}

// Fungsi Wrapper untuk Cetak PO
function printStrukPO(items, pembeli, total, dp, sisa, estimasi, nota, status, catatan) {
    const dataPO = { nota_id: nota, total, dp, sisa, estimasi, status, catatan };
    showReceiptModal(items, new Date(), pembeli, dataPO);
}

// Update fungsi handleConfirmYes (Sales Biasa) agar kompatibel
function handleConfirmYes() {
    document.getElementById('confirmModal').classList.add('hidden');
    
    // Konversi data keranjang ke format struk
    const items = lastProcessedCart.map(i => ({ 
        nama: i.nama, 
        qty: i.qty, 
        total: i.harga_jual_final * i.qty, 
        harga_satuan: i.harga_jual_final,
        diskon_persen: i.diskon_persen, 
        harga_asli: i.harga_asli 
    }));
    
    // Panggil showReceiptModal dengan parameter poData = NULL (Mode Sales Biasa)
    showReceiptModal(items, new Date(), lastProcessedPembeli, null); 
}


// --- B. LOGIKA INPUT & SIMPAN PO ---

// 1. Buka Modal Input PO dari Kasir
function bukaModalPO() {
    if (keranjang.length === 0) return Swal.fire('Keranjang Kosong', 'Pilih produk dulu', 'warning');
    
    // Hitung Total Keranjang
    const total = keranjang.reduce((sum, item) => {
        let harga = item.harga_jual;
        if (item.diskon_persen > 0) harga = harga - (harga * item.diskon_persen / 100);
        return sum + (harga * item.qty);
    }, 0);

    // Reset Form Modal PO
    document.getElementById('poTotalDisplay').textContent = formatRupiah(total);
    document.getElementById('poNama').value = '';
    document.getElementById('poEstimasi').value = '';
    document.getElementById('poDP').value = '';
    document.getElementById('poCatatan').value = ''; // Reset Catatan
    document.getElementById('poSisaDisplay').textContent = formatRupiah(total);
    
    // Auto Hitung Sisa saat ketik DP
    const dpInput = document.getElementById('poDP');
    dpInput.oninput = () => {
        const dp = Number(dpInput.value);
        const sisa = total - dp;
        document.getElementById('poSisaDisplay').textContent = formatRupiah(sisa < 0 ? 0 : sisa);
    };

    document.getElementById('modalInputPO').classList.remove('hidden');
}

// Ganti seluruh fungsi prosesSimpanPO() Anda:

async function prosesSimpanPO() {
    const nama = document.getElementById('poNama').value;
    const estimasi = document.getElementById('poEstimasi').value;
    const dp = Number(document.getElementById('poDP').value);
    const catatan = document.getElementById('poCatatan').value.trim();
    
    // Hitung Total Jual (Harga Final)
    const totalJual = keranjang.reduce((sum, item) => {
        let harga = item.harga_jual;
        return sum + (harga * item.qty);
    }, 0);

    // [BARU] Hitung Total Modal
    const totalModal = keranjang.reduce((sum, item) => {
        return sum + (item.modal * item.qty);
    }, 0);

    if(!nama) return Swal.fire('Info', 'Nama pembeli wajib diisi', 'warning');
    if(dp < 0) return Swal.fire('Info', 'DP tidak boleh minus', 'warning');
    if(dp >= totalJual) return Swal.fire('Info', 'Jika lunas, gunakan tombol "Bayar Lunas" saja', 'info');

    showLoading('Memproses PO...');
    
    try {
        const notaId = `PO-${Date.now().toString().slice(-6)}`;
        const sisa = totalJual - dp;

        // A. Kurangi Stok Produk (Menggunakan RPC Database)
        const updateStokPromises = keranjang.map(item => {
             return supabase.rpc('kurangi_stok', { 
                 p_id: item.produk_id, 
                 p_qty: item.qty 
             });
        });
        await Promise.all(updateStokPromises);

        // B. Simpan ke Tabel PREORDER
        const { error: errPO } = await supabase.from('preorder').insert({
            nota_id: notaId,
            nama_pembeli: nama,
            items_json: keranjang,
            total_transaksi: totalJual,
            jumlah_dp: dp,
            sisa_tagihan: sisa,
            estimasi_selesai: estimasi || null,
            status: 'BELUM_LUNAS',
            catatan: catatan,
            // [FIX KRITIS 1] SIMPAN TOTAL MODAL PO UNTUK REFERENSI
            total_modal_po: totalModal 
        });
        if(errPO) throw errPO;

        // C. Simpan DP ke Tabel TRANSAKSI (Laporan Penjualan)
        if (dp > 0) {
            const refProdukId = keranjang[0].produk_id; 
            
            await supabase.from('transaksi').insert({
                produk_id: refProdukId, 
                qty: 1,
                total: dp, // Hanya DP yang masuk total hari ini
                // [FIX KRITIS 2] LABA DIPOSTING 0 SAAT DP, UNTUK DIHITUNG LENGKAP SAAT PELUNASAN
                keuntungan: 0, 
                nota_id: notaId,
                nama_pembeli: `${nama} (DP PO)`,
                created_at: getWibTimestampString()
            });
        }

        // D. Cetak Struk DP & Bersihkan Layar
        printStrukPO(keranjang, nama, totalJual, dp, sisa, estimasi, notaId, 'DP', catatan);
        
        keranjang = [];
        renderKeranjang();
        document.getElementById('modalInputPO').classList.add('hidden');
        Swal.fire('Berhasil', 'PO tersimpan. Stok & Laporan terupdate.', 'success');
        
        loadStok();
        const pageActive = document.querySelector('.page.active');
        if(pageActive && pageActive.id === 'preorder') {
            loadPreorders();
        }

    } catch(err) {
        console.error(err);
        Swal.fire('Gagal', err.message, 'error');
    } finally {
        hideLoading();
    }
}


// --- C. LOGIKA DAFTAR PO & PELUNASAN ---

// Ganti seluruh fungsi loadPreorders() Anda di script.js:

async function loadPreorders() {
    const tBody = document.getElementById('poTableBody');
    if(!tBody) return;

    tBody.innerHTML = '<tr><td colspan="7" class="text-center p-4">Loading...</td></tr>';
    
    const { data, error } = await supabase
        .from('preorder')
        .select('*')
        .order('created_at', { ascending: false });

    if(error) {
        tBody.innerHTML = '<tr><td colspan="7" class="text-center text-red-500">Gagal: ' + error.message + '</td></tr>';
        return;
    }

    if(!data || data.length === 0) {
        tBody.innerHTML = '<tr><td colspan="7" class="text-center p-4 italic text-slate-500">Belum ada data PO</td></tr>';
        return;
    }

    // --- PERBAIKAN LOGIKA IZIN (ROUTING YANG BENAR) ---
    let izinHapus = false;
    
    if (typeof userPermissions !== 'undefined') {
        // 1. Cek apakah dia Admin Utama (berdasarkan ID konstan atau Role)
        const isMainAdmin = (currentUserId === MAIN_ADMIN_ID) || (userPermissions.role === 'admin');
        
        // 2. Cek apakah dia punya izin 'Hapus Laporan' (can_manage_laporan)
        // JANGAN GUNAKAN 'can_delete_transactions', ITU SALAH.
        const hasPermission = userPermissions.can_manage_laporan; 

        if (isMainAdmin || hasPermission) {
            izinHapus = true;
        }
    }

    tBody.innerHTML = data.map(po => {
        const items = po.items_json || [];
        const itemList = items.map(i => `• ${escapeHtml(i.nama)} (${i.qty}x)`).join('<br>');
        
        const catatanShow = po.catatan 
            ? `<div class="bg-yellow-50 dark:bg-slate-700 border border-yellow-100 dark:border-slate-600 p-2 rounded text-xs italic text-slate-600 dark:text-slate-300 whitespace-pre-wrap max-w-[200px]">${escapeHtml(po.catatan)}</div>` 
            : '<span class="text-slate-300">-</span>';

        let statusBadge = po.status === 'LUNAS' 
            ? '<span class="bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-bold">LUNAS</span>'
            : '<span class="bg-yellow-100 text-yellow-700 px-2 py-1 rounded text-xs font-bold">BELUM LUNAS</span>';

        const jsonItems = JSON.stringify(items).replace(/"/g, '&quot;');
        const catatanSafe = (po.catatan || '').replace(/"/g, '&quot;');
        
        let buttonsHtml = '';

        if (po.status !== 'LUNAS') {
            buttonsHtml += `
                <button onclick='bukaModalPelunasan(${JSON.stringify(po)})' class="w-full bg-green-500 text-white px-3 py-1 rounded shadow text-xs font-bold hover:bg-green-600 transition mb-1">
                   <i class="fa-solid fa-money-bill"></i> Lunasi
                </button>
            `;
        } else {
            buttonsHtml += `
                <button onclick='printStrukPO(${jsonItems}, "${po.nama_pembeli}", ${po.total_transaksi}, ${po.jumlah_dp}, 0, "${po.estimasi_selesai}", "${po.nota_id}", "LUNAS", "${catatanSafe}")' class="w-full bg-sky-500 text-white px-3 py-1 rounded shadow text-xs hover:bg-sky-600 transition mb-1">
                    <i class="fa-solid fa-print"></i> Struk
                </button>
            `;
        }

        if (izinHapus) {
            buttonsHtml += `
                <button onclick="hapusPreorder('${po.id}', '${po.nota_id}', ${po.jumlah_dp})" class="w-full bg-red-500 text-white px-3 py-1 rounded shadow text-xs font-bold hover:bg-red-600 transition">
                   <i class="fa-solid fa-trash"></i> Hapus
                </button>
            `;
        } else {
            buttonsHtml += `
                <button disabled class="w-full bg-slate-300 dark:bg-slate-700 text-slate-500 px-3 py-1 rounded cursor-not-allowed text-xs font-bold opacity-70" title="Butuh Izin Hapus Laporan">
                   <i class="fa-solid fa-trash"></i> Hapus
                </button>
            `;
        }

        const btnAksi = `<div class="flex flex-col gap-1 min-w-[80px]">${buttonsHtml}</div>`;

        return `
            <tr class="border-b dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition">
                <td class="p-4 align-top">
                    <div class="font-bold text-slate-800 dark:text-slate-200">${escapeHtml(po.nama_pembeli)}</div>
                    <div class="text-xs text-slate-500 font-mono">${po.nota_id}</div>
                    <div class="text-xs text-slate-400 mt-1">${formatTanggal(po.created_at)}</div>
                </td>
                <td class="p-4 text-xs text-slate-600 dark:text-slate-400 align-top leading-relaxed">${itemList}</td>
                <td class="p-4 align-top">${catatanShow}</td>
                <td class="p-4 text-sm align-top">${po.estimasi_selesai ? formatTanggal(po.estimasi_selesai).split(',')[0] : '-'}</td>
                <td class="p-4 text-right align-top">
                    <div class="font-bold text-slate-700 dark:text-slate-300">Total: ${formatRupiah(po.total_transaksi)}</div>
                    <div class="text-xs text-purple-600">DP: ${formatRupiah(po.jumlah_dp)}</div>
                    <div class="text-xs text-red-500 font-bold mt-1">Sisa: ${formatRupiah(po.sisa_tagihan)}</div>
                </td>
                <td class="p-4 text-center align-top">${statusBadge}</td>
                <td class="p-4 text-center align-top">${btnAksi}</td>
            </tr>
        `;
    }).join('');
}

/**
 * Menghapus Preorder yang belum lunas dan transaksi DP terkait.
 * @param {string} poId ID unik baris preorder
 * @param {string} notaId ID Nota PO (PO-xxxxxx)
 * @param {number} dpJumlah Jumlah DP yang sudah masuk (untuk konfirmasi)
 */
async function hapusPreorder(poId, notaId, dpJumlah) {
    if (dpJumlah > 0) {
        const confirm = await Swal.fire({
            title: 'Hapus Transaksi PO?',
            html: `Yakin ingin menghapus ${notaId} ?<br>
                   Transaksi DP sebesar ${formatCurrency(dpJumlah)} (jika ada) di Laporan juga akan dihapus.`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Ya, Hapus',
            cancelButtonText: 'Batal',
            confirmButtonColor: '#dc2626'
        });
        if (!confirm.isConfirmed) return;
    } else {
         const confirm = await Swal.fire({
            title: 'Hapus PO Belum Lunas?',
            text: `Yakin ingin menghapus PO ${notaId}?`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Ya, Hapus',
            cancelButtonText: 'Batal',
            confirmButtonColor: '#dc2626'
        });
        if (!confirm.isConfirmed) return;
    }

    showLoading('Menghapus PO dan Transaksi terkait...');

    try {
        // A. Hapus Transaksi DP yang masuk ke Laporan (Tabel Transaksi)
        // Dihapus berdasarkan nota_id yang sama.
        const { error: transError } = await supabase
            .from('transaksi')
            .delete()
            .eq('nota_id', notaId);
        
        if (transError) {
             console.error("Gagal menghapus transaksi DP:", transError);
             // Lanjutkan, karena yang utama adalah menghapus record PO
        }

        // B. Hapus Record Master PO (Tabel Preorder)
        const { error: poError } = await supabase
            .from('preorder')
            .delete()
            .eq('id', poId);
            
        if (poError) throw poError;

        Swal.fire('Berhasil Dihapus!', `Pre-Order ${notaId} telah dihapus.`, 'success');
        
        // Muat ulang daftar PO dan Stok (karena stok produk PO sudah dikurangi saat DP)
        loadPreorders();
        loadStok(); 

    } catch (err) {
        Swal.fire('Gagal', `Gagal menghapus PO: ${err.message}`, 'error');
    } finally {
        hideLoading();
    }
}

// 4. Buka Modal Pelunasan
let activePO = null;
function bukaModalPelunasan(po) {
    activePO = po; // Simpan data PO yg sedang diedit ke variabel global
    document.getElementById('pelunasanId').value = po.id;
    document.getElementById('pelunasanSisa').textContent = formatRupiah(po.sisa_tagihan);
    document.getElementById('editEstimasi').value = po.estimasi_selesai || '';
    
    document.getElementById('modalPelunasan').classList.remove('hidden');
}

// 5. Update Estimasi Saja (Fitur kecil di modal pelunasan)
async function updateEstimasiOnly() {
    if(!activePO) return;
    const tglBaru = document.getElementById('editEstimasi').value;
    
    showLoading('Update Tanggal...');
    const { error } = await supabase.from('preorder')
        .update({ estimasi_selesai: tglBaru })
        .eq('id', activePO.id);
        
    hideLoading();
    if(error) Swal.fire('Gagal', error.message, 'error');
    else {
        Swal.fire('Sukses', 'Estimasi tanggal diperbarui', 'success');
        loadPreorders(); 
    }
}

// Ganti seluruh fungsi prosesLunasiAkhir() Anda di script.js:

async function prosesLunasiAkhir() {
    if(!activePO) return;
    
    // Total keuntungan penuh dihitung, tetapi tidak ditampilkan di SweetAlert
    const totalModalPO = activePO.total_modal_po || 0;
    const totalKeuntunganFinal = activePO.total_transaksi - totalModalPO;

    // --- PERUBAHAN DI SINI: MENGHAPUS TAMPILAN LABA DARI KONFIRMASI ---
    const konfirmasi = await Swal.fire({
        title: 'Konfirmasi Pelunasan',
        // Text/HTML hanya menampilkan sisa tagihan, BUKAN laba
        html: `Terima pelunasan sebesar **${formatRupiah(activePO.sisa_tagihan)}**?`, 
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Ya, Lunasi',
        confirmButtonColor: '#16a34a'
    });
    // -----------------------------------------------------------------

    if(!konfirmasi.isConfirmed) return;

    showLoading('Memproses Pelunasan...');
    
    try {
        // A. Update Status PO jadi LUNAS
        const { error: errPO } = await supabase.from('preorder')
            .update({ 
                status: 'LUNAS',
                sisa_tagihan: 0,
                tanggal_pelunasan: getWibTimestampString()
            })
            .eq('id', activePO.id);
        if(errPO) throw errPO;

        // B. Masukkan Sisa Pembayaran ke Laporan Penjualan (Tabel Transaksi)
        const uangMasuk = activePO.sisa_tagihan;
        if (uangMasuk > 0) {
            const refProdukId = activePO.items_json && activePO.items_json.length > 0 
                ? activePO.items_json[0].produk_id 
                : null;
            
            await supabase.from('transaksi').insert({
                produk_id: refProdukId, 
                qty: 1,
                // Total uang yang masuk hari ini (sisa tagihan)
                total: uangMasuk, 
                // Keuntungan diisi dengan LABA BERSIH TOTAL PO (sesuai logika)
                keuntungan: totalKeuntunganFinal, 
                nota_id: activePO.nota_id,
                nama_pembeli: `${activePO.nama_pembeli} (PELUNASAN)`,
                created_at: getWibTimestampString()
            });
        }

        // C. Cetak Struk LUNAS
        printStrukPO(
            activePO.items_json, 
            activePO.nama_pembeli, 
            activePO.total_transaksi, 
            activePO.jumlah_dp, 
            0, // Sisa jadi 0
            activePO.estimasi_selesai, 
            activePO.nota_id, 
            'LUNAS',
            activePO.catatan
        );
        
        document.getElementById('modalPelunasan').classList.add('hidden');
        Swal.fire('LUNAS!', 'Pembayaran berhasil & Laba total tercatat.', 'success');
        loadPreorders();

    } catch (err) {
        Swal.fire('Gagal', err.message, 'error');
    } finally {
        hideLoading();
    }
}

