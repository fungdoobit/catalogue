// script.js
//
// Responsibilities:
//   1. Load products.json
//   2. Build the category pills from whatever categories exist in the data
//   3. Render product cards into the grid
//   4. Re-render whenever the search text or selected category changes
//
// Keeping data (products.json) separate from this file means: adding a
// 9th product later means editing JSON only — never touching this logic.

let allProducts = [];  // full list, loaded once from products.json
let activePath = [];   // the drill-down category selection — [] means "All".
                        // e.g. ["Tech Accessories", "iPhone", "Pro"] once
                        // three levels deep. See getProductPath() below.
let searchTerm = "";    // current text in the search box

const gridEl = document.getElementById("product-grid");
const pillsEl = document.getElementById("category-pills");
const searchInputEl = document.getElementById("search-input");
const emptyStateEl = document.getElementById("empty-state");
const heroEl = document.getElementById("hero");
const heroWrapEl = document.getElementById("hero-wrap");
const navEl = document.getElementById("site-nav");
const controlsEl = document.querySelector(".controls");

// Watches "reveal" elements (the product cards) and adds "is-visible" once
// each one scrolls into the viewport — styles.css does the actual fade/rise
// animation, this just decides *when* to trigger it. unobserve() after it
// fires so each card only animates in once, not every time it re-enters view.
const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        revealObserver.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.15 }
);

// index is used to stagger the animation slightly per card (capped at
// 300ms) so a row of cards cascades in rather than popping in all at once.
function observeReveal(el, index) {
  el.classList.add("reveal");
  el.style.transitionDelay = `${Math.min(index * 60, 300)}ms`;
  revealObserver.observe(el);
}

// Shows the compact nav bar once the hero has scrolled fully out of the
// viewport (entry.isIntersecting becomes false), and hides it again if you
// scroll back up to the hero. This reuses the same IntersectionObserver
// technique as the card reveals above, just watching one element instead
// of many, so the nav only appears once the entrance is actually over.
const navObserver = new IntersectionObserver(([entry]) => {
  navEl.classList.toggle("is-visible", !entry.isIntersecting);
});
navObserver.observe(heroEl);

// The controls (search + pills) sit just below the hero, so they're what
// scrolling past the entrance reveals first — give them the same
// fade/rise treatment as the cards for a consistent feel.
observeReveal(controlsEl, 0);

// ---------------------------------------------------------------------
// Hero subtitle: scroll-scrubbed word highlight
// Unlike observeReveal above (which is a one-time "has this scrolled into
// view yet?" check), this needs a continuous 0-1 progress value tied to
// scroll position.
// ---------------------------------------------------------------------
const heroSubtitleEl = document.getElementById("hero-subtitle");

// Split the subtitle into one <span class="word"> per word, so each word
// can be animated independently. This is safe to do with innerHTML here
// specifically because the text is our own hard-coded copy in index.html,
// not data from products.json or any other untrusted source.
const subtitleWords = heroSubtitleEl.textContent.trim().split(/\s+/);
heroSubtitleEl.innerHTML = subtitleWords
  .map((word) => `<span class="word">${word}</span>`)
  .join(" ");
const subtitleWordEls = heroSubtitleEl.querySelectorAll(".word");
const heroDividerFillEl = document.getElementById("hero-divider-fill");

// #hero is `position: sticky` inside #hero-wrap, which is taller than one
// screen (see .hero-wrap in styles.css) — so scrolling through that extra
// height holds the hero in place instead of sweeping it past instantly.
// This reads that hold's progress directly from #hero-wrap's own position,
// the same technique as the reveal-on-scroll cards use for "has this
// entered view", just turned into a continuous 0-1 value instead of a
// one-time yes/no: 0 while still at the very top, 1 once the wrapper's
// bottom is about to reach the top of the viewport (exactly when the hero
// is about to release and continue scrolling away).
function updateSubtitleHighlight() {
  const rect = heroWrapEl.getBoundingClientRect();
  const holdDistance = rect.height - window.innerHeight;
  const progress = holdDistance > 0 ? Math.min(Math.max(-rect.top / holdDistance, 0), 1) : 1;
  const litCount = Math.round(progress * subtitleWordEls.length);
  subtitleWordEls.forEach((word, i) => {
    word.classList.toggle("is-active", i < litCount);
  });

  // Same progress value, reused directly as a percentage height — the
  // divider line underneath the subtitle fills top-down in exact lockstep
  // with the words lighting up, rather than running on its own timer.
  heroDividerFillEl.style.height = `${progress * 100}%`;
}

let subtitleTicking = false;
window.addEventListener("scroll", () => {
  if (subtitleTicking) return;
  subtitleTicking = true;
  requestAnimationFrame(() => {
    updateSubtitleHighlight();
    subtitleTicking = false;
  });
});
updateSubtitleHighlight(); // correct state immediately, e.g. on a page refresh mid-scroll

// ---------------------------------------------------------------------
// Custom cursor: a small dot that snaps exactly to the mouse every frame
// (the "pivot"), plus a larger ring that only ever closes a fraction of
// the remaining distance to the mouse each frame — that's what makes it
// lag behind. How far behind it currently is also drives a stretch +
// rotation toward the direction of travel, so it "flings" when you move
// fast and relaxes back into a plain circle once it catches up.
//
// matchMedia("(hover: hover) and (pointer: fine)") is how you detect "this
// is a real mouse", not a touchscreen — touch devices report hover:none,
// so this whole block is simply skipped there and the OS cursor (which
// doesn't exist on touch anyway) is never touched. Reduced-motion visitors
// are skipped too, since the whole point of this effect is motion.
// ---------------------------------------------------------------------
const supportsFineCursor = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

if (supportsFineCursor && !prefersReducedMotion) {
  document.documentElement.classList.add("custom-cursor");

  const dotEl = document.getElementById("cursor-dot");
  const tailEl = document.getElementById("cursor-tail");

  let mouseX = window.innerWidth / 2;
  let mouseY = window.innerHeight / 2;
  let tailX = mouseX;
  let tailY = mouseY;
  let cursorRevealed = false;

  window.addEventListener("mousemove", (event) => {
    mouseX = event.clientX;
    mouseY = event.clientY;
    // Wait for real mouse movement before showing anything, so there's no
    // stray dot sitting at the center of the screen before you've touched
    // the mouse at all.
    if (!cursorRevealed) {
      cursorRevealed = true;
      dotEl.style.opacity = "1";
      tailEl.style.opacity = "0.5";
    }
  });

  function animateCursor() {
    // -4px / -16px center each element on the mouse position: they're
    // positioned by their top-left corner by default, so this shifts each
    // one back by exactly half its own width/height (8px and 32px, from
    // the CSS) rather than letting the mouse point sit at their corner.
    dotEl.style.transform = `translate3d(${mouseX - 4}px, ${mouseY - 4}px, 0)`;

    // Linear interpolation ("lerp"): move the tail 15% of the remaining
    // distance to the mouse, every frame, instead of jumping straight to
    // it. Repeated every frame, that produces smooth chasing motion — the
    // classic technique behind any "trailing" cursor or cursor-follower.
    tailX += (mouseX - tailX) * 0.15;
    tailY += (mouseY - tailY) * 0.15;

    // How far behind the tail currently is becomes the "fling": far behind
    // (moving fast) means a longer stretch angled toward the direction of
    // travel; caught up (barely moving) means effectively a plain circle.
    const dx = mouseX - tailX;
    const dy = mouseY - tailY;
    const lag = Math.min(Math.sqrt(dx * dx + dy * dy), 60);
    const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
    const stretch = 1 + lag / 40;

    // Squishing the perpendicular axis by 1/sqrt(stretch) as the other
    // axis stretches keeps the shape's apparent area roughly constant —
    // it reads as an elastic blob being pulled, not just growing overall.
    tailEl.style.transform =
      `translate3d(${tailX - 16}px, ${tailY - 16}px, 0) ` +
      `rotate(${angle}deg) scale(${stretch}, ${1 / Math.sqrt(stretch)})`;

    requestAnimationFrame(animateCursor);
  }
  requestAnimationFrame(animateCursor);
}

init();

async function init() {
  try {
    const response = await fetch("products.json");
    allProducts = await response.json();
  } catch (err) {
    // If products.json fails to load (e.g. opened as a raw file:// page
    // without a local server — see README), show a clear message instead
    // of a silently empty page.
    gridEl.innerHTML =
      "<p>Couldn't load products.json. If you're opening this file directly in a browser, run a local server instead (see README).</p>";
    console.error(err);
    return;
  }

  renderCategoryPills();
  render();

  searchInputEl.addEventListener("input", (event) => {
    searchTerm = event.target.value.trim().toLowerCase();
    render();
  });
}

// A product's full category path, top to bottom — "Tech Accessories" for
// most products, or ["Tech Accessories", "iPhone", "Pro"] for something
// filed all the way down under a specific iPhone model. `subcategory` is
// entirely optional in products.json; products that don't have one are
// just a single-level path.
function getProductPath(product) {
  return [product.category, ...(product.subcategory || [])];
}

// Every distinct value that appears at a given depth, among products whose
// path matches activePath up to that depth. This is what makes the whole
// pill system data-driven rather than a hand-maintained list: add a
// product with a new subcategory anywhere in products.json, and a pill for
// it appears automatically next render — there's no separate place that
// has to be told "iPhone" or "Pro" exist. It also means a subcategory with
// zero products yet (say, "17e") simply has no pill yet, rather than
// showing an option that leads to an empty grid.
function getOptionsAtLevel(level) {
  const options = new Set();
  allProducts.forEach((product) => {
    const path = getProductPath(product);
    // Only levels *before* this one should constrain it — e.g. level 0
    // (the top row) must always offer every top-level category, regardless
    // of how deep activePath currently goes; only level 1 onward should
    // care what's picked at level 0. Comparing against the whole
    // activePath instead of activePath.slice(0, level) was the bug here:
    // it made every row silently inherit constraints from levels deeper
    // than itself, so once you'd drilled down, shallower rows lost their
    // other options entirely.
    const matchesPathSoFar = activePath
      .slice(0, level)
      .every((value, i) => path[i] === value);
    if (matchesPathSoFar && path.length > level) {
      options.add(path[level]);
    }
  });
  return [...options];
}

// Renders one pill row per level of the drill-down (top-level categories,
// then subcategories once one is selected, and so on) — called every time
// the selection changes, not just once at load, since which rows exist at
// all depends on how deep activePath currently goes.
function renderCategoryPills() {
  pillsEl.innerHTML = "";

  for (let level = 0; ; level++) {
    // A row for `level` only makes sense once every level before it has
    // actually been chosen — e.g. no "Pro" row until "iPhone" is selected,
    // even though .every() on activePath.slice(0, level) would otherwise
    // vacuously "match" everything when activePath doesn't reach this deep
    // yet (an empty check trivially passes for any product).
    if (level > activePath.length) break;

    const options = getOptionsAtLevel(level);
    if (options.length === 0) break; // nothing left to drill into at this depth

    const row = document.createElement("div");
    row.className = "category-pills";

    ["All", ...options].forEach((option) => {
      const isAll = option === "All";
      const isActive = isAll ? activePath.length === level : activePath[level] === option;

      const button = document.createElement("button");
      button.type = "button";
      button.className = "pill" + (isActive ? " active" : "");
      // The top row's "All" (reset everything) reads fine on its own, but
      // stacked directly under another "All" a row up, it reads as
      // ambiguous ("all what?"). Specifically the row one level under
      // "iPhone" — the actual iPhone models — gets the clarified label;
      // checking the parent value here rather than a hardcoded level
      // number means this still targets the right row even if some other
      // branch of the category tree ends up deeper or shallower than
      // iPhone's. If a different, non-"model" subcategory gets added
      // elsewhere later, this wording may need to become configurable
      // instead of tied to this one specific parent value.
      button.textContent = isAll && activePath[level - 1] === "iPhone" ? "All models" : option;
      button.addEventListener("click", () => {
        // Truncating to `level` first means picking a new value at this
        // depth always discards whatever was selected deeper than it —
        // e.g. switching from "iPhone" to "Home & Kitchen" clears "Pro"
        // too, rather than leaving a stale, no-longer-relevant selection.
        activePath = activePath.slice(0, level);
        if (!isAll) activePath.push(option);
        renderCategoryPills();
        render();
      });
      row.appendChild(button);
    });

    pillsEl.appendChild(row);
  }
}

// Applies the current search text + category filter, then redraws the grid.
// Both filters are combined with AND: a product must match the selected
// category AND contain the search text in its name. "Matches the category"
// means activePath is a prefix of the product's own path — e.g. selecting
// just "Tech Accessories" (activePath length 1) matches every product
// under it regardless of subcategory, while drilling down to
// ["Tech Accessories", "iPhone", "Pro"] only matches that exact branch.
function render() {
  const filtered = allProducts.filter((product) => {
    const path = getProductPath(product);
    const matchesCategory = activePath.every((value, i) => path[i] === value);
    const matchesSearch = product.name.toLowerCase().includes(searchTerm);
    return matchesCategory && matchesSearch;
  });

  gridEl.innerHTML = "";
  emptyStateEl.hidden = filtered.length > 0;

  filtered.forEach((product, index) => {
    const card = buildProductCard(product);
    gridEl.appendChild(card);
    observeReveal(card, index);
  });
}

// Builds a single <article class="product-card"> element via the DOM API
// (rather than innerHTML + string concatenation) so product names never
// have to be manually escaped — textContent always inserts plain text
// safely, even if a name later contains characters like < or &.
function buildProductCard(product) {
  const card = document.createElement("article");
  card.className = "product-card";

  // Everything except the "Get it" button lives in here — photo, category,
  // name, price. This grouping matters for the hover-preview video: it
  // covers exactly this area (see attachVideoPreview() below), so the
  // button is the one thing that always stays visible and clickable, and
  // the card only ever pops out as a single whole unit rather than the
  // video and the card animating separately at different sizes.
  const previewArea = document.createElement("div");
  previewArea.className = "product-preview-area";

  const imageWrap = document.createElement("div");
  imageWrap.className = "product-image-wrap";

  if (product.badge) {
    const badge = document.createElement("span");
    badge.className = "badge";
    badge.textContent = product.badge;
    imageWrap.appendChild(badge);
  }

  const image = document.createElement("img");
  image.src = product.image;
  image.alt = product.name;
  image.loading = "lazy";
  imageWrap.appendChild(image);
  previewArea.appendChild(imageWrap);

  const info = document.createElement("div");
  info.className = "product-info";

  const category = document.createElement("p");
  category.className = "product-category";
  category.textContent = product.category;

  const name = document.createElement("h2");
  name.className = "product-name";
  name.textContent = product.name;

  info.appendChild(category);
  info.appendChild(name);

  // Price is optional per the data model, so only render it when present.
  if (product.price) {
    const price = document.createElement("p");
    price.className = "product-price";
    price.textContent = product.price;
    info.appendChild(price);
  }

  previewArea.appendChild(info);
  card.appendChild(previewArea);

  // Optional per-product hover-preview video — see attachVideoPreview()
  // below. Products with no "video" field in products.json simply never
  // get this element at all, so there's nothing extra for them to load.
  if (product.video) {
    attachVideoPreview(card, previewArea, product.video);
  }

  // "Get it" (the affiliate link) and, when a product has one, "Copy code"
  // sit side by side as two ways to act on a product — see
  // attachCopyCode() below for what the code button actually does.
  const actions = document.createElement("div");
  actions.className = "product-actions";

  const cta = document.createElement("a");
  cta.className = "product-cta";
  cta.href = product.link;
  cta.textContent = "Get it →";
  cta.target = "_blank";        // opens in a new tab
  cta.rel = "noopener noreferrer"; // security best practice for target="_blank" links:
                                    // stops the opened page from accessing window.opener
  actions.appendChild(cta);

  // Optional per-product discount/voucher code, entirely separate from the
  // link — products.json simply omits "code" for anything that doesn't
  // have one.
  if (product.code) {
    attachCopyCode(actions, product.code);
  }

  card.appendChild(actions);

  return card;
}

// A small secondary button next to "Get it" that copies a product's code
// to the clipboard, with the label itself flashing "Copied!" briefly as
// the only feedback — no separate toast/alert needed for something this
// low-stakes. navigator.clipboard is only available on secure contexts
// (https, or localhost while testing), which GitHub Pages always is.
function attachCopyCode(actions, code) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "product-copy-code";
  button.textContent = `Copy code: ${code}`;

  let resetTimer = null;
  button.addEventListener("click", () => {
    navigator.clipboard.writeText(code).then(() => {
      button.textContent = "Copied!";
      button.classList.add("is-copied");
      clearTimeout(resetTimer);
      resetTimer = setTimeout(() => {
        button.textContent = `Copy code: ${code}`;
        button.classList.remove("is-copied");
      }, 1500);
    });
  });

  actions.appendChild(button);
}

// How long you need to hold hover before the preview appears.
const VIDEO_HOVER_DELAY_MS = 700;

// Remembers whether you last chose sound on or off, across every video on
// the site and across visits (localStorage survives a page reload). There
// is no way around browsers blocking *the very first* autoplay-with-sound
// attempt before you've ever clicked anything — that's a deliberate,
// universal restriction (see the long comment in attachVideoPreview()
// below), not something a website can opt out of. What this *can* fix is
// everything after that: once you've told a video "yes, sound", every
// other video stops bothering to guess and just starts that way too,
// instead of re-attempting and silently falling back on every single one.
const SOUND_PREF_KEY = "catalogue-video-sound";

function getSoundPreference() {
  try {
    return localStorage.getItem(SOUND_PREF_KEY); // "on", "off", or null (never chosen)
  } catch {
    return null; // localStorage can throw in private-browsing/locked-down contexts
  }
}

function setSoundPreference(wantsSound) {
  try {
    localStorage.setItem(SOUND_PREF_KEY, wantsSound ? "on" : "off");
  } catch {
    // Nothing to do if storage is unavailable — the site still works, it
    // just won't remember the choice for next time.
  }
}

// Small inline icons for the mute button (same hand-written-SVG approach as
// the scroll-cue arrow in the hero) — no icon library needed for two glyphs.
const ICON_MUTED =
  '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><line x1="23" y1="9" x2="17" y2="15"></line><line x1="17" y1="9" x2="23" y2="15"></line></svg>';
const ICON_UNMUTED =
  '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path><path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path></svg>';

// Holding hover on a card replaces the photo, category, name, and price
// (everything in .product-preview-area — see buildProductCard() above)
// with a short looping video covering that exact same area, while the
// whole card lifts above its neighbors (the "is-previewing" class in
// styles.css) as one single unit — a quick preview, not a link to
// anywhere. The "Get it" button lives outside .product-preview-area, so
// it's the one thing that always stays visible underneath. Tries to play
// with sound; falls back to muted if the browser blocks that (see the
// mouseenter handler below for why). Only wired up on devices with a real
// mouse (supportsFineCursor, computed further down for the custom cursor
// too): a touchscreen has no "hover and wait", just taps, so this would
// never make sense to trigger there.
function attachVideoPreview(card, previewArea, videoUrl) {
  if (!supportsFineCursor) return;

  // inset: 0 here exactly matches .product-preview-area's own box (photo
  // + text), covering it edge-to-edge — not growing past it, unlike the
  // earlier version of this feature. That's what removed both bugs from
  // that version at once: nothing to misalign with the static image
  // underneath, and nothing to accidentally end up wider than the card.
  const overlay = document.createElement("div");
  overlay.className = "product-video-overlay";
  previewArea.appendChild(overlay);

  const video = document.createElement("video");
  video.className = "product-video";
  video.loop = true;
  video.playsInline = true;
  video.preload = "none"; // don't fetch the file until someone actually hovers
  overlay.appendChild(video);

  const muteButton = document.createElement("button");
  muteButton.type = "button";
  muteButton.className = "product-video-mute";
  overlay.appendChild(muteButton);

  // Keeps the button's icon and label in sync with the video's actual
  // muted state, from wherever that state got set (a real click below, or
  // the autoplay fallback further down).
  function updateMuteButton() {
    muteButton.innerHTML = video.muted ? ICON_MUTED : ICON_UNMUTED;
    muteButton.setAttribute("aria-label", video.muted ? "Unmute preview" : "Mute preview");
  }
  updateMuteButton();

  // A real click is the one thing that reliably turns sound on — see the
  // long comment in the mouseenter handler below. stopPropagation keeps
  // this from also bubbling up to the overlay's own click-to-unmute
  // handler further down and re-toggling what this click just set.
  muteButton.addEventListener("click", (event) => {
    event.stopPropagation();
    video.muted = !video.muted;
    updateMuteButton();
    setSoundPreference(!video.muted);
  });

  // The small button is the precise control, but it's easy to miss over a
  // playing video — clicking anywhere on the preview also counts as the
  // same real gesture and unmutes (muteButton's stopPropagation keeps a
  // click ON the button from double-handling here). Only ever turns sound
  // ON this way; turning it back off stays a deliberate action on the
  // button itself, not an accidental side effect of clicking the video.
  overlay.addEventListener("click", () => {
    if (video.muted) {
      video.muted = false;
      updateMuteButton();
      setSoundPreference(true);
    }
  });

  let hoverTimer = null;

  card.addEventListener("mouseenter", () => {
    hoverTimer = setTimeout(() => {
      // Setting .src here, not up front, means the video file is only
      // ever downloaded the first time someone actually hovers long
      // enough to see it — not for every card on every page load.
      if (!video.src) video.src = videoUrl;
      video.currentTime = 0;

      // Browsers only allow *unmuted* autoplay as a direct response to
      // specific gesture types (a real click or tap) — hover is
      // deliberately excluded from that list, and browsers explicitly
      // close the obvious loophole too (starting muted, then flipping
      // .muted off a moment later without a fresh gesture) — so there is
      // no way to make the very first preview anyone ever hovers start
      // with sound. Every site with a hover/autoplay preview has this
      // same wall (YouTube and Instagram included) — it isn't fixable
      // from here.
      //
      // What *is* fixable: once you've told a video "yes, sound" — by
      // clicking the button or the video itself, both real gestures —
      // getSoundPreference() remembers that choice (see its definition
      // above), so every video after that skips the doomed unmuted
      // attempt on a cold hover and starts muted immediately, with
      // nothing to notice or correct.
      const wantsSound = getSoundPreference() !== "off";
      video.muted = !wantsSound;
      updateMuteButton();
      video.play().catch(() => {
        video.muted = true;
        updateMuteButton();
        video.play().catch(() => {});
      });

      overlay.classList.add("is-visible");
      muteButton.classList.add("is-visible");
      card.classList.add("is-previewing");
    }, VIDEO_HOVER_DELAY_MS);
  });

  card.addEventListener("mouseleave", () => {
    clearTimeout(hoverTimer);
    overlay.classList.remove("is-visible");
    muteButton.classList.remove("is-visible");
    card.classList.remove("is-previewing");
    video.pause();
  });
}
