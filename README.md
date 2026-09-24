# Traductor Inteligente Multimodal 🌐

Plataforma Web responsiva de Inteligencia Artificial capaz de traducir información entre español e inglés mediante texto conversacional (Chat), audio, documentos (PDF, DOCX, TXT) e imágenes.

## 1. Problema que resuelve

Reduce las barreras del idioma en organizaciones binacionales (México-Estados Unidos) permitiendo a los usuarios intercambiar y comprender contenidos en distintos formatos (mensajes, audios, fotos y documentos) desde una única plataforma unificada.

## 2. Funcionalidades implementadas

- **Traducción Bidireccional:** Español ↔ Inglés.
- **Chat:** Conversación continua conservando el historial, persistido en el navegador (se restaura al recargar), con opción de **regenerar** un mensaje, **dictado por voz** y exportación del chat en Markdown.
- **Audio:** Transcripción y síntesis de voz (Text-to-Speech) de la traducción, con grabación de micrófono limitada a 60 s y detección automática de idioma.
- **Documentos:** Extracción y traducción de `.pdf`, `.docx` y `.txt`, con descargas nombradas según el archivo original.
- **Imágenes:** Extracción de texto (OCR) y traducción de `.jpg` y `.png`, mostrando además el texto original extraído. Las imágenes se optimizan en el cliente antes de enviarse.

### UX adicional
- **Progreso en vivo:** Líneas de avance con etapas y cronómetro (ej. "Transcribiendo… 4s") en audio, documentos e imágenes.
- **Cancelación:** Botón para cancelar una petición en curso sin recargar la página.
- **Retroalimentación:** Skeleton loaders, indicador de escritura del chat y toasts con el tiempo de cada traducción.
- **Persistencia:** Tema, idiomas y voz recordados entre sesiones (localStorage).
- **Accesibilidad:** Indicador de conexión online/offline, `aria-live` para lectores de pantalla, avisos de tamaño antes de subir archivos y soporte de `prefers-reduced-motion`.

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
- **Validación server-side:** Cada endpoint valida idioma destino, voz TTS, formato, tamaño (base64 decodificado) y longitud de contenido antes de llamar a OpenAI. El límite de 15,000 caracteres para documentos ahora está aplicado en el servidor.
- **Rate limiting:** Los endpoints incluyen un limitador por IP en memoria (20 peticiones/minuto). Nota: al ser instancias efímeras de Vercel, es una defensa parcial; para protección completa considera Vercel KV/Upstash.
- **CORS:** Solo se permite el origen configurado (`https://neffex010.github.io`) y `localhost` para desarrollo, de forma consistente entre Vercel y los handlers.
- **Saneado en el frontend:** Los textos se insertan escapados y el Markdown se sanitiza con DOMPurify antes de renderizar (previene XSS).
- **Errores genéricos:** El backend no filtra detalles internos al cliente; los errores técnicos solo se registran en los logs del servidor.
- **Archivos temporales:** Los documentos y audios se procesan en la carpeta `/tmp` del entorno serverless y se eliminan inmediatamente tras la traducción con el bloque `finally`.

## 8. Formatos de archivos soportados

- **Audio:** `.webm`, `.mp3`, `.wav`, `.m4a` (Max 10MB)
- **Documentos:** `.pdf`, `.docx`, `.txt` (Max 5MB)
- **Imágenes:** `.jpg`, `.jpeg`, `.png` (Max 4MB)

## 9. Limitaciones conocidas

- Documentos mayores a 15,000 caracteres son rechazados con un mensaje claro para evitar superar el límite de tokens por petición.
- El tiempo de respuesta en Vercel está limitado (10s por defecto; 60s configurado para audio y documentos), lo que puede afectar archivos grandes.
- El rate limiter es por instancia (memoria), por lo que con alta concurrencia puede no aplicar en todos los casos.

## 10. Desarrollo local y pruebas

```bash
# 1. Crear e instalar dependencias
python -m venv .venv
.venv\Scripts\activate          # Windows
pip install -r requirements.txt
pip install -r requirements-dev.txt

# 2. Configurar credenciales
copy .env.example .env          # Windows
# Editar .env con tu OPENAI_API_KEY

# 3. Levantar las funciones serverless localmente (requiere Vercel CLI)
vercel dev

# 4. Ejecutar pruebas
python -m pytest -v
```

El flujo de CI (GitHub Actions) compila los fuentes Python y ejecuta las pruebas en cada push.

## 11. Autor

- **Nombre:** Luis Enrique Cabrera Garcia
- **Materia:** Inteligencia Artificial Aplicada a las TIC

## 12. URLs Públicas

- **Aplicación (GitHub Pages):** [neffex010.github.io/1.4-Examen-Tema-1.-Tendencias-actuales-de-la-IA](https://neffex010.github.io/1.4-Examen-Tema-1.-Tendencias-actuales-de-la-IA/)
-
