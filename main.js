import './style.css';

const digitNames = ["", "いち", "に", "さん", "よん", "ご", "ろく", "なな", "はち", "きゅう"];
const posNames = ["", "じゅう", "ひゃく", "せん"];
const blockNames = ["", "まん", "おく", "ちょう"];

function getReading(numStr) {
  if (numStr === "0") return "れい";
  let blocks = [];
  let currentBlock = "";
  for(let i=numStr.length-1; i>=0; i--) {
    currentBlock = numStr[i] + currentBlock;
    if (currentBlock.length === 4 || i === 0) {
      blocks.unshift(currentBlock);
      currentBlock = "";
    }
  }
  let allTokens = [];
  for (let i = 0; i < blocks.length; i++) {
    const blockIndex = blocks.length - 1 - i;
    const blockStr = blocks[i];
    if (parseInt(blockStr) === 0) continue;
    let blockTokens = [];
    const len = blockStr.length;
    for(let j=0; j<len; j++) {
      const d = parseInt(blockStr[len - 1 - j]);
      if (d === 0) continue;
      let nameStr = digitNames[d];
      let posStr = posNames[j];
      if (j === 1) { if (d === 1) nameStr = ""; }
      else if (j === 2) {
        if (d === 1) { nameStr = ""; }
        else if (d === 3) { posStr = "びゃく"; }
        else if (d === 6) { nameStr = "ろっ"; posStr = "ぴゃく"; }
        else if (d === 8) { nameStr = "はっ"; posStr = "ぴゃく"; }
      } else if (j === 3) {
        if (d === 1) { nameStr = ""; }
        else if (d === 3) { posStr = "ぜん"; }
        else if (d === 8) { nameStr = "はっ"; }
      }
      blockTokens.unshift(nameStr + posStr);
    }
    if (blockIndex > 0 && blockTokens.length > 0) {
       let lastToken = blockTokens[blockTokens.length - 1];
       if (blockIndex === 3) {
          if (lastToken === "いち") lastToken = "いっ";
          else if (lastToken === "はち") lastToken = "はっ";
          else if (lastToken === "じゅう") lastToken = "じゅっ";
       }
       blockTokens[blockTokens.length - 1] = lastToken + blockNames[blockIndex];
    }
    allTokens.push(...blockTokens);
  }
  return allTokens.join(" ");
}

function getRandomBigInt(min, max) {
    const range = max - min;
    if (range === 0n) return min;
    const rangeStr = range.toString();
    let randomStr = "";
    for(let i=0; i<rangeStr.length; i++) {
        randomStr += Math.floor(Math.random() * 10).toString();
    }
    let randomBigInt = BigInt(randomStr);
    if (randomBigInt > range) randomBigInt = randomBigInt % (range + 1n);
    return min + randomBigInt;
}

function formatNumberWithCommas(numStr) {
    return numStr.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

let history = [];
let currentNumberStr = "0";
let currentReading = "れい";
let ttsVoice = null;
// true = using Cloudflare Edge TTS proxy (blue), false = browser native (orange)
let usingEdgeProxy = false;

// ─────────────────────────────────────────────
// Vercel Edge TTS proxy endpoint
// ─────────────────────────────────────────────
const TTS_API_URL = 'https://edge-tts-api-one.vercel.app/api/tts';
const TTS_VOICE   = 'ja-JP-NanamiNeural';

function updateButtonColor() {
    const ttsButton = document.getElementById('ttsButton');
    if (!ttsButton) return;
    if (usingEdgeProxy) {
        ttsButton.classList.remove('from-orange-500','to-orange-700','hover:from-orange-400','hover:to-orange-600','focus:ring-orange-500/50');
        ttsButton.classList.add('from-blue-500','to-blue-700','hover:from-blue-400','hover:to-blue-600','focus:ring-blue-500/50');
    } else {
        ttsButton.classList.remove('from-blue-500','to-blue-700','hover:from-blue-400','hover:to-blue-600','focus:ring-blue-500/50');
        ttsButton.classList.add('from-orange-500','to-orange-700','hover:from-orange-400','hover:to-orange-600','focus:ring-orange-500/50');
    }
}

// ─────────────────────────────────────────────
// Browser native TTS (fallback)
// ─────────────────────────────────────────────
function initVoices() {
    const voices = window.speechSynthesis.getVoices();
    if (voices.length === 0) return;
    ttsVoice = voices.find(v => v.lang.includes('ja') && (v.name.includes('Natural') || v.name.includes('Online')))
            || voices.find(v => v.lang.includes('ja') && v.name.includes('Microsoft'))
            || voices.find(v => v.lang.includes('ja'))
            || voices[0];
}
window.speechSynthesis.onvoiceschanged = initVoices;
initVoices();

// ─────────────────────────────────────────────
// Pre-flight: check if Cloudflare proxy is alive
// ─────────────────────────────────────────────
async function checkProxy() {
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 4000);
        const res = await fetch(`${TTS_API_URL}?text=テスト&voice=${TTS_VOICE}`, { signal: controller.signal });
        clearTimeout(timeout);
        if (res.ok) {
            usingEdgeProxy = true;
            updateButtonColor();
            console.log('Edge TTS proxy is available — using high-quality Nanami voice.');
        }
    } catch (e) {
        usingEdgeProxy = false;
        console.warn('Edge TTS proxy not available, falling back to browser TTS:', e.message);
    }
}
checkProxy();

// ─────────────────────────────────────────────
// TTS via Cloudflare Worker (returns MP3 blob)
// ─────────────────────────────────────────────
async function playEdgeProxyTTS(text) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
        const res = await fetch(`${TTS_API_URL}?text=${encodeURIComponent(text)}&voice=${TTS_VOICE}`, {
            signal: controller.signal
        });
        clearTimeout(timeout);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const blob = await res.blob();
        const audioUrl = URL.createObjectURL(blob);
        return new Promise((resolve, reject) => {
            const audio = new Audio(audioUrl);
            audio.onended = () => { URL.revokeObjectURL(audioUrl); resolve(); };
            audio.onerror = () => { URL.revokeObjectURL(audioUrl); reject(new Error('Audio playback error')); };
            audio.play().catch(reject);
        });
    } catch (e) {
        clearTimeout(timeout);
        throw e;
    }
}

// ─────────────────────────────────────────────
// TTS via browser native Speech Synthesis (fallback)
// ─────────────────────────────────────────────
window._ttsUtterance = null;
function playNativeTTS(text) {
    return new Promise((resolve) => {
        window.speechSynthesis.cancel();
        window._ttsUtterance = new SpeechSynthesisUtterance(text);
        window._ttsUtterance.lang = 'ja-JP';
        window._ttsUtterance.volume = 1.0;
        if (!ttsVoice) initVoices();
        if (ttsVoice) window._ttsUtterance.voice = ttsVoice;
        const cleanup = () => resolve();
        window._ttsUtterance.onend = cleanup;
        window._ttsUtterance.onerror = cleanup;
        window.speechSynthesis.speak(window._ttsUtterance);
        if (window.speechSynthesis.paused) window.speechSynthesis.resume();
        setTimeout(() => { if (!window._ttsUtterance) return; cleanup(); }, 12000);
    });
}

// ─────────────────────────────────────────────
// Main TTS dispatcher
// ─────────────────────────────────────────────
let isPlayingTTS = false;
async function playTTS() {
    if (!currentReading || isPlayingTTS) return;
    isPlayingTTS = true;

    const ttsButton = document.getElementById('ttsButton');
    const ringColor = usingEdgeProxy ? 'ring-blue-400' : 'ring-orange-400';
    ttsButton.classList.add('animate-pulse', 'ring-4', ringColor);

    const text = currentReading;

    try {
        if (usingEdgeProxy) {
            await playEdgeProxyTTS(text);
        } else {
            await playNativeTTS(text);
        }
    } catch (e) {
        console.warn('Primary TTS failed, switching to browser native:', e.message);
        // Fallback: switch to native and update UI
        usingEdgeProxy = false;
        updateButtonColor();
        ttsButton.classList.remove(ringColor);
        ttsButton.classList.add('ring-orange-400');
        await playNativeTTS(text);
    } finally {
        isPlayingTTS = false;
        ttsButton.classList.remove('animate-pulse', 'ring-4', 'ring-blue-400', 'ring-orange-400');
    }
}

// ─────────────────────────────────────────────
// DOM logic
// ─────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    updateButtonColor();

    const minInput = document.getElementById('minInput');
    const maxInput = document.getElementById('maxInput');
    const outputBtn = document.getElementById('outputBtn');
    const numberDisplay = document.getElementById('numberDisplay');
    const readingDisplay = document.getElementById('readingDisplay');
    const ttsButton = document.getElementById('ttsButton');
    const downloadBtn = document.getElementById('downloadBtn');
    const presetRadios = document.querySelectorAll('input[name="preset"]');
    const settingsToggleBtn = document.getElementById('settingsToggleBtn');
    const settingsContent = document.getElementById('settingsContent');
    const settingsChevron = document.getElementById('settingsChevron');

    settingsToggleBtn.addEventListener('click', () => {
        settingsContent.classList.toggle('hidden');
        settingsChevron.classList.toggle('rotate-180', !settingsContent.classList.contains('hidden'));
    });

    presetRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            if (e.target.checked) {
                const [min, max] = e.target.value.split('-');
                minInput.value = min;
                maxInput.value = max;
            }
        });
    });

    function getCleanBigInt(val) {
        val = val.replace(/,/g, '').trim();
        if (!val) return 0n;
        try { return BigInt(val); } catch { return 0n; }
    }

    outputBtn.addEventListener('click', () => {
        let minVal = getCleanBigInt(minInput.value);
        let maxVal = getCleanBigInt(maxInput.value);
        if (minVal > maxVal) { [minVal, maxVal] = [maxVal, minVal]; minInput.value = minVal.toString(); maxInput.value = maxVal.toString(); }

        const randomNum = getRandomBigInt(minVal, maxVal);
        currentNumberStr = randomNum.toString();
        currentReading = getReading(currentNumberStr);

        numberDisplay.textContent = formatNumberWithCommas(currentNumberStr);
        readingDisplay.textContent = currentReading;

        history.push({ number: formatNumberWithCommas(currentNumberStr), reading: currentReading });

        const currentRange = `${minVal}-${maxVal}`;
        let matched = false;
        presetRadios.forEach(r => { r.checked = (r.value === currentRange) ? (matched = true) : false; });
        if (!matched) presetRadios.forEach(r => r.checked = false);
    });

    ttsButton.addEventListener('click', playTTS);

    downloadBtn.addEventListener('click', () => {
        if (history.length === 0) { alert('ダウンロードする履歴がありません。まずは出力ボタンを押してください。'); return; }
        let content = "【数字の読み方 履歴】\r\n\r\n";
        history.forEach(item => { content += `${item.number}, ${item.reading}\r\n`; });
        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `numbers_history_${Date.now()}.txt`;
        document.body.appendChild(a); a.click();
        document.body.removeChild(a); URL.revokeObjectURL(url);
    });
});
