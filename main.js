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
      
      if (j === 1) { // 10
        if (d === 1) nameStr = "";
      } else if (j === 2) { // 100
        if (d === 1) { nameStr = ""; }
        else if (d === 3) { posStr = "びゃく"; }
        else if (d === 6) { nameStr = "ろっ"; posStr = "ぴゃく"; }
        else if (d === 8) { nameStr = "はっ"; posStr = "ぴゃく"; }
      } else if (j === 3) { // 1000
        if (d === 1) { nameStr = ""; }
        else if (d === 3) { posStr = "ぜん"; }
        else if (d === 8) { nameStr = "はっ"; }
      }
      
      blockTokens.unshift(nameStr + posStr);
    }
    
    // Attach block name to the last token in blockTokens
    if (blockIndex > 0 && blockTokens.length > 0) {
       let lastToken = blockTokens[blockTokens.length - 1];
       if (blockIndex === 3) { // 兆
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
    if (randomBigInt > range) {
        randomBigInt = randomBigInt % (range + 1n);
    }
    return min + randomBigInt;
}

function formatNumberWithCommas(numStr) {
    return numStr.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

let history = []; 
let currentNumberStr = "0";
let currentReading = "れい";
let ttsVoice = null;
let useFallbackTTS = false; // Add state for TTS method

// Initialize TTS voice
function initVoices() {
    let voices = window.speechSynthesis.getVoices();
    if (voices.length === 0) return;
    
    // Prioritize Microsoft Natural voices (Edge TTS)
    let edgeVoice = voices.find(v => v.lang.includes('ja') && (v.name.includes('Natural') || v.name.includes('Online')));
    if (!edgeVoice) {
        edgeVoice = voices.find(v => v.lang.includes('ja') && v.name.includes('Microsoft'));
    }
    let defaultJaVoice = voices.find(v => v.lang.includes('ja'));
    
    ttsVoice = edgeVoice || defaultJaVoice || voices.find(v => v.lang.startsWith('ja')) || voices[0];
}

window.speechSynthesis.onvoiceschanged = initVoices;
// Try initializing immediately
initVoices();

// Pre-flight check for Edge TTS WebSockets
function checkEdgeTTSAvailability() {
    try {
        const ws = new WebSocket('wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken=6A5AA1D4EAFF4E9FB37E23D68491D6F4');
        ws.onopen = () => ws.close(); // Success
        ws.onerror = () => enableFallbackUI(); // Failure
    } catch(e) {
        enableFallbackUI();
    }
}
checkEdgeTTSAvailability();

function enableFallbackUI() {
    useFallbackTTS = true;
    const ttsButton = document.getElementById('ttsButton');
    if(ttsButton) {
        ttsButton.classList.remove('from-blue-500', 'to-blue-700', 'hover:from-blue-400', 'hover:to-blue-600', 'focus:ring-blue-500/50');
        ttsButton.classList.add('from-orange-500', 'to-orange-700', 'hover:from-orange-400', 'hover:to-orange-600', 'focus:ring-orange-500/50');
    }
}

function playFallbackTTS() {
    return new Promise((resolve) => {
        if (!currentReading) return resolve();
        const textToRead = currentReading.replace(/\s+/g, '');
        const utterance = new SpeechSynthesisUtterance(textToRead);
        utterance.lang = 'ja-JP';
        utterance.rate = 0.9;
        
        if (!ttsVoice) initVoices();
        if (ttsVoice) utterance.voice = ttsVoice;
        
        utterance.onend = resolve;
        utterance.onerror = resolve; // Resolve to clear pulsing state
        window.speechSynthesis.speak(utterance);
    });
}

let isPlayingTTS = false;

async function playTTS() {
    if (!currentReading || isPlayingTTS) return;
    isPlayingTTS = true;
    const textToRead = currentReading.replace(/\s+/g, '');
    
    const ttsButton = document.getElementById('ttsButton');
    const ringColor = useFallbackTTS ? 'ring-orange-400' : 'ring-blue-400';
    ttsButton.classList.add('animate-pulse', 'ring-4', ringColor);
    
    try {
        if (useFallbackTTS) {
            await playFallbackTTS();
        } else {
            await speakEdgeTTS(textToRead, 'ja-JP-KeitaNeural');
        }
    } catch (e) {
        console.warn("Edge TTS WebSocket failed, falling back to Web Speech API:", e);
        enableFallbackUI();
        ttsButton.classList.remove('ring-blue-400');
        ttsButton.classList.add('ring-orange-400');
        await playFallbackTTS();
    } finally {
        isPlayingTTS = false;
        ttsButton.classList.remove('animate-pulse', 'ring-4', 'ring-blue-400', 'ring-orange-400');
    }
}

async function speakEdgeTTS(text, voice = 'ja-JP-KeitaNeural') {
    return new Promise((resolve, reject) => {
        const ws = new WebSocket('wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken=6A5AA1D4EAFF4E9FB37E23D68491D6F4');
        
        ws.onopen = () => {
            const configMsg = `X-Timestamp:${Date.now()}\r\nContent-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n{"context":{"synthesis":{"audio":{"metadataoptions":{"sentenceBoundaryEnabled":"false","wordBoundaryEnabled":"false"},"outputFormat":"audio-24khz-48kbitrate-mono-mp3"}}}}`;
            ws.send(configMsg);
            
            const reqId = typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : Math.random().toString(36).substring(2);
            const ssml = `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='ja-JP'><voice name='${voice}'><prosody rate='-10%'>${text}</prosody></voice></speak>`;
            
            const requestMsg = `X-RequestId:${reqId}\r\nContent-Type:application/ssml+xml\r\nX-Timestamp:${Date.now()}Z\r\nPath:ssml\r\n\r\n${ssml}`;
            ws.send(requestMsg);
        };
        
        let audioParts = [];
        
        ws.onmessage = async (event) => {
            if (typeof event.data === 'string') {
                if (event.data.includes('Path:turn.end')) {
                    ws.close();
                    if (audioParts.length > 0) {
                        const audioBlob = new Blob(audioParts, { type: 'audio/mp3' });
                        const audioUrl = URL.createObjectURL(audioBlob);
                        const audio = new Audio(audioUrl);
                        audio.onended = () => {
                            URL.revokeObjectURL(audioUrl);
                            resolve();
                        };
                        audio.onerror = () => reject(new Error("Audio playback failed"));
                        audio.play().catch(reject);
                    } else {
                        reject(new Error("No audio data received"));
                    }
                }
            } else if (event.data instanceof Blob) {
                const arrayBuffer = await event.data.arrayBuffer();
                const bytes = new Uint8Array(arrayBuffer);
                let headerEnd = -1;
                for (let i = 0; i < bytes.length - 3; i++) {
                    if (bytes[i] === 0x0D && bytes[i+1] === 0x0A && bytes[i+2] === 0x0D && bytes[i+3] === 0x0A) {
                        headerEnd = i + 4;
                        break;
                    }
                }
                if (headerEnd !== -1) {
                    audioParts.push(arrayBuffer.slice(headerEnd));
                }
            }
        };
        
        ws.onerror = () => reject(new Error("WebSocket connection error"));
        
        setTimeout(() => {
            if (ws.readyState !== WebSocket.CLOSED) {
                ws.close();
                reject(new Error("Edge TTS Timeout"));
            }
        }, 10000);
    });
}

document.addEventListener('DOMContentLoaded', () => {
    // If fallback was triggered before DOM loaded, ensure button is orange
    if (useFallbackTTS) enableFallbackUI();

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

    // Accordion Toggle
    settingsToggleBtn.addEventListener('click', () => {
        settingsContent.classList.toggle('hidden');
        if (settingsContent.classList.contains('hidden')) {
            settingsChevron.classList.remove('rotate-180');
        } else {
            settingsChevron.classList.add('rotate-180');
        }
    });

    // Preset handlers
    presetRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            if (e.target.checked) {
                const [min, max] = e.target.value.split('-');
                minInput.value = min;
                maxInput.value = max;
            }
        });
    });

    // Clean inputs
    function getCleanBigInt(inputVal) {
        let val = inputVal.replace(/,/g, '').trim();
        if (val === '') return 0n;
        try {
            return BigInt(val);
        } catch {
            return 0n;
        }
    }

    // Output generation
    outputBtn.addEventListener('click', () => {
        let minVal = getCleanBigInt(minInput.value);
        let maxVal = getCleanBigInt(maxInput.value);
        
        if (minVal > maxVal) {
            const temp = minVal;
            minVal = maxVal;
            maxVal = temp;
            minInput.value = minVal.toString();
            maxInput.value = maxVal.toString();
        }
        
        const randomNum = getRandomBigInt(minVal, maxVal);
        currentNumberStr = randomNum.toString();
        currentReading = getReading(currentNumberStr);
        
        numberDisplay.textContent = formatNumberWithCommas(currentNumberStr);
        readingDisplay.textContent = currentReading;
        
        history.push({
            number: formatNumberWithCommas(currentNumberStr),
            reading: currentReading
        });
        
        const currentRange = `${minVal.toString()}-${maxVal.toString()}`;
        let matched = false;
        presetRadios.forEach(r => {
            if (r.value === currentRange) {
                r.checked = true;
                matched = true;
            }
        });
        if (!matched) {
            presetRadios.forEach(r => r.checked = false);
        }
    });

    // TTS Button
    ttsButton.addEventListener('click', playTTS);

    // Download Button
    downloadBtn.addEventListener('click', () => {
        if (history.length === 0) {
            alert('ダウンロードする履歴がありません。まずは出力ボタンを押してください。');
            return;
        }
        
        let fileContent = "【数字の読み方 履歴】\r\n\r\n";
        history.forEach((item) => {
            fileContent += `${item.number}\r\n${item.reading}\r\n\r\n`;
        });
        
        const blob = new Blob([fileContent], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `numbers_history_${new Date().getTime()}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    });
});
