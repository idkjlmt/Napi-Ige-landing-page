const PAGE_COUNT = 121;
const PAGE_PATH = page => `assets/pages/navarra-mate-${String(page).padStart(3, "0")}.jpg`;
const ANIMATION_MS = 620;

const els = {
  shell: document.querySelector("#readerShell"),
  stage: document.querySelector("#bookStage"),
  book: document.querySelector("#book"),
  loading: document.querySelector("#bookLoading"),
  loadingText: document.querySelector("#loadingText"),
  loadingBar: document.querySelector("#loadingBar"),
  error: document.querySelector("#readerError"),
  retry: document.querySelector("#retryBook"),
  left: document.querySelector("#leftPage"),
  right: document.querySelector("#rightPage"),
  sheet: document.querySelector("#turnSheet"),
  previous: document.querySelector("#previousPage"),
  next: document.querySelector("#nextPage"),
  previousFooter: document.querySelector("#previousFooter"),
  nextFooter: document.querySelector("#nextFooter"),
  indicator: document.querySelector("#pageIndicator"),
  progress: document.querySelector("#progressBar"),
  orderCta: document.querySelector("#readerOrderCta"),
  status: document.querySelector("#readerStatus"),
  zoomIn: document.querySelector("#zoomIn"),
  zoomOut: document.querySelector("#zoomOut"),
  zoomValue: document.querySelector("#zoomValue"),
  fullscreen: document.querySelector("#fullscreen")
};

const cache = new Map();
let currentPage = 1;
let zoom = 1;
let isAnimating = false;
let touchStartX = null;
let touchStartY = null;
let mobileMode = window.matchMedia("(max-width: 640px)").matches;

const isMobile = () => window.matchMedia("(max-width: 640px)").matches;

function viewFor(page, mobile = isMobile()) {
  if (mobile) return { left: null, right: page };
  if (page <= 1) return { left: null, right: 1 };
  const left = page % 2 === 0 ? page : page - 1;
  return { left, right: left + 1 <= PAGE_COUNT ? left + 1 : null };
}

function targetPage(direction) {
  if (isMobile()) return Math.min(PAGE_COUNT, Math.max(1, currentPage + direction));
  if (direction > 0) return currentPage === 1 ? 2 : Math.min(PAGE_COUNT, currentPage + 2);
  return currentPage <= 2 ? 1 : Math.max(2, currentPage - 2);
}

function loadPage(page, force = false) {
  if (!page) return Promise.resolve(null);
  if (!force && cache.has(page)) return cache.get(page);
  const promise = new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = async () => {
      try { await image.decode?.(); } catch {}
      resolve(image);
    };
    image.onerror = () => {
      cache.delete(page);
      reject(new Error(`A(z) ${page}. oldal nem tölthető be.`));
    };
    image.src = `${PAGE_PATH(page)}${force ? `?retry=${Date.now()}` : ""}`;
  });
  cache.set(page, promise);
  return promise;
}

async function ensureView(view, force = false) {
  await Promise.all([loadPage(view.left, force), loadPage(view.right, force)]);
}

function setSlot(slot, page) {
  const image = slot.querySelector("img");
  if (!page) {
    slot.classList.add("is-empty");
    image.removeAttribute("src");
    return;
  }
  slot.classList.remove("is-empty");
  image.src = PAGE_PATH(page);
  image.alt = `Navarra Biblia – ${page}. oldal`;
}

function lastVisiblePage(view = viewFor(currentPage)) {
  return view.right || view.left || currentPage;
}

function updateControls() {
  const view = viewFor(currentPage);
  const lastVisible = lastVisiblePage(view);
  els.indicator.textContent = isMobile() ? `${currentPage} / ${PAGE_COUNT}` : view.left ? `${view.left}–${lastVisible} / ${PAGE_COUNT}` : `1 / ${PAGE_COUNT}`;
  els.progress.style.width = `${(lastVisible / PAGE_COUNT) * 100}%`;
  const atStart = currentPage <= 1;
  const atEnd = lastVisible >= PAGE_COUNT;
  [els.previous, els.previousFooter].forEach(button => button.disabled = isAnimating || atStart);
  [els.next, els.nextFooter].forEach(button => button.disabled = isAnimating || atEnd);
  els.orderCta.hidden = !atEnd || isAnimating;
}

function renderCurrent() {
  const view = viewFor(currentPage);
  setSlot(els.left, view.left);
  setSlot(els.right, view.right);
  updateControls();
  warmNearby(currentPage);
}

function setSheetImages(frontPage, backPage) {
  const front = els.sheet.querySelector(".turn-front img");
  const back = els.sheet.querySelector(".turn-back img");
  front.src = PAGE_PATH(frontPage);
  back.src = PAGE_PATH(backPage);
}

function waitForAnimation() {
  return new Promise(resolve => {
    let finished = false;
    const done = () => {
      if (finished) return;
      finished = true;
      els.sheet.removeEventListener("animationend", done);
      resolve();
    };
    els.sheet.addEventListener("animationend", done, { once: true });
    window.setTimeout(done, ANIMATION_MS + 140);
  });
}

async function navigate(direction) {
  if (isAnimating) return;
  const nextPage = targetPage(direction);
  if (nextPage === currentPage) return;
  isAnimating = true;
  updateControls();
  els.status.textContent = "Oldal betöltése…";
  const currentView = viewFor(currentPage);
  const nextView = viewFor(nextPage);
  try {
    await ensureView(nextView);
    els.error.hidden = true;
    if (isMobile()) {
      setSheetImages(currentView.right, nextView.right);
      setSlot(els.right, nextView.right);
      els.sheet.className = `turn-sheet mobile-sheet ${direction > 0 ? "flip-next" : "flip-previous"}`;
    } else if (direction > 0) {
      setSheetImages(currentView.right, nextView.left);
      setSlot(els.right, nextView.right);
      els.sheet.className = "turn-sheet from-right flip-next";
    } else {
      setSheetImages(currentView.left, nextView.right);
      setSlot(els.left, nextView.left);
      els.sheet.className = "turn-sheet from-left flip-previous";
    }
    els.sheet.hidden = false;
    void els.sheet.offsetWidth;
    await waitForAnimation();
    currentPage = nextPage;
    renderCurrent();
  } catch (error) {
    console.error(error);
    els.error.hidden = false;
  } finally {
    els.sheet.hidden = true;
    els.sheet.className = "turn-sheet";
    els.status.textContent = "Navarra Biblia · Máté evangéliuma";
    isAnimating = false;
    updateControls();
    els.stage.focus({ preventScroll: true });
  }
}

function warmNearby(page) {
  const pages = [];
  for (let offset = 1; offset <= 5; offset += 1) {
    if (page + offset <= PAGE_COUNT) pages.push(page + offset);
  }
  const warm = () => pages.forEach(item => loadPage(item).catch(() => {}));
  if ("requestIdleCallback" in window) window.requestIdleCallback(warm, { timeout: 1200 });
  else window.setTimeout(warm, 350);
}

function updateZoom(delta) {
  zoom = Math.min(1.45, Math.max(.75, Number((zoom + delta).toFixed(2))));
  els.book.style.setProperty("--book-scale", zoom);
  els.zoomValue.textContent = `${Math.round(zoom * 100)}%`;
}

async function loadInitial(force = false) {
  els.error.hidden = true;
  els.loading.hidden = false;
  els.book.setAttribute("aria-busy", "true");
  els.status.textContent = "A mintakötet betöltése…";
  els.loadingBar.style.width = "25%";
  try {
    await ensureView(viewFor(1), force);
    els.loadingBar.style.width = "100%";
    renderCurrent();
    window.setTimeout(() => { els.loading.hidden = true; }, 180);
    els.book.setAttribute("aria-busy", "false");
    els.status.textContent = "Navarra Biblia · Máté evangéliuma";
  } catch (error) {
    console.error(error);
    els.loading.hidden = true;
    els.error.hidden = false;
    els.status.textContent = "Betöltési hiba";
  } finally {
    updateControls();
  }
}

els.previous.addEventListener("click", () => navigate(-1));
els.next.addEventListener("click", () => navigate(1));
els.previousFooter.addEventListener("click", () => navigate(-1));
els.nextFooter.addEventListener("click", () => navigate(1));
els.zoomIn.addEventListener("click", () => updateZoom(.1));
els.zoomOut.addEventListener("click", () => updateZoom(-.1));
els.retry.addEventListener("click", () => loadInitial(true));
els.fullscreen.addEventListener("click", async () => {
  try {
    if (!document.fullscreenElement) await els.shell.requestFullscreen?.();
    else await document.exitFullscreen?.();
  } catch {}
});

document.addEventListener("fullscreenchange", () => {
  els.fullscreen.setAttribute("aria-label", document.fullscreenElement ? "Kilépés a teljes képernyőből" : "Teljes képernyő");
});

els.stage.addEventListener("keydown", event => {
  if (event.repeat) return;
  if (event.key === "ArrowLeft") { event.preventDefault(); navigate(-1); }
  if (event.key === "ArrowRight") { event.preventDefault(); navigate(1); }
});

els.stage.addEventListener("touchstart", event => {
  touchStartX = event.changedTouches[0].clientX;
  touchStartY = event.changedTouches[0].clientY;
}, { passive: true });

els.stage.addEventListener("touchend", event => {
  if (touchStartX === null || touchStartY === null) return;
  const dx = event.changedTouches[0].clientX - touchStartX;
  const dy = event.changedTouches[0].clientY - touchStartY;
  if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.25) navigate(dx < 0 ? 1 : -1);
  touchStartX = null;
  touchStartY = null;
}, { passive: true });

window.addEventListener("resize", () => {
  const nowMobile = isMobile();
  if (nowMobile === mobileMode || isAnimating) return;
  if (!nowMobile && currentPage > 1 && currentPage % 2 === 1) currentPage -= 1;
  mobileMode = nowMobile;
  renderCurrent();
});

const menuButton = document.querySelector(".menu-button");
const siteHeader = document.querySelector(".site-header");
menuButton.addEventListener("click", () => {
  const open = siteHeader.classList.toggle("is-open");
  menuButton.setAttribute("aria-expanded", String(open));
  menuButton.setAttribute("aria-label", open ? "Menü bezárása" : "Menü megnyitása");
});
document.querySelectorAll("#mainNav a").forEach(link => link.addEventListener("click", () => {
  siteHeader.classList.remove("is-open");
  menuButton.setAttribute("aria-expanded", "false");
}));

document.querySelector("#orderForm").addEventListener("submit", event => {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  const subject = "Navarra Biblia előrendelés";
  const body = [
    "Kedves EWTN Kiadó!",
    "",
    "Szeretnék csatlakozni a Navarra Biblia közösségi előrendeléséhez.",
    "",
    `Név: ${data.get("name")}`,
    `E-mail: ${data.get("email")}`,
    `Példányszám: ${data.get("quantity")}`,
    `Megjegyzés: ${data.get("message") || "–"}`
  ].join("\n");
  window.location.href = `mailto:shop@ewtn.hu?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
});

loadInitial();
