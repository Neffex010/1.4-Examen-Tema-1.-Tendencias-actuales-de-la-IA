class APIClient {
    constructor(baseUrl, timeoutMs = 90000) {
        this.baseUrl = baseUrl;
        this.timeoutMs = timeoutMs;
    }

    async post(endpoint, payload) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), this.timeoutMs);

        try {
            const response = await fetch(`${this.baseUrl}${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                signal: controller.signal
            });

            let data = null;
            try {
                data = await response.json();
            } catch (err) {
                data = null;
            }

            if (response.status === 429) {
                throw new Error(data?.error || 'Demasiadas solicitudes. Espera un momento y vuelve a intentar.');
            }
            if (response.status === 413) {
                throw new Error(data?.error || 'El archivo excede el límite permitido.');
            }
            if (response.status === 502 || response.status === 504) {
                throw new Error('El servidor tardó demasiado en responder. Intenta con un archivo más pequeño.');
            }
            if (!response.ok) {
                throw new Error(data?.error || `Error del servidor (${response.status}).`);
            }
            return data;
        } catch (error) {
            if (error.name === 'AbortError') {
                throw new Error('La solicitud tardó demasiado. Intenta con un archivo más pequeño.');
            }
            if (error instanceof TypeError) {
                // fetch falla con TypeError en problemas de red / CORS
                throw new Error('Error de conexión con el servidor. Verifica tu conexión a internet.');
            }
            console.error(`[APIClient] Error en ${endpoint}:`, error);
            throw error;
        } finally {
            clearTimeout(timer);
        }
    }
}