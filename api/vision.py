import os
import json
from http.server import BaseHTTPRequestHandler
from openai import OpenAI

class BaseTranslatorHandler(BaseHTTPRequestHandler):
    """Clase base para manejar CORS y respuestas JSON estructuradas (POO)."""
    
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
        """Resuelve el preflight CORS automático de los navegadores."""
        self.send_response(200)
        self._set_cors_headers()
        self.end_headers()

class VisionTranslator:
    """Maneja la lógica de extracción y traducción de texto en imágenes vía OpenAI."""
    
    def __init__(self):
        self.client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
        self.model = "gpt-4o"

    def translate_image(self, base64_image, target_lang):
        prompt = (
            f"Extrae el texto de esta imagen y tradúcelo al {target_lang}. "
            "Devuelve EXCLUSIVAMENTE el texto traducido. Si no hay texto legible, "
            "devuelve exactamente: 'No se detectó texto legible en la imagen.'"
        )
        
        response = self.client.chat.completions.create(
            model=self.model,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {
                            "type": "image_url", 
                            "image_url": {"url": f"data:image/jpeg;base64,{base64_image}"}
                        }
                    ],
                }
            ],
            max_tokens=1500
        )
        return response.choices[0].message.content

class handler(BaseTranslatorHandler):
    """Punto de entrada REST para Vercel Serverless Functions."""
    
    def do_POST(self):
        try:
            content_length = int(self.headers.get('Content-Length', 0))
            if content_length == 0:
                self._send_json_response(400, {"error": "Cuerpo de la petición vacío."})
                return
                
            payload = json.loads(self.rfile.read(content_length))
            base64_img = payload.get("image")
            target_language = payload.get("target_language")
            
            if not base64_img or not target_language:
                self._send_json_response(400, {"error": "Faltan parámetros requeridos (image, target_language)."})
                return

            translator = VisionTranslator()
            result = translator.translate_image(base64_img, target_language)
            
            self._send_json_response(200, {"translation": result})
            
        except Exception as e:
            self._send_json_response(500, {"error": f"Error interno del servidor: {str(e)}"})