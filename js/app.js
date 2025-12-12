const dropzone = document.getElementById("dropzone");
const fileInput = document.getElementById("fileInput");
const result = document.getElementById("result");

// Klik → buka file picker
dropzone.addEventListener("click", () => fileInput.click());

// Saat file dipilih manual
fileInput.addEventListener("change", (e) => {
    handleFile(e.target.files[0]);
});

// ===== Drag and Drop =====
dropzone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropzone.style.background = "#dcdcdc";
});

dropzone.addEventListener("dragleave", () => {
    dropzone.style.background = "#e3e3e3";
});

dropzone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropzone.style.background = "#e3e3e3";

    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
});

// ===== Process File =====
function handleFile(file) {
    if (!file.type.startsWith("image/")) {
        alert("Harap pilih file gambar!");
        return;
    }

    const imgURL = URL.createObjectURL(file);

    result.innerHTML = `
        <p>Gambar berhasil dimuat:</p>
        <img src="${imgURL}" style="max-width: 300px; margin-top: 10px; border-radius: 10px;" />
    `;

    // TODO: tambahkan proses remove background kamu di sini
}
