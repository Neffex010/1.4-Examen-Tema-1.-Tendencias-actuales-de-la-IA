import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from openai import OpenAI

from _helpers import BaseTranslatorHandler, valid_language

MAX_MESSAGE_CHARS = 8000
MAX_HISTORY_MESSAGES = 12


class ChatTranslator:
    def __init__(self):
        self.client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
        self.model = "gpt-4o-mini"

    def translate_message(self, message, target_lang, history):
        messages_payload = [
            {
                "role": "system",
                "content": "Eres un traductor estricto. Entregas traducciones sin juicios de valor, "
                           "advertencias ni introducciones.",
            }
        ]

        for msg in history[-MAX_HISTORY_MESSAGES:]:
            role = msg.get("role")
            content = (msg.get("content") or "").strip()
            if role in ("user", "assistant") and content:
                messages_payload.append({"role": role, "content": content[:MAX_MESSAGE_CHARS]})

        prompt = (
            f"Traduce el siguiente texto al {target_lang}. "
            "Responde UNICAMENTE con la traduccion directa, fiel y literal del material original. "
            "Conserva el tono exacto y la jerga sin suavizar ni censurar el contenido. "
            f"Texto a traducir:\n\n{message}"
        )
        messages_payload.append({"role": "user", "content": prompt})

        response = self.client.chat.completions.create(
            model=self.model,
            messages=messages_payload,
            max_tokens=1000,
            temperature=0.3,
        )
        return response.choices[0].message.content


class handler(BaseTranslatorHandler):
    def do_POST(self):
        payload, error, status = self._read_json()
        if error:
            self._send_json(status, {"error": error})
            return

        message = str(payload.get("message") or "").strip()
        target_lang = payload.get("target_language")
        history = payload.get("history") if isinstance(payload.get("history"), list) else []

        if not message:
            self._send_json(400, {"error": "El mensaje esta vacio."})
            return
        if len(message) > MAX_MESSAGE_CHARS:
            self._send_json(413, {"error": f"El mensaje excede los {MAX_MESSAGE_CHARS} caracteres."})
            return
        if not valid_language(target_lang):
            self._send_json(400, {"error": "Idioma destino no valido. Usa 'es' o 'en'."})
            return

        try:
            translator = ChatTranslator()
            translated_text = translator.translate_message(message, target_lang.lower(), history)
            self._send_json(200, {
                "original_text": message,
                "translated_text": translated_text,
            })
        except Exception as exc:
            print(f"[chat] error interno: {exc}", flush=True)
            self._send_json(500, {"error": "Error al traducir el mensaje. Intentalo de nuevo."})