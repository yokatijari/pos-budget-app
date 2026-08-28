"""
database.py - Database setup and connection helper for Pos Budget App
"""
import sqlite3
import os
from datetime import date, datetime

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "budget.db")

def get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn

def init_db():
    conn = get_connection()
    cursor = conn.cursor()

    # 1. Tabel Periode
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS periodes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nama VARCHAR(100) NOT NULL,
        start_date TEXT NOT NULL,
        end_date TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'aktif' CHECK(status IN ('aktif', 'selesai')),
        catatan TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)

    # 2. Tabel Pemasukan (Income)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS incomes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        periode_id INTEGER NOT NULL,
        nominal REAL NOT NULL CHECK(nominal > 0),
        sumber TEXT NOT NULL,
        tanggal TEXT NOT NULL,
        catatan TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (periode_id) REFERENCES periodes(id) ON DELETE CASCADE
    )
    """)

    # 3. Tabel Pos Deposit (Envelope)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS envelopes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        periode_id INTEGER NOT NULL,
        nama_pos TEXT NOT NULL,
        nominal_alokasi REAL NOT NULL CHECK(nominal_alokasi >= 0),
        icon TEXT DEFAULT 'wallet',
        color TEXT DEFAULT '#3B82F6',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (periode_id) REFERENCES periodes(id) ON DELETE CASCADE
    )
    """)

    # 4. Tabel Pengeluaran (Expense)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS expenses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        pos_id INTEGER NOT NULL,
        nominal REAL NOT NULL CHECK(nominal > 0),
        keterangan TEXT NOT NULL,
        tanggal TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (pos_id) REFERENCES envelopes(id) ON DELETE CASCADE
    )
    """)

    # Create Indexes for performance
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_periodes_status ON periodes(status)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_incomes_periode ON incomes(periode_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_envelopes_periode ON envelopes(periode_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_expenses_pos ON expenses(pos_id)")

    conn.commit()

    # Check if empty, seed sample data
    cursor.execute("SELECT COUNT(*) as count FROM periodes")
    if cursor.fetchone()['count'] == 0:
        seed_sample_data(conn)

    conn.close()

def seed_sample_data(conn):
    cursor = conn.cursor()
    today = date.today()
    start_date = today.strftime("%Y-%m-01")
    import calendar
    _, last_day = calendar.monthrange(today.year, today.month)
    end_date = f"{today.year}-{today.month:02d}-{last_day:02d}"

    period_name = f"Periode {today.strftime('%B %Y')}"
    cursor.execute("""
    INSERT INTO periodes (nama, start_date, end_date, status, catatan)
    VALUES (?, ?, ?, 'aktif', 'Periode awal envelope budgeting')
    """, (period_name, start_date, end_date))
    periode_id = cursor.lastrowid

    # Seed Income: Rp 6.500.000
    cursor.execute("""
    INSERT INTO incomes (periode_id, nominal, sumber, tanggal, catatan)
    VALUES (?, ?, ?, ?, ?)
    """, (periode_id, 6500000, "Gaji Bulanan", start_date, "Gaji pokok bulanan"))

    # Seed Envelopes (Total: Rp 6.500.000)
    envelopes_data = [
        ("Makan & Minum", 2000000, "utensils", "#10B981"),
        ("Transportasi & Bensin", 500000, "car", "#3B82F6"),
        ("Tabungan & Investasi", 1000000, "piggy-bank", "#8B5CF6"),
        ("Tagihan & Listrik", 800000, "zap", "#F59E0B"),
        ("Belanja Kebutuhan Rumah", 700000, "shopping-bag", "#EC4899"),
        ("Hiburan & Healing", 500000, "film", "#06B6D4"),
        ("Dana Darurat", 500000, "shield-alert", "#6366F1"),
        ("Sedekah & Sosial", 500000, "heart", "#14B8A6"),
    ]

    for nama, alokasi, icon, color in envelopes_data:
        cursor.execute("""
        INSERT INTO envelopes (periode_id, nama_pos, nominal_alokasi, icon, color)
        VALUES (?, ?, ?, ?, ?)
        """, (periode_id, nama, alokasi, icon, color))
        pos_id = cursor.lastrowid

        # Sample initial expenses
        if nama == "Makan & Minum":
            cursor.execute("""
            INSERT INTO expenses (pos_id, nominal, keterangan, tanggal)
            VALUES (?, ?, ?, ?)
            """, (pos_id, 150000, "Belanja mingguan pasar & sayur", start_date))
            cursor.execute("""
            INSERT INTO expenses (pos_id, nominal, keterangan, tanggal)
            VALUES (?, ?, ?, ?)
            """, (pos_id, 35000, "Makan siang kantor", start_date))
        elif nama == "Transportasi & Bensin":
            cursor.execute("""
            INSERT INTO expenses (pos_id, nominal, keterangan, tanggal)
            VALUES (?, ?, ?, ?)
            """, (pos_id, 100000, "Isi bensin motor & e-toll", start_date))

    conn.commit()

if __name__ == "__main__":
    init_db()
    print("Database initialized successfully at:", DB_PATH)
