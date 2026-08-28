"""
test_handler.py - Direct unit test for HTTP Request Handler without socket binding
"""
import unittest
import io
import json
import tempfile
import os
import database
import services
import app

class MockSocket:
    def __init__(self, data=b""):
        self.rfile = io.BytesIO(data)
        self.wfile = io.BytesIO()

    def makefile(self, mode, *args, **kwargs):
        if 'r' in mode:
            return self.rfile
        elif 'w' in mode:
            return self.wfile

class TestHandlerDirect(unittest.TestCase):
    def setUp(self):
        self.db_fd, self.db_path = tempfile.mkstemp()
        database.DB_PATH = self.db_path
        database.init_db()

    def tearDown(self):
        os.close(self.db_fd)
        os.unlink(self.db_path)

    def _execute_request(self, method, path, body_dict=None):
        body_bytes = json.dumps(body_dict).encode('utf-8') if body_dict else b""
        headers = f"{method} {path} HTTP/1.1\r\nHost: localhost\r\nContent-Type: application/json\r\nContent-Length: {len(body_bytes)}\r\n\r\n".encode('utf-8')
        raw_request = headers + body_bytes
        
        # We can directly invoke the handler methods on a dummy instance
        class DummyHandler(app.BudgetRequestHandler):
            def __init__(self):
                self.rfile = io.BytesIO(body_bytes)
                self.wfile = io.BytesIO()
                self.path = path
                self.headers = {"Content-Length": str(len(body_bytes)), "Content-Type": "application/json"}
                self.status_code = None
                self.response_headers = {}

            def send_response(self, code, message=None):
                self.status_code = code

            def send_header(self, keyword, value):
                self.response_headers[keyword] = value

            def end_headers(self):
                pass

        handler = DummyHandler()
        if method == "GET":
            handler.do_GET()
        elif method == "POST":
            handler.do_POST()
        elif method == "PUT":
            handler.do_PUT()
        elif method == "DELETE":
            handler.do_DELETE()

        response_body = handler.wfile.getvalue().decode('utf-8')
        json_resp = json.loads(response_body) if response_body else {}
        return handler.status_code, json_resp

    def test_get_dashboard(self):
        status, res = self._execute_request("GET", "/api/dashboard")
        self.assertEqual(status, 200)
        self.assertTrue(res['success'])
        self.assertTrue(res['data']['has_active_period'])
        self.assertIn("envelopes", res['data'])

    def test_add_expense_valid(self):
        # Ambil envelope id dari dashboard
        _, dash = self._execute_request("GET", "/api/dashboard")
        pos = next(e for e in dash['data']['envelopes'] if "Makan" in e['nama_pos'])
        
        status, res = self._execute_request("POST", "/api/expenses", {
            "pos_id": pos['id'],
            "nominal": 25000,
            "keterangan": "Nasi goreng spesial",
            "tanggal": "2026-08-28"
        })
        self.assertEqual(status, 201)
        self.assertTrue(res['success'])

    def test_add_expense_overspending_rejected(self):
        _, dash = self._execute_request("GET", "/api/dashboard")
        pos = next(e for e in dash['data']['envelopes'] if "Makan" in e['nama_pos'])
        
        # Nominal melebihi saldo pos
        over_nominal = pos['sisa_saldo'] + 500000
        status, res = self._execute_request("POST", "/api/expenses", {
            "pos_id": pos['id'],
            "nominal": over_nominal,
            "keterangan": "Makan mewah overspending",
            "tanggal": "2026-08-28"
        })
        self.assertEqual(status, 422)
        self.assertFalse(res['success'])
        self.assertTrue(res['is_overspending'])
        self.assertIn("melebihi sisa saldo", res['error'])

    def test_add_period_and_close(self):
        # Tambah periode baru
        status, res = self._execute_request("POST", "/api/periods", {
            "nama": "Periode Baru Testing",
            "start_date": "2026-11-01",
            "end_date": "2026-11-30",
            "catatan": "Test note"
        })
        self.assertEqual(status, 201)
        period_id = res['data']['id']

        # Tutup periode
        status, res = self._execute_request("POST", f"/api/periods/{period_id}/close")
        self.assertEqual(status, 200)
        self.assertTrue(res['success'])

if __name__ == "__main__":
    unittest.main()
