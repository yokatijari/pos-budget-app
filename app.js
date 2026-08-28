/**
 * app.js - Frontend Logic & Dual Storage Engine (API + LocalStorage / GitHub Pages)
 * PosBudget: Envelope Budgeting Web App
 */

// Application State
const state = {
    currentTab: 'dashboard',
    activePeriodId: null,
    dashboardData: null,
    periods: [],
    expenses: [],
    incomes: [],
    envelopes: [],
    chartInstance: null,
    selectedArchivePeriodId: null,
    isLocalMode: false // True if running without backend server (e.g. GitHub Pages / Static Hosting)
};

// ==========================================
// UTILITY & FORMATTER FUNCTIONS
// ==========================================

function formatRupiah(number) {
    if (number === null || number === undefined || isNaN(number)) return "Rp 0";
    return "Rp " + Math.round(number).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function parseRupiah(str) {
    if (typeof str === 'number') return str;
    if (!str) return 0;
    const clean = str.toString().replace(/[^0-9]/g, '');
    return parseFloat(clean) || 0;
}

function formatCurrencyInput(input) {
    const rawVal = parseRupiah(input.value);
    if (rawVal === 0) {
        input.value = "";
    } else {
        input.value = rawVal.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    }
}

function formatDateIndo(dateStr) {
    if (!dateStr) return "-";
    try {
        const parts = dateStr.split('-');
        if (parts.length === 3) {
            const months = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
            const year = parts[0];
            const monthIdx = parseInt(parts[1], 10) - 1;
            const day = parseInt(parts[2], 10);
            return `${day} ${months[monthIdx]} ${year}`;
        }
        return dateStr;
    } catch (e) {
        return dateStr;
    }
}

function getTodayString() {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// Toast Notifications
function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    const bgClass = type === 'success' ? 'bg-emerald-600' : (type === 'error' ? 'bg-rose-600' : 'bg-slate-900');
    
    toast.className = `${bgClass} text-white text-xs font-semibold px-4 py-3 rounded-xl shadow-lg flex items-center space-x-2 pointer-events-auto transform transition-all duration-300 translate-y-2 opacity-0`;
    toast.innerHTML = `<span>${message}</span>`;
    
    container.appendChild(toast);
    setTimeout(() => {
        toast.classList.remove('translate-y-2', 'opacity-0');
    }, 10);

    setTimeout(() => {
        toast.classList.add('translate-y-2', 'opacity-0');
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

// ==========================================
// LOCAL STORAGE ADAPTER (OFFLINE / GITHUB PAGES)
// ==========================================

const LocalDB = {
    KEYS: {
        PERIODS: 'pos_periods',
        INCOMES: 'pos_incomes',
        ENVELOPES: 'pos_envelopes',
        EXPENSES: 'pos_expenses'
    },

    get(key) {
        try {
            return JSON.parse(localStorage.getItem(key)) || [];
        } catch (e) {
            return [];
        }
    },

    set(key, data) {
        localStorage.setItem(key, JSON.stringify(data));
    },

    initSample() {
        if (this.get(this.KEYS.PERIODS).length === 0) {
            const today = new Date();
            const startStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
            const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
            const endStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${lastDay}`;
            const periodName = `Periode ${today.toLocaleString('id-ID', { month: 'long', year: 'numeric' })}`;

            const samplePeriod = {
                id: 1,
                nama: periodName,
                start_date: startStr,
                end_date: endStr,
                status: 'aktif',
                catatan: 'Periode awal envelope budgeting'
            };
            this.set(this.KEYS.PERIODS, [samplePeriod]);

            const sampleIncome = {
                id: 1,
                periode_id: 1,
                nominal: 6500000,
                sumber: 'Gaji Bulanan',
                tanggal: startStr,
                catatan: 'Gaji pokok bulanan'
            };
            this.set(this.KEYS.INCOMES, [sampleIncome]);

            const envelopes = [
                { id: 1, periode_id: 1, nama_pos: 'Makan & Minum', nominal_alokasi: 2000000, icon: 'utensils', color: '#10B981' },
                { id: 2, periode_id: 1, nama_pos: 'Transportasi & Bensin', nominal_alokasi: 500000, icon: 'car', color: '#3B82F6' },
                { id: 3, periode_id: 1, nama_pos: 'Tabungan & Investasi', nominal_alokasi: 1000000, icon: 'piggy-bank', color: '#8B5CF6' },
                { id: 4, periode_id: 1, nama_pos: 'Tagihan & Listrik', nominal_alokasi: 800000, icon: 'zap', color: '#F59E0B' },
                { id: 5, periode_id: 1, nama_pos: 'Belanja Kebutuhan Rumah', nominal_alokasi: 700000, icon: 'shopping-bag', color: '#EC4899' },
                { id: 6, periode_id: 1, nama_pos: 'Hiburan & Healing', nominal_alokasi: 500000, icon: 'film', color: '#06B6D4' },
                { id: 7, periode_id: 1, nama_pos: 'Dana Darurat', nominal_alokasi: 500000, icon: 'shield-alert', color: '#6366F1' },
                { id: 8, periode_id: 1, nama_pos: 'Sedekah & Sosial', nominal_alokasi: 500000, icon: 'heart', color: '#14B8A6' },
            ];
            this.set(this.KEYS.ENVELOPES, envelopes);

            const sampleExpenses = [
                { id: 1, pos_id: 1, nominal: 150000, keterangan: 'Belanja mingguan pasar & sayur', tanggal: startStr },
                { id: 2, pos_id: 1, nominal: 35000, keterangan: 'Makan siang kantor', tanggal: startStr },
                { id: 3, pos_id: 2, nominal: 100000, keterangan: 'Isi bensin motor & e-toll', tanggal: startStr }
            ];
            this.set(this.KEYS.EXPENSES, sampleExpenses);
        }
    },

    getStatusColor(sisa, alokasi) {
        if (alokasi <= 0) return sisa <= 0 ? 'merah' : 'hijau';
        const pct = (sisa / alokasi) * 100.0;
        if (pct > 30.0) return 'hijau';
        if (pct >= 10.0) return 'kuning';
        return 'merah';
    },

    getDashboardSummary(periodId = null) {
        this.initSample();
        const periods = this.get(this.KEYS.PERIODS);
        const period = periodId 
            ? periods.find(p => p.id == periodId)
            : periods.find(p => p.status === 'aktif') || periods[0];

        if (!period) {
            return { has_active_period: false, period: null, summary: null, envelopes: [], recent_expenses: [], incomes: [] };
        }

        const allIncomes = this.get(this.KEYS.INCOMES).filter(i => i.periode_id == period.id);
        const allEnvelopes = this.get(this.KEYS.ENVELOPES).filter(e => e.periode_id == period.id);
        const allExpenses = this.get(this.KEYS.EXPENSES);

        const envelopes = allEnvelopes.map(env => {
            const posExpenses = allExpenses.filter(x => x.pos_id == env.id);
            const totalSpent = posExpenses.reduce((sum, x) => sum + x.nominal, 0);
            const sisa = env.nominal_alokasi - totalSpent;
            const pctSpent = env.nominal_alokasi > 0 ? (totalSpent / env.nominal_alokasi) * 100 : 0;
            const pctRemaining = env.nominal_alokasi > 0 ? (sisa / env.nominal_alokasi) * 100 : 0;

            return {
                ...env,
                total_pengeluaran: totalSpent,
                jumlah_transaksi: posExpenses.length,
                sisa_saldo: sisa,
                persentase_terpakai: Math.round(pctSpent * 10) / 10,
                persentase_sisa: Math.round(pctRemaining * 10) / 10,
                status_warna: this.getStatusColor(sisa, env.nominal_alokasi)
            };
        });

        const periodExpenses = [];
        allExpenses.forEach(x => {
            const env = allEnvelopes.find(e => e.id == x.pos_id);
            if (env) {
                periodExpenses.push({
                    ...x,
                    nama_pos: env.nama_pos,
                    pos_icon: env.icon,
                    pos_color: env.color
                });
            }
        });
        periodExpenses.sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal) || b.id - a.id);

        const totalPemasukan = allIncomes.reduce((sum, i) => sum + i.nominal, 0);
        const totalAlokasi = envelopes.reduce((sum, e) => sum + e.nominal_alokasi, 0);
        const totalPengeluaran = envelopes.reduce((sum, e) => sum + e.total_pengeluaran, 0);
        const belumDialokasikan = totalPemasukan - totalAlokasi;
        const sisaAnggaran = totalPemasukan - totalPengeluaran;

        const today = new Date();
        const endD = new Date(period.end_date);
        const startD = new Date(period.start_date);
        const diffTime = endD - today;
        const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        const overallPct = totalAlokasi > 0 ? Math.round((totalPengeluaran / totalAlokasi) * 1000) / 10 : 0;
        const posWarningCount = envelopes.filter(e => e.status_warna === 'kuning' || e.status_warna === 'merah').length;

        return {
            has_active_period: true,
            period: period,
            summary: {
                total_pemasukan: totalPemasukan,
                total_alokasi: totalAlokasi,
                belum_dialokasikan: belumDialokasikan,
                total_pengeluaran: totalPengeluaran,
                sisa_anggaran_keseluruhan: sisaAnggaran,
                overall_progress_pct: overallPct,
                days_left: daysLeft,
                pos_warning_count: posWarningCount,
                total_pos: envelopes.length
            },
            envelopes: envelopes,
            recent_expenses: periodExpenses.slice(0, 10),
            incomes: allIncomes
        };
    }
};

// ==========================================
// EXPORT & IMPORT DATA BACKUP
// ==========================================

function exportDataBackup() {
    LocalDB.initSample();
    const backupData = {
        app: 'PosBudget',
        version: '1.0',
        export_date: new Date().toISOString(),
        periods: LocalDB.get(LocalDB.KEYS.PERIODS),
        incomes: LocalDB.get(LocalDB.KEYS.INCOMES),
        envelopes: LocalDB.get(LocalDB.KEYS.ENVELOPES),
        expenses: LocalDB.get(LocalDB.KEYS.EXPENSES)
    };

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupData, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `posbudget_backup_${getTodayString()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();

    showToast("File backup berhasil diunduh!");
}

function importDataBackup() {
    const fileInput = document.getElementById('import-file-input');
    if (!fileInput.files || fileInput.files.length === 0) {
        showToast("Pilih file backup (.json) terlebih dahulu", "error");
        return;
    }

    const file = fileInput.files[0];
    const reader = new FileReader();

    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);
            if (!data.periods || !data.envelopes) {
                throw new Error("Format file backup tidak sesuai");
            }

            LocalDB.set(LocalDB.KEYS.PERIODS, data.periods || []);
            LocalDB.set(LocalDB.KEYS.INCOMES, data.incomes || []);
            LocalDB.set(LocalDB.KEYS.ENVELOPES, data.envelopes || []);
            LocalDB.set(LocalDB.KEYS.EXPENSES, data.expenses || []);

            showToast("Data backup berhasil dipulihkan!");
            closeModal('modal-backup-settings');
            loadDashboard();
        } catch (err) {
            showToast("Gagal membaca file: " + err.message, "error");
        }
    };

    reader.readAsText(file);
}

// ==========================================
// MODAL MANAGEMENT
// ==========================================

function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    
    if (modalId === 'modal-add-expense') {
        document.getElementById('expense-date').value = getTodayString();
        populateExpensePosDropdown();
        document.getElementById('expense-nominal-input').value = '';
        document.getElementById('expense-keterangan').value = '';
        document.getElementById('expense-pos-balance-info').classList.add('hidden');
        document.getElementById('expense-live-preview').innerHTML = '';
    } else if (modalId === 'modal-add-income') {
        document.getElementById('income-date').value = getTodayString();
        document.getElementById('income-source').value = '';
        document.getElementById('income-nominal-input').value = '';
        document.getElementById('income-notes').value = '';
    } else if (modalId === 'modal-add-envelope') {
        document.getElementById('envelope-edit-id').value = '';
        document.getElementById('envelope-name').value = '';
        document.getElementById('envelope-nominal-input').value = '';
        document.getElementById('envelope-modal-title').querySelector('span').innerText = 'Tambah Pos Deposit Baru';
        updateEnvelopeAllocPreview();
    } else if (modalId === 'modal-new-period') {
        const today = new Date();
        const startStr = getTodayString();
        const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        document.getElementById('period-start-date').value = startStr;
        document.getElementById('period-end-date').value = nextMonth.toISOString().split('T')[0];
        document.getElementById('period-name-input').value = `Periode ${today.toLocaleString('id-ID', { month: 'long', year: 'numeric' })}`;
        populateCopyPosDropdown();
    }

    modal.classList.remove('modal-hidden');
    lucide.createIcons();
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    modal.classList.add('modal-hidden');
}

window.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-backdrop')) {
        e.target.classList.add('modal-hidden');
    }
});

// ==========================================
// TAB NAVIGATION
// ==========================================

function switchTab(tabId) {
    state.currentTab = tabId;

    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
    const activeSection = document.getElementById(`tab-${tabId}`);
    if (activeSection) activeSection.classList.remove('hidden');

    document.querySelectorAll('.tab-nav-btn').forEach(btn => {
        btn.classList.remove('bg-white', 'text-indigo-600', 'shadow-sm');
        btn.classList.add('text-slate-600');
    });
    const activeNavBtn = document.getElementById(`nav-btn-${tabId}`);
    if (activeNavBtn) {
        activeNavBtn.classList.add('bg-white', 'text-indigo-600', 'shadow-sm');
        activeNavBtn.classList.remove('text-slate-600');
    }

    document.querySelectorAll('.mobile-nav-btn').forEach(btn => {
        btn.classList.remove('text-indigo-600');
        btn.classList.add('text-slate-400');
    });
    const activeMobileBtn = document.getElementById(`mobile-nav-${tabId}`);
    if (activeMobileBtn) {
        activeMobileBtn.classList.add('text-indigo-600');
        activeMobileBtn.classList.remove('text-slate-400');
    }

    if (tabId === 'history') {
        loadPeriodsHistory();
    } else if (tabId === 'expenses') {
        loadFullExpenses();
    } else if (tabId === 'incomes') {
        renderIncomesTable();
    } else if (tabId === 'envelopes') {
        renderEnvelopesManagement();
    }

    lucide.createIcons();
}

// ==========================================
// API / DATA LOADERS
// ==========================================

async function loadDashboard() {
    try {
        let json;
        if (!state.isLocalMode) {
            try {
                const res = await fetch('/api/dashboard');
                if (!res.ok) throw new Error("API not available");
                json = await res.json();
            } catch (apiErr) {
                // Fallback to LocalStorage mode
                state.isLocalMode = true;
                json = { success: true, data: LocalDB.getDashboardSummary() };
            }
        } else {
            json = { success: true, data: LocalDB.getDashboardSummary() };
        }
        
        if (!json.success || !json.data || !json.data.has_active_period) {
            renderEmptyPeriodState();
            return;
        }

        state.dashboardData = json.data;
        state.activePeriodId = json.data.period.id;
        state.envelopes = json.data.envelopes || [];
        state.incomes = json.data.incomes || [];
        state.recentExpenses = json.data.recent_expenses || [];

        renderActivePeriodBanner(json.data.period, json.data.summary);
        renderOverviewSummary(json.data.summary);
        renderEnvelopesCards(json.data.envelopes);
        renderRecentExpenses(json.data.recent_expenses);
        renderChart(json.data.envelopes);
        
        lucide.createIcons();
    } catch (err) {
        console.error("Gagal memuat dashboard:", err);
    }
}

async function loadPeriodsHistory() {
    if (state.isLocalMode) {
        const periods = LocalDB.get(LocalDB.KEYS.PERIODS);
        const incomes = LocalDB.get(LocalDB.KEYS.INCOMES);
        const envelopes = LocalDB.get(LocalDB.KEYS.ENVELOPES);
        const expenses = LocalDB.get(LocalDB.KEYS.EXPENSES);

        state.periods = periods.map(p => {
            const pInc = incomes.filter(i => i.periode_id == p.id).reduce((sum, i) => sum + i.nominal, 0);
            const pEnv = envelopes.filter(e => e.periode_id == p.id);
            const pExp = expenses.filter(x => pEnv.some(e => e.id == x.pos_id)).reduce((sum, x) => sum + x.nominal, 0);
            return {
                ...p,
                total_pemasukan: pInc,
                total_alokasi: pEnv.reduce((sum, e) => sum + e.nominal_alokasi, 0),
                total_pengeluaran: pExp,
                sisa_saldo_keseluruhan: pInc - pExp,
                total_pos: pEnv.length,
                total_transaksi: expenses.filter(x => pEnv.some(e => e.id == x.pos_id)).length
            };
        });
        renderPeriodsHistoryList(state.periods);
        return;
    }

    try {
        const res = await fetch('/api/periods');
        const json = await res.json();
        if (json.success) {
            state.periods = json.data || [];
            renderPeriodsHistoryList(state.periods);
        }
    } catch (err) {}
}

async function loadFullExpenses() {
    if (!state.activePeriodId) return;

    if (state.isLocalMode) {
        const envelopes = LocalDB.get(LocalDB.KEYS.ENVELOPES).filter(e => e.periode_id == state.activePeriodId);
        const expenses = LocalDB.get(LocalDB.KEYS.EXPENSES);
        const list = [];
        expenses.forEach(x => {
            const env = envelopes.find(e => e.id == x.pos_id);
            if (env) {
                list.push({ ...x, nama_pos: env.nama_pos, pos_icon: env.icon, pos_color: env.color });
            }
        });
        list.sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal) || b.id - a.id);
        state.expenses = list;
        populateExpensePosFilterOptions();
        applyExpenseFilters();
        return;
    }

    try {
        const res = await fetch(`/api/expenses?period_id=${state.activePeriodId}`);
        const json = await res.json();
        if (json.success) {
            state.expenses = json.data || [];
            populateExpensePosFilterOptions();
            applyExpenseFilters();
        }
    } catch (err) {}
}

// ==========================================
// RENDERING FUNCTIONS
// ==========================================

function renderActivePeriodBanner(period, summary) {
    const banner = document.getElementById('active-period-banner');
    banner.classList.remove('hidden');

    document.getElementById('period-title').innerText = period.nama;
    document.getElementById('period-dates').innerHTML = `
        <i data-lucide="calendar" class="w-3.5 h-3.5 inline mr-1"></i>
        <span>${formatDateIndo(period.start_date)} — ${formatDateIndo(period.end_date)}</span>
    `;

    const daysLeft = summary.days_left;
    const daysLeftEl = document.getElementById('period-days-left');
    if (daysLeft < 0) {
        daysLeftEl.innerHTML = `<i data-lucide="alert-circle" class="w-3 h-3 inline mr-1"></i>Periode Berakhir (${Math.abs(daysLeft)} hari lalu)`;
        daysLeftEl.className = "text-xs text-rose-300 bg-rose-500/20 px-2.5 py-0.5 rounded-full border border-rose-500/30";
    } else if (daysLeft === 0) {
        daysLeftEl.innerHTML = `<i data-lucide="clock" class="w-3 h-3 inline mr-1"></i>Hari Terakhir`;
        daysLeftEl.className = "text-xs text-amber-300 bg-amber-500/20 px-2.5 py-0.5 rounded-full border border-amber-500/30";
    } else {
        daysLeftEl.innerHTML = `<i data-lucide="clock" class="w-3 h-3 inline mr-1"></i>${daysLeft} Hari Tersisa`;
        daysLeftEl.className = "text-xs text-slate-300 bg-white/10 px-2.5 py-0.5 rounded-full border border-white/10";
    }
}

function renderOverviewSummary(summary) {
    document.getElementById('stat-total-pemasukan').innerText = formatRupiah(summary.total_pemasukan);
    document.getElementById('stat-incomes-count').innerText = `${state.incomes.length} transaksi`;

    document.getElementById('stat-total-alokasi').innerText = formatRupiah(summary.total_alokasi);
    document.getElementById('stat-pos-count').innerText = `${summary.total_pos} pos`;

    const belumAlokasiEl = document.getElementById('stat-belum-alokasi');
    belumAlokasiEl.innerText = formatRupiah(summary.belum_dialokasikan);
    const statusAlokasiEl = document.getElementById('stat-alokasi-status-text');

    if (summary.belum_dialokasikan > 0) {
        belumAlokasiEl.className = "text-lg sm:text-2xl font-black text-amber-600";
        statusAlokasiEl.innerText = "Belum teralokasi ke pos deposit";
    } else if (summary.belum_dialokasikan === 0 && summary.total_pemasukan > 0) {
        belumAlokasiEl.className = "text-lg sm:text-2xl font-black text-emerald-600";
        statusAlokasiEl.innerText = "100% Pemasukan telah dialokasikan";
    } else {
        belumAlokasiEl.className = "text-lg sm:text-2xl font-black text-slate-400";
        statusAlokasiEl.innerText = "Belum ada pemasukan tercatat";
    }

    document.getElementById('stat-total-pengeluaran').innerText = formatRupiah(summary.total_pengeluaran);
    document.getElementById('stat-sisa-total').innerText = formatRupiah(summary.sisa_anggaran_keseluruhan);

    const pct = summary.overall_progress_pct;
    document.getElementById('overall-percentage').innerText = `${pct}%`;
    const progressBar = document.getElementById('overall-progress-bar');
    progressBar.style.width = `${Math.min(pct, 100)}%`;

    if (pct >= 90) {
        progressBar.className = "progress-bar-fill h-full rounded-full bg-rose-500";
    } else if (pct >= 70) {
        progressBar.className = "progress-bar-fill h-full rounded-full bg-amber-500";
    } else {
        progressBar.className = "progress-bar-fill h-full rounded-full bg-gradient-to-r from-emerald-500 to-indigo-600";
    }

    const warningBanner = document.getElementById('pos-warning-banner');
    if (summary.pos_warning_count > 0) {
        warningBanner.classList.remove('hidden');
        document.getElementById('pos-warning-message').innerText = 
            `Ada ${summary.pos_warning_count} pos deposit dengan saldo di bawah 30% atau mendekati habis.`;
    } else {
        warningBanner.classList.add('hidden');
    }
}

function renderEnvelopesCards(envelopes) {
    const container = document.getElementById('envelopes-cards-grid');
    if (!envelopes || envelopes.length === 0) {
        container.innerHTML = `
            <div class="col-span-full bg-white p-8 rounded-2xl border border-slate-200 text-center text-slate-400">
                <i data-lucide="layers" class="w-10 h-10 mx-auto mb-2 opacity-40"></i>
                <p class="text-sm font-semibold">Belum ada pos deposit dibuat.</p>
                <button onclick="openModal('modal-add-envelope')" class="mt-3 bg-indigo-600 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-sm">
                    Buat Pos Deposit Pertama
                </button>
            </div>
        `;
        return;
    }

    container.innerHTML = envelopes.map(pos => {
        const badgeColorClass = pos.status_warna === 'hijau' 
            ? 'badge-status-hijau' 
            : (pos.status_warna === 'kuning' ? 'badge-status-kuning' : 'badge-status-merah');
        
        const badgeLabel = pos.status_warna === 'hijau'
            ? 'Aman'
            : (pos.status_warna === 'kuning' ? 'Waspada' : (pos.sisa_saldo <= 0 ? 'Habis' : 'Kritis'));

        const barColor = pos.status_warna === 'hijau' 
            ? 'bg-emerald-500' 
            : (pos.status_warna === 'kuning' ? 'bg-amber-500' : 'bg-rose-500');

        return `
            <div class="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-card shadow-card-hover flex flex-col justify-between">
                <div>
                    <div class="flex items-start justify-between gap-2 mb-3">
                        <div class="flex items-center space-x-3">
                            <div class="w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-sm" style="background-color: ${pos.color || '#4F46E5'}">
                                <i data-lucide="${pos.icon || 'wallet'}" class="w-5 h-5"></i>
                            </div>
                            <div>
                                <h4 class="font-extrabold text-slate-900 text-sm leading-tight">${pos.nama_pos}</h4>
                                <span class="text-[11px] text-slate-400">Alokasi: ${formatRupiah(pos.nominal_alokasi)}</span>
                            </div>
                        </div>
                        <span class="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full ${badgeColorClass} uppercase tracking-wider">
                            ${badgeLabel}
                        </span>
                    </div>

                    <div class="my-3">
                        <div class="flex justify-between text-[11px] font-semibold text-slate-600 mb-1">
                            <span>Terpakai: ${pos.persentase_terpakai}%</span>
                            <span>Sisa: ${pos.persentase_sisa}%</span>
                        </div>
                        <div class="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden p-0.5 border border-slate-200">
                            <div class="progress-bar-fill h-full rounded-full ${barColor}" style="width: ${Math.min(pos.persentase_terpakai, 100)}%"></div>
                        </div>
                    </div>

                    <div class="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-xs">
                        <div>
                            <div class="text-[10px] text-slate-400 uppercase font-semibold">Terpakai</div>
                            <div class="font-bold text-slate-700">${formatRupiah(pos.total_pengeluaran)}</div>
                        </div>
                        <div class="text-right">
                            <div class="text-[10px] text-slate-400 uppercase font-semibold">Sisa Saldo</div>
                            <div class="font-extrabold ${pos.status_warna === 'merah' ? 'text-rose-600' : 'text-slate-900'}">${formatRupiah(pos.sisa_saldo)}</div>
                        </div>
                    </div>
                </div>

                <div class="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                    <span class="text-[11px] text-slate-400">${pos.jumlah_transaksi} Transaksi</span>
                    <button onclick="quickExpenseForPos(${pos.id})" class="text-xs font-bold text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 px-2.5 py-1.5 rounded-lg transition-all flex items-center gap-1">
                        <i data-lucide="plus" class="w-3.5 h-3.5"></i>
                        <span>Pakai Saldo</span>
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

function renderRecentExpenses(expenses) {
    const container = document.getElementById('recent-expenses-list');
    if (!expenses || expenses.length === 0) {
        container.innerHTML = `
            <div class="p-8 text-center text-slate-400 text-xs">
                <i data-lucide="receipt" class="w-8 h-8 mx-auto mb-1 opacity-40"></i>
                <p>Belum ada transaksi pengeluaran tercatat.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = expenses.map(exp => `
        <div class="py-3 flex items-center justify-between gap-3 text-xs sm:text-sm">
            <div class="flex items-center space-x-3 min-w-0">
                <div class="w-8 h-8 rounded-lg flex items-center justify-center text-white shrink-0" style="background-color: ${exp.pos_color || '#4F46E5'}">
                    <i data-lucide="${exp.pos_icon || 'receipt'}" class="w-4 h-4"></i>
                </div>
                <div class="min-w-0">
                    <div class="font-bold text-slate-900 truncate">${exp.keterangan}</div>
                    <div class="text-[11px] text-slate-400 flex items-center gap-1.5">
                        <span class="font-medium text-slate-600">${exp.nama_pos}</span>
                        <span>&bull;</span>
                        <span>${formatDateIndo(exp.tanggal)}</span>
                    </div>
                </div>
            </div>
            <div class="text-right shrink-0">
                <div class="font-extrabold text-rose-600">-${formatRupiah(exp.nominal)}</div>
                <button onclick="confirmDeleteExpense(${exp.id})" title="Hapus Pengeluaran" class="text-[10px] text-slate-400 hover:text-rose-600 transition-colors">
                    Hapus
                </button>
            </div>
        </div>
    `).join('');
}

function renderChart(envelopes) {
    const ctx = document.getElementById('envelopesChart');
    if (!ctx) return;

    if (state.chartInstance) {
        state.chartInstance.destroy();
    }

    if (!envelopes || envelopes.length === 0) return;

    const labels = envelopes.map(e => e.nama_pos);
    const dataAlokasi = envelopes.map(e => e.nominal_alokasi);
    const backgroundColors = envelopes.map(e => e.color || '#4F46E5');

    state.chartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: dataAlokasi,
                backgroundColor: backgroundColors,
                borderWidth: 2,
                borderColor: '#ffffff',
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const val = context.raw || 0;
                            return ` ${context.label}: ${formatRupiah(val)}`;
                        }
                    }
                }
            },
            cutout: '70%'
        }
    });
}

function renderEmptyPeriodState() {
    const banner = document.getElementById('active-period-banner');
    banner.classList.add('hidden');

    const container = document.getElementById('tab-dashboard');
    container.innerHTML = `
        <div class="bg-white p-12 rounded-3xl border border-slate-200 text-center max-w-lg mx-auto shadow-card">
            <div class="w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-4">
                <i data-lucide="calendar-plus" class="w-8 h-8"></i>
            </div>
            <h3 class="text-xl font-black text-slate-900 mb-2">Belum Ada Periode Aktif</h3>
            <p class="text-xs sm:text-sm text-slate-500 mb-6 leading-relaxed">
                Mulai siklus keuangan Anda dengan membuat periode baru (misal: 1 bulan anggaran) dan catat pemasukan Anda.
            </p>
            <button onclick="openModal('modal-new-period')" class="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm px-6 py-3 rounded-xl shadow-md transition-all inline-flex items-center space-x-2">
                <i data-lucide="plus" class="w-4 h-4"></i>
                <span>Buat Periode Baru Sekarang</span>
            </button>
        </div>
    `;
    lucide.createIcons();
}

// ==========================================
// TAB 2: ALOKASI POS LOGIC
// ==========================================

function renderEnvelopesManagement() {
    if (!state.dashboardData) return;
    const summary = state.dashboardData.summary;
    const envelopes = state.envelopes;

    document.getElementById('alloc-banner-total-income').innerText = formatRupiah(summary.total_pemasukan);
    document.getElementById('alloc-banner-total-allocated').innerText = formatRupiah(summary.total_alokasi);
    document.getElementById('alloc-banner-unallocated').innerText = formatRupiah(summary.belum_dialokasikan);
    document.getElementById('envelopes-table-count').innerText = `${envelopes.length} Pos Deposit`;

    const unallocBox = document.getElementById('alloc-banner-unallocated-box');
    if (summary.belum_dialokasikan > 0) {
        unallocBox.className = "bg-amber-50 border border-amber-200 p-4 rounded-2xl";
        unallocBox.querySelector('.text-xs').className = "text-xs text-amber-700 font-semibold uppercase";
        document.getElementById('alloc-banner-unallocated').className = "text-xl font-black text-amber-700 mt-1";
    } else {
        unallocBox.className = "bg-emerald-50 border border-emerald-200 p-4 rounded-2xl";
        unallocBox.querySelector('.text-xs').className = "text-xs text-emerald-700 font-semibold uppercase";
        document.getElementById('alloc-banner-unallocated').className = "text-xl font-black text-emerald-700 mt-1";
    }

    const tbody = document.getElementById('envelopes-table-body');
    if (!envelopes || envelopes.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="p-8 text-center text-slate-400">Belum ada pos deposit dibuat.</td></tr>`;
        return;
    }

    tbody.innerHTML = envelopes.map(pos => {
        const badgeColorClass = pos.status_warna === 'hijau' 
            ? 'badge-status-hijau' 
            : (pos.status_warna === 'kuning' ? 'badge-status-kuning' : 'badge-status-merah');
        
        const badgeLabel = pos.status_warna === 'hijau' ? 'Aman' : (pos.status_warna === 'kuning' ? 'Waspada' : 'Kritis');

        return `
            <tr class="hover:bg-slate-50/80 transition-colors">
                <td class="py-3 px-4 font-bold text-slate-900 flex items-center space-x-2">
                    <div class="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs" style="background-color: ${pos.color || '#4F46E5'}">
                        <i data-lucide="${pos.icon || 'wallet'}" class="w-3.5 h-3.5"></i>
                    </div>
                    <span>${pos.nama_pos}</span>
                </td>
                <td class="py-3 px-4 font-bold text-slate-800">${formatRupiah(pos.nominal_alokasi)}</td>
                <td class="py-3 px-4 text-slate-600">${formatRupiah(pos.total_pengeluaran)}</td>
                <td class="py-3 px-4 font-extrabold ${pos.status_warna === 'merah' ? 'text-rose-600' : 'text-slate-900'}">${formatRupiah(pos.sisa_saldo)}</td>
                <td class="py-3 px-4">
                    <div class="flex items-center space-x-2">
                        <span class="text-[10px] font-bold px-2 py-0.5 rounded-full ${badgeColorClass}">${badgeLabel}</span>
                        <span class="text-[11px] text-slate-500 font-medium">${pos.persentase_terpakai}%</span>
                    </div>
                </td>
                <td class="py-3 px-4 text-center">
                    <div class="flex items-center justify-center space-x-1">
                        <button onclick="editEnvelope(${pos.id})" title="Edit Pos" class="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all">
                            <i data-lucide="edit-3" class="w-4 h-4"></i>
                        </button>
                        <button onclick="confirmDeleteEnvelope(${pos.id})" title="Hapus Pos" class="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all">
                            <i data-lucide="trash-2" class="w-4 h-4"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
    lucide.createIcons();
}

function updateEnvelopeAllocPreview() {
    if (!state.dashboardData) return;
    const summary = state.dashboardData.summary;
    const editId = document.getElementById('envelope-edit-id').value;
    
    let available = summary.belum_dialokasikan;
    if (editId) {
        const existingPos = state.envelopes.find(e => e.id == editId);
        if (existingPos) {
            available += existingPos.nominal_alokasi;
        }
    }

    document.getElementById('envelope-available-alloc').innerText = formatRupiah(available);
}

function checkEnvelopeAllocationLimit() {
    if (!state.dashboardData) return;
    const nominal = parseRupiah(document.getElementById('envelope-nominal-input').value);
    const summary = state.dashboardData.summary;
    const editId = document.getElementById('envelope-edit-id').value;
    
    let available = summary.belum_dialokasikan;
    if (editId) {
        const existingPos = state.envelopes.find(e => e.id == editId);
        if (existingPos) {
            available += existingPos.nominal_alokasi;
        }
    }

    const previewEl = document.getElementById('envelope-available-alloc');
    if (nominal > available) {
        previewEl.innerText = `${formatRupiah(available)} (Melebihi sisa!)`;
        previewEl.className = "font-bold text-rose-600";
    } else {
        previewEl.innerText = formatRupiah(available - nominal) + " tersisa setelah pos ini";
        previewEl.className = "font-bold text-emerald-600";
    }
}

// ==========================================
// TAB 3: PENGELUARAN LOGIC
// ==========================================

function populateExpensePosFilterOptions() {
    const select = document.getElementById('filter-expense-pos');
    select.innerHTML = '<option value="">Semua Pos</option>' + 
        state.envelopes.map(e => `<option value="${e.id}">${e.nama_pos}</option>`).join('');
}

function applyExpenseFilters() {
    const searchQuery = (document.getElementById('filter-expense-search').value || '').toLowerCase();
    const posFilter = document.getElementById('filter-expense-pos').value;

    let filtered = state.expenses;
    if (posFilter) {
        filtered = filtered.filter(e => e.pos_id == posFilter);
    }
    if (searchQuery) {
        filtered = filtered.filter(e => e.keterangan.toLowerCase().includes(searchQuery) || e.nama_pos.toLowerCase().includes(searchQuery));
    }

    const tbody = document.getElementById('expenses-full-table-body');
    const emptyState = document.getElementById('expenses-empty-state');

    if (filtered.length === 0) {
        tbody.innerHTML = '';
        emptyState.classList.remove('hidden');
        return;
    }

    emptyState.classList.add('hidden');
    tbody.innerHTML = filtered.map(exp => `
        <tr class="hover:bg-slate-50/80 transition-colors">
            <td class="py-3 px-4 text-slate-500 font-medium whitespace-nowrap">${formatDateIndo(exp.tanggal)}</td>
            <td class="py-3 px-4 font-bold text-slate-800">
                <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold" style="background-color: ${exp.pos_color}15; color: ${exp.pos_color};">
                    <i data-lucide="${exp.pos_icon || 'wallet'}" class="w-3.5 h-3.5"></i>
                    ${exp.nama_pos}
                </span>
            </td>
            <td class="py-3 px-4 font-semibold text-slate-900">${exp.keterangan}</td>
            <td class="py-3 px-4 text-right font-black text-rose-600 whitespace-nowrap">-${formatRupiah(exp.nominal)}</td>
            <td class="py-3 px-4 text-center whitespace-nowrap">
                <button onclick="confirmDeleteExpense(${exp.id})" title="Hapus Transaksi" class="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all">
                    <i data-lucide="trash-2" class="w-4 h-4"></i>
                </button>
            </td>
        </tr>
    `).join('');
    lucide.createIcons();
}

// ==========================================
// TAB 4: PEMASUKAN LOGIC
// ==========================================

function renderIncomesTable() {
    const tbody = document.getElementById('incomes-table-body');
    const totalEl = document.getElementById('incomes-table-total');
    const total = state.incomes.reduce((acc, i) => acc + i.nominal, 0);
    totalEl.innerText = `Total: ${formatRupiah(total)}`;

    if (!state.incomes || state.incomes.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="p-8 text-center text-slate-400">Belum ada pemasukan dicatat pada periode ini.</td></tr>`;
        return;
    }

    tbody.innerHTML = state.incomes.map(inc => `
        <tr class="hover:bg-slate-50/80 transition-colors">
            <td class="py-3 px-4 text-slate-500 font-medium whitespace-nowrap">${formatDateIndo(inc.tanggal)}</td>
            <td class="py-3 px-4 font-extrabold text-slate-900">${inc.sumber}</td>
            <td class="py-3 px-4 text-slate-500">${inc.catatan || '-'}</td>
            <td class="py-3 px-4 text-right font-black text-emerald-600 whitespace-nowrap">+${formatRupiah(inc.nominal)}</td>
            <td class="py-3 px-4 text-center whitespace-nowrap">
                <button onclick="confirmDeleteIncome(${inc.id})" title="Hapus Pemasukan" class="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all">
                    <i data-lucide="trash-2" class="w-4 h-4"></i>
                </button>
            </td>
        </tr>
    `).join('');
    lucide.createIcons();
}

// ==========================================
// TAB 5: RIWAYAT PERIODE LOGIC
// ==========================================

function renderPeriodsHistoryList(periods) {
    const container = document.getElementById('periods-history-list');
    if (!periods || periods.length === 0) {
        container.innerHTML = `<div class="col-span-full bg-white p-8 rounded-2xl border border-slate-200 text-center text-slate-400"><p>Belum ada riwayat periode anggaran.</p></div>`;
        return;
    }

    container.innerHTML = periods.map(p => {
        const isCurrent = p.status === 'aktif';
        return `
            <div class="bg-white p-5 rounded-2xl border ${isCurrent ? 'border-indigo-500 shadow-md ring-1 ring-indigo-500/30' : 'border-slate-200/80'} shadow-card flex flex-col justify-between">
                <div>
                    <div class="flex items-center justify-between mb-2">
                        <span class="text-xs font-bold px-2.5 py-0.5 rounded-full ${isCurrent ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'} uppercase">
                            ${p.status}
                        </span>
                        <span class="text-xs text-slate-400">${formatDateIndo(p.start_date)} — ${formatDateIndo(p.end_date)}</span>
                    </div>
                    <h4 class="font-extrabold text-slate-900 text-base mb-1">${p.nama}</h4>
                    <p class="text-xs text-slate-500 mb-4">${p.catatan || 'Tidak ada catatan'}</p>

                    <div class="grid grid-cols-3 gap-2 bg-slate-50 p-3 rounded-xl text-center text-xs mb-3">
                        <div>
                            <div class="text-[10px] text-slate-400 font-semibold">Pemasukan</div>
                            <div class="font-bold text-emerald-600">${formatRupiah(p.total_pemasukan)}</div>
                        </div>
                        <div>
                            <div class="text-[10px] text-slate-400 font-semibold">Pengeluaran</div>
                            <div class="font-bold text-rose-600">${formatRupiah(p.total_pengeluaran)}</div>
                        </div>
                        <div>
                            <div class="text-[10px] text-slate-400 font-semibold">Sisa Akhir</div>
                            <div class="font-black text-slate-800">${formatRupiah(p.sisa_saldo_keseluruhan)}</div>
                        </div>
                    </div>
                </div>

                <div class="pt-3 border-t border-slate-100 flex items-center justify-between">
                    <span class="text-xs text-slate-400">${p.total_pos} Pos &bull; ${p.total_transaksi} Transaksi</span>
                    <button onclick="viewPeriodDetail(${p.id})" class="text-xs font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 px-3 py-1.5 rounded-lg transition-all flex items-center gap-1">
                        <i data-lucide="eye" class="w-3.5 h-3.5"></i>
                        <span>Lihat Detail</span>
                    </button>
                </div>
            </div>
        `;
    }).join('');
    lucide.createIcons();
}

async function viewPeriodDetail(periodId) {
    state.selectedArchivePeriodId = periodId;
    let data;
    if (state.isLocalMode) {
        data = LocalDB.getDashboardSummary(periodId);
    } else {
        const res = await fetch(`/api/periods/${periodId}`);
        const json = await res.json();
        data = json.data;
    }

    if (!data) return;
    const period = data.period;
    const summary = data.summary;
    const envelopes = data.envelopes;
    const expenses = data.recent_expenses;

    document.getElementById('archive-detail-title').innerText = period.nama;
    document.getElementById('archive-detail-dates').innerText = `${formatDateIndo(period.start_date)} — ${formatDateIndo(period.end_date)} (${period.status.toUpperCase()})`;

    document.getElementById('archive-metric-income').innerText = formatRupiah(summary.total_pemasukan);
    document.getElementById('archive-metric-spent').innerText = formatRupiah(summary.total_pengeluaran);
    document.getElementById('archive-metric-balance').innerText = formatRupiah(summary.sisa_anggaran_keseluruhan);

    const envList = document.getElementById('archive-envelopes-list');
    envList.innerHTML = envelopes.map(e => `
        <div class="p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between text-xs">
            <div class="flex items-center space-x-2">
                <div class="w-6 h-6 rounded-lg flex items-center justify-center text-white text-[10px]" style="background-color: ${e.color || '#4F46E5'}">
                    <i data-lucide="${e.icon || 'wallet'}" class="w-3 h-3"></i>
                </div>
                <div>
                    <div class="font-bold text-slate-800">${e.nama_pos}</div>
                    <div class="text-[10px] text-slate-400">Alokasi: ${formatRupiah(e.nominal_alokasi)}</div>
                </div>
            </div>
            <div class="text-right">
                <div class="font-bold text-slate-700">Terpakai: ${formatRupiah(e.total_pengeluaran)}</div>
                <div class="text-[10px] font-semibold text-slate-500">Sisa: ${formatRupiah(e.sisa_saldo)}</div>
            </div>
        </div>
    `).join('');

    const expList = document.getElementById('archive-expenses-list');
    if (!expenses || expenses.length === 0) {
        expList.innerHTML = '<div class="p-3 text-center text-slate-400 text-xs">Tidak ada catatan pengeluaran.</div>';
    } else {
        expList.innerHTML = expenses.map(exp => `
            <div class="py-2 flex items-center justify-between text-xs">
                <div>
                    <div class="font-bold text-slate-800">${exp.keterangan}</div>
                    <div class="text-[10px] text-slate-400">${exp.nama_pos} &bull; ${formatDateIndo(exp.tanggal)}</div>
                </div>
                <div class="font-bold text-rose-600">-${formatRupiah(exp.nominal)}</div>
            </div>
        `).join('');
    }

    const activateBtn = document.getElementById('btn-activate-archive-period');
    if (period.status === 'aktif') {
        activateBtn.classList.add('hidden');
    } else {
        activateBtn.classList.remove('hidden');
    }

    openModal('modal-period-detail');
    lucide.createIcons();
}

async function activateArchivePeriod() {
    if (!state.selectedArchivePeriodId) return;

    if (state.isLocalMode) {
        const periods = LocalDB.get(LocalDB.KEYS.PERIODS);
        periods.forEach(p => {
            if (p.id == state.selectedArchivePeriodId) p.status = 'aktif';
            else if (p.status === 'aktif') p.status = 'selesai';
        });
        LocalDB.set(LocalDB.KEYS.PERIODS, periods);
        showToast("Periode berhasil diaktifkan kembali");
        closeModal('modal-period-detail');
        await loadDashboard();
        switchTab('dashboard');
        return;
    }

    try {
        const res = await fetch(`/api/periods/${state.selectedArchivePeriodId}/activate`, { method: 'POST' });
        const json = await res.json();
        if (json.success) {
            showToast("Periode berhasil diaktifkan kembali");
            closeModal('modal-period-detail');
            await loadDashboard();
            switchTab('dashboard');
        }
    } catch (err) {}
}

// ==========================================
// FORM SUBMIT HANDLERS & BUSINESS VALIDATIONS
// ==========================================

function populateExpensePosDropdown(selectedId = null) {
    const select = document.getElementById('expense-pos-id');
    select.innerHTML = '<option value="" disabled selected>-- Pilih Pos Deposit --</option>' +
        state.envelopes.map(e => `
            <option value="${e.id}" data-balance="${e.sisa_saldo}" data-name="${e.nama_pos}" data-status="${e.status_warna}" ${selectedId == e.id ? 'selected' : ''}>
                ${e.nama_pos} (Sisa: ${formatRupiah(e.sisa_saldo)})
            </option>
        `).join('');

    if (selectedId) {
        updateSelectedPosInfo();
    }
}

function quickExpenseForPos(posId) {
    openModal('modal-add-expense');
    populateExpensePosDropdown(posId);
}

function updateSelectedPosInfo() {
    const select = document.getElementById('expense-pos-id');
    const selectedOption = select.options[select.selectedIndex];
    if (!selectedOption || !selectedOption.value) return;

    const balance = parseFloat(selectedOption.getAttribute('data-balance') || 0);
    const status = selectedOption.getAttribute('data-status') || 'hijau';

    const infoBox = document.getElementById('expense-pos-balance-info');
    infoBox.classList.remove('hidden');
    document.getElementById('expense-pos-current-balance').innerText = formatRupiah(balance);

    const badge = document.getElementById('expense-pos-status-badge');
    badge.innerText = status === 'hijau' ? 'Aman' : (status === 'kuning' ? 'Waspada' : 'Kritis');
    badge.className = `px-2 py-0.5 rounded-full text-[10px] font-bold ${status === 'hijau' ? 'badge-status-hijau' : (status === 'kuning' ? 'badge-status-kuning' : 'badge-status-merah')}`;

    calculateExpenseLiveCheck();
}

function calculateExpenseLiveCheck() {
    const select = document.getElementById('expense-pos-id');
    const selectedOption = select.options[select.selectedIndex];
    if (!selectedOption || !selectedOption.value) return;

    const balance = parseFloat(selectedOption.getAttribute('data-balance') || 0);
    const nominal = parseRupiah(document.getElementById('expense-nominal-input').value);
    const preview = document.getElementById('expense-live-preview');

    if (nominal <= 0) {
        preview.innerHTML = '';
        return;
    }

    if (nominal > balance) {
        const deficit = nominal - balance;
        preview.innerHTML = `<span class="text-rose-600 font-bold">⚠️ Melebihi sisa saldo! Kurang ${formatRupiah(deficit)}</span>`;
    } else {
        const remaining = balance - nominal;
        preview.innerHTML = `<span class="text-emerald-600 font-semibold">✓ Saldo mencukupi. Sisa setelah transaksi: ${formatRupiah(remaining)}</span>`;
    }
}

function showOverspendingAlert(posName, currentBalance, triedAmount, deficit) {
    document.getElementById('alert-pos-name').innerText = posName;
    document.getElementById('alert-pos-balance').innerText = formatRupiah(currentBalance);
    document.getElementById('alert-tried-amount').innerText = formatRupiah(triedAmount);
    document.getElementById('alert-deficit-amount').innerText = formatRupiah(deficit);
    
    openModal('modal-overspending-alert');
}

// 1. Expense Submit Handler (HARD OVERSPENDING VALIDATION)
async function handleExpenseSubmit(e) {
    e.preventDefault();

    const posSelect = document.getElementById('expense-pos-id');
    const posId = parseInt(posSelect.value);
    const selectedOption = posSelect.options[posSelect.selectedIndex];
    const posName = selectedOption ? selectedOption.getAttribute('data-name') : 'Pos';
    const currentBalance = selectedOption ? parseFloat(selectedOption.getAttribute('data-balance')) : 0;
    
    const nominal = parseRupiah(document.getElementById('expense-nominal-input').value);
    const keterangan = document.getElementById('expense-keterangan').value.trim();
    const tanggal = document.getElementById('expense-date').value;

    if (!posId || nominal <= 0 || !keterangan || !tanggal) {
        showToast("Lengkapi semua field dengan benar", "error");
        return;
    }

    // CLIENT HARD OVERSPENDING CHECK
    if (nominal > currentBalance) {
        const deficit = nominal - currentBalance;
        showOverspendingAlert(posName, currentBalance, nominal, deficit);
        return;
    }

    if (state.isLocalMode) {
        const expenses = LocalDB.get(LocalDB.KEYS.EXPENSES);
        const newId = expenses.length > 0 ? Math.max(...expenses.map(x => x.id)) + 1 : 1;
        expenses.push({ id: newId, pos_id: posId, nominal: nominal, keterangan: keterangan, tanggal: tanggal });
        LocalDB.set(LocalDB.KEYS.EXPENSES, expenses);
        
        showToast("Pengeluaran berhasil dicatat!");
        closeModal('modal-add-expense');
        await loadDashboard();
        if (state.currentTab === 'expenses') loadFullExpenses();
        return;
    }

    try {
        const res = await fetch('/api/expenses', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pos_id: posId, nominal: nominal, keterangan: keterangan, tanggal: tanggal })
        });
        const json = await res.json();
        if (json.success) {
            showToast("Pengeluaran berhasil dicatat!");
            closeModal('modal-add-expense');
            await loadDashboard();
            if (state.currentTab === 'expenses') loadFullExpenses();
        } else {
            if (json.is_overspending) {
                showOverspendingAlert(posName, currentBalance, nominal, nominal - currentBalance);
            } else {
                showToast(json.error || "Gagal menyimpan pengeluaran", "error");
            }
        }
    } catch (err) {
        showToast("Terjadi kesalahan sistem", "error");
    }
}

// 2. Envelope Submit Handler
async function handleEnvelopeSubmit(e) {
    e.preventDefault();

    const editId = document.getElementById('envelope-edit-id').value;
    const namaPos = document.getElementById('envelope-name').value.trim();
    const nominalAlokasi = parseRupiah(document.getElementById('envelope-nominal-input').value);
    const icon = document.getElementById('envelope-icon').value;
    const color = document.getElementById('envelope-color').value;

    if (!state.activePeriodId) {
        showToast("Tidak ada periode aktif", "error");
        return;
    }

    if (state.isLocalMode) {
        const envelopes = LocalDB.get(LocalDB.KEYS.ENVELOPES);
        const summary = state.dashboardData.summary;
        let available = summary.belum_dialokasikan;
        if (editId) {
            const existing = envelopes.find(x => x.id == editId);
            if (existing) available += existing.nominal_alokasi;
        }

        if (nominalAlokasi > available) {
            showToast("Alokasi melebihi sisa pemasukan!", "error");
            return;
        }

        if (editId) {
            const idx = envelopes.findIndex(x => x.id == editId);
            if (idx !== -1) {
                envelopes[idx] = { ...envelopes[idx], nama_pos: namaPos, nominal_alokasi: nominalAlokasi, icon: icon, color: color };
            }
        } else {
            const newId = envelopes.length > 0 ? Math.max(...envelopes.map(x => x.id)) + 1 : 1;
            envelopes.push({ id: newId, periode_id: state.activePeriodId, nama_pos: namaPos, nominal_alokasi: nominalAlokasi, icon: icon, color: color });
        }

        LocalDB.set(LocalDB.KEYS.ENVELOPES, envelopes);
        showToast(editId ? "Pos deposit berhasil diperbarui!" : "Pos deposit berhasil dibuat!");
        closeModal('modal-add-envelope');
        await loadDashboard();
        if (state.currentTab === 'envelopes') renderEnvelopesManagement();
        return;
    }

    try {
        const method = editId ? 'PUT' : 'POST';
        const url = editId ? `/api/envelopes/${editId}` : '/api/envelopes';
        const payload = editId 
            ? { nama_pos: namaPos, nominal_alokasi: nominalAlokasi, icon: icon, color: color }
            : { periode_id: state.activePeriodId, nama_pos: namaPos, nominal_alokasi: nominalAlokasi, icon: icon, color: color };

        const res = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const json = await res.json();
        if (json.success) {
            showToast(editId ? "Pos deposit diperbarui!" : "Pos deposit dibuat!");
            closeModal('modal-add-envelope');
            await loadDashboard();
            if (state.currentTab === 'envelopes') renderEnvelopesManagement();
        } else {
            showToast(json.error || "Gagal menyimpan pos", "error");
        }
    } catch (err) {
        showToast("Terjadi kesalahan sistem", "error");
    }
}

function editEnvelope(posId) {
    const pos = state.envelopes.find(e => e.id == posId);
    if (!pos) return;

    document.getElementById('envelope-edit-id').value = pos.id;
    document.getElementById('envelope-name').value = pos.nama_pos;
    document.getElementById('envelope-nominal-input').value = pos.nominal_alokasi.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    document.getElementById('envelope-icon').value = pos.icon || 'wallet';
    document.getElementById('envelope-color').value = pos.color || '#3B82F6';
    document.getElementById('envelope-modal-title').querySelector('span').innerText = 'Edit Pos Deposit';

    openModal('modal-add-envelope');
    checkEnvelopeAllocationLimit();
}

async function confirmDeleteEnvelope(posId) {
    if (!confirm("Apakah Anda yakin ingin menghapus pos ini? Seluruh riwayat pengeluaran pada pos ini juga akan dihapus.")) return;

    if (state.isLocalMode) {
        let envelopes = LocalDB.get(LocalDB.KEYS.ENVELOPES).filter(x => x.id != posId);
        let expenses = LocalDB.get(LocalDB.KEYS.EXPENSES).filter(x => x.pos_id != posId);
        LocalDB.set(LocalDB.KEYS.ENVELOPES, envelopes);
        LocalDB.set(LocalDB.KEYS.EXPENSES, expenses);
        showToast("Pos deposit berhasil dihapus");
        await loadDashboard();
        if (state.currentTab === 'envelopes') renderEnvelopesManagement();
        return;
    }

    try {
        const res = await fetch(`/api/envelopes/${posId}`, { method: 'DELETE' });
        const json = await res.json();
        if (json.success) {
            showToast("Pos deposit berhasil dihapus");
            await loadDashboard();
            if (state.currentTab === 'envelopes') renderEnvelopesManagement();
        }
    } catch (err) {}
}

// 3. Income Submit Handler
async function handleIncomeSubmit(e) {
    e.preventDefault();

    const sumber = document.getElementById('income-source').value.trim();
    const nominal = parseRupiah(document.getElementById('income-nominal-input').value);
    const tanggal = document.getElementById('income-date').value;
    const catatan = document.getElementById('income-notes').value.trim();

    if (!state.activePeriodId) {
        showToast("Tidak ada periode aktif", "error");
        return;
    }

    if (state.isLocalMode) {
        const incomes = LocalDB.get(LocalDB.KEYS.INCOMES);
        const newId = incomes.length > 0 ? Math.max(...incomes.map(i => i.id)) + 1 : 1;
        incomes.push({ id: newId, periode_id: state.activePeriodId, nominal: nominal, sumber: sumber, tanggal: tanggal, catatan: catatan });
        LocalDB.set(LocalDB.KEYS.INCOMES, incomes);
        showToast("Pemasukan berhasil dicatat!");
        closeModal('modal-add-income');
        await loadDashboard();
        if (state.currentTab === 'incomes') renderIncomesTable();
        return;
    }

    try {
        const res = await fetch('/api/incomes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ periode_id: state.activePeriodId, nominal: nominal, sumber: sumber, tanggal: tanggal, catatan: catatan })
        });
        const json = await res.json();
        if (json.success) {
            showToast("Pemasukan dicatat!");
            closeModal('modal-add-income');
            await loadDashboard();
            if (state.currentTab === 'incomes') renderIncomesTable();
        }
    } catch (err) {}
}

async function confirmDeleteIncome(incomeId) {
    if (!confirm("Hapus catatan pemasukan ini?")) return;

    if (state.isLocalMode) {
        let incomes = LocalDB.get(LocalDB.KEYS.INCOMES).filter(i => i.id != incomeId);
        LocalDB.set(LocalDB.KEYS.INCOMES, incomes);
        showToast("Pemasukan berhasil dihapus");
        await loadDashboard();
        if (state.currentTab === 'incomes') renderIncomesTable();
        return;
    }

    try {
        const res = await fetch(`/api/incomes/${incomeId}`, { method: 'DELETE' });
        const json = await res.json();
        if (json.success) {
            showToast("Pemasukan berhasil dihapus");
            await loadDashboard();
            if (state.currentTab === 'incomes') renderIncomesTable();
        }
    } catch (err) {}
}

// 4. Delete Expense Handler
async function confirmDeleteExpense(expenseId) {
    if (!confirm("Hapus catatan pengeluaran ini? Saldo pos akan dikembalikan.")) return;

    if (state.isLocalMode) {
        let expenses = LocalDB.get(LocalDB.KEYS.EXPENSES).filter(x => x.id != expenseId);
        LocalDB.set(LocalDB.KEYS.EXPENSES, expenses);
        showToast("Pengeluaran berhasil dihapus");
        await loadDashboard();
        if (state.currentTab === 'expenses') loadFullExpenses();
        return;
    }

    try {
        const res = await fetch(`/api/expenses/${expenseId}`, { method: 'DELETE' });
        const json = await res.json();
        if (json.success) {
            showToast("Pengeluaran berhasil dihapus");
            await loadDashboard();
            if (state.currentTab === 'expenses') loadFullExpenses();
        }
    } catch (err) {}
}

// 5. New Period Submit Handler
async function handleNewPeriodSubmit(e) {
    e.preventDefault();

    const nama = document.getElementById('period-name-input').value.trim();
    const startDate = document.getElementById('period-start-date').value;
    const endDate = document.getElementById('period-end-date').value;
    const notes = document.getElementById('period-notes-input').value.trim();
    const copyCheck = document.getElementById('period-copy-pos-check').checked;
    const copySelect = document.getElementById('period-copy-pos-select');
    const copyFromId = copyCheck ? copySelect.value : null;

    if (state.isLocalMode) {
        const periods = LocalDB.get(LocalDB.KEYS.PERIODS);
        periods.forEach(p => p.status = 'selesai');
        const newId = periods.length > 0 ? Math.max(...periods.map(p => p.id)) + 1 : 1;
        periods.unshift({ id: newId, nama: nama, start_date: startDate, end_date: endDate, status: 'aktif', catatan: notes });
        LocalDB.set(LocalDB.KEYS.PERIODS, periods);

        if (copyFromId) {
            const allEnv = LocalDB.get(LocalDB.KEYS.ENVELOPES);
            const sourceEnv = allEnv.filter(e => e.periode_id == copyFromId);
            let nextEnvId = allEnv.length > 0 ? Math.max(...allEnv.map(e => e.id)) + 1 : 1;
            sourceEnv.forEach(s => {
                allEnv.push({ id: nextEnvId++, periode_id: newId, nama_pos: s.nama_pos, nominal_alokasi: s.nominal_alokasi, icon: s.icon, color: s.color });
            });
            LocalDB.set(LocalDB.KEYS.ENVELOPES, allEnv);
        }

        showToast("Periode baru berhasil dibuat!");
        closeModal('modal-new-period');
        await loadDashboard();
        switchTab('dashboard');
        return;
    }

    try {
        const res = await fetch('/api/periods', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nama: nama, start_date: startDate, end_date: endDate, catatan: notes, copy_from_period_id: copyFromId ? parseInt(copyFromId) : null })
        });
        const json = await res.json();
        if (json.success) {
            showToast("Periode baru berhasil dibuat!");
            closeModal('modal-new-period');
            await loadDashboard();
            switchTab('dashboard');
        }
    } catch (err) {}
}

function toggleCopyPosDropdown() {
    const isChecked = document.getElementById('period-copy-pos-check').checked;
    const container = document.getElementById('period-copy-pos-container');
    container.className = isChecked ? '' : 'hidden';
}

async function populateCopyPosDropdown() {
    let periods = [];
    if (state.isLocalMode) {
        periods = LocalDB.get(LocalDB.KEYS.PERIODS);
    } else {
        try {
            const res = await fetch('/api/periods');
            const json = await res.json();
            periods = json.data || [];
        } catch (e) {}
    }

    const select = document.getElementById('period-copy-pos-select');
    if (!periods || periods.length === 0) {
        select.innerHTML = '<option value="">Tidak ada periode sebelumnya</option>';
    } else {
        select.innerHTML = periods.map(p => `<option value="${p.id}">${p.nama}</option>`).join('');
    }
}

async function confirmClosePeriod() {
    if (!state.activePeriodId) return;
    if (!confirm("Tutup dan arsipkan periode ini?")) return;

    if (state.isLocalMode) {
        const periods = LocalDB.get(LocalDB.KEYS.PERIODS);
        const p = periods.find(x => x.id == state.activePeriodId);
        if (p) p.status = 'selesai';
        LocalDB.set(LocalDB.KEYS.PERIODS, periods);
        showToast("Periode berhasil ditutup dan diarsipkan");
        await loadDashboard();
        return;
    }

    try {
        const res = await fetch(`/api/periods/${state.activePeriodId}/close`, { method: 'POST' });
        const json = await res.json();
        if (json.success) {
            showToast("Periode berhasil ditutup dan diarsipkan");
            await loadDashboard();
        }
    } catch (err) {}
}

// ==========================================
// APP INITIALIZATION
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
    loadDashboard();
});
