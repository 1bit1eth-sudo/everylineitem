function createProgressBar() {
  const progressContainer = document.createElement("div");
  progressContainer.className =
    "progress-container fixed top-0 z-10 h-1 w-full bg-background";
  const progressBar = document.createElement("div");
  progressBar.className = "progress-bar h-1 w-0 bg-accent";
  progressBar.id = "myBar";
  progressContainer.appendChild(progressBar);
  document.body.appendChild(progressContainer);
}
createProgressBar();

function updateScrollProgress() {
  document.addEventListener("scroll", () => {
    const winScroll =
      document.body.scrollTop || document.documentElement.scrollTop;
    const height =
      document.documentElement.scrollHeight -
      document.documentElement.clientHeight;
    const scrolled = (winScroll / height) * 100;
    const myBar = document.getElementById("myBar");
    if (myBar) myBar.style.width = scrolled + "%";
  });
}
updateScrollProgress();

function addHeadingLinks() {
  const headings = Array.from(document.querySelectorAll("h2, h3, h4, h5, h6"));
  for (const heading of headings) {
    heading.classList.add("group");
    const link = document.createElement("a");
    link.className =
      "heading-link ms-2 no-underline opacity-75 md:opacity-0 md:group-hover:opacity-100 md:focus:opacity-100";
    link.href = "#" + heading.id;
    const span = document.createElement("span");
    span.ariaHidden = "true";
    span.innerText = "#";
    link.appendChild(span);
    heading.appendChild(link);
  }
}
addHeadingLinks();

function attachCopyButtons() {
  const copyButtonLabel = "Copy";
  const codeBlocks = Array.from(document.querySelectorAll("pre"));
  for (const codeBlock of codeBlocks) {
    const wrapper = document.createElement("div");
    wrapper.style.position = "relative";
    const computedStyle = getComputedStyle(codeBlock);
    const hasFileNameOffset =
      computedStyle.getPropertyValue("--file-name-offset").trim() !== "";
    const topClass = hasFileNameOffset ? "top-(--file-name-offset)" : "-top-3";
    const copyButton = document.createElement("button");
    copyButton.className = `copy-code absolute end-3 ${topClass} rounded bg-muted border border-muted px-2 py-1 text-xs leading-4 text-foreground font-medium`;
    copyButton.innerHTML = copyButtonLabel;
    codeBlock.setAttribute("tabindex", "0");
    codeBlock.appendChild(copyButton);
    codeBlock?.parentNode?.insertBefore(wrapper, codeBlock);
    wrapper.appendChild(codeBlock);
    copyButton.addEventListener("click", async () => {
      await copyCode(codeBlock, copyButton);
    });
  }
  async function copyCode(block, button) {
    const code = block.querySelector("code");
    const text = code?.innerText;
    await navigator.clipboard.writeText(text ?? "");
    button.innerText = "Copied";
    setTimeout(() => {
      button.innerText = copyButtonLabel;
    }, 700);
  }
}
attachCopyButtons();

function initLightbox() {
  const article = document.getElementById("article");
  if (!article) return;
  const prefersReducedMotion = () =>
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let overlay = null;
  let lastFocused = null;
  requestAnimationFrame(() => {
    const images = Array.from(article.querySelectorAll("img"));
    for (const image of images) {
      if (image.closest("a")) continue;
      image.setAttribute("role", "button");
      image.setAttribute("tabindex", "0");
      image.setAttribute("aria-haspopup", "dialog");
      image.setAttribute(
        "aria-label",
        image.alt ? `Zoom image: ${image.alt}` : "Zoom image"
      );
    }
  });
  function open(src, alt, trigger) {
    if (overlay) return;
    lastFocused = trigger ?? document.activeElement;
    overlay = document.createElement("div");
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute(
      "aria-label",
      alt ? `Image preview: ${alt}` : "Image preview"
    );
    overlay.className =
      "fixed inset-0 z-50 flex cursor-zoom-out items-center justify-center bg-black/70 backdrop-blur-sm opacity-0 transition-opacity duration-200 motion-reduce:transition-none";
    const closeButton = document.createElement("button");
    closeButton.type = "button";
    closeButton.setAttribute("aria-label", "Close image preview");
    closeButton.className =
      "absolute end-4 top-4 rounded p-2 text-3xl leading-none text-white";
    closeButton.innerHTML = "&#10005;";
    closeButton.addEventListener("click", close);
    const image = document.createElement("img");
    image.src = src;
    image.alt = "";
    image.className = "max-h-[90dvh] max-w-[90dvw] cursor-default object-contain";
    overlay.append(closeButton, image);
    let currentScale = 1;
    overlay.addEventListener("click", e => {
      if (e.target === overlay && currentScale <= 1) close();
    });
    document.body.appendChild(overlay);
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKeyDown);
    window.__closeLightbox = close;
    requestAnimationFrame(() => overlay?.classList.add("opacity-100"));
    closeButton.focus();
  }
  function close() {
    if (!overlay) return;
    const el = overlay;
    overlay = null;
    window.__closeLightbox = null;
    document.removeEventListener("keydown", onKeyDown);
    document.body.style.overflow = "";
    lastFocused?.focus();
    lastFocused = null;
    if (prefersReducedMotion()) {
      el.remove();
      return;
    }
    const remove = () => el.remove();
    el.addEventListener("transitionend", remove, { once: true });
    setTimeout(remove, 250);
    el.classList.remove("opacity-100");
  }
  function onKeyDown(e) {
    if (e.key === "Escape") close();
  }
  function triggerFromEvent(e) {
    const image = e.target.closest("img");
    if (!image || !article.contains(image) || image.closest("a")) return null;
    return image;
  }
  function activate(image) {
    open(image.currentSrc || image.src, image.alt, image);
  }
  article.addEventListener("click", e => {
    const image = triggerFromEvent(e);
    if (!image) return;
    e.preventDefault();
    activate(image);
  });
  article.addEventListener("keydown", e => {
    if (e.key !== "Enter" && e.key !== " " && e.key !== "Spacebar") return;
    const image = triggerFromEvent(e);
    if (!image) return;
    e.preventDefault();
    activate(image);
  });
}
initLightbox();

if (!window.__lightboxSwapBound) {
  window.__lightboxSwapBound = true;
  document.addEventListener("astro:before-swap", () =>
    window.__closeLightbox?.()
  );
}

document.addEventListener("astro:after-swap", () =>
  window.scrollTo({ left: 0, top: 0, behavior: "instant" })
);
