import os, json, base64, tempfile
from http.server import BaseHTTPRequestHandler
from openai import OpenAI
import PyPDF2, docx
from fpdf import FPDF

class BaseTranslatorHandler(BaseHTTPRequestHandler):
    def _set_cors_headers(self):
        self.send_header('Access-Control-Allow-Origin', 'https://neffex010.github.io')
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

                # Generar DOCX con estilos
                doc_out = docx.Document()
                try:
                    doc_out.core_properties.title = f"Traduccion - {payload.get('filename', 'documento')}"
                    doc_out.core_properties.author = "Traductor Inteligente IA"
                except Exception:
                    pass

                from docx.shared import Cm as _Cm
                for section in doc_out.sections:
                    section.top_margin = _Cm(2.5)
                    section.bottom_margin = _Cm(2.5)
                    section.left_margin = _Cm(2.5)
                    section.right_margin = _Cm(2.5)

                doc_out.add_heading('Traduccion', level=0)
                for _line in translated_text.split('\n'):
                    _s = _line.strip()
                    if not _s:
                        continue
                    if _s.startswith('### '):
                        doc_out.add_heading(_s[4:], level=3)
                    elif _s.startswith('## '):
                        doc_out.add_heading(_s[3:], level=2)
                    elif _s.startswith('# '):
                        doc_out.add_heading(_s[2:], level=1)
                    elif _s.startswith('- ') or _s.startswith('* '):
                        doc_out.add_paragraph(_s[2:], style='List Bullet')
                    else:
                        doc_out.add_paragraph(_s)

                docx_path = f"{tmp_path}_out.docx"
                doc_out.save(docx_path)
                with open(docx_path, "rb") as f: docx_b64 = base64.b64encode(f.read()).decode('utf-8')

                # Generar PDF con estilos
                class _PDF(FPDF):
                    def header(self):
                        self.set_font('Helvetica', 'B', 9)
                        self.set_text_color(120, 120, 120)
                        self.cell(0, 8, 'Traduccion - Traductor Inteligente IA', 0, 1, 'R')
                        self.ln(2)
                        self.set_x(self.l_margin)
                        self.set_text_color(30, 30, 30)
                        self.set_font('Helvetica', size=11)
                    def footer(self):
                        self.set_y(-15)
                        self.set_font('Helvetica', 'I', 8)
                        self.set_text_color(150, 150, 150)
                        self.cell(0, 10, f'Pagina {self.page_no()}/{{nb}}', 0, 0, 'C')

                def _sanitize(t):
                    t = (t.replace('\u2018', "'").replace('\u2019', "'")
                          .replace('\u201c', '"').replace('\u201d', '"')
                          .replace('\u2013', '-').replace('\u2014', '-')
                          .replace('\u2026', '...'))
                    return t.encode('latin-1', 'replace').decode('latin-1')

                pdf = _PDF()
                pdf.alias_nb_pages()
                pdf.set_auto_page_break(auto=True, margin=20)
                pdf.set_margins(20, 20, 20)
                pdf.add_page()
                pdf.set_text_color(30, 30, 30)

                pdf.set_font("Helvetica", "B", 18)
                pdf.set_text_color(20, 60, 120)
                pdf.cell(0, 12, _sanitize('Traduccion'), 0, 1)
                pdf.ln(4)
                pdf.set_text_color(30, 30, 30)
                pdf.set_font("Helvetica", size=11)

                for _line in translated_text.split('\n'):
                    _s = _line.strip()
                    if not _s:
                        pdf.ln(3)
                    elif _s.startswith('### '):
                        pdf.set_font("Helvetica", "B", 13)
                        pdf.ln(2)
                        pdf.multi_cell(0, 7, text=_sanitize(_s[4:]))
                        pdf.set_font("Helvetica", size=11)
                        pdf.ln(1)
                    elif _s.startswith('## '):
                        pdf.set_font("Helvetica", "B", 15)
                        pdf.ln(3)
                        pdf.multi_cell(0, 8, text=_sanitize(_s[3:]))
                        pdf.set_font("Helvetica", size=11)
                        pdf.ln(2)
                    elif _s.startswith('# '):
                        pdf.set_font("Helvetica", "B", 16)
                        pdf.ln(4)
                        pdf.multi_cell(0, 9, text=_sanitize(_s[2:]))
                        pdf.set_font("Helvetica", size=11)
                        pdf.ln(3)
                    elif _s.startswith('- ') or _s.startswith('* '):
                        pdf.multi_cell(0, 6, text=_sanitize('  - ' + _s[2:]))
                    else:
                        pdf.multi_cell(0, 6, text=_sanitize(_s))

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
