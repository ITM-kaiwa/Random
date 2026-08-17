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

let history = []; // Array of { number: string, reading: string }
let currentNumberStr = "0";
let currentReading = "れい";
let ttsVoice = null;

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

function playTTS() {
    if (!currentReading) return;
    const textToRead = currentReading.replace(/\s+/g, '');
    const utterance = new SpeechSynthesisUtterance(textToRead);
    utterance.lang = 'ja-JP';
    utterance.rate = 0.9;
    
    if (!ttsVoice) initVoices();
    
    if (ttsVoice) {
        utterance.voice = ttsVoice;
    }
    window.speechSynthesis.speak(utterance);
}

document.addEventListener('DOMContentLoaded', () => {
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
        
        // Add to history
        history.push({
            number: formatNumberWithCommas(currentNumberStr),
            reading: currentReading
        });
        
        // Uncheck presets if manual override happened
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
        history.forEach((item, index) => {
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
