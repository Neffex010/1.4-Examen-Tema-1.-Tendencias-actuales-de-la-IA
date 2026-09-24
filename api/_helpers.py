"""Helpers compartidos para las Serverless Functions de Vercel.

Centraliza el manejo de CORS, respuestas JSON, validacion de entrada,
rate limiting ligero y utilidades de saneado de texto.
"""

import json
import re
import time
from http.server import BaseHTTPRequestHandler

ALLOWED_ORIGINS = {"https://neffex010.github.io"}
ALLOWED_LANGUAGES = {"es", "en"}
ALLOWED_VOICES = {"alloy", "echo", "fable", "nova", "onyx", "shimmer"}
ALLOWED_DOC_EXTENSIONS = {"txt", "pdf", "docx"}
ALLOWED_IMAGE_EXTENSIONS = {"jpg", "jpeg", "png"}

MAX_BODY_BYTES = 15 * 1024 * 1024  # 15MB de JSON (audio 10MB en base64 + overhead)
RATE_LIMIT_WINDOW_SECONDS = 60
RATE_LIMIT_MAX_REQUESTS = 20

_hits = {}


def _now():
    return time.time()


def is_rate_limited(ip, limit=RATE_LIMIT_MAX_REQUESTS, window=RATE_LIMIT_WINDOW_SECONDS):
    """Rate limiter en memoria; protege contra abuso basico dentro de una instancia.

    Nota: en Vercel cada instancia es efimera y tiene su propia tabla,
    por lo que es una defensa parcial (mejor que nada) ante el abuso.
    """
    now = _now()
    bucket = _hits.get(ip)
    if bucket is None:
        _hits[ip] = [now]
        return False
    cutoff = now - window
    while bucket and bucket[-1] < cutoff:
        bucket.pop()
    if not bucket:
        del _hits[ip]
        return False
    if len(bucket) >= limit:
        return True
    bucket.insert(0, now)
    return False


def origin_is_allowed(origin):
    if not origin:
        return True
    if origin in ALLOWED_ORIGINS:
        return True
    if origin.startswith("http://localhost") or origin.startswith("https://localhost"):
        return True
    return False


def valid_language(value):
    return isinstance(value, str) and value.strip().lower() in ALLOWED_LANGUAGES


def valid_voice(value):
    return isinstance(value, str) and value.strip().lower() in ALLOWED_VOICES


def valid_extension(value, allowed):
    return isinstance(value, str) and value.lower() in allowed


def clean_xml(text):
    """Elimina caracteres de control no permitidos por XML 1.0."""
    return re.sub(r"[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]", "", str(text))


def sanitize_latin1(text):
    """Normaliza comillas tipograficas y garantiza representacion latin-1 (PDF)."""
    t = str(text)
    t = (t.replace("\u2018", "'").replace("\u2019", "'")
         .replace("\u201c", '"').replace("\u201d", '"')
         .replace("\u2013", "-").replace("\u2014", "-")
         .replace("\u2026", "...")
         .replace("\t", "    "))
    return t.encode("latin-1", "replace").decode("latin-1")


class BaseTranslatorHandler(BaseHTTPRequestHandler):
    """Clase base que unifica CORS, respuestas JSON y lectura segura del body."""

    def _set_cors_headers(self):
        origin = self.headers.get("Origin", "")
        if origin_is_allowed(origin):
            self.send_header("Access-Control-Allow-Origin", origin or "*")
            self.send_header("Vary", "Origin")
            self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")

    def _send_json(self, status_code, data):
        body = json.dumps(data).encode("utf-8")
        self.send_response(status_code)
        self.send_header("Content-type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self._set_cors_headers()
        self.end_headers()
        self.wfile.write(body)

    def _read_json(self, limit_bytes=MAX_BODY_BYTES):
        """Lee y valida el body JSON. Devuelve (payload, error, status_code)."""
        origin = self.headers.get("Origin", "")
        if not origin_is_allowed(origin):
            return None, "Origen no permitido para esta API.", 403

        try:
            client_ip = self.client_address[0]
        except Exception:
            client_ip = "unknown"
        if is_rate_limited(client_ip):
            return None, "Has realizado demasiadas solicitudes. Espera un momento.", 429

        try:
            content_length = int(self.headers.get("Content-Length", 0) or 0)
        except (TypeError, ValueError):
            return None, "Cabecera Content-Length invalida.", 400

        if content_length <= 0:
            return None, "El cuerpo de la solicitud esta vacio.", 400
        if content_length > limit_bytes:
            return None, "La solicitud excede el tamano maximo permitido.", 413

        try:
            raw = self.rfile.read(content_length) or b""
        except Exception:
            return None, "Error al leer el cuerpo de la solicitud.", 400

        if not raw:
            return None, "El cuerpo de la solicitud esta vacio.", 400

        try:
            payload = json.loads(raw.decode("utf-8-sig"))
        except (ValueError, UnicodeDecodeError):
            return None, "El cuerpo debe ser un JSON valido.", 400

        if not isinstance(payload, dict):
            return None, "El cuerpo debe ser un objeto JSON.", 400

        return payload, None, 200

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Max-Age", "600")
        self._set_cors_headers()
        self.end_headers()