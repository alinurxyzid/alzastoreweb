// =============== [WAJIB DIISI] ===============
const MAIN_ADMIN_ID = 'cbb9f0e0-8155-41fd-8eb7-9aab185c665c';
// ===============================================

// Variabel global
let currentUserId = null;
let globalCurrentUserName = 'Kasir';
let userPermissions = {
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

function showPage(pageId) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const el = document.getElementById(pageId);
  if (el) el.classList.add('active');

  navButtons.forEach(b => {
    b.classList.toggle('active', b.dataset.page === pageId);
  });
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

// ---------- INITIALIZATION ----------
document.addEventListener('DOMContentLoaded', async () => {
    if (typeof Chart !== 'undefined' && typeof ChartZoom !== 'undefined') {
        Chart.register(ChartZoom);
    }
    
    const mainContent = document.getElementById('main-content');
    
    // 1. Cek Sesi
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      window.location.href = 'login.html'; 
      return;
    }
    currentUserId = session.user.id;

    // 2. Ambil Profil
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('role, nama, can_manage_stok, can_manage_laporan, can_see_finances') 
      .eq('id', session.user.id)
      .single();

    if (error || !profile) {
      Swal.fire('Gagal', 'Gagal memverifikasi status Anda. Silakan login kembali.', 'error').then(() => {
          supabase.auth.signOut().then(() => window.location.href = 'login.html');
      });
      return;
    }
    
    if (profile.role !== 'approved' && profile.role !== 'admin') {
      Swal.fire('Pending', 'Akun Anda masih menunggu persetujuan Admin.', 'warning').then(() => {
          supabase.auth.signOut().then(() => window.location.href = 'login.html');
      });
      return;
    }

    globalCurrentUserName = profile.nama || 'Kasir';
    userPermissions = {
      can_manage_stok: profile.can_manage_stok,
      can_manage_laporan: profile.can_manage_laporan,
      can_see_finances: profile.can_see_finances
    };
    
    mainContent.classList.remove('hidden');

    if (currentUserId !== MAIN_ADMIN_ID) {
        const adminNavButton = document.querySelector('.nav-btn[data-page="admin"]');
        if (adminNavButton) adminNavButton.classList.add('hidden');
        const adminPageSection = document.getElementById('admin');
        if(adminPageSection) adminPageSection.classList.add('hidden');
    }

    applyUiPermissions();

    // 3. Inactivity Timer
    let inactivityTimer; 
    const INACTIVITY_TIMEOUT = 600000; // 10 Menit

    async function forceLogout() {
         console.log("Timeout: Logout paksa.");
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

    resetInactivityTimer();
    window.addEventListener('mousemove', resetInactivityTimer);
    window.addEventListener('mousedown', resetInactivityTimer);
    window.addEventListener('keypress', resetInactivityTimer);
    window.addEventListener('scroll', resetInactivityTimer);
    window.addEventListener('touchstart', resetInactivityTimer);

    // 4. Load Data
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

    // 5. Event Listeners
    navButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            showPage(btn.dataset.page);
            if(btn.dataset.page === 'dashboard') loadDashboard();
            if(btn.dataset.page === 'admin') loadAdminUsers();
        });
    });

    // Form Listener STOK
    formStok.addEventListener('submit', handleStokSubmit);

    // Form Listener KASIR (Clone untuk Reset Event)
    const oldFormKasir = document.getElementById('formKasir');
    // Clone form untuk membuang semua event listener "hantu" sebelumnya
    const newFormKasir = oldFormKasir.cloneNode(true);
    oldFormKasir.parentNode.replaceChild(newFormKasir, oldFormKasir);
    
    // Ambil referensi elemen-elemen di dalam form BARU
    const freshFormKasir = document.getElementById('formKasir');
    // Cari tombol "Tambah" (tombol pertama di form)
    const btnTambah = freshFormKasir.querySelector('button'); 
    // Cari Input Qty
    const inputQty = document.getElementById('kasirQty');

    // [KUNCI] Ubah type tombol jadi 'button' agar tidak memicu submit form bawaan browser
    if(btnTambah) {
        btnTambah.type = 'button'; 
        
        // Pasang listener KLIK manual
        btnTambah.addEventListener('click', (e) => {
            e.preventDefault(); // Jaga-jaga
            handleAddToCart(e);
        });
    }

    // [KUNCI] Pasang listener ENTER pada input Qty (pengganti submit form)
    if(inputQty) {
        inputQty.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault(); // Matikan submit form
                handleAddToCart(e); // Panggil manual
            }
        });
    }

    // Tombol Clear
    const btnClearKasir = document.getElementById('kasirClear'); 
    if(btnClearKasir) {
        // Pastikan tombol clear juga type='button'
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

    // Listener Search pada elemen BARU
    const freshSearchEl = document.getElementById('kasirProdukSearch');
    if (freshSearchEl) {
        freshSearchEl.addEventListener('input', handleProdukSearch);
        freshSearchEl.addEventListener('focus', handleProdukSearch);
        freshSearchEl.addEventListener('blur', () => {
            setTimeout(hideProdukDropdown, 200); 
        });
    }
    // === [AKHIR PERBAIKAN UTAMA] ===

    const kasirNamaInput = document.getElementById('kasirNamaPembeli');
    if (kasirNamaInput) {
        kasirNamaInput.addEventListener('input', updateKeranjangPembeliDisplay);
    }

    // Logout Modal Logic
    const logoutConfirmModal = document.getElementById('logoutConfirmModal');
    document.getElementById('logout-button').addEventListener('click', () => {
       logoutConfirmModal.classList.remove('hidden');
    });
    document.getElementById('logoutModalYesBtn').addEventListener('click', async () => {
       logoutConfirmModal.classList.add('hidden');
       showLoading('Anda sedang logout...');
       const { error } = await supabase.auth.signOut();
       if (error) {
         alert('Gagal logout: ' + error.message);
         hideLoading();
       } else {
         window.location.href = 'login.html';
       }
    });
    document.getElementById('logoutModalNoBtn').addEventListener('click', () => logoutConfirmModal.classList.add('hidden'));
    document.getElementById('logoutModalCloseBtn').addEventListener('click', () => logoutConfirmModal.classList.add('hidden'));

    // Tombol Lainnya
    document.getElementById('exportExcelBtn').addEventListener('click', exportToExcel);
    document.getElementById('laporanFilterBtn').addEventListener('click', loadLaporan);
    document.getElementById('closeModalBtn').addEventListener('click', () => closeReceiptModal(true));
    document.getElementById('printReceiptBtn').addEventListener('click', printReceipt);
    document.getElementById('exportJpgBtn').addEventListener('click', exportReceiptAsJpg);

    confirmModalYesBtn.addEventListener('click', handleConfirmYes);
    confirmModalNoBtn.addEventListener('click', handleConfirmNo);
    closeConfirmBtn.addEventListener('click', handleConfirmNo);

    prosesKeranjangBtn.addEventListener('click', handleProsesKeranjang);
    clearKeranjangBtn.addEventListener('click', handleClearKeranjang);

    tambahVarianBtn.addEventListener('click', tambahVarianInput);
    
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('laporanTglMulai').value = today;
    document.getElementById('laporanTglSelesai').value = today;
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
        dropdownEl.innerHTML = `<div class="px-4 py-2 text-sm">Produk tidak ditemukan.</div>`;
        dropdownEl.classList.remove('hidden');
        return;
    }
    const html = list.map(p => {
        const isHabis = p.stok === 0;
        const style = isHabis ? 'bg-gray-200 opacity-60 cursor-not-allowed' : 'hover:bg-blue-100 cursor-pointer';
        
        const diskon = p.diskon_persen || 0;
        let hargaTampil = formatRupiah(p.harga_jual);
        
        if (diskon > 0) {
            const hargaDiskon = p.harga_jual - (p.harga_jual * diskon / 100);
            hargaTampil = `<span class="line-through text-xs text-red-400 mr-1">${formatRupiah(p.harga_jual)}</span> 
                           <span class="font-bold">${formatRupiah(hargaDiskon)}</span> 
                           <span class="text-[10px] bg-red-100 text-red-600 px-1 rounded">-${diskon}%</span>`;
        }

        const click = isHabis ? '' : `onmousedown="selectProduk(${p.id}, '${escapeHtml(p.nama)}', ${p.harga_jual}, ${diskon})"`;
        
        return `
            <div class="px-4 py-2 ${style}" ${click}>
                <p class="font-medium">${escapeHtml(p.nama)} ${isHabis ? '(Habis)' : ''}</p>
                <p class="text-sm text-green-600">Stok: ${p.stok} | ${hargaTampil}</p>
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

async function loadKasirHistory() {
    try {
        // [UPDATE] Tambahkan 'harga_jual_history' di dalam select
        const { data, error } = await supabase
            .from('transaksi')
            .select('id, produk_id, qty, total, created_at, keuntungan, nota_id, nama_pembeli, diskon_persen, harga_jual_history, produk:produk_id(nama, harga_jual)')
            .order('created_at', { ascending: false })
            .limit(100);

        if (error) throw error;

        // Grouping Data
        const grouped = (data || []).reduce((acc, t) => {
            const nid = t.nota_id || t.created_at;
            if (!acc[nid]) {
                acc[nid] = {
                    nota_id: nid,
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

        kasirTable.innerHTML = sorted.slice(0, 20).map(n => {
            const names = n.items.map(i => {
                // Jika produk dihapus, pakai nama fallback, atau bisa ambil dari history jika ada kolom nama_history (opsional)
                const namaProduk = i.produk?.nama || 'Produk Dihapus';
                return `<span class="block text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap">• ${escapeHtml(namaProduk)} (${i.qty}x)</span>`;
            }).join('');

            // [UPDATE] Mapping data untuk Reprint Struk
            const reprintData = n.items.map(t => ({
                nama: t.produk?.nama || 'Produk Dihapus',
                qty: t.qty,
                total: t.total,
                // Harga Satuan yang dibayar (setelah diskon)
                harga_satuan: (Number(t.total) / Number(t.qty)),
                // [PENTING] Bawa data diskon & harga asli history
                diskon_persen: t.diskon_persen || 0,
                harga_asli: t.harga_jual_history // Ini adalah harga 'snapshot' saat transaksi terjadi
            }));

            const pembeliDisplay = n.nama_pembeli
                ? `<span class="font-medium text-slate-700 dark:text-slate-300">${escapeHtml(n.nama_pembeli)}</span>`
                : `<span class="italic text-slate-400 text-xs">Umum</span>`;

            const pembeliRaw = n.nama_pembeli || ' ';

            return `
             <tr class="hover:bg-slate-50 dark:hover:bg-slate-700/50 border-b dark:border-slate-700 align-top transition-colors duration-150">
                <td class="p-3 align-middle">${names}</td>
                <td class="p-3 align-middle">${pembeliDisplay}</td>
                <td class="p-3 align-middle text-center">${n.qty}</td>
                <td class="p-3 align-middle font-semibold text-slate-700 dark:text-slate-200">${formatRupiah(n.total)}</td>
                <td class="p-3 align-middle text-xs text-slate-500 whitespace-nowrap">${formatTanggal(n.created_at)}</td>
                <td class="p-3 align-middle text-center">
                   <button class="bg-sky-500 text-white px-3 py-1.5 rounded-md text-xs font-medium hover:bg-sky-600 transition-all shadow-sm flex items-center justify-center gap-1 mx-auto"
                           title="Cetak Ulang Struk"
                           onclick='reprintReceipt(${JSON.stringify(reprintData)}, "${n.created_at}", ${JSON.stringify(pembeliRaw)})'>
                     <i class="fa-solid fa-print"></i> Struk
                   </button>
                </td>
             </tr>`;
        }).join('');

    } catch (err) {
        console.error('loadKasirHistory error:', err);
        kasirTable.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-red-500 bg-red-50 dark:bg-red-900/20 rounded-lg"><i class="fa-solid fa-triangle-exclamation mr-2"></i>Gagal memuat riwayat transaksi: ${err.message}</td></tr>`;
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
                     // Ini kunci agar laporan tidak berubah walau harga produk diedit nanti
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
        btnProses.innerHTML = '<i class="fa-solid fa-check-double"></i> Proses';
    }
}

// === LAPORAN & EXPORT ===

async function loadLaporan() {
    try {
        const start = document.getElementById('laporanTglMulai').value;
        const end = document.getElementById('laporanTglSelesai').value;
        
        // [UPDATE QUERY] Tambahkan modal_history, harga_jual_history, diskon_persen
        let q = supabase.from('transaksi')
            .select('id, qty, total, keuntungan, created_at, nama_pembeli, diskon_persen, modal_history, harga_jual_history, produk:produk_id(nama)');
            
        if(start) q = q.gte('created_at', new Date(start + 'T00:00:00').toISOString());
        if(end) q = q.lte('created_at', new Date(end + 'T23:59:59').toISOString());
        
        const { data, error } = await q.order('created_at', { ascending: false }).limit(200);
        if(error) throw error;
        
        globalLaporanCache = data || [];
        
        laporanTable.innerHTML = globalLaporanCache.map(t => {
            const canSee = userPermissions.can_see_finances;
            const canDel = userPermissions.can_manage_laporan;
            
            // [LOGIKA DATA LAMA VS BARU]
            // Jika transaksi lama belum punya history, kita tampilkan '-' atau 0
            const modalShow = t.modal_history ? formatRupiah(t.modal_history) : '<span class="text-xs text-gray-400">-</span>';
            const hargaShow = t.harga_jual_history ? formatRupiah(t.harga_jual_history) : '<span class="text-xs text-gray-400">-</span>';
            
            // Tampilan Diskon
            const diskonHtml = t.diskon_persen > 0 
                ? `<span class="bg-red-100 text-red-600 text-xs px-2 py-1 rounded-full font-bold">-${t.diskon_persen}%</span>` 
                : '-';

            // Izin lihat modal
            const modalCell = canSee ? modalShow : '<i class="fa-solid fa-lock text-gray-300"></i>';

            return `
             <tr class="hover:bg-slate-50 dark:hover:bg-slate-700/50 border-b dark:border-slate-700">
                <td class="p-3 text-xs whitespace-nowrap text-slate-500">${formatTanggal(t.created_at)}</td>
                <td class="p-3 font-medium text-slate-800 dark:text-slate-200">${escapeHtml(t.produk?.nama || 'Produk Dihapus')}</td>
                <td class="p-3 text-sm">${escapeHtml(t.nama_pembeli || '-')}</td>
                
                <td class="p-3 text-sm text-slate-600 dark:text-slate-400">${modalCell}</td>
                <td class="p-3 text-sm text-slate-600 dark:text-slate-400">${hargaShow}</td>
                <td class="p-3 text-center text-sm">${diskonHtml}</td>
                
                <td class="p-3 text-center font-bold">${t.qty}</td>
                <td class="p-3 font-semibold text-slate-800 dark:text-slate-200">${formatRupiah(t.total)}</td>
                <td class="p-3 font-semibold text-green-600 dark:text-green-400">${canSee ? formatRupiah(t.keuntungan) : '-'}</td>
                
                <td class="p-3 text-center">
                    <button class="bg-red-100 text-red-600 hover:bg-red-600 hover:text-white p-2 rounded-lg transition-all ${canDel?'':'opacity-50 cursor-not-allowed'}" 
                            title="Hapus Transaksi"
                            onclick="hapusLaporan(${t.id})" ${canDel?'':'disabled'}>
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                </td>
             </tr>`;
        }).join('');
        
    } catch(e) { 
        console.error(e);
        // Colspan disesuaikan jadi 10 karena kolom bertambah
        laporanTable.innerHTML = `<tr><td colspan="10" class="text-center p-4 text-red-500">Gagal memuat laporan.</td></tr>`; 
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

function showReceiptModal(items, date, buyer) {
    receiptDateEl.textContent = formatTanggal(date);
    if(receiptKasirNameEl) receiptKasirNameEl.textContent = globalCurrentUserName;
    if(receiptNamaPembeliEl) receiptNamaPembeliEl.textContent = buyer;
    
    let sum = 0;
    receiptItemsEl.innerHTML = items.map(i => {
        const tot = i.total || (i.harga_satuan * i.qty);
        sum += tot;
        
        let infoHarga = `${i.qty} x ${formatRupiah(i.harga_satuan)}`;
        
        if (i.diskon_persen > 0) {
            // [LOGIKA BARU]
            // Prioritas 1: Gunakan 'harga_asli' dari database (History)
            // Prioritas 2: Jika data lama tidak punya history, hitung manual (Fallback)
            let hargaNormalVal;
            if (i.harga_asli) {
                hargaNormalVal = i.harga_asli;
            } else {
                // Rumus mundur: Harga Akhir / (Faktor Diskon)
                hargaNormalVal = i.harga_satuan / ((100 - i.diskon_persen) / 100);
            }
            
            infoHarga = `
                <div style="margin-bottom: 2px;">${i.qty} x ${formatRupiah(i.harga_satuan)}</div>
                <div class="text-xs text-slate-500" style="line-height: 1; position: relative; display: inline-block;">
                    <span style="position: relative; display: inline-block; color: #94a3b8;">
                        ${formatRupiah(hargaNormalVal)}
                        <span style="
                            position: absolute;
                            left: 0;
                            top: 45%; 
                            width: 100%;
                            height: 1.5px;
                            background-color: #475569;
                            content: '';
                            display: block;">
                        </span>
                    </span>
                    <span class="italic ml-1 font-medium text-slate-600">(Disc ${i.diskon_persen}%)</span>
                </div>
            `;
        }

        return `<tr class="border-b border-dashed border-slate-300 dark:border-slate-600">
                    <td class="pt-1 font-medium" colspan="2" style="line-height: 1.2; vertical-align: bottom;">
                        ${escapeHtml(i.nama)}
                    </td>
                </tr>
                <tr>
                    <td class="pl-2 pb-2 text-slate-700 dark:text-slate-300" style="width:60%; line-height: 1.2; vertical-align: top;">
                        ${infoHarga}
                    </td>
                    <td class="text-right font-medium pb-2" colspan="2" style="line-height: 1.2; vertical-align: top;">
                        ${formatRupiah(tot)}
                    </td>
                </tr>`;
    }).join('');
    
    receiptTotalEl.textContent = formatRupiah(sum);
    receiptModal.classList.remove('hidden');
    hideLoading();
}

window.reprintReceipt = function(data, date, buyer) {
    showReceiptModal(Array.isArray(data) ? data : [data], date, buyer);
}

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
        
        // [BARU]
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
