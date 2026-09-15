// CONFIGURACIÓN: Reemplaza con la URL pública de tu backend en Vercel
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

    // 2. AUDIO
    document.getElementById('audio-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const fileInput = document.getElementById('audio-input');
        const lang = document.getElementById('audio-target-lang').value;
        
        try {
            const file = fileInput.files[0];
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

    // 3. DOCUMENTOS
    document.getElementById('docs-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const fileInput = document.getElementById('docs-input');
        const lang = document.getElementById('docs-target-lang').value;
        
        try {
            const file = fileInput.files[0];
            FileManager.validate(file, ['pdf', 'docx', 'txt'], 5);
            
            UIController.toggleLoading('docs-form', true);
            const base64File = await FileManager.toBase64(file);
            
            const res = await api.post('/docs.py', { 
                file: base64File, 
                filename: file.name, 
                target_language: lang 
            });
            
            document.getElementById('docs-original-text').textContent = res.original_text;
            document.getElementById('docs-translated-text').textContent = res.translated_text;
            document.getElementById('docs-results').classList.remove('d-none');
            
        } catch (error) {
            UIController.showAlert(error.message);
        } finally {
            UIController.toggleLoading('docs-form', false);
        }
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
            
            // Mostrar previsualización
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