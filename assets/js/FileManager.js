class FileManager {
    static validate(file, allowedExtensions, maxSizeMB) {
        if (!file) throw new Error("No se seleccionó ningún archivo.");

        const extension = file.name.split('.').pop().toLowerCase();
        if (!allowedExtensions.includes(extension)) {
            throw new Error(`Formato no permitido. Usa: ${allowedExtensions.join(', ')}`);
        }

        const MIME_MAP = {
            'txt':  ['text/plain'],
            'pdf':  ['application/pdf'],
            'docx': ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
            'jpg':  ['image/jpeg'],
            'jpeg': ['image/jpeg'],
            'png':  ['image/png'],
            'webm': ['audio/webm', 'video/webm'],
            'mp3':  ['audio/mpeg', 'audio/mp3'],
            'wav':  ['audio/wav', 'audio/x-wav', 'audio/wave'],
            'm4a':  ['audio/mp4', 'audio/x-m4a', 'audio/m4a']
        };
        if (file.type && MIME_MAP[extension] && !MIME_MAP[extension].includes(file.type)) {
            throw new Error(`El archivo no parece ser un ${extension.toUpperCase()} válido.`);
        }

        const sizeMB = file.size / (1024 * 1024);
        if (sizeMB > maxSizeMB) {
            throw new Error(`El archivo excede el límite de ${maxSizeMB}MB.`);
        }
        return true;
    }

    static async toBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result.split(',')[1]); // Extrae solo la cadena base64
            reader.onerror = error => reject(error);
        });
    }

    static formatBytes(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
    }

    /**
     * Redimensiona y comprime una imagen en el cliente antes de enviarla.
     * Reduce notablemente el payload (y el costo del OCR) sin perder legibilidad.
     * Si la recompresión no aporta, devuelve la imagen original intacta.
     */
    static async compressImage(file, maxDim = 1600, quality = 0.85) {
        const originalSize = file.size;
        try {
            const objectUrl = URL.createObjectURL(file);
            const img = await new Promise((resolve, reject) => {
                const el = new Image();
                el.onload = () => resolve(el);
                el.onerror = () => reject(new Error('No se pudo leer la imagen.'));
                el.src = objectUrl;
            });
            URL.revokeObjectURL(objectUrl);

            const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
            const canvas = document.createElement('canvas');
            canvas.width = Math.max(1, Math.round(img.width * scale));
            canvas.height = Math.max(1, Math.round(img.height * scale));
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

            const mime = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
            const compressed = canvas.toDataURL(mime, quality).split(',')[1];
            const compressedSize = Math.round(compressed.length * 3 / 4);

            if (compressedSize >= originalSize) {
                // La compresión no aporta: usa el original
                return { base64: await FileManager.toBase64(file), originalSize, compressedSize: originalSize, reused: true };
            }
            return { base64: compressed, originalSize, compressedSize, reused: false };
        } catch (error) {
            return { base64: await FileManager.toBase64(file), originalSize, compressedSize: originalSize, reused: true };
        }
    }
}