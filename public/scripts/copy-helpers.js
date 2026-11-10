// Copy helpers for the Fee Index page: the dataset citation and the
// one-line school-fee stats. Clipboard API with a textarea fallback.
// No dependencies.
(function () {
  function fallbackCopy(text) {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand("copy");
    } catch {
      // Clipboard unavailable; the button label still reports the attempt.
    }
    document.body.removeChild(ta);
  }

  function copyText(text, button) {
    const done = () => {
      const original = button.textContent;
      button.textContent = "Copied";
      setTimeout(() => {
        button.textContent = original;
      }, 2000);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, () => {
        fallbackCopy(text);
        done();
      });
    } else {
      fallbackCopy(text);
      done();
    }
  }

  function init() {
    const citationBtn = document.getElementById("copy-citation");
    if (citationBtn) {
      citationBtn.addEventListener("click", (event) => {
        copyText(
          event.currentTarget.getAttribute("data-citation"),
          event.currentTarget
        );
      });
    }
    const linesBtn = document.getElementById("copy-school-lines");
    const linesPre = document.getElementById("school-lines");
    if (linesBtn && linesPre) {
      linesBtn.addEventListener("click", (event) => {
        copyText(linesPre.textContent, event.currentTarget);
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
