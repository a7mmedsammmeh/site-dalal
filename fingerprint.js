/* ═══════════════════════════════════════════════════════════════
   DALAL — Device Fingerprint
   Generates a stable device fingerprint from browser properties.
   Stored in localStorage so it persists across sessions.
   ═══════════════════════════════════════════════════════════════ */

window.DalalFingerprint = (function () {
    const STORAGE_KEY = 'dalal-fp';

    async function generate() {
        const components = [
            navigator.userAgent,
            navigator.language,
            navigator.languages?.join(',') || '',
            screen.width + 'x' + screen.height,
            screen.colorDepth,
            new Date().getTimezoneOffset(),
            Intl.DateTimeFormat().resolvedOptions().timeZone || '',
            navigator.hardwareConcurrency || '',
            navigator.deviceMemory || '',
            navigator.platform || '',
            !!navigator.cookieEnabled,
            !!window.indexedDB,
            !!window.localStorage,
            !!window.sessionStorage,
            typeof window.ontouchstart !== 'undefined',
            navigator.maxTouchPoints || 0,
            // Canvas fingerprint
            await canvasFingerprint(),
            // WebGL fingerprint
            webglFingerprint(),
            // Audio fingerprint
            await audioFingerprint(),
        ];

        const raw = components.join('|');
        return await hashString(raw);
    }

    function canvasFingerprint() {
        return new Promise(resolve => {
            try {
                const canvas = document.createElement('canvas');
                canvas.width = 200; canvas.height = 50;
                const ctx = canvas.getContext('2d');
                ctx.textBaseline = 'top';
                ctx.font = '14px Arial';
                ctx.fillStyle = '#f60';
                ctx.fillRect(125, 1, 62, 20);
                ctx.fillStyle = '#069';
                ctx.fillText('DALAL🌸', 2, 15);
                ctx.fillStyle = 'rgba(102,204,0,0.7)';
                ctx.fillText('DALAL🌸', 4, 17);
                resolve(canvas.toDataURL().slice(-50));
            } catch { resolve(''); }
        });
    }

    function webglFingerprint() {
        try {
            const canvas = document.createElement('canvas');
            const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
            if (!gl) return '';
            const renderer = gl.getParameter(gl.RENDERER);
            const vendor   = gl.getParameter(gl.VENDOR);
            return `${vendor}~${renderer}`;
        } catch { return ''; }
    }

    function audioFingerprint() {
        return new Promise(resolve => {
            try {
                const ctx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 44100 });
                const oscillator = ctx.createOscillator();
                const analyser   = ctx.createAnalyser();
                const gain       = ctx.createGain();
                gain.gain.value  = 0;
                oscillator.type  = 'triangle';
                oscillator.frequency.value = 10000;
                oscillator.connect(analyser);
                analyser.connect(gain);
                gain.connect(ctx.destination);
                oscillator.start(0);
                const data = new Float32Array(analyser.frequencyBinCount);
                analyser.getFloatFrequencyData(data);
                oscillator.stop();
                ctx.close();
                resolve(data.slice(0, 10).join(','));
            } catch { resolve(''); }
        });
    }

    async function hashString(str) {
        try {
            const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
            return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
        } catch {
            // Fallback simple hash
            let hash = 0;
            for (let i = 0; i < str.length; i++) {
                hash = ((hash << 5) - hash) + str.charCodeAt(i);
                hash |= 0;
            }
            return Math.abs(hash).toString(16).padStart(8, '0');
        }
    }

    async function get() {
        // Return cached fingerprint if exists
        const cached = localStorage.getItem(STORAGE_KEY);
        if (cached) return cached;

        // Generate new fingerprint
        const fp = await generate();
        localStorage.setItem(STORAGE_KEY, fp);
        return fp;
    }

    return { get };
})();
