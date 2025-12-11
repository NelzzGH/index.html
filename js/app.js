// ==============================
// Konfigurasi
// ==============================
const BACKEND_BASE = "https://YOUR-BACKEND-URL"; 
// contoh: "https://rmbg-backend-production.up.railway.app"

// endpoint backend
const API_PROCESS = `${BACKEND_BASE}/api/remove-bg`;


// ==============================
// Element HTML
// ==============================
const dropZone = document.getElementById("dropzone");
const filePicker = document.getElementById("filePicker");
const processAllBtn = document.getElementById("processAll");
const fileList = document.getElementById("fileList");

let files = [];


// ==============================
// Drag & Drop
// ==============================
dropZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropZone.classList.add("dragover");
});

dropZone.addEventListener("dragleave", () => {
    dropZone.classList.remove("dragover");
});

dropZone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropZone.classList.remove("dragover");
    addFiles(e.dataTransfer.files);
});

filePicker.addEventListener("change", (e) => {
    addFiles(e.target.files);
});


// ==============================
// Tambah file ke list UI
// ==============================
function addFiles(selected) {
    for (let f of selected) {
        let id = Date.now() + Math.random();

        files.push({ id, file: f, status: "queued", result: null });

        let item = document.createElement("div");
        item.className = "file-item";
        item.id = `file-${id}`;

        item.innerHTML = `
            <img src="${URL.createObjectURL(f)}" class="thumb">
            <div class="filename">${f.name}</div>
            <div class="status" id="status-${id}">Queued</div>
            <button class="remove" onclick="removeFile(${id})">Hapus</button>
        `;

        fileList.appendChild(item);
    }
}


// ==============================
// Hapus file
// ==============================
function removeFile(id) {
    files = files.filter(f => f.id !== id);
    let item = document.getElementById(`file-${id}`);
    if (item) item.remove();
}


// ==============================
// Proses semua file
// ==============================
processAllBtn.addEventListener("click", () => {
    if (!BACKEND_BASE || BACKEND_BASE.includes("YOUR-BACKEND-URL")) {
        alert("Isi BACKEND_BASE dulu di app.js dengan URL backend kamu.");
        return;
    }

    for (let f of files) {
        if (f.status === "queued") processFile(f);
    }
});


// ==============================
// Kirim file ke backend
// ==============================
async function processFile(obj) {
    const id = obj.id;
    const statusEl = document.getElementById(`status-${id}`);

    statusEl.innerText = "Processing...";
    obj.status = "processing";

    try {
        const form = new FormData();
        form.append("image", obj.file);

        const res = await fetch(API_PROCESS, {
            method: "POST",
            body: form
        });

        if (!res.ok) throw new Error("Backend error");

        const blob = await res.blob();
        obj.result = blob;

        statusEl.innerText = "Done";

        let imgURL = URL.createObjectURL(blob);

        const imgTag = document.createElement("img");
        imgTag.src = imgURL;
        imgTag.className = "result-img";

        document.getElementById(`file-${id}`).appendChild(imgTag);

        obj.status = "done";

    } catch (err) {
        statusEl.innerText = "Error";
        obj.status = "error";
        console.error(err);
    }
}
