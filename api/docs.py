import os
import json
import base64
import tempfile
from http.server import BaseHTTPRequestHandler
from openai import OpenAI
import PyPDF2
import docx

class BaseTranslatorHandler(BaseHTTPRequestHandler):
    """Clase base para manejar CORS y respuestas JSON (POO)."""
    
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
    """Encapsula la lógica de extracción de texto para múltiples formatos."""
    
    @staticmethod
    def extract_from_txt(file_path):
        with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
            return f.read().strip()

    @staticmethod
    def extract_from_pdf(file_path):
        text = ""
        with open(file_path, "rb") as f:
            reader = PyPDF2.PdfReader(f)
            for page in reader.pages:
                extracted = page.extract_text()
                if extracted:
                    text += extracted + "\n\n"
        return text.strip()

    @staticmethod
    def extract_from_docx(file_path):
        doc = docx.Document(file_path)
        return "\n".join([para.text for para in doc.paragraphs if para.text.strip()])

class DocumentTranslator:
    """Maneja la traducción del texto extraído de documentos con OpenAI."""
    
    def __init__(self):
        self.client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
        # Se usa un modelo con mayor contexto por si el documento es largo
        self.model = "gpt-4o-mini" 

    def translate_text(self, text, target_lang):
        prompt = (
            f"Traduce el siguiente documento al {target_lang}. "
            "Proporciona una traducción directa, fiel y literal del material original. "
            "Conserva el formato, el tono exacto y la jerga sin suavizar ni censurar el contenido. "
            "Omite por completo juicios de valor, advertencias de contenido o introducciones.\n\n"
            f"Documento:\n{text}"
        )
        
        response = self.client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": "Eres un traductor estricto de documentos técnicos y formales."},
                {"role": "user", "content": prompt}
            ],
            max_tokens=4000,
            temperature=0.3
        )
        return response.choices[0].message.content

class handler(BaseTranslatorHandler):
    """Punto de entrada REST para el procesamiento de documentos."""
    
    def do_POST(self):
        try:
            content_length = int(self.headers.get('Content-Length', 0))
            if content_length == 0:
                self._send_json_response(400, {"error": "Petición vacía."})
                return
                
            payload = json.loads(self.rfile.read(content_length))
            file_b64 = payload.get("file")
            filename = payload.get("filename", "")
            target_lang = payload.get("target_language", "es")
            
            if not file_b64 or not filename:
                self._send_json_response(400, {"error": "Archivo no seleccionado o falta el nombre."})
                return
                
            file_bytes = base64.b64decode(file_b64)
            extension = filename.split(".")[-1].lower()
            
            allowed_extensions = ["txt", "pdf", "docx"]
            if extension not in allowed_extensions:
                self._send_json_response(400, {"error": f"Formato de archivo no permitido. Solo se admiten: {', '.join(allowed_extensions)}."})
                return
                
            # Guardar el archivo temporalmente para procesarlo con las librerías
            with tempfile.NamedTemporaryFile(delete=False, suffix=f".{extension}") as tmp_file:
                tmp_file.write(file_bytes)
                tmp_path = tmp_file.name

            try:
                # Extracción según el formato
                extractor = DocumentExtractor()
                if extension == "txt":
                    extracted_text = extractor.extract_from_txt(tmp_path)
                elif extension == "pdf":
                    extracted_text = extractor.extract_from_pdf(tmp_path)
                elif extension == "docx":
                    extracted_text = extractor.extract_from_docx(tmp_path)
                
                if not extracted_text:
                    self._send_json_response(400, {"error": "Documento sin contenido procesable o ilegible."})
                    return
                
                # Limitación preventiva para evitar exceder el token limit (aprox. 15,000 caracteres)
                if len(extracted_text) > 15000:
                    self._send_json_response(400, {"error": "El documento excede el tamaño admitido para procesamiento de una sola pasada."})
                    return

                translator = DocumentTranslator()
                translated_text = translator.translate_text(extracted_text, target_lang)
                
                self._send_json_response(200, {
                    "original_text": extracted_text,
                    "translated_text": translated_text
                })
            finally:
                os.remove(tmp_path) # Limpieza del entorno
            
        except Exception as e:
            self._send_json_response(500, {"error": f"Error procesando el documento: {str(e)}"})