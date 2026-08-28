"""
test_app.py - Test suite for Envelope Budgeting application
"""
import unittest
import os
import sqlite3
import tempfile
import database
import services

class TestPosBudgetApp(unittest.TestCase):

    def setUp(self):
        # Gunakan temporary database untuk testing terisolasi
        self.db_fd, self.db_path = tempfile.mkstemp()
        database.DB_PATH = self.db_path
        database.init_db()

    def tearDown(self):
        os.close(self.db_fd)
        os.unlink(self.db_path)

    def test_01_active_period_and_income(self):
        active = services.get_active_period()
        self.assertIsNotNone(active, "Harus ada periode aktif awal")
        
        incomes = services.get_incomes_by_period(active['id'])
        self.assertGreater(len(incomes), 0, "Harus ada data pemasukan awal")
        total_income = sum(i['nominal'] for i in incomes)
        self.assertEqual(total_income, 6500000)

    def test_02_envelope_allocation_validation(self):
        """Uji validasi: Total alokasi tidak boleh melebihi sisa pemasukan"""
        active = services.get_active_period()
        period_id = active['id']

        # Pada seed data, total alokasi sudah sama dengan pemasukan (6.500.000)
        # Menambah pos baru dengan alokasi > 0 harus ditolak
        with self.assertRaises(ValueError) as ctx:
            services.create_envelope(period_id, "Pos Tambahan", 100000)
        
        self.assertIn("Alokasi melebihi sisa pemasukan", str(ctx.exception))

    def test_03_expense_within_balance_succeeds(self):
        """Uji pengeluaran normal yang dalam batas saldo pos"""
        active = services.get_active_period()
        envelopes = services.get_envelopes_by_period(active['id'])
        
        # Cari pos 'Makan & Minum'
        makan_pos = next(e for e in envelopes if "Makan" in e['nama_pos'])
        sisa_sebelum = makan_pos['sisa_saldo']

        # Catat pengeluaran 50.000
        exp_id = services.add_expense(makan_pos['id'], 50000, "Makan malam", "2026-08-28")
        self.assertIsNotNone(exp_id)

        # Cek sisa saldo setelah transaksi
        updated_pos = services.get_envelope_by_id(makan_pos['id'])
        self.assertEqual(updated_pos['sisa_saldo'], sisa_sebelum - 50000)

    def test_04_overspending_rejection(self):
        """Uji validasi keras: Pengeluaran melebihi sisa saldo pos WAJIB DITOLAK"""
        active = services.get_active_period()
        envelopes = services.get_envelopes_by_period(active['id'])
        
        # Cari pos 'Transportasi & Bensin' (alokasi 500rb, sudah terpakai 100rb, sisa 400rb)
        transport_pos = next(e for e in envelopes if "Transport" in e['nama_pos'])
        sisa_saldo = transport_pos['sisa_saldo']

        # Coba belanja melebihi sisa saldo (misal 500.000 > 400.000)
        with self.assertRaises(ValueError) as ctx:
            services.add_expense(transport_pos['id'], sisa_saldo + 100000, "Beli sparepart mahal", "2026-08-28")

        err_str = str(ctx.exception)
        self.assertIn("OVERSPENDING_ERROR", err_str)
        self.assertIn("Kekurangan dana: Rp 100,000", err_str)

    def test_05_status_color_thresholds(self):
        """Uji indikator warna status sisa saldo"""
        # Hijau: > 30% (misal sisa 800rb dari 1jt = 80%)
        self.assertEqual(services.get_status_color(800000, 1000000), 'hijau')
        
        # Kuning: 10% - 30% (misal sisa 200rb dari 1jt = 20%)
        self.assertEqual(services.get_status_color(200000, 1000000), 'kuning')
        
        # Merah: < 10% (misal sisa 50rb dari 1jt = 5%)
        self.assertEqual(services.get_status_color(50000, 1000000), 'merah')

        # Merah: 0 (habis)
        self.assertEqual(services.get_status_color(0, 1000000), 'merah')

    def test_06_period_lifecycle_and_copy_template(self):
        """Uji pembuatan periode baru, penutupan periode lama, dan salin template pos"""
        old_active = services.get_active_period()
        
        # Buat periode baru dengan copy template dari periode aktif lama
        new_period_id = services.create_period(
            nama="Periode Oktober 2026",
            start_date="2026-10-01",
            end_date="2026-10-31",
            catatan="Periode baru uji",
            copy_from_period_id=old_active['id']
        )

        # Periode baru harus aktif
        current_active = services.get_active_period()
        self.assertEqual(current_active['id'], new_period_id)

        # Periode lama harus berstatus selesai
        old_period_updated = services.get_period_by_id(old_active['id'])
        self.assertEqual(old_period_updated['status'], 'selesai')

        # Template pos berhasil disalin
        new_envelopes = services.get_envelopes_by_period(new_period_id)
        self.assertEqual(len(new_envelopes), 8)

        # Tidak bisa menambah pengeluaran pada periode lama yang sudah selesai
        old_envelopes = services.get_envelopes_by_period(old_active['id'])
        with self.assertRaises(ValueError):
            services.add_expense(old_envelopes[0]['id'], 10000, "Makan", "2026-08-28")

if __name__ == "__main__":
    unittest.main()
