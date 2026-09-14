class FileManager {
    static validate(file, allowedExtensions, maxSizeMB) {
        if (!file) throw new Error("No se seleccionó ningún archivo.");
        
        const extension = file.name.split('.').pop().toLowerCase();
        if (!allowedExtensions.includes(extension)) {
            throw new Error(`Formato no permitido. Usa: ${allowedExtensions.join(', ')}`);
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
}