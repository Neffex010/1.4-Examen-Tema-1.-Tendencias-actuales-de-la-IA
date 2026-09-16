class UIController {
    // 1. Notificaciones flotantes (Bootstrap Toasts)
    static showAlert(message, type = 'danger') {
        const toastContainer = document.getElementById('toast-container') || this.createToastContainer();
        const toastEl = document.createElement('div');
        toastEl.className = `toast align-items-center text-bg-${type} border-0 mb-2`;
        toastEl.setAttribute('role', 'alert');
        toastEl.setAttribute('aria-live', 'assertive');
        toastEl.setAttribute('aria-atomic', 'true');
        toastEl.innerHTML = `
            <div class="d-flex">
                <div class="toast-body">${message}</div>
                <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
            </div>
        `;
        toastContainer.appendChild(toastEl);
        const toast = new bootstrap.Toast(toastEl, { delay: 4000 });
        toast.show();
        toastEl.addEventListener('hidden.bs.toast', () => toastEl.remove());
    }

    static createToastContainer() {
        const container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'toast-container position-fixed bottom-0 end-0 p-3';
        container.style.zIndex = '1055';
        document.body.appendChild(container);
        return container;
    }

    // 2. Chat con Auto-Scroll y botón de copiado
    static appendChat(text, sender) {
        const history = document.getElementById('chat-history');
        const div = document.createElement('div');
        div.className = `p-2 mb-2 rounded shadow-sm ${sender === 'user' ? 'bg-primary text-white ms-auto text-end' : 'bg-light border'}`;
        div.style.maxWidth = '85%';
        div.style.width = 'fit-content';
        
        let copyBtn = sender === 'bot' ? `<button class="btn btn-sm btn-outline-secondary ms-2 py-0 px-1 float-end" onclick="UIController.copyText(this, \`${text.replace(/`/g, "'").replace(/"/g, "&quot;")}\`)" title="Copiar">📋</button>` : '';
        
        div.innerHTML = `<strong>${sender === 'user' ? 'Tú' : 'IA'}:</strong><br><span style="white-space: pre-wrap;">${text}</span> ${copyBtn}`;
        history.appendChild(div);
        
        // Ejecutar Auto-scroll suave
        history.scrollTo({ top: history.scrollHeight, behavior: 'smooth' });
    }

    // 3. Bloqueo total preventivo de formularios
    static toggleLoading(formId, isLoading, btnText = 'Traducir') {
        const form = document.getElementById(formId);
        const btn = form.querySelector('button[type="submit"]');
        const spinner = btn.querySelector('.spinner-border');
        const textSpan = btn.querySelector('.btn-text');
        
        // Deshabilitar inputs, selects y textarea para evitar doble petición
        Array.from(form.elements).forEach(el => el.disabled = isLoading);
        
        if (isLoading) {
            spinner.classList.remove('d-none');
            textSpan.textContent = 'Procesando...';
        } else {
            spinner.classList.add('d-none');
            textSpan.textContent = btnText;
        }
    }

    // 4. API del Portapapeles (Directa e ID)
    static async copyText(button, text) {
        try {
            await navigator.clipboard.writeText(text);
            const originalHTML = button.innerHTML;
            button.innerHTML = '✅';
            button.classList.replace('btn-outline-secondary', 'btn-success');
            setTimeout(() => {
                button.innerHTML = originalHTML;
                button.classList.replace('btn-success', 'btn-outline-secondary');
            }, 2000);
        } catch (err) {
            this.showAlert('Error al copiar al portapapeles', 'danger');
        }
    }

    static copyFromId(button, elementId) {
        const text = document.getElementById(elementId).textContent;
        this.copyText(button, text);
    }
}