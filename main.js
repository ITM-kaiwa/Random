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
let useFallbackTTS = true; 

function updateButtonColor() {
    const ttsButton = document.getElementById('ttsButton');
    if (!ttsButton) return;
    
    if (useFallbackTTS) {
        // Orange for standard fallback
        ttsButton.classList.remove('from-blue-500', 'to-blue-700', 'hover:from-blue-400', 'hover:to-blue-600', 'focus:ring-blue-500/50');
        ttsButton.classList.add('from-orange-500', 'to-orange-700', 'hover:from-orange-400', 'hover:to-orange-600', 'focus:ring-orange-500/50');
    } else {
        // Blue for Edge TTS Native
        ttsButton.classList.remove('from-orange-500', 'to-orange-700', 'hover:from-orange-400', 'hover:to-orange-600', 'focus:ring-orange-500/50');
        ttsButton.classList.add('from-blue-500', 'to-blue-700', 'hover:from-blue-400', 'hover:to-blue-600', 'focus:ring-blue-500/50');
    }
}

function initVoices() {
    let voices = window.speechSynthesis.getVoices();
    if (voices.length === 0) return;
    
    // Check if the browser natively supports Microsoft Edge Natural Voices
    let edgeVoice = voices.find(v => v.lang.includes('ja') && (v.name.includes('Natural') || v.name.includes('Online')));
    
    if (edgeVoice) {
        ttsVoice = edgeVoice;
        useFallbackTTS = false;
    } else {
        // If not, fallback to whatever Japanese voice is available
        ttsVoice = voices.find(v => v.lang.includes('ja')) || voices[0];
        useFallbackTTS = true;
    }
    updateButtonColor();
}

window.speechSynthesis.onvoiceschanged = initVoices;
initVoices();

let isPlayingTTS = false;
window._ttsUtterance = null; // Store in window to absolutely prevent GC

function playTTS() {
    return new Promise((resolve) => {
        if (!currentReading || isPlayingTTS) return resolve();
        isPlayingTTS = true;
        
        const ttsButton = document.getElementById('ttsButton');
        const ringColor = useFallbackTTS ? 'ring-orange-400' : 'ring-blue-400';
        ttsButton.classList.add('animate-pulse', 'ring-4', ringColor);
        
        // Do NOT use cancel() here, it causes the 'interrupted' error on Edge
        // Do NOT remove spaces, as Neural voices might hang on extremely long single words
        const textToRead = currentReading; 
        
        window._ttsUtterance = new SpeechSynthesisUtterance(textToRead);
        window._ttsUtterance.lang = 'ja-JP';
        window._ttsUtterance.volume = 1.0;
        
        // Refresh voices just in case they were updated
        let voices = window.speechSynthesis.getVoices();
        let voiceToUse = voices.find(v => v.lang.includes('ja') && (v.name.includes('Natural') || v.name.includes('Online')));
        if (!voiceToUse) voiceToUse = voices.find(v => v.lang.includes('ja'));
        
        if (voiceToUse) {
            window._ttsUtterance.voice = voiceToUse;
        }
        
        const cleanup = () => {
            isPlayingTTS = false;
            ttsButton.classList.remove('animate-pulse', 'ring-4', ringColor);
            resolve();
        };
        
        window._ttsUtterance.onend = cleanup;
        window._ttsUtterance.onerror = (e) => {
            console.error("TTS Playback Error:", e);
            cleanup();
        };
        
        window.speechSynthesis.speak(window._ttsUtterance);
        
        // Hack for Chrome/Edge stuck in paused state
        if (window.speechSynthesis.paused) {
            window.speechSynthesis.resume();
        }
        
        // Extended safety timeout (Online voices can take several seconds to buffer)
        setTimeout(() => {
            if (isPlayingTTS) {
                console.warn("TTS timeout reached. Forcing cleanup.");
                // We do NOT call cancel() here to avoid triggering 'interrupted' error on late audio
                cleanup();
            }
        }, 15000);
    });
}

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
        if (settingsContent.classList.contains('hidden')) {
            settingsChevron.classList.remove('rotate-180');
        } else {
            settingsChevron.classList.add('rotate-180');
        }
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

    function getCleanBigInt(inputVal) {
        let val = inputVal.replace(/,/g, '').trim();
        if (val === '') return 0n;
        try {
            return BigInt(val);
        } catch {
            return 0n;
        }
    }

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

    ttsButton.addEventListener('click', playTTS);

    downloadBtn.addEventListener('click', () => {
        if (history.length === 0) {
            alert('ダウンロードする履歴がありません。まずは出力ボタンを押してください。');
            return;
        }
        
        let fileContent = "【数字の読み方 履歴】\r\n\r\n";
        history.forEach((item) => {
            fileContent += `${item.number}, ${item.reading}\r\n`;
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
