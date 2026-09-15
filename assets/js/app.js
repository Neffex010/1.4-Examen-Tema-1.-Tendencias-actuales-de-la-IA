const VERCEL_URL = "https://1-4-examen-tema-1-tendencias-actual-one.vercel.app/api";
const api = new APIClient(VERCEL_URL);

document.addEventListener('DOMContentLoaded', () => {

    // 1. CHAT
    document.getElementById('chat-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const input = document.getElementById('chat-input');
        const lang = document.getElementById('chat-target-lang').value;
        const text = input.value.trim();
        if (!text) return UIController.showAlert("El mensaje está vacío.");
        UIController.appendChat(text, 'user');
        input.value = '';
        UIController.toggleLoading('chat-form', true, 'Enviar');
        try {
            const res = await api.post('/chat.py', { message: text, target_language: lang });
            UIController.appendChat(res.translated_text, 'bot');
        } catch (error) {
            UIController.showAlert(error.message);
        } finally {
            UIController.toggleLoading('chat-form', false, 'Enviar');
        }
    });

    // 2. AUDIO & GRABACIÓN
    let mediaRecorder;
    let audioChunks = [];
    const btnRecord = document.getElementById('btn-record');
    const audioInput = document.getElementById('audio-input');

    btnRecord.addEventListener('click', async () => {
        if (btnRecord.classList.contains('recording')) {
            mediaRecorder.stop();
            btnRecord.classList.remove('recording');
            btnRecord.innerHTML = '🎤 Grabar';
            btnRecord.classList.replace('btn-danger', 'btn-outline-danger');
        } else {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                mediaRecorder = new MediaRecorder(stream);
                mediaRecorder.start();
                audioChunks = [];
                mediaRecorder.addEventListener("dataavailable", event => { audioChunks.push(event.data); });
                mediaRecorder.addEventListener("stop", () => {
                    const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                    const file = new File([audioBlob], "grabacion.webm", { type: 'audio/webm' });
                    const dataTransfer = new DataTransfer();
                    dataTransfer.items.add(file);
                    audioInput.files = dataTransfer.files;
                    UIController.showAlert("Audio grabado. Presiona Traducir.", "success");
                    stream.getTracks().forEach(track => track.stop());
                });
                btnRecord.classList.add('recording');
                btnRecord.innerHTML = '⏹️ Detener';
                btnRecord.classList.replace('btn-outline-danger', 'btn-danger');
            } catch (err) {
                UIController.showAlert("Error de micrófono. Revisa permisos en tu navegador.");
                console.error(err);
            }
        }
    });

    document.getElementById('audio-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const lang = document.getElementById('audio-target-lang').value;
        try {
            const file = audioInput.files[0];
            if (!file) throw new Error("Debes subir un archivo o grabar un audio.");
            FileManager.validate(file, ['webm', 'mp3', 'wav', 'm4a'], 10);
            UIController.toggleLoading('audio-form', true);
            const base64Audio = await FileManager.toBase64(file);
            const res = await api.post('/audio.py', { audio: base64Audio, target_language: lang });
            document.getElementById('audio-original-text').textContent = res.original_text;
            document.getElementById('audio-translated-text').textContent = res.translated_text;
            const audioPlayer = document.getElementById('audio-player');
            audioPlayer.src = `data:audio/mp3;base64,${res.translated_audio_b64}`;
            audioPlayer.classList.remove('d-none');
            document.getElementById('audio-results').classList.remove('d-none');
        } catch (error) {
            UIController.showAlert(error.message);
        } finally {
            UIController.toggleLoading('audio-form', false);
        }
    });

    // 3. DOCUMENTOS Y DESCARGA
    document.getElementById('docs-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const fileInput = document.getElementById('docs-input');
        const lang = document.getElementById('docs-target-lang').value;
        try {
            const file = fileInput.files[0];
            FileManager.validate(file, ['pdf', 'docx', 'txt'], 5);
            UIController.toggleLoading('docs-form', true);
            const base64File = await FileManager.toBase64(file);
            const res = await api.post('/docs.py', { file: base64File, filename: file.name, target_language: lang });
            document.getElementById('docs-original-text').textContent = res.original_text;
            document.getElementById('docs-translated-text').textContent = res.translated_text;
            document.getElementById('docs-results').classList.remove('d-none');
        } catch (error) {
            UIController.showAlert(error.message);
        } finally {
            UIController.toggleLoading('docs-form', false);
        }
    });

    document.getElementById('btn-download-doc').addEventListener('click', () => {
        const textToDownload = document.getElementById('docs-translated-text').textContent;
        if (!textToDownload) return;
        const blob = new Blob([textToDownload], { type: "text/plain;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = "Documento_Traducido.txt";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    });

    // 4. IMÁGENES
    document.getElementById('vision-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const fileInput = document.getElementById('vision-input');
        const lang = document.getElementById('vision-target-lang').value;
        try {
            const file = fileInput.files[0];
            FileManager.validate(file, ['jpg', 'jpeg', 'png'], 4);
            UIController.toggleLoading('vision-form', true);
            const base64Img = await FileManager.toBase64(file);
            document.getElementById('vision-preview').src = `data:${file.type};base64,${base64Img}`;
            const res = await api.post('/vision.py', { image: base64Img, target_language: lang });
            document.getElementById('vision-translated-text').textContent = res.translation;
            document.getElementById('vision-results').classList.remove('d-none');
        } catch (error) {
            UIController.showAlert(error.message);
        } finally {
            UIController.toggleLoading('vision-form', false);
        }
    });
});
