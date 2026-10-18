from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs
from pathlib import Path
import json, secrets, threading, time, mimetypes, socket

ROOT = Path(__file__).resolve().parent
HOST = "0.0.0.0"  # allow devices on the same Wi-Fi to reach this PC
PORT = 8000

def lan_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("192.0.2.1", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"
SESSIONS = {}
LOCK = threading.Lock()

class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        super().end_headers()

    def do_GET(self):
        path = urlparse(self.path).path
        if path == "/api/session":
            token = secrets.token_urlsafe(18)
            with LOCK:
                SESSIONS[token] = {"created": time.time(), "phone": False, "phones": 0, "motion": None}
            self.send_json({"token": token, "expires_in": 1800, "lan_ip": lan_ip(), "port": PORT})
            return
        if path == "/api/status":
            token = parse_qs(urlparse(self.path).query).get("token", [""])[0]
            with LOCK:
                session = SESSIONS.get(token)
                if session and time.time() - session["created"] > 1800:
                    SESSIONS.pop(token, None)
                    session = None
            self.send_json({"valid": bool(session), "phone": bool(session and session["phone"]),
                            "motion": session.get("motion") if session else None})
            return
        if path == "/phone":
            query = urlparse(self.path).query
            self.path = "/static/phone.html" + (("?" + query) if query else "")
        elif path == "/":
            self.path = "/static/index.html"
        return super().do_GET()

    def do_POST(self):
        path = urlparse(self.path).path
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length > 12000:
                self.send_json({"error": "Payload too large"}, 413); return
            data = json.loads(self.rfile.read(length) or b"{}")
        except Exception:
            self.send_json({"error": "Invalid JSON"}, 400); return
        token = str(data.get("token", ""))
        with LOCK:
            session = SESSIONS.get(token)
            if not session or time.time() - session["created"] > 1800:
                SESSIONS.pop(token, None)
                self.send_json({"error": "Session expired. Create a new QR code."}, 404); return
            if path == "/api/join":
                session["phones"] = int(session.get("phones", 0)) + 1
                session["phone"] = True
                self.send_json({"ok": True, "controllers": session["phones"]}); return
            if path == "/api/motion":
                if not session["phone"]:
                    self.send_json({"error": "Phone has not joined"}, 409); return
                # Only numeric orientation values are accepted.
                vals = {}
                for k in ("alpha", "beta", "gamma"):
                    try: vals[k] = max(-360.0, min(360.0, float(data.get(k, 0))))
                    except (ValueError, TypeError): vals[k] = 0.0
                session["motion"] = {"alpha": vals["alpha"], "beta": vals["beta"],
                                     "gamma": vals["gamma"], "at": time.time()}
                self.send_json({"ok": True}); return
            if path == "/api/disconnect":
                session["phones"] = max(0, int(session.get("phones", 1)) - 1)
                session["phone"] = session["phones"] > 0
                if not session["phone"]:
                    session["motion"] = None
                self.send_json({"ok": True, "controllers": session["phones"]}); return
        self.send_json({"error": "Not found"}, 404)

    def send_json(self, obj, status=200):
        raw = json.dumps(obj).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def log_message(self, fmt, *args):
        print("[MOTION 3D]", fmt % args)

if __name__ == "__main__":
    print("=" * 58)
    print("  MOTION 3D — local prototype")
    print(f"  PC:   http://127.0.0.1:{PORT}")
    print(f"  Wi-Fi phone URL: http://{lan_ip()}:{PORT}")
    print("  Keep this window open while using the app.")
    print("  LAN URL allows phones on the same Wi-Fi to reach this PC.")
    print("  Motion sensors may still require HTTPS in your mobile browser.")
    print("=" * 58)
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping MOTION 3D...")
    finally:
        server.server_close()
