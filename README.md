# Traductor Inteligente Multimodal 🌐

Plataforma Web responsiva de Inteligencia Artificial capaz de traducir información entre español e inglés mediante texto conversacional (Chat), audio, documentos (PDF, DOCX, TXT) e imágenes.

## 1. Problema que resuelve

Reduce las barreras del idioma en organizaciones binacionales (México-Estados Unidos) permitiendo a los usuarios intercambiar y comprender contenidos en distintos formatos (mensajes, audios, fotos y documentos) desde una única plataforma unificada.

## 2. Funcionalidades implementadas

- **Traducción Bidireccional:** Español ↔ Inglés.
- **Chat:** Conversación continua conservando el historial.
- **Audio:** Transcripción y síntesis de voz (Text-to-Speech) de la traducción.
- **Documentos:** Extracción y traducción de `.pdf`, `.docx` y `.txt`.
- **Imágenes:** Extracción de texto (OCR) y traducción de `.jpg` y `.png`.

## 3. Tecnologías utilizadas

- **Frontend:** HTML5, CSS3, JavaScript (ES6+), Bootstrap 5.
- **Backend:** Python (Serverless Functions), PyPDF2, python-docx.
- **Despliegue:** GitHub Pages (Frontend) y Vercel (Backend).

## 4. Arquitectura general de la solución

Aplicación SPA (Single Page Application) donde el Frontend gestiona la UI y el estado, comunicándose vía peticiones REST (POST) con el Backend en Vercel. El Backend actúa como middleware seguro para consumir la API de OpenAI y devolver el JSON procesado.

## 5. Uso de la API de OpenAI

- `gpt-4o-mini`: Para traducción de texto (chat y documentos) debido a su rapidez y eficiencia en procesamiento de lenguaje natural.
- `gpt-4o`: Para el módulo de visión, analizando la imagen en base64 para extraer y traducir texto.
- `whisper-1`: Para la transcripción del audio a texto original.
- `tts-1`: Para generar el audio sintetizado de la traducción final.

## 6. Programación Orientada a Objetos (POO)

- **Frontend:** Clases `UIController` (gestión del DOM), `FileManager` (validación/conversión de archivos) y `APIClient` (peticiones REST).
- **Backend:** Clases heredadas de `BaseHTTPRequestHandler` para el manejo de endpoints y clases de servicio (`VisionTranslator`, `AudioTranslator`, etc.) para encapsular la lógica de OpenAI.

## 7. Consideraciones de seguridad y privacidad

- **Credenciales:** La `OPENAI_API_KEY` reside exclusivamente en las variables de entorno de Vercel. Nunca se expone en el código fuente ni en el navegador.
- **Archivos temporales:** Los documentos y audios se procesan en la carpeta `/tmp` del entorno serverless y se eliminan inmediatamente tras la traducción con el bloque `finally`.

## 8. Formatos de archivos soportados

- **Audio:** `.webm`, `.mp3`, `.wav`, `.m4a` (Max 10MB)
- **Documentos:** `.pdf`, `.docx`, `.txt` (Max 5MB)
- **Imágenes:** `.jpg`, `.jpeg`, `.png` (Max 4MB)

## 9. Limitaciones conocidas

- Documentos extremadamente largos (>15,000 caracteres) pueden ser rechazados para evitar superar el límite de tokens por petición.
- El tiempo de respuesta en Vercel (Hobby) tiene un timeout de 10 a 60 segundos, lo que puede afectar archivos grandes.

## 10. Autor

- **Nombre:** Luis Enrique Cabrera Garcia
- **Materia:** Inteligencia Artificial Aplicada a las TIC

## 11. URLs Públicas

- **Aplicación (GitHub Pages):** [neffex010.github.io/1.4-Examen-Tema-1.-Tendencias-actuales-de-la-IA](https://neffex010.github.io/1.4-Examen-Tema-1.-Tendencias-actuales-de-la-IA/)
-
