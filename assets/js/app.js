const VERCEL_URL = "https://1-4-examen-tema-1-tendencias-actual-one.vercel.app/api";
const api = new APIClient(VERCEL_URL);
const THEME_STORAGE_KEY = 'translator-theme';
const CHAT_STORAGE_KEY = 'translator-chat';
const PREFS_STORAGE_KEY = 'translator-prefs';
const MAX_RECORD_MS = 59000;

const BTN_CHAT = '<i class="bi bi-send"></i> Enviar';
const BTN_TRANSLATE = '<i class="bi bi-translate"></i> Traducir';
const BTN_EXTRACT = '<i class="bi bi-search"></i> Extraer';
const EMPTY_CHAT_HTML = '<div class="text-center text-muted mt-5"><i class="bi bi-robot display-4 opacity-50"></i><p class="mt-2">Inicia una conversación para traducir</p></div>';

const storage = {
    get(key, fallback) {
        try {
            const raw = localStorage.getItem(key);
            return raw ? JSON.parse(raw) : fallback;
        } catch (err) {
            return fallback;
        }
    },
    set(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch (err) { /* localStorage no disponible */ }
    },
    del(key) {
        try {
            localStorage.removeItem(key);
        } catch (err) { /* localStorage no disponible */ }
    }
};

(async function applyTheme() {
    const btnTheme = document.getElementById('theme-toggle');
    let savedTheme = null;
    try { savedTheme = localStorage.getItem(THEME_STORAGE_KEY); } catch (err) { /* localStorage no disponible */ }
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const theme = savedTheme || (prefersDark ? 'dark' : 'light');
    document.documentElement.setAttribute('data-bs-theme', theme);
    if (btnTheme) {
        btnTheme.innerHTML = theme === 'dark' ? '<i class="bi bi-sun"></i> Claro' : '<i class="bi bi-moon-stars"></i> Oscuro';
    }
})();

function updateLangLabels(targetLang) {
    const isEn = targetLang === 'en';
    const src = isEn ? 'ES' : 'EN';
    const dst = isEn ? 'EN' : 'ES';
    const map = {
        'audio-original-label': `Transcripción Original (${src})`,
        'audio-target-label':   `Traducción (${dst})`,
        'docs-original-label':  `Original (${src})`,
        'docs-target-label':    `Traducción (${dst})`,
        'vision-target-label':  `Traducción Extraída (${dst})`
    };
    for (const id in map) {
        const el = document.getElementById(id);
        if (el) el.textContent = map[id];
    }
}

const elapsed = start => `${Math.max(1, Math.round((Date.now() - start) / 1000))}s`;

document.addEventListener('DOMContentLoaded', () => {
    const themeToggle = document.getElementById('theme-toggle');
    themeToggle.addEventListener('click', () => {
        const html = document.documentElement;
        const next = html.getAttribute('data-bs-theme') === 'dark' ? 'light' : 'dark';
        html.setAttribute('data-bs-theme', next);
        themeToggle.innerHTML = next === 'dark' ? '<i class="bi bi-sun"></i> Claro' : '<i class="bi bi-moon-stars"></i> Oscuro';
        try { localStorage.setItem(THEME_STORAGE_KEY, next); } catch (err) { /* localStorage no disponible */ }
    });

    // Indicador online/offline
    const connBadge = document.getElementById('conn-status');
    if (connBadge) {
        const updateConn = () => {
            const online = navigator.onLine;
            connBadge.classList.toggle('d-none', online);
            if (!online) UIController.showAlert('Sin conexión a internet. Revisa tu red.', 'warning');
        };
        window.addEventListener('online', () => { updateConn(); UIController.showAlert('Conexión restablecida', 'success'); });
        window.addEventListener('offline', updateConn);
        updateConn();
    }

    // Preferencias persistidas (idiomas y voz)
    const prefs = storage.get(PREFS_STORAGE_KEY, {});
    const persistPrefs = () => {
        prefs.chatLang = document.getElementById('chat-target-lang')?.value;
        prefs.audioLang = document.getElementById('audio-target-lang')?.value;
        prefs.audioVoice = document.getElementById('audio-voice')?.value;
        prefs.docsLang = document.getElementById('docs-target-lang')?.value;
        prefs.visionLang = document.getElementById('vision-target-lang')?.value;
        storage.set(PREFS_STORAGE_KEY, prefs);
    };
    const applyPrefs = () => {
        const apply = (id, value) => {
            if (!value) return;
            const el = document.getElementById(id);
            if (el) el.value = value;
        };
        apply('chat-target-lang', prefs.chatLang);
        apply('audio-target-lang', prefs.audioLang);
        apply('audio-voice', prefs.audioVoice);
        apply('docs-target-lang', prefs.docsLang);
        apply('vision-target-lang', prefs.visionLang);
    };
    applyPrefs();
    document.querySelectorAll('select').forEach(sel => sel.addEventListener('change', persistPrefs));

    // Drag & Drop accesible (teclado incluido) + aviso de tamaño
    document.querySelectorAll('.drop-zone').forEach(zone => {
        const input = zone.querySelector('input[type="file"]');
        const textElement = zone.querySelector('.drop-text');
        const originalText = textElement.innerHTML;
        const maxMb = input.dataset.maxMb ? parseFloat(input.dataset.maxMb) : null;
        zone.setAttribute('tabindex', '0');
        zone.setAttribute('role', 'button');
        const handleFile = () => {
            if (input.files.length) {
                textElement.innerHTML = `<i class="bi bi-file-earmark-check text-success"></i> ${UIController.escapeHtml(input.files[0].name)}`;
                if (maxMb && input.files[0].size / (1024 * 1024) > maxMb) {
                    UIController.showAlert(`El archivo supera el límite de ${maxMb}MB.`, 'warning');
                }
            } else {
                textElement.innerHTML = originalText;
            }
        };
        zone.addEventListener('click', () => input.click());
        zone.addEventListener('keydown', e => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                input.click();
            }
        });
        zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('dragover'); });
        zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
        zone.addEventListener('drop', e => {
            e.preventDefault();
            zone.classList.remove('dragover');
            if (e.dataTransfer.files.length) {
                input.files = e.dataTransfer.files;
                handleFile();
            }
        });
        input.addEventListener('change', handleFile);
    });

    /* ============================ CHAT ============================ */
    let chatContext = [];
    let chatBusy = false;
    let lastUserText = null;
    let lastUserLang = null;
    const chatHistoryEl = document.getElementById('chat-history');
    const chatInput = document.getElementById('chat-input');
    const chatTarget = document.getElementById('chat-target-lang');

    const saveChat = () => {
        storage.set(CHAT_STORAGE_KEY, { lang: chatTarget.value, history: chatContext });
    };

    const renderChatContext = (withRetry) => {
        const empty = chatHistoryEl.querySelector('.text-center.text-muted');
        if (empty) empty.remove();
        chatContext.forEach((msg, i) => {
            const sender = msg.role === 'user' ? 'user' : 'bot';
            UIController.appendChat(msg.content, sender, { latest: withRetry && i === chatContext.length - 1 });
        });
    };

    // Restaurar conversación guardada
    (function restoreChat() {
        const saved = storage.get(CHAT_STORAGE_KEY, null);
        if (!saved || !saved.history || !saved.history.length) return;
        chatContext = saved.history.slice(-6);
        if (saved.lang && chatTarget) chatTarget.value = saved.lang;
        renderChatContext(false);
    })();

    const clearChat = () => {
        chatHistoryEl.innerHTML = EMPTY_CHAT_HTML;
        chatContext = [];
        lastUserText = null;
        storage.del(CHAT_STORAGE_KEY);
    };

    document.getElementById('btn-clear-chat')?.addEventListener('click', () => {
        if (!confirm('¿Seguro que quieres borrar el historial del chat?')) return;
        clearChat();
        UIController.showAlert('Historial de chat borrado', 'success');
    });

    document.getElementById('btn-export-chat')?.addEventListener('click', () => {
        const lines = [];
        Array.from(chatHistoryEl.children).forEach(el => {
            if (el.dataset.role !== 'user' && el.dataset.role !== 'bot') return;
            const body = el.querySelector('.mt-2');
            if (!body || !body.textContent.trim()) return;
            const label = el.dataset.role === 'user' ? 'Tú' : 'IA';
            lines.push(`**${label}:**\n\n${body.innerText.trim()}`);
        });
        if (!lines.length) return UIController.showAlert('El chat está vacío', 'warning');
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([lines.join('\n\n---\n\n')], { type: 'text/markdown;charset=utf-8' }));
        a.download = 'Chat_Traducido.md';
        a.click();
    });

    // Copiar y regenerar (delegación)
    chatHistoryEl.addEventListener('click', e => {
        const copyBtn = e.target.closest('button[data-copy]');
        if (copyBtn) { UIController.copyText(copyBtn, copyBtn.dataset.copy); return; }
        const retryBtn = e.target.closest('button[data-retry]');
        if (retryBtn && lastUserText !== null) {
            const bubble = retryBtn.closest('[data-role="bot"]');
            if (bubble) bubble.remove();
            chatContext = chatContext.slice(0, -2);
            sendChat(lastUserText, lastUserLang);
        }
    });

    // Chips de ejemplos rápidos
    document.getElementById('chat-suggestions')?.addEventListener('click', e => {
        const chip = e.target.closest('button[data-text]');
        if (!chip) return;
        chatInput.value = chip.dataset.text;
        chatInput.focus();
        document.getElementById('chat-form').requestSubmit();
    });

    // Enter para enviar (Shift+Enter nueva línea)
    chatInput.addEventListener('keydown', e => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            document.getElementById('chat-form').requestSubmit();
        }
    });

    // Dictado nativo
    const btnDictate = document.getElementById('btn-dictate');
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.lang = 'es-MX';
        recognition.continuous = false;
        recognition.interimResults = false;
        btnDictate.addEventListener('click', () => {
            recognition.start();
            btnDictate.classList.add('btn-danger', 'text-white');
            btnDictate.innerHTML = '<i class="bi bi-mic-fill"></i>';
        });
        recognition.onresult = (e) => { chatInput.value += ' ' + e.results[0][0].transcript; };
        recognition.onend = () => {
            btnDictate.classList.remove('btn-danger', 'text-white');
            btnDictate.innerHTML = '<i class="bi bi-mic"></i>';
        };
    } else {
        btnDictate.style.display = 'none';
    }

    async function sendChat(text, targetLanguage) {
        if (chatBusy) return;
        chatBusy = true;
        document.querySelectorAll('#chat-history [data-retry]').forEach(b => b.remove());
        UIController.appendChat(text, 'user');
        chatInput.value = '';
        UIController.toggleLoading('chat-form', true, BTN_CHAT);
        UIController.showTyping();
        const startedAt = Date.now();
        try {
            const res = await api.post('/chat.py', {
                message: text,
                target_language: targetLanguage,
                history: chatContext
            });
            UIController.hideTyping();
            UIController.appendChat(res.translated_text, 'bot', { latest: true });
            chatContext.push({ role: 'user', content: text });
            chatContext.push({ role: 'assistant', content: res.translated_text });
            if (chatContext.length > 6) chatContext = chatContext.slice(-6);
            lastUserText = text;
            lastUserLang = targetLanguage;
            saveChat();
            UIController.showAlert(`Traducido en ${elapsed(startedAt)}`, 'success');
        } catch (error) {
            UIController.hideTyping();
            UIController.showAlert(error.message);
        } finally {
            chatBusy = false;
            UIController.toggleLoading('chat-form', false, BTN_CHAT);
        }
    }

    document.getElementById('chat-form').addEventListener('submit', e => {
        e.preventDefault();
        const text = chatInput.value.trim();
        if (!text) return UIController.showAlert('El mensaje está vacío.');
        sendChat(text, chatTarget.value);
    });

    /* ============================ AUDIO ============================ */
    let activeAbort = null;
    let mediaRecorder = null;
    let audioChunks = [];
    let recordTimer = null;
    let recordStart = 0;
    const btnRecord = document.getElementById('btn-record');
    const recordTimerEl = document.getElementById('record-timer');
    const audioInput = document.getElementById('audio-input');

    const startRecordUI = () => {
        btnRecord.classList.add('recording');
        btnRecord.innerHTML = '<i class="bi bi-stop-circle"></i> Detener';
        btnRecord.classList.replace('btn-outline-danger', 'btn-danger');
        recordTimerEl.classList.remove('d-none');
        recordStart = Date.now();
        recordTimer = setInterval(() => {
            const secs = Math.floor((Date.now() - recordStart) / 1000);
            recordTimerEl.textContent = `Grabando ${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
            if (secs >= Math.floor(MAX_RECORD_MS / 1000)) {
                UIController.showAlert('Límite de grabación alcanzado (60s).', 'warning');
                stopRecording();
            }
        }, 1000);
    };
    const stopRecordUI = () => {
        btnRecord.classList.remove('recording');
        btnRecord.innerHTML = '<i class="bi bi-mic"></i> Grabar';
        btnRecord.classList.replace('btn-danger', 'btn-outline-danger');
        clearInterval(recordTimer);
        recordTimerEl.classList.add('d-none');
    };
    const stopRecording = () => {
        stopRecordUI();
        try {
            if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop();
        } catch (err) { /* ignore */ }
    };

    btnRecord.addEventListener('click', () => {
        if (btnRecord.classList.contains('recording')) { stopRecording(); return; }
        (async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                const mime = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : '';
                mediaRecorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
                audioChunks = [];
                mediaRecorder.addEventListener('dataavailable', event => audioChunks.push(event.data));
                mediaRecorder.addEventListener('stop', () => {
                    const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                    const dataTransfer = new DataTransfer();
                    dataTransfer.items.add(new File([audioBlob], 'grabacion.webm', { type: 'audio/webm' }));
                    audioInput.files = dataTransfer.files;
                    document.getElementById('audio-drop').querySelector('.drop-text').innerHTML = '<i class="bi bi-mic-fill text-danger"></i> Grabación lista';
                    stream.getTracks().forEach(track => track.stop());
                });
                mediaRecorder.start();
                startRecordUI();
            } catch (err) {
                UIController.showAlert('Error al acceder al micrófono. Revisa los permisos del navegador.');
            }
        })();
    });

    document.getElementById('audio-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        let stopProgress = () => {};
        try {
            const file = audioInput.files[0];
            FileManager.validate(file, ['webm', 'mp3', 'wav', 'm4a'], 10);

            document.getElementById('audio-copy-btn').classList.add('d-none');
            document.getElementById('audio-player').classList.add('d-none');
            document.getElementById('audio-detected-lang').classList.add('d-none');
            document.getElementById('audio-empty-state').classList.add('d-none');
            document.getElementById('audio-results').classList.remove('d-none');
            UIController.toggleLoading('audio-form', true, BTN_TRANSLATE);
            UIController.toggleSkeletons('audio-original-text', true);
            UIController.toggleSkeletons('audio-translated-text', true);
            updateLangLabels(document.getElementById('audio-target-lang').value);
            persistPrefs();

            activeAbort = new AbortController();
            stopProgress = UIController.startProgress('audio-progress', ['Transcribiendo', 'Traduciendo', 'Generando voz']);
            const startedAt = Date.now();

            const res = await api.post('/audio.py', {
                audio: await FileManager.toBase64(file),
                target_language: document.getElementById('audio-target-lang').value,
                voice: document.getElementById('audio-voice').value
            }, { signal: activeAbort.signal });

            stopProgress();
            document.getElementById('audio-original-text').innerHTML = UIController.escapeHtml(res.original_text);
            document.getElementById('audio-translated-text').innerHTML = UIController.renderMarkdown(res.translated_text);
            if (res.detected_language) {
                const badge = document.getElementById('audio-detected-lang');
                badge.textContent = `Idioma detectado: ${UIController.langName(res.detected_language)}`;
                badge.classList.remove('d-none');
            }
            document.getElementById('audio-player').src = `data:audio/mp3;base64,${res.translated_audio_b64}`;
            document.getElementById('audio-player').classList.remove('d-none');
            document.getElementById('audio-copy-btn').classList.remove('d-none');
            UIController.showAlert(`Audio procesado en ${elapsed(startedAt)}`, 'success');
        } catch (error) {
            stopProgress();
            document.getElementById('audio-player').classList.add('d-none');
            document.getElementById('audio-copy-btn').classList.add('d-none');
            document.getElementById('audio-results').classList.add('d-none');
            document.getElementById('audio-empty-state').classList.remove('d-none');
            UIController.showAlert(error.name === 'CancelError' ? 'Operación cancelada.' : error.message, error.name === 'CancelError' ? 'warning' : 'danger');
        } finally {
            activeAbort = null;
            UIController.toggleLoading('audio-form', false, BTN_TRANSLATE);
        }
    });

    /* ============================ DOCUMENTOS ============================ */
    let currentDocsData = null;
    document.getElementById('docs-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        let stopProgress = () => {};
        try {
            const file = document.getElementById('docs-input').files[0];
            FileManager.validate(file, ['pdf', 'docx', 'txt'], 5);
            const fileStem = file.name.replace(/\.[^.]+$/, '');

            document.getElementById('docs-copy-btn').classList.add('d-none');
            document.getElementById('docs-download-group').classList.add('d-none');
            document.getElementById('docs-empty-state').classList.add('d-none');
            document.getElementById('docs-results').classList.remove('d-none');
            UIController.toggleLoading('docs-form', true, BTN_TRANSLATE);
            UIController.toggleSkeletons('docs-original-text', true);
            UIController.toggleSkeletons('docs-translated-text', true);
            updateLangLabels(document.getElementById('docs-target-lang').value);
            persistPrefs();

            activeAbort = new AbortController();
            stopProgress = UIController.startProgress('docs-progress', ['Extrayendo texto', 'Traduciendo', 'Generando documento']);
            const startedAt = Date.now();

            const res = await api.post('/docs.py', {
                file: await FileManager.toBase64(file),
                filename: file.name,
                target_language: document.getElementById('docs-target-lang').value
            }, { signal: activeAbort.signal });
            currentDocsData = { ...res, stem: fileStem };

            stopProgress();
            document.getElementById('docs-original-text').innerHTML = UIController.escapeHtml(res.original_text);
            document.getElementById('docs-translated-text').innerHTML = UIController.renderMarkdown(res.translated_text);
            document.getElementById('docs-copy-btn').classList.remove('d-none');
            document.getElementById('docs-download-group').classList.remove('d-none');
            UIController.showAlert(`Documento traducido en ${elapsed(startedAt)}`, 'success');
        } catch (error) {
            stopProgress();
            document.getElementById('docs-copy-btn').classList.add('d-none');
            document.getElementById('docs-download-group').classList.add('d-none');
            document.getElementById('docs-results').classList.add('d-none');
            document.getElementById('docs-empty-state').classList.remove('d-none');
            UIController.showAlert(error.name === 'CancelError' ? 'Operación cancelada.' : error.message, error.name === 'CancelError' ? 'warning' : 'danger');
        } finally {
            activeAbort = null;
            UIController.toggleLoading('docs-form', false, BTN_TRANSLATE);
        }
    });

    const downloadBlob = (b64, mimeType, name) => {
        const binary = atob(b64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([bytes], { type: mimeType }));
        a.download = name;
        a.click();
    };
    const docsName = ext => currentDocsData?.stem ? `Traduccion_${currentDocsData.stem}.${ext}` : `Traduccion.${ext}`;

    document.getElementById('btn-download-txt')?.addEventListener('click', () => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([document.getElementById('docs-translated-text').innerText], { type: 'text/plain;charset=utf-8' }));
        a.download = docsName('txt');
        a.click();
    });
    document.getElementById('btn-download-docx')?.addEventListener('click', () => {
        if (currentDocsData) downloadBlob(currentDocsData.docx_b64, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', docsName('docx'));
    });
    document.getElementById('btn-download-pdf')?.addEventListener('click', () => {
        if (currentDocsData) downloadBlob(currentDocsData.pdf_b64, 'application/pdf', docsName('pdf'));
    });

    /* ============================ IMÁGENES ============================ */
    document.getElementById('vision-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        let stopProgress = () => {};
        try {
            const file = document.getElementById('vision-input').files[0];
            FileManager.validate(file, ['jpg', 'jpeg', 'png'], 4);
            const { base64, originalSize, compressedSize, reused } = await FileManager.compressImage(file);

            document.getElementById('vision-copy-btn').classList.add('d-none');
            document.getElementById('vision-original-box').classList.add('d-none');
            document.getElementById('vision-empty-state').classList.add('d-none');
            document.getElementById('vision-results').classList.remove('d-none');
            UIController.toggleLoading('vision-form', true, BTN_EXTRACT);
            UIController.toggleSkeletons('vision-translated-text', true);
            updateLangLabels(document.getElementById('vision-target-lang').value);
            persistPrefs();

            document.getElementById('vision-preview').src = URL.createObjectURL(file);
            if (!reused) {
                UIController.showAlert(`Imagen optimizada en el cliente: ${FileManager.formatBytes(originalSize)} → ${FileManager.formatBytes(compressedSize)}`, 'info');
            }

            activeAbort = new AbortController();
            stopProgress = UIController.startProgress('vision-progress', ['Extrayendo texto de la imagen', 'Traduciendo']);
            const startedAt = Date.now();

            const res = await api.post('/vision.py', {
                image: base64,
                target_language: document.getElementById('vision-target-lang').value
            }, { signal: activeAbort.signal });

            stopProgress();
            document.getElementById('vision-translated-text').innerHTML = UIController.renderMarkdown(res.translation);
            if (res.original_text) {
                document.getElementById('vision-original-text').innerHTML = UIController.escapeHtml(res.original_text);
                document.getElementById('vision-original-box').classList.remove('d-none');
            }
            document.getElementById('vision-copy-btn').classList.remove('d-none');
            UIController.showAlert(`Imagen procesada en ${elapsed(startedAt)}`, 'success');
        } catch (error) {
            stopProgress();
            document.getElementById('vision-copy-btn').classList.add('d-none');
            document.getElementById('vision-results').classList.add('d-none');
            document.getElementById('vision-empty-state').classList.remove('d-none');
            UIController.showAlert(error.name === 'CancelError' ? 'Operación cancelada.' : error.message, error.name === 'CancelError' ? 'warning' : 'danger');
        } finally {
            activeAbort = null;
            UIController.toggleLoading('vision-form', false, BTN_EXTRACT);
        }
    });

    /* ============================ CANCELAR ============================ */
    ['btn-cancel-audio', 'btn-cancel-docs', 'btn-cancel-vision'].forEach(id => {
        document.getElementById(id)?.addEventListener('click', () => activeAbort?.abort());
    });
});