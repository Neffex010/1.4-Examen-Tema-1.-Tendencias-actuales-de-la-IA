import os
import json
import base64
import tempfile
from http.server import BaseHTTPRequestHandler
from openai import OpenAI

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

class AudioTranslator:
    def __init__(self):
        self.client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

    def process_audio(self, audio_bytes, target_lang):
        # Manejo temporal del archivo de audio en el entorno serverless (/tmp)
        with tempfile.NamedTemporaryFile(delete=False, suffix=".webm") as tmp_file:
            tmp_file.write(audio_bytes)
            tmp_path = tmp_file.name

        try:
            # 1. Transcripción (Whisper)
            with open(tmp_path, "rb") as audio_file:
                transcript = self.client.audio.transcriptions.create(
                    model="whisper-1", 
                    file=audio_file
                )
            original_text = transcript.text
            
            # 2. Traducción (GPT-4o-mini)
            prompt = (
                f"Traduce el siguiente texto al idioma {target_lang}. "
                "Responde EXCLUSIVAMENTE con la traducción, sin introducciones ni notas:\n\n"
                f"{original_text}"
            )
            translation_response = self.client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": "Eres un traductor estricto y literal."},
                    {"role": "user", "content": prompt}
                ]
            )
            translated_text = translation_response.choices[0].message.content
            
            # 3. Síntesis de voz (TTS)
            tts_response = self.client.audio.speech.create(
                model="tts-1",
                voice="alloy",
                input=translated_text
            )
            
            tts_b64 = base64.b64encode(tts_response.content).decode('utf-8')
            
            return {
                "original_text": original_text,
                "translated_text": translated_text,
                "translated_audio_b64": tts_b64
            }
        finally:
            os.remove(tmp_path)

class handler(BaseTranslatorHandler):
    def do_POST(self):
        try:
            content_length = int(self.headers.get('Content-Length', 0))
            if content_length == 0:
                self._send_json_response(400, {"error": "Cuerpo de la petición vacío."})
                return
                
            payload = json.loads(self.rfile.read(content_length))
            audio_b64 = payload.get("audio")
            target_lang = payload.get("target_language")
            
            if not audio_b64 or not target_lang:
                self._send_json_response(400, {"error": "Faltan parámetros (audio, target_language)."})
                return
                
            audio_bytes = base64.b64decode(audio_b64)
            
            translator = AudioTranslator()
            result = translator.process_audio(audio_bytes, target_lang)
            
            self._send_json_response(200, result)
            
        except Exception as e:
            self._send_json_response(500, {"error": f"Error interno: {str(e)}"})