// Import the main demystify script
importScripts('index.js');

// Listen for messages from the main thread
self.addEventListener('message', (e) => {
    const { code, id } = e.data;
    
    try {
        const result = demystify(code);
        self.postMessage({ success: true, result, id });
    } catch (error) {
        self.postMessage({ success: false, error: error.message, id });
    }
});
