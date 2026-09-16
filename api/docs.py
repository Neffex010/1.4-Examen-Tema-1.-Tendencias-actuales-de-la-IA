import os, json, base64, tempfile
from http.server import BaseHTTPRequestHandler
from openai import OpenAI
import PyPDF2, docx
from fpdf import FPDF

class BaseTranslatorHandler(BaseHTTPRequestHandler):
    def _set_cors_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    def _send_json_response(self, status_code, data):
        self.send_response(status_code)
        self.send_header('Content-type', 'application/json')
        self._set_cors_headers()
        self.end_headers()
        self.wfile.write(json.dumps(data).encode('utf-8'))
    def do_OPTIONS(self):
        self.send_response(200)
        self._set_cors_headers()
        self.end_headers()

class DocumentExtractor:
    @staticmethod
    def extract_from_txt(path):
        with open(path, "r", encoding="utf-8", errors="ignore") as f: return f.read().strip()
    @staticmethod
    def extract_from_pdf(path):
        text = ""
        with open(path, "rb") as f:
            for page in PyPDF2.PdfReader(f).pages: text += (page.extract_text() or "") + "\n"
        return text.strip()
    @staticmethod
    def extract_from_docx(path):
        return "\n".join([p.text for p in docx.Document(path).paragraphs if p.text.strip()])

class handler(BaseTranslatorHandler):
    def do_POST(self):
        try:
            content_length = int(self.headers.get('Content-Length', 0))
            payload = json.loads(self.rfile.read(content_length))
            file_bytes = base64.b64decode(payload.get("file"))
            extension = payload.get("filename").split(".")[-1].lower()
            
            with tempfile.NamedTemporaryFile(delete=False, suffix=f".{extension}") as tmp_file:
                tmp_file.write(file_bytes)
                tmp_path = tmp_file.name

            try:
                ext = DocumentExtractor()
                text = ext.extract_from_txt(tmp_path) if extension=="txt" else (ext.extract_from_pdf(tmp_path) if extension=="pdf" else ext.extract_from_docx(tmp_path))
                if len(text) < 5: return self._send_json_response(400, {"error": "Documento sin texto procesable."})
                
                client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
                trans_res = client.chat.completions.create(
                    model="gpt-4o-mini",
                    messages=[{"role": "user", "content": f"Traduce al {payload.get('target_language', 'es')} manteniendo el formato exacto:\n\n{text}"}]
                )
                translated_text = trans_res.choices[0].message.content

                # Generar DOCX
                doc_out = docx.Document()
                doc_out.add_paragraph(translated_text)
                docx_path = f"{tmp_path}_out.docx"
                doc_out.save(docx_path)
                with open(docx_path, "rb") as f: docx_b64 = base64.b64encode(f.read()).decode('utf-8')

                # Generar PDF (Sanitizando Unicode para FPDF)
                pdf = FPDF()
                pdf.add_page()
                pdf.set_font("Helvetica", size=11)
                
                # Reemplazo manual de caracteres tipográficos conflictivos
                clean_pdf_text = translated_text.replace("‘", "'").replace("’", "'").replace("“", '"').replace("”", '"').replace("–", "-").replace("—", "-")
                # Forzar codificación compatible con fuentes estándar (soporta acentos y ñ)
                clean_pdf_text = clean_pdf_text.encode('latin-1', 'replace').decode('latin-1')
                
                pdf.multi_cell(0, 6, text=clean_pdf_text)
                pdf_path = f"{tmp_path}_out.pdf"
                pdf.output(pdf_path)
                with open(pdf_path, "rb") as f: pdf_b64 = base64.b64encode(f.read()).decode('utf-8')

                self._send_json_response(200, {
                    "original_text": text,
                    "translated_text": translated_text,
                    "docx_b64": docx_b64,
                    "pdf_b64": pdf_b64
                })
            finally:
                for p in [tmp_path, f"{tmp_path}_out.docx", f"{tmp_path}_out.pdf"]:
                    if os.path.exists(p): os.remove(p)
        except Exception as e:
            self._send_json_response(500, {"error": str(e)})