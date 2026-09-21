import * as pdfjsLib from "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.min.mjs";

pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs";

const PDF_PATH = "assets/2610-NAPI-IGE-OKTOBER.pdf";
const els = {
  shell: document.querySelector("#readerShell"),
  stage: document.querySelector("#bookStage"),
  book: document.querySelector("#book"),
  loading: document.querySelector("#bookLoading"),
  missing: document.querySelector("#missingPdf"),
  upload: document.querySelector("#pdfUpload"),
  left: document.querySelector("#leftPage"),
  right: document.querySelector("#rightPage"),
  previous: document.querySelector("#previousPage"),
  next: document.querySelector("#nextPage"),
  indicator: document.querySelector("#pageIndicator"),
  progress: document.querySelector("#progressBar"),
  status: document.querySelector("#readerStatus"),
  zoomIn: document.querySelector("#zoomIn"),
  zoomOut: document.querySelector("#zoomOut"),
  zoomValue: document.querySelector("#zoomValue"),
  fullscreen: document.querySelector("#fullscreen"),
  download: document.querySelector("#downloadPdf")
};

let pdf = null;
let pageNumber = 1;
let zoom = 1;
let renderToken = 0;
let touchStartX = null;

const isMobile = () => window.matchMedia("(max-width: 620px)").matches;
const pageStep = () => isMobile() ? 1 : 2;

async function renderPage(number, canvas) {
  if (!pdf || number < 1 || number > pdf.numPages) {
    canvas.hidden = true;
    return;
  }
  canvas.hidden = false;
  const page = await pdf.getPage(number);
  const base = page.getViewport({ scale: 1 });
  const targetWidth = Math.min(1100, Math.max(520, els.book.clientWidth / (isMobile() ? 1 : 2) * 1.7));
  const viewport = page.getViewport({ scale: targetWidth / base.width });
  const context = canvas.getContext("2d", { alpha: false });
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);
  await page.render({ canvasContext: context, viewport }).promise;
}

async function renderSpread(direction = "next") {
  if (!pdf) return;
  const token = ++renderToken;
  const mobile = isMobile();
  const leftNumber = mobile ? 0 : pageNumber;
  const rightNumber = mobile ? pageNumber : pageNumber + 1;
  await Promise.all([
    renderPage(leftNumber, els.left),
    renderPage(rightNumber, els.right)
  ]);
  if (token !== renderToken) return;
  const animatedPage = direction === "next" ? els.right : els.left;
  animatedPage.classList.remove("turning-next", "turning-previous");
  void animatedPage.offsetWidth;
  animatedPage.classList.add(direction === "next" ? "turning-next" : "turning-previous");
  const endPage = Math.min(pdf.numPages, mobile ? pageNumber : pageNumber + 1);
  els.indicator.textContent = mobile ? `${pageNumber} / ${pdf.numPages}` : `${pageNumber}–${endPage} / ${pdf.numPages}`;
  els.progress.style.width = `${(endPage / pdf.numPages) * 100}%`;
  els.previous.disabled = pageNumber <= 1;
  els.next.disabled = endPage >= pdf.numPages;
}

async function loadPdf(source, uploadedName = null) {
  els.loading.hidden = false;
  els.missing.hidden = true;
  els.status.textContent = "A kiadvány betöltése…";
  try {
    pdf = await pdfjsLib.getDocument(source).promise;
    pageNumber = 1;
    els.loading.hidden = true;
    els.status.textContent = uploadedName || "Napi Ige · 2026. október";
    await renderSpread();
  } catch (error) {
    console.warn("A PDF nem tölthető be:", error);
    els.loading.hidden = true;
    els.missing.hidden = false;
    els.status.textContent = "A PDF feltöltésre vár";
    els.previous.disabled = true;
    els.next.disabled = true;
    els.download.hidden = true;
  }
}

function changePage(direction) {
  if (!pdf) return;
  const next = pageNumber + direction * pageStep();
  if (next < 1 || next > pdf.numPages) return;
  pageNumber = next;
  renderSpread(direction > 0 ? "next" : "previous");
}

function updateZoom(delta) {
  zoom = Math.min(1.5, Math.max(.75, zoom + delta));
  els.book.style.setProperty("--book-scale", zoom);
  els.zoomValue.textContent = `${Math.round(zoom * 100)}%`;
}

els.previous.addEventListener("click", () => changePage(-1));
els.next.addEventListener("click", () => changePage(1));
els.zoomIn.addEventListener("click", () => updateZoom(.1));
els.zoomOut.addEventListener("click", () => updateZoom(-.1));
els.fullscreen.addEventListener("click", () => {
  if (!document.fullscreenElement) els.shell.requestFullscreen?.();
  else document.exitFullscreen?.();
});
els.stage.addEventListener("keydown", event => {
  if (event.key === "ArrowLeft") changePage(-1);
  if (event.key === "ArrowRight") changePage(1);
});
els.stage.addEventListener("touchstart", event => { touchStartX = event.changedTouches[0].clientX; }, { passive: true });
els.stage.addEventListener("touchend", event => {
  if (touchStartX === null) return;
  const distance = event.changedTouches[0].clientX - touchStartX;
  if (Math.abs(distance) > 45) changePage(distance < 0 ? 1 : -1);
  touchStartX = null;
}, { passive: true });
els.upload.addEventListener("change", async event => {
  const file = event.target.files?.[0];
  if (!file) return;
  els.download.hidden = false;
  els.download.href = URL.createObjectURL(file);
  els.download.download = file.name;
  const data = await file.arrayBuffer();
  loadPdf({ data }, file.name);
});

let lastMobile = isMobile();
window.addEventListener("resize", () => {
  const currentMobile = isMobile();
  if (currentMobile !== lastMobile && pdf) {
    pageNumber = currentMobile ? Math.max(1, pageNumber) : Math.max(1, pageNumber % 2 === 0 ? pageNumber - 1 : pageNumber);
    lastMobile = currentMobile;
    renderSpread();
  }
});

const menuButton = document.querySelector(".menu-button");
const siteHeader = document.querySelector(".site-header");
menuButton.addEventListener("click", () => {
  const open = menuButton.getAttribute("aria-expanded") === "true";
  menuButton.setAttribute("aria-expanded", String(!open));
  menuButton.setAttribute("aria-label", open ? "Menü megnyitása" : "Menü bezárása");
  siteHeader.classList.toggle("menu-open", !open);
});
siteHeader.querySelectorAll("nav a").forEach(link => link.addEventListener("click", () => {
  menuButton.setAttribute("aria-expanded", "false");
  menuButton.setAttribute("aria-label", "Menü megnyitása");
  siteHeader.classList.remove("menu-open");
}));

loadPdf(PDF_PATH);
