class APIClient {
    constructor(baseUrl) {
        this.baseUrl = baseUrl;
    }

    async post(endpoint, payload) {
        try {
            const response = await fetch(`${this.baseUrl}${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || 'Error desconocido en el servidor.');
            }
            return data;
        } catch (error) {
            console.error(`[APIClient] Error en ${endpoint}:`, error);
            throw error;
        }
    }
}