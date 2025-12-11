const BACKEND_BASE = "https://YOUR_BACKEND_URL"; // <-- ganti nanti, tanpa trailing slash
const REMOVE_ENDPOINT = BACKEND_BASE + "/remove";

// ---------- UI & Drag/Drop ----------
const dropArea = document.getElementById("drop-area");
const fileInput = document.getElementById("file-input");
const selectBtn = document.getElementById("select-files");
const fileListEl = document.getElementById("file-list");
const processBtn = document.getElementById("process-btn");
const progressBarFill = document.getElementById("progress-fill");
const progressText = document.getElementById("progress-text");
const progressWrap = document.getElementById("progress");

let files = []; // {file, id, status, resultBlob}

selectBtn.addEventListener("click", ()=> fileInput.click());
fileInput.addEventListener("change", (e)=> handleFiles(Array.from(e.target.files)));

;["dragenter","dragover"].forEach(ev=>{
  dropArea.addEventListener(ev, (e)=> {
    e.preventDefault(); e.stopPropagation();
    dropArea.classList.add("dragover");
  });
});
;["dragleave","drop"].forEach(ev=>{
  dropArea.addEventListener(ev, (e)=> {
    e.preventDefault(); e.stopPropagation();
    dropArea.classList.remove("dragover");
  });
});

dropArea.addEventListener("drop", (e)=>{
  const dt = e.dataTransfer;
  // If folder dropped, webkitGetAsEntry will be used (handled by input if folder chosen).
  if (dt && dt.items) {
    // Prefer FileSystem API traversal if available
    readDroppedItems(dt.items).then(list => {
      handleFiles(list);
    });
  } else {
    handleFiles(Array.from(e.dataTransfer.files));
  }
});

// read entries (folder support for Chrome)
function readDroppedItems(items) {
  const promises = [];
  for (let i=0;i<items.length;i++){
    const it = items[i].webkitGetAsEntry && items[i].webkitGetAsEntry();
    if (it) promises.push(traverseEntry(it));
    else if (items[i].getAsFile) {
      const f = items[i].getAsFile();
      if (f) promises.push(Promise.resolve(f));
    }
  }
  return Promise.all(promises).then(flatten);
}

function flatten(arr){
  // flatten nested arrays and filter files
  return arr.flat(Infinity).filter(Boolean);
}

function traverseEntry(entry) {
  return new Promise((resolve)=>{
    if (entry.isFile) {
      entry.file(file=> resolve(file));
    } else if (entry.isDirectory) {
      const reader = entry.createReader();
      const out = [];
      function readChunk() {
        reader.readEntries(async (entries) => {
          if (entries.length === 0) {
            resolve(out);
          } else {
            const promises = entries.map(e=> traverseEntry(e));
            const results = await Promise.all(promises);
            out.push(...results.flat(Infinity));
            readChunk();
          }
        });
      }
      readChunk();
    } else resolve(null);
  });
}

function handleFiles(list) {
  const images = list.filter(f => f && f.type && f.type.startsWith("image/"));
  for (let f of images) {
    const id = cryptoRandomId();
    files.push({file: f, id, status: "queued", resultBlob: null});
    addFileItemUI(f, id);
  }
  updateProgress();
}

function cryptoRandomId(){ return Math.random().toString(36).slice(2,9) }

// ---------- UI file list ----------
function addFileItemUI(file, id) {
  const div = document.createElement("div");
  div.className = "file-item";
  div.id = "fi-"+id;
  const img = document.createElement("img");
  img.alt = file.name;
  const reader = new FileReader();
  reader.onload = e => img.src = e.target.result;
  reader.readAsDataURL(file);
  const name = document.createElement("div"); name.className = "name"; name.textContent = file.name;
  const status = document.createElement("div"); status.className="status"; status.textContent = "queued";
  const btns = document.createElement("div");
  btns.style.display="flex"; btns.style.gap="6px"; btns.style.justifyContent="center";
  const dlBtn = document.createElement("button"); dlBtn.textContent="Download"; dlBtn.style.display="none";
  dlBtn.addEventListener("click", ()=> {
    const entry = files.find(x=>x.id===id);
    if (entry && entry.resultBlob) downloadBlob(entry.resultBlob, file.name.replace(/\.[^.]+$/, "") + "_no-bg.png");
  });
  const removeBtn = document.createElement("button"); removeBtn.textContent="Hapus";
  removeBtn.addEventListener("click", ()=> {
    files = files.filter(x=>x.id!==id);
    const el = document.getElementById("fi-"+id); if (el) el.remove();
    updateProgress();
  });
  btns.appendChild(dlBtn); btns.appendChild(removeBtn);

  div.appendChild(img); div.appendChild(name); div.appendChild(status); div.appendChild(btns);
  fileListEl.appendChild(div);
}

function setFileStatus(id, text, showDownload=false){
  const el = document.getElementById("fi-"+id);
  if (!el) return;
  const status = el.querySelector(".status");
  status.textContent = text;
  const dlBtn = el.querySelector("button");
  if (dlBtn) dlBtn.style.display = showDownload ? "inline-block" : "none";
}

function downloadBlob(blob, filename){
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(()=> URL.revokeObjectURL(a.href), 3000);
}

// ---------- Processing ----------
processBtn.addEventListener("click", ()=> {
  if (!REMOVE_ENDPOINT || REMOVE_ENDPOINT.includes("YOUR_BACKEND_URL")) {
    alert("Isi BACKEND_BASE di app.js dengan URL backend-mu (lihat README).");
    return;
  }
  if (files.length===0){ alert("Tidak ada file."); return; }
  processAll();
});

async function processAll(){
  progressWrap.classList.remove("hidden");
  let idx=0;
  for (let entry of files){
    idx++;
    try {
      setFileStatus(entry.id, "uploading...");
      const result = await uploadAndRemove(entry.file, entry.id, (p)=> {
        // per-file progress updates (optional)
      });
      entry.resultBlob = result;
      setFileStatus(entry.id, "done", true);
    } catch(err){
      console.error(err);
      setFileStatus(entry.id, "error");
    }
    updateProgress(idx, files.length);
  }

  // if user wants zip, create zip
  const downloadZip = document.getElementById("download-zip").checked;
  if (downloadZip) {
    try {
      await zipAndDownloadResults();
    } catch(err){
      console.error("zip error", err);
    }
  }
  progressText.textContent = "Selesai.";
}

// Upload single file to backend and return processed blob
async function uploadAndRemove(file, id, onProgress) {
  const form = new FormData();
  form.append("image", file, file.name);

  // fetch with progress using XMLHttpRequest for upload progress
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", REMOVE_ENDPOINT, true);
    xhr.responseType = "blob";
    xhr.onload = function() {
      if (xhr.status>=200 && xhr.status < 300) {
        // got processed image
        resolve(xhr.response);
      } else {
        // try to parse json error
        const reader = new FileReader();
        reader.onload = () => {
          try {
            const text = reader.result;
            const json = JSON.parse(text);
            reject(json);
          } catch(e){
            reject({error:"server_error", status:xhr.status});
          }
        };
        reader.readAsText(xhr.response);
      }
    };
    xhr.onerror = ()=> reject({error:"network"});
    xhr.upload.onprogress = function(e){
      if (e.lengthComputable){
        const pct = Math.round((e.loaded / e.total) * 100);
        setFileStatus(id, `uploading ${pct}%`);
        // overall progress
        updateProgress();
      }
      if (onProgress) onProgress(e);
    };
    xhr.send(form);
  });
}

// create zip of results (uses JSZip via dynamic import to avoid large bundle; fallback download each)
async function zipAndDownloadResults(){
  // dynamic import JSZip from CDN
  const jszipUrl = "https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js";
  if (!window.JSZip) {
    await loadScript(jszipUrl);
  }
  const zip = new window.JSZip();
  let count = 0;
  for (let e of files){
    if (e.resultBlob){
      const name = e.file.name.replace(/\.[^.]+$/, "") + "_no-bg.png";
      const arrayBuffer = await e.resultBlob.arrayBuffer();
      zip.file(name, arrayBuffer);
      count++;
    }
  }
  if (count===0) return;
  const content = await zip.generateAsync({type:"blob"});
  downloadBlob(content, "remove-bg-results.zip");
}

function loadScript(src){
  return new Promise((resolve, reject) => {
    const s = document.createElement("script"); s.src=src; s.onload=resolve; s.onerror=reject;
    document.head.appendChild(s);
  });
}

// overall progress: show percentage of processed files
function updateProgress(doneCount=0, totalOverride=0){
  const total = totalOverride || files.length;
  const done = files.filter(f=>f.resultBlob).length + doneCount;
  const pct = total===0 ? 0 : Math.round((done/total)*100);
  progressBarFill.style.width = pct + "%";
  progressText.textContent = `${done}/${total} selesai (${pct}%)`;
}

// ---------- Utilities ----------
