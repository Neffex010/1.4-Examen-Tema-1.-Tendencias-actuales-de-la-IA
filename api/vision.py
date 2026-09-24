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

ORIGINAL_MARKER = "===ORIGINAL==="
TRANSLATION_MARKER = "===TRADUCCION==="


def split_ocr_result(result):
    """Separa el texto extraido del traducido a partir del formato delimitado.

    Es tolerante: si el modelo no sigue el formato, devuelve el texto completo
    como traduccion y el original vacio (el frontend oculta el bloque original).
    """
    if NO_TEXT_MARKER in result:
        return None
    if ORIGINAL_MARKER in result and TRANSLATION_MARKER in result:
        try:
            rest = result.split(ORIGINAL_MARKER, 1)[1]
            original, translation = rest.split(TRANSLATION_MARKER, 1)
            return original.strip(), translation.strip()
        except ValueError:
            return "", result
    return "", result


class VisionTranslator:
    """Extrae y traduce el texto de una imagen usando el modelo de vision."""

    def __init__(self):
        self.client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
        self.model = "gpt-4o"

    def translate_image(self, base64_image, target_lang):
        prompt = (
            f"Extrae el texto de esta imagen y tradúcelo al {target_lang}. "
            "Responde EXCLUSIVAMENTE con este formato exacto, sin introducciones ni notas:\n"
            f"{ORIGINAL_MARKER}\n"
            "<texto original extraido, tal como aparece en la imagen>\n"
            f"{TRANSLATION_MARKER}\n"
            "<traduccion fiel del texto anterior>\n"
            f"Si no hay texto legible, devuelve exactamente: '{NO_TEXT_MARKER}'"
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

        parts = split_ocr_result(result)
        if parts is None:
            raise ValueError("No se detectó texto legible en la imagen. Intenta con otra imagen de mayor calidad.")
        original_text, translation = parts
        return {
            "original_text": original_text,
            "translation": translation or result,
        }


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
            self._send_json(200, result)
        except ValueError as exc:
            self._send_json(422, {"error": str(exc)})
        except Exception as exc:
            print(f"[vision] error interno: {exc}", flush=True)
            self._send_json(500, {"error": "Error al procesar la imagen. Inténtalo de nuevo."})