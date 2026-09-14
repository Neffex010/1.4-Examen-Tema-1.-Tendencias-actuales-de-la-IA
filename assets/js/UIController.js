class UIController {
    static showAlert(message, type = 'danger') {
        const alertEl = document.getElementById('global-alert');
        alertEl.textContent = message;
        alertEl.className = `alert alert-${type}`;
        alertEl.classList.remove('d-none');
        setTimeout(() => alertEl.classList.add('d-none'), 5000);
    }

    static toggleLoading(formId, isLoading, defaultText = 'Traducir') {
        const btn = document.querySelector(`#${formId} button[type="submit"]`);
        const spinner = btn.querySelector('.spinner-border');
        const text = btn.querySelector('.btn-text');
        
        btn.disabled = isLoading;
        if (isLoading) {
            spinner.classList.remove('d-none');
            text.textContent = 'Procesando...';
        } else {
            spinner.classList.add('d-none');
            text.textContent = defaultText;
        }
    }

    static appendChat(text, sender) {
        const history = document.getElementById('chat-history');
        const div = document.createElement('div');
        const isUser = sender === 'user';
        
        div.className = `p-2 mb-2 rounded ${isUser ? 'bg-primary text-white ms-5' : 'bg-secondary text-white me-5'}`;
        div.innerHTML = `<strong>${isUser ? 'Tú' : 'Traducción'}:</strong><br>${text}`;
        
        history.appendChild(div);
        history.scrollTop = history.scrollHeight;
    }
}