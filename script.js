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

let allProducts = [];       // full list, loaded once from products.json
let activeCategory = "All"; // which pill is currently selected
let searchTerm = "";        // current text in the search box

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

  buildCategoryPills();
  render();

  searchInputEl.addEventListener("input", (event) => {
    searchTerm = event.target.value.trim().toLowerCase();
    render();
  });
}

// Builds one pill per unique category found in the data, plus an "All"
// pill at the start. Using a Set here is just the standard JS way to get
// unique values out of an array.
function buildCategoryPills() {
  const categories = ["All", ...new Set(allProducts.map((p) => p.category))];

  pillsEl.innerHTML = "";
  categories.forEach((category) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "pill" + (category === activeCategory ? " active" : "");
    button.textContent = category;
    button.addEventListener("click", () => {
      activeCategory = category;
      // Move the "active" class to whichever pill was just clicked.
      pillsEl.querySelectorAll(".pill").forEach((pill) => pill.classList.remove("active"));
      button.classList.add("active");
      render();
    });
    pillsEl.appendChild(button);
  });
}

// Applies the current search text + category filter, then redraws the grid.
// Both filters are combined with AND: a product must match the selected
// category AND contain the search text in its name.
function render() {
  const filtered = allProducts.filter((product) => {
    const matchesCategory = activeCategory === "All" || product.category === activeCategory;
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

  const body = document.createElement("div");
  body.className = "product-body";

  const category = document.createElement("p");
  category.className = "product-category";
  category.textContent = product.category;

  const name = document.createElement("h2");
  name.className = "product-name";
  name.textContent = product.name;

  body.appendChild(category);
  body.appendChild(name);

  // Price is optional per the data model, so only render it when present.
  if (product.price) {
    const price = document.createElement("p");
    price.className = "product-price";
    price.textContent = product.price;
    body.appendChild(price);
  }

  const cta = document.createElement("a");
  cta.className = "product-cta";
  cta.href = product.link;
  cta.textContent = "Get it →";
  cta.target = "_blank";        // opens in a new tab
  cta.rel = "noopener noreferrer"; // security best practice for target="_blank" links:
                                    // stops the opened page from accessing window.opener
  body.appendChild(cta);

  card.appendChild(imageWrap);
  card.appendChild(body);
  return card;
}
