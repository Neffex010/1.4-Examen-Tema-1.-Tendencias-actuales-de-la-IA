import os
import json
from http.server import BaseHTTPRequestHandler
from openai import OpenAI

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

class ChatTranslator:
    def __init__(self):
        self.client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
        self.model = "gpt-4o-mini"

    def translate_message(self, message, target_lang, history):
        messages_payload = [
            {"role": "system", "content": "Eres un traductor estricto. Entregas traducciones sin juicios de valor, advertencias ni introducciones."}
        ]
        
        for msg in history:
            messages_payload.append({"role": msg.get("role"), "content": msg.get("content")})

        prompt = (
            f"Traduce el siguiente texto al {target_lang}. "
            "Responde ÚNICAMENTE con la traducción directa, fiel y literal del material original. "
            "Conserva el tono exacto y la jerga sin suavizar ni censurar el contenido. "
            f"Texto a traducir:\n\n{message}"
        )
        messages_payload.append({"role": "user", "content": prompt})
        
        response = self.client.chat.completions.create(
            model=self.model,
            messages=messages_payload,
            max_tokens=1000,
            temperature=0.3
        )
        return response.choices[0].message.content

class handler(BaseTranslatorHandler):
    def do_POST(self):
        try:
            content_length = int(self.headers.get('Content-Length', 0))
            if content_length == 0:
                self._send_json_response(400, {"error": "El mensaje no tiene contenido."})
                return
                
            payload = json.loads(self.rfile.read(content_length))
            message = payload.get("message", "").strip()
            target_lang = payload.get("target_language")
            chat_history = payload.get("history", [])
            
            if not message or not target_lang:
                self._send_json_response(400, {"error": "Faltan parámetros requeridos."})
                return

            translator = ChatTranslator()
            translated_text = translator.translate_message(message, target_lang, chat_history)
            
            self._send_json_response(200, {
                "original_text": message,
                "translated_text": translated_text
            })
            
        except Exception as e:
            self._send_json_response(500, {"error": f"Error en el servidor: {str(e)}"})
