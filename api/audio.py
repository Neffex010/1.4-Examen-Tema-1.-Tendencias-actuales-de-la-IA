import os, json, base64, tempfile
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

class AudioTranslator:
    def __init__(self):
        self.client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

    def process_audio(self, audio_bytes, target_lang, voice):
        with tempfile.NamedTemporaryFile(delete=False, suffix=".webm") as tmp_file:
            tmp_file.write(audio_bytes)
            tmp_path = tmp_file.name
        try:
            with open(tmp_path, "rb") as audio_file:
                transcript = self.client.audio.transcriptions.create(
                    model="whisper-1", 
                    file=audio_file
                )
            original_text = transcript.text
            prompt = f"Traduce al {target_lang}. Responde EXCLUSIVAMENTE con la traducción:\n\n{original_text}"
            translation_response = self.client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[{"role": "user", "content": prompt}]
            )
            translated_text = translation_response.choices[0].message.content
            tts_response = self.client.audio.speech.create(model="tts-1", voice=voice, input=translated_text)
            tts_b64 = base64.b64encode(tts_response.content).decode('utf-8')
            return {"original_text": original_text, "translated_text": translated_text, "translated_audio_b64": tts_b64}
        finally:
            if os.path.exists(tmp_path): os.remove(tmp_path)

class handler(BaseTranslatorHandler):
    def do_POST(self):
        try:
            content_length = int(self.headers.get('Content-Length', 0))
            payload = json.loads(self.rfile.read(content_length))
            audio_bytes = base64.b64decode(payload.get("audio"))
            voice = payload.get("voice", "alloy")
            result = AudioTranslator().process_audio(audio_bytes, payload.get("target_language"), voice)
            self._send_json_response(200, result)
        except Exception as e:
            self._send_json_response(500, {"error": str(e)})
