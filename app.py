"""
app.py - Main HTTP REST API Server and Static Web Handler for Pos Budget App
"""
import http.server
import socketserver
import json
import os
import re
import urllib.parse
from datetime import datetime

from database import init_db
import services

PORT = int(os.environ.get("PORT", 8000))
STATIC_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "static")

class BudgetRequestHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=STATIC_DIR, **kwargs)

    def _send_json(self, status_code, data):
        response_bytes = json.dumps(data, default=str).encode('utf-8')
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(response_bytes)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
        self.wfile.write(response_bytes)

    def _parse_body(self):
        try:
            content_length = int(self.headers.get('Content-Length', 0))
            if content_length > 0:
                body = self.rfile.read(content_length).decode('utf-8')
                return json.loads(body)
        except Exception:
            pass
        return {}

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self):
        parsed_url = urllib.parse.urlparse(self.path)
        path = parsed_url.path
        query_params = urllib.parse.parse_qs(parsed_url.query)

        # API Routes
        if path.startswith("/api/"):
            try:
                # 1. Dashboard summary
                if path == "/api/dashboard":
                    period_id = query_params.get("period_id", [None])[0]
                    if period_id:
                        period_id = int(period_id)
                    data = services.get_dashboard_summary(period_id)
                    return self._send_json(200, {"success": True, "data": data})

                # 2. Periods list
                elif path == "/api/periods":
                    periods = services.get_all_periods()
                    return self._send_json(200, {"success": True, "data": periods})

                # 3. Single Period Detail
                elif re.match(r"^/api/periods/(\d+)$", path):
                    period_id = int(re.match(r"^/api/periods/(\d+)$", path).group(1))
                    data = services.get_dashboard_summary(period_id)
                    return self._send_json(200, {"success": True, "data": data})

                # 4. Incomes list
                elif path == "/api/incomes":
                    period_id = query_params.get("period_id", [None])[0]
                    if not period_id:
                        active = services.get_active_period()
                        period_id = active['id'] if active else None
                    if not period_id:
                        return self._send_json(200, {"success": True, "data": []})
                    incomes = services.get_incomes_by_period(int(period_id))
                    return self._send_json(200, {"success": True, "data": incomes})

                # 5. Envelopes list
                elif path == "/api/envelopes":
                    period_id = query_params.get("period_id", [None])[0]
                    if not period_id:
                        active = services.get_active_period()
                        period_id = active['id'] if active else None
                    if not period_id:
                        return self._send_json(200, {"success": True, "data": []})
                    envelopes = services.get_envelopes_by_period(int(period_id))
                    return self._send_json(200, {"success": True, "data": envelopes})

                # 6. Expenses list
                elif path == "/api/expenses":
                    period_id = query_params.get("period_id", [None])[0]
                    limit = query_params.get("limit", [None])[0]
                    if not period_id:
                        active = services.get_active_period()
                        period_id = active['id'] if active else None
                    if not period_id:
                        return self._send_json(200, {"success": True, "data": []})
                    expenses = services.get_expenses_by_period(int(period_id), limit)
                    return self._send_json(200, {"success": True, "data": expenses})

                else:
                    return self._send_json(404, {"success": False, "error": "Endpoint tidak ditemukan"})

            except Exception as e:
                return self._send_json(500, {"success": False, "error": str(e)})

        # Serve static files
        if path == "/" or path == "":
            self.path = "/index.html"
        return super().do_GET()

    def do_POST(self):
        parsed_url = urllib.parse.urlparse(self.path)
        path = parsed_url.path
        body = self._parse_body()

        if not path.startswith("/api/"):
            return self._send_json(404, {"success": False, "error": "Endpoint tidak ditemukan"})

        try:
            # 1. Create Period
            if path == "/api/periods":
                nama = body.get("nama")
                start_date = body.get("start_date")
                end_date = body.get("end_date")
                catatan = body.get("catatan", "")
                copy_from = body.get("copy_from_period_id")

                if not nama or not start_date or not end_date:
                    return self._send_json(400, {"success": False, "error": "Nama, tanggal mulai, dan tanggal selesai wajib diisi"})

                new_id = services.create_period(nama, start_date, end_date, catatan, copy_from)
                return self._send_json(201, {"success": True, "message": "Periode berhasil dibuat", "data": {"id": new_id}})

            # 2. Close Period
            elif re.match(r"^/api/periods/(\d+)/close$", path):
                period_id = int(re.match(r"^/api/periods/(\d+)/close$", path).group(1))
                services.close_period(period_id)
                return self._send_json(200, {"success": True, "message": "Periode berhasil ditutup dan diarsipkan"})

            # 3. Activate Period
            elif re.match(r"^/api/periods/(\d+)/activate$", path):
                period_id = int(re.match(r"^/api/periods/(\d+)/activate$", path).group(1))
                services.activate_period(period_id)
                return self._send_json(200, {"success": True, "message": "Periode berhasil diaktifkan"})

            # 4. Add Income
            elif path == "/api/incomes":
                periode_id = body.get("periode_id")
                nominal = float(body.get("nominal", 0))
                sumber = body.get("sumber", "").strip()
                tanggal = body.get("tanggal", "").strip()
                catatan = body.get("catatan", "").strip()

                if not periode_id or not nominal or not sumber or not tanggal:
                    return self._send_json(400, {"success": False, "error": "Semua field pemasukan wajib diisi"})

                income_id = services.add_income(periode_id, nominal, sumber, tanggal, catatan)
                return self._send_json(201, {"success": True, "message": "Pemasukan berhasil dicatat", "data": {"id": income_id}})

            # 5. Add Envelope (Pos Deposit)
            elif path == "/api/envelopes":
                periode_id = body.get("periode_id")
                nama_pos = body.get("nama_pos", "").strip()
                nominal_alokasi = float(body.get("nominal_alokasi", 0))
                icon = body.get("icon", "wallet")
                color = body.get("color", "#3B82F6")

                if not periode_id or not nama_pos:
                    return self._send_json(400, {"success": False, "error": "Periode dan nama pos wajib diisi"})

                env_id = services.create_envelope(periode_id, nama_pos, nominal_alokasi, icon, color)
                return self._send_json(201, {"success": True, "message": "Pos deposit berhasil dibuat", "data": {"id": env_id}})

            # 6. Add Expense (Pengeluaran)
            elif path == "/api/expenses":
                pos_id = body.get("pos_id")
                nominal = float(body.get("nominal", 0))
                keterangan = body.get("keterangan", "").strip()
                tanggal = body.get("tanggal", "").strip()

                if not pos_id or not nominal or not keterangan or not tanggal:
                    return self._send_json(400, {"success": False, "error": "Pos deposit, nominal, keterangan, dan tanggal wajib diisi"})

                exp_id = services.add_expense(pos_id, nominal, keterangan, tanggal)
                return self._send_json(201, {"success": True, "message": "Pengeluaran berhasil dicatat", "data": {"id": exp_id}})

            else:
                return self._send_json(404, {"success": False, "error": "Endpoint tidak ditemukan"})

        except ValueError as ve:
            err_str = str(ve)
            # Check if this is an overspending error for structured frontend handling
            if "OVERSPENDING_ERROR" in err_str:
                return self._send_json(422, {
                    "success": False,
                    "is_overspending": True,
                    "error": err_str.replace("OVERSPENDING_ERROR: ", "")
                })
            return self._send_json(400, {"success": False, "error": err_str})
        except Exception as e:
            return self._send_json(500, {"success": False, "error": str(e)})

    def do_PUT(self):
        parsed_url = urllib.parse.urlparse(self.path)
        path = parsed_url.path
        body = self._parse_body()

        try:
            # Update Envelope
            if re.match(r"^/api/envelopes/(\d+)$", path):
                pos_id = int(re.match(r"^/api/envelopes/(\d+)$", path).group(1))
                nama_pos = body.get("nama_pos", "").strip()
                nominal_alokasi = float(body.get("nominal_alokasi", 0))
                icon = body.get("icon")
                color = body.get("color")

                if not nama_pos:
                    return self._send_json(400, {"success": False, "error": "Nama pos tidak boleh kosong"})

                services.update_envelope(pos_id, nama_pos, nominal_alokasi, icon, color)
                return self._send_json(200, {"success": True, "message": "Pos deposit berhasil diperbarui"})

            else:
                return self._send_json(404, {"success": False, "error": "Endpoint tidak ditemukan"})

        except ValueError as ve:
            return self._send_json(400, {"success": False, "error": str(ve)})
        except Exception as e:
            return self._send_json(500, {"success": False, "error": str(e)})

    def do_DELETE(self):
        parsed_url = urllib.parse.urlparse(self.path)
        path = parsed_url.path

        try:
            # 1. Delete Income
            if re.match(r"^/api/incomes/(\d+)$", path):
                income_id = int(re.match(r"^/api/incomes/(\d+)$", path).group(1))
                services.delete_income(income_id)
                return self._send_json(200, {"success": True, "message": "Pemasukan berhasil dihapus"})

            # 2. Delete Envelope
            elif re.match(r"^/api/envelopes/(\d+)$", path):
                pos_id = int(re.match(r"^/api/envelopes/(\d+)$", path).group(1))
                services.delete_envelope(pos_id)
                return self._send_json(200, {"success": True, "message": "Pos deposit berhasil dihapus"})

            # 3. Delete Expense
            elif re.match(r"^/api/expenses/(\d+)$", path):
                exp_id = int(re.match(r"^/api/expenses/(\d+)$", path).group(1))
                services.delete_expense(exp_id)
                return self._send_json(200, {"success": True, "message": "Pengeluaran berhasil dihapus"})

            else:
                return self._send_json(404, {"success": False, "error": "Endpoint tidak ditemukan"})

        except ValueError as ve:
            return self._send_json(400, {"success": False, "error": str(ve)})
        except Exception as e:
            return self._send_json(500, {"success": False, "error": str(e)})

def run_server(port=PORT):
    init_db()
    os.makedirs(STATIC_DIR, exist_ok=True)
    
    server_address = ('', port)
    httpd = socketserver.ThreadingTCPServer(server_address, BudgetRequestHandler)
    httpd.allow_reuse_address = True
    print(f"🚀 Server Pos Budget App berjalan di http://localhost:{port}")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n🛑 Menghentikan server...")
        httpd.shutdown()

if __name__ == "__main__":
    run_server()
