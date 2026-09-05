# Catalogue No. 01

A small, static, Apple-style curated product link page. Plain HTML/CSS/JS —
no build step, no frameworks, no backend.

**Live at:** https://fungdoobit.github.io/catalogue/

## Files

- `index.html` — page structure
- `styles.css` — all styling
- `script.js` — loads `products.json` and handles search + category filtering
- `products.json` — the product data (edit this to add/change products)

## Preview locally

Because `script.js` uses `fetch()` to load `products.json`, opening
`index.html` directly by double-clicking it won't work in most browsers
(they block `fetch` on the `file://` protocol). Run a tiny local server
instead — no install needed if you have Python:

```bash
cd catalogue
python3 -m http.server 8000
```

Then open **http://localhost:8000** in your browser.

(No Python? VS Code's "Live Server" extension does the same thing with one click.)

## Deploy for free with GitHub Pages

1. Push this repo to GitHub (if it isn't already).
2. On GitHub, go to your repo → **Settings** → **Pages**.
3. Under "Build and deployment", set **Source** to `Deploy from a branch`.
4. Choose the branch (e.g. `main`) and folder `/ (root)`, then **Save**.
5. Wait ~1 minute, then refresh the Pages settings tab — GitHub shows you
   the live URL (something like `https://yourusername.github.io/catalogue/`).

That's it — totally free, and it updates automatically every time you push
to that branch.

The `og:url`/`og:image` tags in `index.html` are already pointed at the
live URL above. If you ever rename the repo or move it under a different
account, update those two tags to match the new URL — those apps fetch
the image separately, so it has to be the real live URL, not a relative
path.

## Editing products

Open `products.json` and edit the array. Each product looks like:

```json
{
  "name": "Product Name",
  "image": "https://example.com/image.jpg",
  "category": "Some Category",
  "subcategory": ["Sub Level 1", "Sub Level 2"],
  "badge": "Top Pick",
  "price": "$19.99",
  "link": "https://your-affiliate-link.com",
  "video": "https://example.com/preview.mp4",
  "code": "ABC-123-XYZ"
}
```

`subcategory`, `badge`, `price`, `video`, and `code` are all optional —
leave `badge` as `""`, omit `price`, or omit `subcategory`/`video`/`code`
entirely if a product doesn't have one.

### Discount/voucher codes

`code` is a separate, secondary way to get the product — some Shopee
listings pair an affiliate link with a code that gets typed in at
checkout instead. When present, a "Copy code" button appears under "Get
it →" (see `attachCopyCode()` in `script.js`); clicking it copies the
code to the clipboard and briefly shows "Copied!" as confirmation. A
product with no `code` just doesn't get the button at all.

### Subcategories (drill-down filtering)

`subcategory` is an array representing a path *underneath* `category`,
as deep as you want — for example, a product filed under Tech
Accessories → iPhone → Pro would have:

```json
"category": "Tech Accessories",
"subcategory": ["iPhone", "Pro"]
```

The category pills pick this up automatically: selecting "Tech
Accessories" reveals a second row with "iPhone" (and anything else
found at that level), selecting "iPhone" reveals a third row with "Pro"
(and any other iPhone models you've added products for), and so on.
There's nothing to register anywhere else — a pill only ever appears
once a product actually exists for it, so you never end up with a
filter that leads to an empty grid. Adding a product for a new model
(say, `["iPhone", "17e"]`) is enough for its own pill to show up next to
"Pro" automatically.

`video` (optional) is a short looping preview clip. Hover a card for
0.7s on desktop and it takes over the photo, category, name, and price
with the video (the "Get it" button is the one thing that stays put and
visible below it), while the whole card lifts and grows above its
neighbors as a single unit — a quick preview, not a link anywhere. The
video file itself isn't downloaded until someone actually triggers the
preview, so products without a video cost nothing extra and products
with one don't load their clip on page load.

There's no "hover and wait" gesture on a touchscreen, so on touch devices
a single tap on the photo opens the same preview instead (a small play
icon in the corner hints that it's tappable, since there's no hover to
discover it with otherwise), and tapping it again closes it — only one
card's preview is ever open at a time, so opening a new one closes
whichever was open before. Tapping "Get it" or "Copy code" is unaffected;
only the photo/text area itself toggles the preview.

It tries to play **with sound** immediately. Browsers only allow
autoplay-with-sound as a direct response to specific gesture types (a
real click or tap) — hover is deliberately excluded from that list, so
pages can't blast audio just from a mouse passing over them, and there's
no workaround (starting muted and flipping the `muted` property a moment
later doesn't bypass it either — browsers explicitly block that too). In
practice this means the very first preview anyone *hovers*, on their very
first visit, always falls back to muted automatically (the video still
plays, just silently) — this is true of every site with a hover/autoplay
preview, not something specific to this one. A tap is a real gesture
though, so on touch devices the very first preview has a genuine shot at
sound working immediately.

What does carry over: clicking anywhere on the preview (the small
speaker button, or the video itself) is a real click, so turning sound on
that way always works — and that choice is remembered in `localStorage`
(see `SOUND_PREF_KEY` in `script.js`), so every other video, this session
and on future visits, starts already knowing you want sound instead of
re-attempting and silently falling back every single time.

Video files live in `videos/` and are referenced by a relative path
(`"video": "videos/yourfile.mp4"`) — same idea as `og-image.png`, just
committed straight into the repo rather than hosted elsewhere. Keep
clips short (a few seconds) and reasonably small — a multi-megabyte file
will feel sluggish appearing right at the hover threshold. MP4 (H.264)
is the safest format for broad browser support.
