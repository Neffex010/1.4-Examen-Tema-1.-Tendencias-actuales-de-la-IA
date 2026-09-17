class UIController {
    static showAlert(message, type = 'danger') {
        const toastContainer = document.getElementById('toast-container') || this.createToastContainer();
        const toastEl = document.createElement('div');
        toastEl.className = `toast align-items-center text-bg-${type} border-0 mb-2 shadow`;
        toastEl.setAttribute('role', 'alert');
        toastEl.setAttribute('aria-live', 'assertive');
        toastEl.setAttribute('aria-atomic', 'true');
        toastEl.innerHTML = `<div class="d-flex"><div class="toast-body"><i class="bi ${type === 'danger' ? 'bi-exclamation-triangle' : 'bi-check-circle'} me-2"></i>${message}</div><button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button></div>`;
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
    static appendChat(originalText, translatedText, targetLang) {
        const history = document.getElementById('chat-history');
        const div = document.createElement('div');
        div.className = 'p-3 mb-3 rounded shadow-sm bg-primary text-white ms-auto';
        div.style.maxWidth = '85%';
        div.style.width = 'fit-content';

        const srcLabel = targetLang === 'en' ? 'ES (original)' : 'EN (original)';
        const dstLabel = targetLang === 'en' ? 'EN (traducción)' : 'ES (traducción)';

        const safeOriginal = originalText.replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const safeTranslated = translatedText.replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const copySafe = safeTranslated.replace(/`/g, "'").replace(/"/g, '&quot;');

        div.innerHTML =
            '<div class="d-flex justify-content-between align-items-center mb-2">' +
                '<strong><i class="bi bi-person"></i> Tú</strong>' +
                '<button class="btn btn-sm btn-outline-light py-0 px-2" title="Copiar" onclick="UIController.copyText(this, `' + copySafe + '`)"><i class="bi bi-clipboard"></i></button>' +
            '</div>' +
            '<div class="small text-white-50 mb-1">' + srcLabel + '</div>' +
            '<div class="mb-2" style="white-space: pre-wrap;">' + safeOriginal + '</div>' +
            '<hr class="border-light opacity-25 my-2">' +
            '<div class="small text-white-50 mb-1">' + dstLabel + '</div>' +
            '<div style="white-space: pre-wrap;">' + safeTranslated + '</div>';

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