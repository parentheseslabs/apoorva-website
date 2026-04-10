// ----------------------------------------------------------------
// Typography driver — uses @chenglou/pretext for DOM-free
// text measurement so we can:
//   1. balance the hero paragraph to an exact line count
//   2. pre-reserve vertical space on timeline entries (no CLS)
// ----------------------------------------------------------------

import { prepare, layout } from "https://esm.sh/@chenglou/pretext@latest";

// Build a canvas-shorthand font string from a computed style.
// Example output:  "italic 500 22px \"EB Garamond\", Georgia, serif"
function fontOf(el) {
  const cs = getComputedStyle(el);
  return `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
}

function lineHeightOf(el) {
  const cs = getComputedStyle(el);
  const lh = parseFloat(cs.lineHeight);
  if (!Number.isNaN(lh)) return lh;
  return parseFloat(cs.fontSize) * 1.5;
}

// Binary-search the smallest container width at which the text still
// renders in <= targetLines. Produces visually balanced rag-right text.
function balanceToLines(el, targetLines) {
  const text = el.textContent.trim();
  if (!text) return;

  const handle = prepare(text, fontOf(el));
  const lh = lineHeightOf(el);

  // Clear any prior override so we measure against the actual CSS width.
  el.style.maxWidth = "";
  const measured = el.getBoundingClientRect().width;
  if (measured < 40) return;

  let lo = 120;
  let hi = Math.ceil(measured);
  let best = hi;

  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const { lineCount } = layout(handle, mid, lh);
    if (lineCount <= targetLines) {
      best = mid;
      hi = mid - 1;
    } else {
      lo = mid + 1;
    }
  }

  // A couple of pixels of breathing room against sub-pixel rounding.
  el.style.maxWidth = `${best + 2}px`;
}

// Pre-compute the exact height of every timeline paragraph and lock
// it in as a min-height. This prevents layout shift once web fonts
// finish loading, and keeps the vertical rule perfectly aligned.
function reserveTimelineHeights() {
  const nodes = document.querySelectorAll(".t-entry__body p");
  nodes.forEach((p) => {
    const text = p.textContent.trim();
    if (!text) return;

    const handle = prepare(text, fontOf(p));
    const lh = lineHeightOf(p);
    const width = p.getBoundingClientRect().width;
    if (width < 40) return;

    const { height } = layout(handle, width, lh);
    if (height > 0) p.style.minHeight = `${Math.ceil(height)}px`;
  });
}

function run() {
  const lede = document.querySelector(".hero__lede");
  if (lede) {
    const target = parseInt(lede.dataset.balance, 10) || 3;
    try { balanceToLines(lede, target); } catch (e) { /* non-fatal */ }
  }
  try { reserveTimelineHeights(); } catch (e) { /* non-fatal */ }
}

// Measurement must wait until fonts are ready, otherwise Canvas
// will report metrics for the fallback font rather than EB Garamond.
if (document.fonts && document.fonts.ready) {
  document.fonts.ready.then(run);
} else {
  window.addEventListener("load", run);
}

// Re-run on resize (debounced) so the balanced paragraph stays balanced.
let resizeTimer = 0;
window.addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(run, 150);
});
