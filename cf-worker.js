/**
 * Edge TTS Proxy - Cloudflare Worker
 * Uses the Cloudflare Workers WebSocket client API (fetch + Upgrade)
 * which differs from the browser WebSocket constructor.
 *
 * Endpoint: GET /?text=<hiragana>&voice=ja-JP-NanamiNeural
 */

const ALLOWED_ORIGIN = 'https://itm-kaiwa.github.io';
const TTS_TOKEN = '6A5AA1D4EAFF4E9FB37E23D68491D6F4';
const TTS_WS_URL = `wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken=${TTS_TOKEN}&Retry-After=200&ConnectionId=${generateId()}`;

const corsHeaders = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function generateId() {
  return [...Array(32)].map(() => Math.floor(Math.random() * 16).toString(16)).join('');
}

export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    const url = new URL(request.url);
    const text = url.searchParams.get('text');
    const voice = url.searchParams.get('voice') || 'ja-JP-NanamiNeural';

    if (!text) {
      return new Response('Missing text parameter', { status: 400, headers: corsHeaders });
    }

    try {
      const audioBuffer = await synthesizeTTS(text, voice);
      return new Response(audioBuffer, {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'audio/mpeg',
          'Cache-Control': 'no-store',
        },
      });
    } catch (err) {
      console.error('TTS synthesis failed:', err.message);
      return new Response(`TTS Error: ${err.message}`, { status: 500, headers: corsHeaders });
    }
  },
};

async function synthesizeTTS(text, voice) {
  // ──────────────────────────────────────────────────────────────
  // Cloudflare Workers WebSocket CLIENT requires using fetch() with
  // Upgrade: websocket — the `new WebSocket()` constructor is only
  // for incoming WebSocket connections from a client to the worker.
  // ──────────────────────────────────────────────────────────────
  const response = await fetch(TTS_WS_URL, {
    headers: {
      'Upgrade': 'websocket',
      'Connection': 'Upgrade',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
      'Origin': 'chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold',
      'Pragma': 'no-cache',
      'Cache-Control': 'no-cache',
    },
  });

  if (response.status !== 101) {
    throw new Error(`WebSocket upgrade failed with status ${response.status}`);
  }

  // ws is a CloudFlare WebSocket object
  const ws = response.webSocket;
  ws.accept();

  return new Promise((resolve, reject) => {
    const chunks = [];
    const timer = setTimeout(() => {
      ws.close();
      reject(new Error('TTS request timed out'));
    }, 15000);

    // Send audio config immediately after accept
    const configMsg =
      `X-Timestamp:${Date.now()}\r\n` +
      `Content-Type:application/json; charset=utf-8\r\n` +
      `Path:speech.config\r\n\r\n` +
      `{"context":{"synthesis":{"audio":{"metadataoptions":{"sentenceBoundaryEnabled":"false","wordBoundaryEnabled":"false"},"outputFormat":"audio-24khz-48kbitrate-mono-mp3"}}}}`;
    ws.send(configMsg);

    // Send SSML
    const reqId = generateId();
    const safeText = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const ssml =
      `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='ja-JP'>` +
      `<voice name='${voice}'>${safeText}</voice>` +
      `</speak>`;
    const ssmlMsg =
      `X-RequestId:${reqId}\r\n` +
      `Content-Type:application/ssml+xml\r\n` +
      `X-Timestamp:${Date.now()}Z\r\n` +
      `Path:ssml\r\n\r\n` +
      ssml;
    ws.send(ssmlMsg);

    ws.addEventListener('message', (event) => {
      if (typeof event.data === 'string') {
        if (event.data.includes('Path:turn.end')) {
          clearTimeout(timer);
          ws.close();
          // Merge all audio chunks into a single ArrayBuffer
          const total = chunks.reduce((n, c) => n + c.byteLength, 0);
          const merged = new Uint8Array(total);
          let offset = 0;
          for (const chunk of chunks) {
            merged.set(new Uint8Array(chunk), offset);
            offset += chunk.byteLength;
          }
          resolve(merged.buffer);
        }
      } else {
        // In Cloudflare Workers binary messages arrive as ArrayBuffer (not Blob)
        const buf = event.data;
        const bytes = new Uint8Array(buf);
        // Strip binary header before MP3 payload (separated by \r\n\r\n)
        let headerEnd = -1;
        for (let i = 0; i < bytes.length - 3; i++) {
          if (
            bytes[i] === 0x0d && bytes[i + 1] === 0x0a &&
            bytes[i + 2] === 0x0d && bytes[i + 3] === 0x0a
          ) {
            headerEnd = i + 4;
            break;
          }
        }
        if (headerEnd !== -1) {
          chunks.push(buf.slice(headerEnd));
        }
      }
    });

    ws.addEventListener('error', (event) => {
      clearTimeout(timer);
      reject(new Error(`WebSocket error: ${event.message || 'unknown'}`));
    });

    ws.addEventListener('close', (event) => {
      if (chunks.length === 0) {
        clearTimeout(timer);
        reject(new Error(`WebSocket closed before audio received (code: ${event.code})`));
      }
    });
  });
}
