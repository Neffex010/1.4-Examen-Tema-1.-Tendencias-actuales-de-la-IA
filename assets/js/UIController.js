class UIController {
    static showAlert(message, type = 'danger') {
        const toastContainer = document.getElementById('toast-container') || this.createToastContainer();
        const toastEl = document.createElement('div');
        toastEl.className = `toast align-items-center text-bg-${type} border-0 mb-2 shadow`;
        toastEl.setAttribute('role', 'alert');
        toastEl.setAttribute('aria-live', 'assertive');
        toastEl.setAttribute('aria-atomic', 'true');
        const _icons = {

            success: 'bi-check-circle-fill',

            warning: 'bi-exclamation-triangle-fill',

            danger:  'bi-x-octagon-fill',

            info:    'bi-info-circle-fill'

        };

        const _icon = _icons[type] || 'bi-info-circle-fill';

        toastEl.innerHTML = `<div class="d-flex"><div class="toast-body"><i class="bi ${_icon} me-2"></i>${message}</div><button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button></div>`;
        toastContainer.appendChild(toastEl);
        new bootstrap.Toast(toastEl, { delay: 4000 }).show();
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
    static appendChat(text, sender) {
        const history = document.getElementById('chat-history');
        const div = document.createElement('div');
        div.className = `p-3 mb-3 rounded shadow-sm ${sender === 'user' ? 'bg-primary text-white ms-auto text-end' : 'bg-body-secondary border'}`;
        div.style.maxWidth = '85%';
        div.style.width = 'fit-content';
        let copyBtn = sender === 'bot' ? `<button class="btn btn-sm btn-outline-secondary ms-2 py-0 px-2 float-end" onclick="UIController.copyText(this, \`${text.replace(/`/g, "'").replace(/"/g, "&quot;")}\`)" title="Copiar"><i class="bi bi-clipboard"></i></button>` : '';
        // Renderizar Markdown
        const formattedText = sender === 'bot' && window.marked ? marked.parse(text) : `<span style="white-space: pre-wrap;">${text}</span>`;
        div.innerHTML = `<strong>${sender === 'user' ? '<i class="bi bi-person"></i> Tú' : '<i class="bi bi-robot"></i> IA'}:</strong> ${copyBtn}<br><div class="mt-2">${formattedText}</div>`;
        history.appendChild(div);
        history.scrollTo({ top: history.scrollHeight, behavior: 'smooth' });
    }
    static toggleLoading(formId, isLoading, btnText = '<i class="bi bi-translate"></i> Traducir') {
        const form = document.getElementById(formId);
        const btn = form.querySelector('button[type="submit"]');
        const spinner = btn.querySelector('.spinner-border');
        const textSpan = btn.querySelector('.btn-text');
        Array.from(form.elements).forEach(el => el.disabled = isLoading);
        if (isLoading) {
            spinner.classList.remove('d-none');
            textSpan.innerHTML = 'Procesando...';
        } else {
            spinner.classList.add('d-none');
            textSpan.innerHTML = btnText;
        }
    }
    static toggleSkeletons(elementId, show) {
        const el = document.getElementById(elementId);
        if(show) {
            el.innerHTML = '<p class="placeholder-glow"><span class="placeholder col-12 rounded"></span><span class="placeholder col-8 rounded"></span><span class="placeholder col-10 rounded"></span></p>';
        } else { el.innerHTML = ''; }
    }
    static async copyText(button, text) {
        try {
            await navigator.clipboard.writeText(text);
            const originalHTML = button.innerHTML;
            button.innerHTML = '<i class="bi bi-check2-all"></i> Copiado';
            button.classList.replace('btn-outline-secondary', 'btn-success');
            setTimeout(() => { button.innerHTML = originalHTML; button.classList.replace('btn-success', 'btn-outline-secondary'); }, 2000);
        } catch (err) { this.showAlert('Error al copiar', 'danger'); }
    }
    static copyFromId(button, elementId) { this.copyText(button, document.getElementById(elementId).innerText); }
}