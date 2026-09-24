import base64
import binascii
import os
import sys
import tempfile

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from openai import OpenAI

from _helpers import BaseTranslatorHandler, valid_language, valid_voice

MAX_AUDIO_MB = 10
MAX_AUDIO_BYTES = MAX_AUDIO_MB * 1024 * 1024


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
                    file=audio_file,
                )

            original_text = (transcript.text or "").strip()
            if not original_text:
                raise ValueError("El audio no contiene voz reconocible. Intenta con otro archivo.")

            prompt = f"Traduce al {target_lang}. Responde EXCLUSIVAMENTE con la traduccion:\n\n{original_text}"
            translation_response = self.client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[{"role": "user", "content": prompt}],
            )
            translated_text = translation_response.choices[0].message.content

            tts_response = self.client.audio.speech.create(model="tts-1", voice=voice, input=translated_text)
            tts_b64 = base64.b64encode(tts_response.content).decode("utf-8")

            return {
                "original_text": original_text,
                "translated_text": translated_text,
                "translated_audio_b64": tts_b64,
            }
        finally:
            if os.path.exists(tmp_path):
                os.remove(tmp_path)


class handler(BaseTranslatorHandler):
    def do_POST(self):
        payload, error, status = self._read_json()
        if error:
            self._send_json(status, {"error": error})
            return

        target_lang = payload.get("target_language")
        voice = payload.get("voice", "alloy")

        if not valid_language(target_lang):
            self._send_json(400, {"error": "Idioma destino no valido. Usa 'es' o 'en'."})
            return
        if valid_voice(voice):
            voice = voice.lower()
        else:
            self._send_json(400, {"error": "Voz de sintesis no valida."})
            return

        try:
            audio_bytes = base64.b64decode(payload.get("audio") or "", validate=False)
        except (binascii.Error, ValueError):
            self._send_json(400, {"error": "El audio enviado no es Base64 valido."})
            return

        if not audio_bytes:
            self._send_json(400, {"error": "El audio esta vacio."})
            return
        if len(audio_bytes) > MAX_AUDIO_BYTES:
            self._send_json(413, {"error": f"El audio excede el limite de {MAX_AUDIO_MB}MB."})
            return

        try:
            result = AudioTranslator().process_audio(audio_bytes, target_lang.lower(), voice)
            self._send_json(200, result)
        except ValueError as exc:
            self._send_json(400, {"error": str(exc)})
        except Exception as exc:
            print(f"[audio] error interno: {exc}", flush=True)
            self._send_json(500, {"error": "Error al procesar el audio. Intentalo de nuevo."})