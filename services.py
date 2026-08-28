"""
services.py - Business Logic & Domain Services for Envelope Budgeting
"""
from datetime import datetime, date
from database import get_connection

# Configurable Warning Thresholds
THRESHOLD_WARNING_PCT = 30.0  # Under 30% -> Yellow
THRESHOLD_DANGER_PCT = 10.0   # Under 10% -> Red

def get_status_color(sisa_saldo, nominal_alokasi):
    """
    Menghitung indikator status warna berdasarkan sisa saldo vs alokasi:
    - 'hijau': sisa > 30% dari alokasi
    - 'kuning': 10% <= sisa <= 30% dari alokasi
    - 'merah': sisa < 10% atau 0
    """
    if nominal_alokasi <= 0:
        return 'merah' if sisa_saldo <= 0 else 'hijau'
    
    pct_remaining = (sisa_saldo / nominal_alokasi) * 100.0
    if pct_remaining > THRESHOLD_WARNING_PCT:
        return 'hijau'
    elif pct_remaining >= THRESHOLD_DANGER_PCT:
        return 'kuning'
    else:
        return 'merah'

# ==============================
# PERIODE SERVICES
# ==============================

def get_active_period():
    """Mengambil data periode yang sedang berstatus 'aktif'"""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT * FROM periodes 
        WHERE status = 'aktif' 
        ORDER BY id DESC LIMIT 1
    """)
    period = cursor.fetchone()
    conn.close()
    return dict(period) if period else None

def get_period_by_id(period_id):
    """Mengambil detail periode berdasarkan ID"""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM periodes WHERE id = ?", (period_id,))
    period = cursor.fetchone()
    conn.close()
    return dict(period) if period else None

def get_all_periods():
    """Mengambil seluruh riwayat periode beserta ringkasan keuangannya"""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT p.*,
               COALESCE((SELECT SUM(nominal) FROM incomes WHERE periode_id = p.id), 0) as total_pemasukan,
               COALESCE((SELECT SUM(nominal_alokasi) FROM envelopes WHERE periode_id = p.id), 0) as total_alokasi,
               COALESCE((SELECT SUM(e.nominal) FROM expenses e JOIN envelopes env ON e.pos_id = env.id WHERE env.periode_id = p.id), 0) as total_pengeluaran,
               (SELECT COUNT(*) FROM envelopes WHERE periode_id = p.id) as total_pos,
               (SELECT COUNT(*) FROM expenses e JOIN envelopes env ON e.pos_id = env.id WHERE env.periode_id = p.id) as total_transaksi
        FROM periodes p
        ORDER BY p.start_date DESC, p.id DESC
    """)
    rows = cursor.fetchall()
    periods = []
    for r in rows:
        p = dict(r)
        p['sisa_saldo_keseluruhan'] = p['total_pemasukan'] - p['total_pengeluaran']
        p['belum_dialokasikan'] = p['total_pemasukan'] - p['total_alokasi']
        periods.append(p)
    conn.close()
    return periods

def create_period(nama, start_date, end_date, catatan=None, copy_from_period_id=None):
    """
    Membuat periode baru. Jika ada periode aktif lain, opsi untuk menjadikannya aktif.
    Jika copy_from_period_id disediakan, salin struktur pos deposit dari periode tersebut.
    """
    conn = get_connection()
    cursor = conn.cursor()

    # Validasi rentang tanggal
    if start_date > end_date:
        raise ValueError("Tanggal mulai tidak boleh melebihi tanggal selesai")

    # Nonaktifkan periode aktif sebelumnya
    cursor.execute("UPDATE periodes SET status = 'selesai' WHERE status = 'aktif'")

    # Masukkan periode baru
    cursor.execute("""
        INSERT INTO periodes (nama, start_date, end_date, status, catatan)
        VALUES (?, ?, ?, 'aktif', ?)
    """, (nama, start_date, end_date, catatan))
    new_period_id = cursor.lastrowid

    # Salin pos jika diminta
    if copy_from_period_id:
        cursor.execute("""
            SELECT nama_pos, nominal_alokasi, icon, color 
            FROM envelopes 
            WHERE periode_id = ?
        """, (copy_from_period_id,))
        pos_list = cursor.fetchall()
        for pos in pos_list:
            cursor.execute("""
                INSERT INTO envelopes (periode_id, nama_pos, nominal_alokasi, icon, color)
                VALUES (?, ?, ?, ?, ?)
            """, (new_period_id, pos['nama_pos'], pos['nominal_alokasi'], pos['icon'], pos['color']))

    conn.commit()
    conn.close()
    return new_period_id

def close_period(period_id):
    """Menandai periode selesai (arsip)"""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("UPDATE periodes SET status = 'selesai' WHERE id = ?", (period_id,))
    conn.commit()
    conn.close()
    return True

def activate_period(period_id):
    """Mengaktifkan kembali periode"""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("UPDATE periodes SET status = 'selesai' WHERE status = 'aktif'")
    cursor.execute("UPDATE periodes SET status = 'aktif' WHERE id = ?", (period_id,))
    conn.commit()
    conn.close()
    return True

# ==============================
# PEMASUKAN SERVICES
# ==============================

def get_incomes_by_period(period_id):
    """Mendapatkan daftar pemasukan pada periode tertentu"""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT * FROM incomes 
        WHERE periode_id = ? 
        ORDER BY tanggal DESC, id DESC
    """, (period_id,))
    incomes = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return incomes

def add_income(periode_id, nominal, sumber, tanggal, catatan=None):
    """Mencatat pemasukan baru ke periode aktif"""
    if nominal <= 0:
        raise ValueError("Nominal pemasukan harus lebih besar dari 0")

    period = get_period_by_id(periode_id)
    if not period:
        raise ValueError("Periode tidak ditemukan")
    if period['status'] != 'aktif':
        raise ValueError("Tidak dapat menambah pemasukan ke periode yang sudah selesai/diarsipkan")

    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO incomes (periode_id, nominal, sumber, tanggal, catatan)
        VALUES (?, ?, ?, ?, ?)
    """, (periode_id, nominal, sumber, tanggal, catatan))
    income_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return income_id

def delete_income(income_id):
    """Hapus pemasukan dengan validasi agar total alokasi tidak melebihi sisa pemasukan"""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM incomes WHERE id = ?", (income_id,))
    income = cursor.fetchone()
    if not income:
        raise ValueError("Pemasukan tidak ditemukan")

    periode_id = income['periode_id']
    
    # Hitung total pemasukan setelah dihapus
    cursor.execute("SELECT COALESCE(SUM(nominal), 0) as total FROM incomes WHERE periode_id = ? AND id != ?", 
                   (periode_id, income_id))
    new_total_income = cursor.fetchone()['total']

    # Hitung total alokasi saat ini
    cursor.execute("SELECT COALESCE(SUM(nominal_alokasi), 0) as total FROM envelopes WHERE periode_id = ?", 
                   (periode_id,))
    total_alokasi = cursor.fetchone()['total']

    if total_alokasi > new_total_income:
        raise ValueError(
            f"Tidak dapat menghapus pemasukan ini karena total pos alokasi (Rp {total_alokasi:,.0f}) "
            f"akan melebihi sisa total pemasukan (Rp {new_total_income:,.0f}). Kurangi alokasi pos terlebih dahulu."
        )

    cursor.execute("DELETE FROM incomes WHERE id = ?", (income_id,))
    conn.commit()
    conn.close()
    return True

# ==============================
# POS DEPOSIT (ENVELOPE) SERVICES
# ==============================

def get_envelopes_by_period(period_id):
    """
    Mengambil seluruh pos deposit pada periode tertentu
    beserta total pengeluaran, sisa saldo, persentase pemakaian, dan status warna.
    """
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT env.*,
               COALESCE((SELECT SUM(nominal) FROM expenses WHERE pos_id = env.id), 0) as total_pengeluaran,
               (SELECT COUNT(*) FROM expenses WHERE pos_id = env.id) as jumlah_transaksi
        FROM envelopes env
        WHERE env.periode_id = ?
        ORDER BY env.id ASC
    """, (period_id,))
    rows = cursor.fetchall()
    
    envelopes = []
    for r in rows:
        item = dict(r)
        alokasi = float(item['nominal_alokasi'])
        terpakai = float(item['total_pengeluaran'])
        sisa = alokasi - terpakai
        
        item['sisa_saldo'] = sisa
        item['persentase_terpakai'] = round((terpakai / alokasi * 100.0), 1) if alokasi > 0 else 0.0
        item['persentase_sisa'] = round((sisa / alokasi * 100.0), 1) if alokasi > 0 else 0.0
        item['status_warna'] = get_status_color(sisa, alokasi)
        envelopes.append(item)

    conn.close()
    return envelopes

def get_envelope_by_id(pos_id):
    """Mengambil data 1 pos deposit beserta kalkulasi sisa saldonya"""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT env.*,
               p.status as periode_status,
               COALESCE((SELECT SUM(nominal) FROM expenses WHERE pos_id = env.id), 0) as total_pengeluaran
        FROM envelopes env
        JOIN periodes p ON env.periode_id = p.id
        WHERE env.id = ?
    """, (pos_id,))
    row = cursor.fetchone()
    conn.close()
    if not row:
        return None
    item = dict(row)
    alokasi = float(item['nominal_alokasi'])
    terpakai = float(item['total_pengeluaran'])
    sisa = alokasi - terpakai
    item['sisa_saldo'] = sisa
    item['persentase_terpakai'] = round((terpakai / alokasi * 100.0), 1) if alokasi > 0 else 0.0
    item['status_warna'] = get_status_color(sisa, alokasi)
    return item

def create_envelope(periode_id, nama_pos, nominal_alokasi, icon="wallet", color="#3B82F6"):
    """
    Membuat pos deposit baru dengan validasi total alokasi tidak melebihi pemasukan
    """
    if nominal_alokasi < 0:
        raise ValueError("Nominal alokasi tidak boleh negatif")

    period = get_period_by_id(periode_id)
    if not period:
        raise ValueError("Periode tidak ditemukan")
    if period['status'] != 'aktif':
        raise ValueError("Tidak dapat menambah pos deposit pada periode yang sudah selesai")

    conn = get_connection()
    cursor = conn.cursor()

    # Hitung total pemasukan
    cursor.execute("SELECT COALESCE(SUM(nominal), 0) as total FROM incomes WHERE periode_id = ?", (periode_id,))
    total_income = cursor.fetchone()['total']

    # Hitung total alokasi yang sudah ada
    cursor.execute("SELECT COALESCE(SUM(nominal_alokasi), 0) as total FROM envelopes WHERE periode_id = ?", (periode_id,))
    current_allocation = cursor.fetchone()['total']

    available_to_allocate = total_income - current_allocation

    if nominal_alokasi > available_to_allocate:
        raise ValueError(
            f"Alokasi melebihi sisa pemasukan! Sisa pemasukan yang belum dialokasikan: "
            f"Rp {available_to_allocate:,.0f} (Mencoba alokasi: Rp {nominal_alokasi:,.0f})"
        )

    cursor.execute("""
        INSERT INTO envelopes (periode_id, nama_pos, nominal_alokasi, icon, color)
        VALUES (?, ?, ?, ?, ?)
    """, (periode_id, nama_pos, nominal_alokasi, icon, color))
    new_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return new_id

def update_envelope(pos_id, nama_pos, nominal_alokasi, icon=None, color=None):
    """
    Memperbarui pos deposit.
    Validasi:
    1. Total seluruh alokasi pos <= Total pemasukan
    2. Nominal alokasi baru >= Pengeluaran yang sudah terjadi pada pos ini
    """
    pos = get_envelope_by_id(pos_id)
    if not pos:
        raise ValueError("Pos deposit tidak ditemukan")
    if pos['periode_status'] != 'aktif':
        raise ValueError("Tidak dapat mengubah pos pada periode yang sudah selesai")

    periode_id = pos['periode_id']
    total_pengeluaran_pos = pos['total_pengeluaran']

    if nominal_alokasi < total_pengeluaran_pos:
        raise ValueError(
            f"Alokasi baru (Rp {nominal_alokasi:,.0f}) tidak boleh lebih kecil dari "
            f"pengeluaran yang sudah terjadi pada pos ini (Rp {total_pengeluaran_pos:,.0f})"
        )

    conn = get_connection()
    cursor = conn.cursor()

    # Hitung total pemasukan
    cursor.execute("SELECT COALESCE(SUM(nominal), 0) as total FROM incomes WHERE periode_id = ?", (periode_id,))
    total_income = cursor.fetchone()['total']

    # Hitung total alokasi pos lain
    cursor.execute("SELECT COALESCE(SUM(nominal_alokasi), 0) as total FROM envelopes WHERE periode_id = ? AND id != ?", 
                   (periode_id, pos_id))
    other_allocation = cursor.fetchone()['total']

    max_possible_allocation = total_income - other_allocation
    if nominal_alokasi > max_possible_allocation:
        raise ValueError(
            f"Alokasi melebihi batas pemasukan! Maksimum yang bisa dialokasikan: "
            f"Rp {max_possible_allocation:,.0f} (Total pemasukan: Rp {total_income:,.0f})"
        )

    cursor.execute("""
        UPDATE envelopes 
        SET nama_pos = ?, nominal_alokasi = ?, 
            icon = COALESCE(?, icon), color = COALESCE(?, color)
        WHERE id = ?
    """, (nama_pos, nominal_alokasi, icon, color, pos_id))
    conn.commit()
    conn.close()
    return True

def delete_envelope(pos_id):
    """Hapus pos deposit beserta riwayat pengeluarannya (cascade)"""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM envelopes WHERE id = ?", (pos_id,))
    conn.commit()
    conn.close()
    return True

# ==============================
# PENGELUARAN (EXPENSE) SERVICES
# ==============================

def get_expenses_by_period(period_id, limit=None):
    """Mengambil transaksi pengeluaran pada suatu periode"""
    conn = get_connection()
    cursor = conn.cursor()
    query = """
        SELECT exp.*, env.nama_pos, env.icon as pos_icon, env.color as pos_color
        FROM expenses exp
        JOIN envelopes env ON exp.pos_id = env.id
        WHERE env.periode_id = ?
        ORDER BY exp.tanggal DESC, exp.id DESC
    """
    if limit:
        query += f" LIMIT {int(limit)}"

    cursor.execute(query, (period_id,))
    rows = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return rows

def add_expense(pos_id, nominal, keterangan, tanggal):
    """
    Mencatat pengeluaran baru.
    VALIDASI KRITIKAL:
    1. Wajib memilih pos yang valid & periode harus aktif.
    2. Nominal pengeluaran TIDAK BOLEH melebihi sisa saldo pos terkait.
    """
    if nominal <= 0:
        raise ValueError("Nominal pengeluaran harus lebih besar dari 0")

    pos = get_envelope_by_id(pos_id)
    if not pos:
        raise ValueError("Pos deposit tidak ditemukan")
    
    if pos['periode_status'] != 'aktif':
        raise ValueError("Periode ini sudah selesai/diarsipkan. Pengeluaran baru tidak diperkenankan.")

    sisa_saldo = pos['sisa_saldo']

    # HARD VALIDATION: Tolak jika melebihi saldo pos
    if nominal > sisa_saldo:
        kekurangan = nominal - sisa_saldo
        err_msg = (
            f"OVERSPENDING_ERROR: Pengeluaran Rp {nominal:,.0f} melebihi sisa saldo pos '{pos['nama_pos']}'! "
            f"Sisa saldo saat ini: Rp {sisa_saldo:,.0f}. Kekurangan dana: Rp {kekurangan:,.0f}."
        )
        raise ValueError(err_msg)

    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO expenses (pos_id, nominal, keterangan, tanggal)
        VALUES (?, ?, ?, ?)
    """, (pos_id, nominal, keterangan, tanggal))
    new_expense_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return new_expense_id

def delete_expense(expense_id):
    """Hapus pengeluaran"""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM expenses WHERE id = ?", (expense_id,))
    conn.commit()
    conn.close()
    return True

# ==============================
# DASHBOARD AGGREGATION SERVICE
# ==============================

def get_dashboard_summary(period_id=None):
    """
    Mengambil data komprehensif dashboard untuk periode yang diminta
    (atau periode aktif jika period_id None).
    """
    if period_id:
        period = get_period_by_id(period_id)
    else:
        period = get_active_period()

    if not period:
        # Jika belum ada periode sama sekali
        return {
            "has_active_period": False,
            "period": None,
            "summary": None,
            "envelopes": [],
            "recent_expenses": [],
            "incomes": []
        }

    p_id = period['id']
    incomes = get_incomes_by_period(p_id)
    envelopes = get_envelopes_by_period(p_id)
    recent_expenses = get_expenses_by_period(p_id, limit=10)

    total_pemasukan = sum(i['nominal'] for i in incomes)
    total_alokasi = sum(e['nominal_alokasi'] for e in envelopes)
    total_pengeluaran = sum(e['total_pengeluaran'] for e in envelopes)
    belum_dialokasikan = total_pemasukan - total_alokasi
    sisa_anggaran_keseluruhan = total_pemasukan - total_pengeluaran

    # Sisa hari periode
    today = date.today()
    try:
        end_d = datetime.strptime(period['end_date'], "%Y-%m-%d").date()
        start_d = datetime.strptime(period['start_date'], "%Y-%m-%d").date()
        days_left = (end_d - today).days
        total_days = (end_d - start_d).days + 1
        elapsed_days = (today - start_d).days + 1
    except Exception:
        days_left = 0
        total_days = 30
        elapsed_days = 0

    # Overall progress
    overall_progress_pct = round((total_pengeluaran / total_alokasi * 100.0), 1) if total_alokasi > 0 else 0.0

    # Pos yang butuh perhatian (kuning atau merah)
    pos_warning_count = sum(1 for e in envelopes if e['status_warna'] in ('kuning', 'merah'))

    summary = {
        "total_pemasukan": total_pemasukan,
        "total_alokasi": total_alokasi,
        "belum_dialokasikan": belum_dialokasikan,
        "total_pengeluaran": total_pengeluaran,
        "sisa_anggaran_keseluruhan": sisa_anggaran_keseluruhan,
        "overall_progress_pct": overall_progress_pct,
        "days_left": days_left,
        "total_days": total_days,
        "elapsed_days": max(0, elapsed_days),
        "pos_warning_count": pos_warning_count,
        "total_pos": len(envelopes)
    }

    return {
        "has_active_period": True,
        "period": period,
        "summary": summary,
        "envelopes": envelopes,
        "recent_expenses": recent_expenses,
        "incomes": incomes
    }
