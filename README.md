# PosBudget — Aplikasi Pencatatan Keuangan Berbasis Pos (Envelope Budgeting)

Aplikasi web modern untuk pencatatan keuangan pribadi dengan konsep **Envelope Budgeting (Alokasi Pos Deposit)**. Dibangun dengan fokus pada kemudahan penggunaan di perangkat mobile/desktop, format Rupiah (IDR) otomatis, dan **validasi ketat anti-overspending**.

---

## 🌟 Fitur Utama & Business Logic

1. **Siklus Anggaran Berbasis Periode**:
   - Tentukan tanggal mulai dan selesai periode (misal: 1 bulan siklus gaji).
   - Pengarsipan otomatis saat periode selesai/ditutup, menjaga riwayat data historis terpisah.
   - Fitur salin template pos dari periode sebelumnya saat membuat periode baru.

2. **Multi-Pemasukan (Incomes)**:
   - Catat sumber pemasukan (Gaji, Bonus, Pendapatan Sampingan, Freelance).
   - Total pemasukan menjadi plafon/anggaran utama siklus berjalan.

3. **Alokasi Pos Deposit (Envelopes)**:
   - Alokasikan pemasukan ke berbagai pos (Makan & Minum, Bensin, Tabungan, Tagihan, Hiburan, dll).
   - **Validasi Alokasi**: Total nominal seluruh pos tidak boleh melebihi total pemasukan periode aktif.
   - Kalkulator sisa alokasi real-time saat membuat/mengedit pos.

4. **Pengeluaran Nyata & Validasi Anti-Overspending**:
   - Setiap pengeluaran **wajib** dikaitkan ke salah satu pos deposit yang ada.
   - **Validasi Keras**: Sistem menolak input pengeluaran jika nominal melebihi sisa saldo pos terkait.
   - **Modal Alert Informatif Kustom**: Menampilkan rincian sisa saldo pos, nominal pengeluaran yang dicoba, dan kekurangan dana yang harus dipenuhi.

5. **Indikator Visual Status Pos (Trafic Light)**:
   - 🟢 **Hijau (Aman)**: Sisa saldo pos $> 30\%$ dari alokasi awal.
   - 🟡 **Kuning (Waspada)**: Sisa saldo pos antara $10\% - 30\%$ dari alokasi awal (mendekati habis).
   - 🔴 **Merah (Kritis / Habis)**: Sisa saldo pos $< 10\%$ atau $0\%$.
   - *(Konfigurasi threshold mudah disesuaikan di `services.py`)*

6. **Dashboard Interaktif**:
   - Kartu statistik keuangan (Pemasukan, Teralokasi, Belum Teralokasi, Terpakai, Sisa Total).
   - Progress bar realisasi anggaran keseluruhan.
   - Visualisasi grafik komposisi pos (Chart.js).
   - Filter & pencarian transaksi pengeluaran.
   - Riwayat & arsip periode lampau dengan fitur eksplorasi detail per siklus.

---

## 🚀 Cara Menjalankan Aplikasi

Aplikasi ini menggunakan modul bawaan **Python 3 Standard Library** (`sqlite3`, `http.server`, `json`), sehingga **tidak memerlukan `npm install` atau instalasi dependensi pihak ketiga**.

### 1. Jalankan Server
Buka terminal dan jalankan:

```bash
cd /Users/efestayoka/.gemini/antigravity/scratch/pos-budget-app
python3 app.py
```

### 2. Buka di Browser
Akses alamat berikut di browser:
👉 **[http://localhost:8000](http://localhost:8000)**

---

## 🧪 Menjalankan Pengujian (Testing)

Jalankan test suite untuk memverifikasi seluruh aturan bisnis validasi:

```bash
python3 test_app.py -v
python3 test_handler.py -v
```

---

## 📁 Struktur Direktori

```
pos-budget-app/
├── app.py              # Server HTTP REST API & static file handler
├── database.py         # Inisialisasi SQLite3 & data awal
├── services.py         # Business logic, validasi overspending, & kalkulasi pos
├── test_app.py         # Unit tests logika bisnis envelope budgeting
├── test_handler.py     # Unit tests REST API handler
├── README.md           # Dokumentasi lengkap
└── static/
    ├── index.html      # Tampilan antarmuka responsif (SPA)
    ├── css/
    │   └── style.css   # Custom CSS styling, badge, & animasi
    └── js/
        └── app.js      # State management, AJAX, Rupiah formatter, Chart.js
```
