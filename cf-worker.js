/**
 * Edge TTS Proxy - Cloudflare Worker
 * Endpoint: GET /?text=<hiragana>&voice=ja-JP-NanamiNeural
 */

const ALLOWED_ORIGIN = 'https://itm-kaiwa.github.io';
const TTS_TOKEN = '6A5AA1D4EAFF4E9FB37E23D68491D6F4';
const TTS_WS_URL = `wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken=${TTS_TOKEN}`;

const corsHeaders = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

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

function synthesizeTTS(text, voice) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(TTS_WS_URL);
    const chunks = [];

    const timer = setTimeout(() => {
      ws.close();
      reject(new Error('TTS request timed out'));
    }, 15000);

    ws.addEventListener('open', () => {
      // 1. Send audio config
      ws.send(
        `X-Timestamp:${Date.now()}\r\n` +
        `Content-Type:application/json; charset=utf-8\r\n` +
        `Path:speech.config\r\n\r\n` +
        `{"context":{"synthesis":{"audio":{"metadataoptions":{"sentenceBoundaryEnabled":"false","wordBoundaryEnabled":"false"},"outputFormat":"audio-24khz-48kbitrate-mono-mp3"}}}}`
      );

      // 2. Send SSML
      const reqId = crypto.randomUUID().replace(/-/g, '');
      const safeText = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const ssml = `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='ja-JP'><voice name='${voice}'>${safeText}</voice></speak>`;
      ws.send(
        `X-RequestId:${reqId}\r\n` +
        `Content-Type:application/ssml+xml\r\n` +
        `X-Timestamp:${Date.now()}Z\r\n` +
        `Path:ssml\r\n\r\n` +
        ssml
      );
    });

    ws.addEventListener('message', async (event) => {
      if (typeof event.data === 'string') {
        if (event.data.includes('Path:turn.end')) {
          clearTimeout(timer);
          ws.close();
          // Merge all chunks
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
        // Binary: strip text header, keep audio payload
        const buf = await event.data.arrayBuffer();
        const bytes = new Uint8Array(buf);
        let headerEnd = -1;
        for (let i = 0; i < bytes.length - 3; i++) {
          if (bytes[i] === 0x0d && bytes[i+1] === 0x0a && bytes[i+2] === 0x0d && bytes[i+3] === 0x0a) {
            headerEnd = i + 4;
            break;
          }
        }
        if (headerEnd !== -1) chunks.push(buf.slice(headerEnd));
      }
    });

    ws.addEventListener('error', () => {
      clearTimeout(timer);
      reject(new Error('WebSocket connection failed'));
    });
  });
}
