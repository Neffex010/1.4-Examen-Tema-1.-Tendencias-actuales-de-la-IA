const VERCEL_URL = "https://1-4-examen-tema-1-tendencias-actual-one.vercel.app/api";
const api = new APIClient(VERCEL_URL);

function updateLangLabels(targetLang) {
    const isEn = targetLang === 'en';
    const src = isEn ? 'ES' : 'EN';
    const dst = isEn ? 'EN' : 'ES';
    const map = {
        'audio-original-label': 'Transcripción Original (' + src + ')',
        'audio-target-label':   'Traducción (' + dst + ')',
        'docs-original-label':  'Original (' + src + ')',
        'docs-target-label':    'Traducción (' + dst + ')',
        'vision-target-label':  'Traducción Extraída (' + dst + ')'
    };
    for (const id in map) {
        const el = document.getElementById(id);
        if (el) el.textContent = map[id];
    }
}

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('theme-toggle').addEventListener('click', (e) => {
        const html = document.documentElement;
        const next = html.getAttribute('data-bs-theme') === 'dark' ? 'light' : 'dark';
        html.setAttribute('data-bs-theme', next);
        e.currentTarget.innerHTML = next === 'dark' ? '<i class="bi bi-sun"></i> Claro' : '<i class="bi bi-moon-stars"></i> Oscuro';
    });

    document.querySelectorAll('.drop-zone').forEach(zone => {
        const input = zone.querySelector('input[type="file"]');
        const textElement = zone.querySelector('.drop-text');
        const originalText = textElement.innerHTML;
        zone.addEventListener('click', () => input.click());
        zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('dragover'); });
        zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
        zone.addEventListener('drop', e => { e.preventDefault(); zone.classList.remove('dragover'); if (e.dataTransfer.files.length) { input.files = e.dataTransfer.files; textElement.innerHTML = `<i class="bi bi-file-earmark-check text-success"></i> ${input.files[0].name}`; } });
        input.addEventListener('change', () => { textElement.innerHTML = input.files.length ? `<i class="bi bi-file-earmark-check text-success"></i> ${input.files[0].name}` : originalText; });
    });

    // Estado global para el contexto del chat
    let chatContext = [];

    // Chat: Limpiar y Exportar
    document.getElementById('btn-clear-chat')?.addEventListener('click', () => {
        document.getElementById('chat-history').innerHTML = '<div class="text-center text-muted mt-5"><i class="bi bi-robot display-4 opacity-50"></i><p class="mt-2">Inicia una conversación para traducir</p></div>';
        chatContext = []; // Reiniciar el contexto en memoria
        UIController.showAlert('Historial de chat borrado', 'success');
    });

    document.getElementById('btn-export-chat')?.addEventListener('click', () => {
        const lines = Array.from(document.getElementById('chat-history').children).map(div => div.innerText).filter(text => text && !text.includes('Inicia una conversación'));
        if (lines.length === 0) return UIController.showAlert('El chat está vacío', 'warning');
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([lines.join('\n\n---\n\n')], { type: 'text/plain;charset=utf-8' }));
        a.download = 'Chat_Exportado.txt'; a.click();
    });

    // Chat: Dictado Nativo
    const btnDictate = document.getElementById('btn-dictate');
    if ('webkitSpeechRecognition' in window) {
        const recognition = new webkitSpeechRecognition();
        recognition.lang = 'es-MX'; recognition.continuous = false; recognition.interimResults = false;
        btnDictate.addEventListener('click', () => { recognition.start(); btnDictate.classList.add('btn-danger', 'text-white'); btnDictate.innerHTML = '<i class="bi bi-mic-fill"></i>'; });
        recognition.onresult = (e) => { document.getElementById('chat-input').value += ' ' + e.results[0][0].transcript; };
        recognition.onend = () => { btnDictate.classList.remove('btn-danger', 'text-white'); btnDictate.innerHTML = '<i class="bi bi-mic"></i>'; };
    } else { btnDictate.style.display = 'none'; }

    // Chat Form Submit
    document.getElementById('chat-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const input = document.getElementById('chat-input');
        const text = input.value.trim();
        if (!text) return UIController.showAlert("El mensaje está vacío.");
        
        UIController.appendChat(text, 'user');
        input.value = '';
        UIController.toggleLoading('chat-form', true, '<i class="bi bi-send"></i> Enviar');
        
        try {
            const res = await api.post('/chat.py', { 
                message: text, 
                target_language: document.getElementById('chat-target-lang').value,
                history: chatContext
            });
            UIController.appendChat(res.translated_text, 'bot');
            
            chatContext.push({ role: 'user', content: text });
            chatContext.push({ role: 'assistant', content: res.translated_text });
            if (chatContext.length > 6) chatContext = chatContext.slice(-6);
            
        } catch (error) { 
            UIController.showAlert(error.message); 
        } finally { 
            UIController.toggleLoading('chat-form', false, '<i class="bi bi-send"></i> Enviar'); 
        }
    });

    // Audio & Grabación
    let mediaRecorder, audioChunks = [];
    const btnRecord = document.getElementById('btn-record'), audioInput = document.getElementById('audio-input');
    btnRecord.addEventListener('click', async () => {
        if (btnRecord.classList.contains('recording')) {
            mediaRecorder.stop(); btnRecord.classList.remove('recording'); btnRecord.innerHTML = '<i class="bi bi-mic"></i> Grabar'; btnRecord.classList.replace('btn-danger', 'btn-outline-danger');
        } else {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                mediaRecorder = new MediaRecorder(stream); mediaRecorder.start(); audioChunks = [];
                mediaRecorder.addEventListener("dataavailable", event => { audioChunks.push(event.data); });
                mediaRecorder.addEventListener("stop", () => {
                    const dataTransfer = new DataTransfer(); dataTransfer.items.add(new File([new Blob(audioChunks, { type: 'audio/webm' })], "grabacion.webm", { type: 'audio/webm' }));
                    audioInput.files = dataTransfer.files;
                    document.getElementById('audio-drop').querySelector('.drop-text').innerHTML = `<i class="bi bi-mic-fill text-danger"></i> Grabación lista`;
                    stream.getTracks().forEach(track => track.stop());
                });
                btnRecord.classList.add('recording'); btnRecord.innerHTML = '<i class="bi bi-stop-circle"></i> Detener'; btnRecord.classList.replace('btn-outline-danger', 'btn-danger');
            } catch (err) { UIController.showAlert("Error de micrófono."); }
        }
    });

    document.getElementById('audio-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
            const file = audioInput.files[0];
            if (!file) throw new Error("Sube un archivo o graba un audio.");
            FileManager.validate(file, ['webm', 'mp3', 'wav', 'm4a'], 10);
            
            // Ocultar botones y reproductor antes de procesar
            document.getElementById('audio-copy-btn').classList.add('d-none');
            document.getElementById('audio-player').classList.add('d-none');
            
            document.getElementById('audio-empty-state').classList.add('d-none');
            document.getElementById('audio-results').classList.remove('d-none');
            UIController.toggleLoading('audio-form', true);
            UIController.toggleSkeletons('audio-original-text', true); UIController.toggleSkeletons('audio-translated-text', true);
            
            updateLangLabels(document.getElementById('audio-target-lang').value);
            
            const res = await api.post('/audio.py', { audio: await FileManager.toBase64(file), target_language: document.getElementById('audio-target-lang').value, voice: document.getElementById('audio-voice').value });
            
            document.getElementById('audio-original-text').innerHTML = res.original_text;
            document.getElementById('audio-translated-text').innerHTML = res.translated_text;
            document.getElementById('audio-player').src = `data:audio/mp3;base64,${res.translated_audio_b64}`;
            
            // Mostrar botones y reproductor al finalizar
            document.getElementById('audio-player').classList.remove('d-none');
            document.getElementById('audio-copy-btn').classList.remove('d-none');
        } catch (error) { UIController.showAlert(error.message); } 
        finally { UIController.toggleLoading('audio-form', false); }
    });

    // Documentos
    document.getElementById('docs-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
            const file = document.getElementById('docs-input').files[0];
            FileManager.validate(file, ['pdf', 'docx', 'txt'], 5);
            
            // Ocultar botones de acción antes de procesar
            document.getElementById('docs-copy-btn').classList.add('d-none');
            document.getElementById('docs-download-group').classList.add('d-none');
            
            document.getElementById('docs-empty-state').classList.add('d-none');
            document.getElementById('docs-results').classList.remove('d-none');
            UIController.toggleLoading('docs-form', true);
            UIController.toggleSkeletons('docs-original-text', true); UIController.toggleSkeletons('docs-translated-text', true);
            
            updateLangLabels(document.getElementById('docs-target-lang').value);
            
            const res = await api.post('/docs.py', { file: await FileManager.toBase64(file), filename: file.name, target_language: document.getElementById('docs-target-lang').value });
            window.currentDocsData = res;
            document.getElementById('docs-original-text').innerHTML = res.original_text;
            document.getElementById('docs-translated-text').innerHTML = window.marked ? marked.parse(res.translated_text) : res.translated_text;
            
            // Mostrar botones al finalizar
            document.getElementById('docs-copy-btn').classList.remove('d-none');
            document.getElementById('docs-download-group').classList.remove('d-none');
        } catch (error) { UIController.showAlert(error.message); } 
        finally { UIController.toggleLoading('docs-form', false); }
    });

    const downloadBlob = (chars, type, name) => {
        const bytes = new Uint8Array(chars.length); for (let i = 0; i < chars.length; i++) bytes[i] = chars.charCodeAt(i);
        const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([bytes], { type })); a.download = name; a.click();
    };
    document.getElementById('btn-download-txt')?.addEventListener('click', () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([document.getElementById('docs-translated-text').innerText], { type: 'text/plain;charset=utf-8' })); a.download = 'Traduccion.txt'; a.click(); });
    document.getElementById('btn-download-docx')?.addEventListener('click', () => { if(window.currentDocsData) downloadBlob(atob(window.currentDocsData.docx_b64), 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'Traduccion.docx'); });
    document.getElementById('btn-download-pdf')?.addEventListener('click', () => { if(window.currentDocsData) downloadBlob(atob(window.currentDocsData.pdf_b64), 'application/pdf', 'Traduccion.pdf'); });

    // Imágenes
    document.getElementById('vision-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
            const file = document.getElementById('vision-input').files[0];
            FileManager.validate(file, ['jpg', 'jpeg', 'png'], 4);
            
            // Ocultar boton de accion antes de procesar
            document.getElementById('vision-copy-btn').classList.add('d-none');
            
            document.getElementById('vision-empty-state').classList.add('d-none');
            document.getElementById('vision-results').classList.remove('d-none');
            UIController.toggleLoading('vision-form', true);
            UIController.toggleSkeletons('vision-translated-text', true);
            
            const base64Img = await FileManager.toBase64(file);
            document.getElementById('vision-preview').src = `data:${file.type};base64,${base64Img}`;
            updateLangLabels(document.getElementById('vision-target-lang').value);
            const res = await api.post('/vision.py', { image: base64Img, target_language: document.getElementById('vision-target-lang').value });
            document.getElementById('vision-translated-text').innerHTML = window.marked ? marked.parse(res.translation) : res.translation;
            
            // Mostrar boton al finalizar
            document.getElementById('vision-copy-btn').classList.remove('d-none');
        } catch (error) { UIController.showAlert(error.message); } 
        finally { UIController.toggleLoading('vision-form', false); }
    });
});
