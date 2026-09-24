import base64
import binascii
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from openai import OpenAI

from _helpers import BaseTranslatorHandler, valid_language

MAX_IMAGE_MB = 4
MAX_IMAGE_BYTES = MAX_IMAGE_MB * 1024 * 1024

NO_TEXT_MARKER = "No se detectó texto legible en la imagen."


class VisionTranslator:
    """Extrae y traduce el texto de una imagen usando el modelo de vision."""

    def __init__(self):
        self.client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
        self.model = "gpt-4o"

    def translate_image(self, base64_image, target_lang):
        prompt = (
            f"Extrae el texto de esta imagen y tradúcelo al {target_lang}. "
            "Devuelve EXCLUSIVAMENTE el texto traducido. Si no hay texto legible, "
            f"devuelve exactamente: '{NO_TEXT_MARKER}'"
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
                            "image_url": {"url": f"data:image/jpeg;base64,{base64_image}"},
                        },
                    ],
                }
            ],
            max_tokens=1500,
        )
        result = response.choices[0].message.content or ""

        if NO_TEXT_MARKER in result:
            raise ValueError("No se detectó texto legible en la imagen. Intenta con otra imagen de mayor calidad.")
        return result


class handler(BaseTranslatorHandler):
    def do_POST(self):
        payload, error, status = self._read_json()
        if error:
            self._send_json(status, {"error": error})
            return

        base64_img = payload.get("image")
        target_language = payload.get("target_language")

        if not base64_img:
            self._send_json(400, {"error": "La imagen está vacía."})
            return
        if not valid_language(target_language):
            self._send_json(400, {"error": "Idioma destino no válido. Usa 'es' o 'en'."})
            return

        try:
            image_bytes = base64.b64decode(base64_img, validate=True)
        except (binascii.Error, ValueError):
            self._send_json(400, {"error": "La imagen enviada no es Base64 válido."})
            return

        if len(image_bytes) > MAX_IMAGE_BYTES:
            self._send_json(413, {"error": f"La imagen excede el límite de {MAX_IMAGE_MB}MB."})
            return

        try:
            translator = VisionTranslator()
            result = translator.translate_image(base64_img, target_language.lower())
            self._send_json(200, {"translation": result})
        except ValueError as exc:
            self._send_json(422, {"error": str(exc)})
        except Exception as exc:
            print(f"[vision] error interno: {exc}", flush=True)
            self._send_json(500, {"error": "Error al procesar la imagen. Inténtalo de nuevo."})