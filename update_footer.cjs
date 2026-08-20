
const fs = require("fs");
let html = fs.readFileSync("index.html", "utf8");

const oldCode = `<button id="downloadBtn" class="mb-6 px-6 py-3 bg-slate-700/80 hover:bg-slate-600 active:bg-slate-800 active:scale-95 text-slate-200 rounded-xl flex items-center gap-2 transition-all shadow-md border border-slate-600 font-medium">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clip-rule="evenodd" />
        </svg>
        履歴をダウンロード
      </button>`;

const newCode = `<div class="mb-6 flex flex-col sm:flex-row gap-4 items-center">
        <button id="downloadBtn" class="px-6 py-3 bg-slate-700/80 hover:bg-slate-600 active:bg-slate-800 active:scale-95 text-slate-200 rounded-xl flex items-center gap-2 transition-all shadow-md border border-slate-600 font-medium">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clip-rule="evenodd" />
          </svg>
          履歴をダウンロード
        </button>
        <a href="https://itm-kaiwa.github.io/calender/" class="px-6 py-3 bg-blue-700/80 hover:bg-blue-600 active:bg-blue-800 active:scale-95 text-slate-200 rounded-xl flex items-center gap-2 transition-all shadow-md border border-blue-600 font-medium whitespace-nowrap">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          カレンダー＆時計
        </a>
      </div>`;

app = html.replace(oldCode, newCode);
fs.writeFileSync("index.html", app);
console.log("Done");

