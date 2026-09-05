#!/usr/bin/env python3
"""
add_product.py — automates the manual steps that went into adding every
product so far by hand: cropping the source photo tightly around the
actual item (so it reads full-size once the site's CSS applies
object-fit: cover, instead of sitting small in the middle of an
oversized frame — see the "UGREEN photo is a bit too small" fix this
script generalizes), dropping the file into images/ (and videos/, if a
clip is given) under a clean name, and appending the matching entry to
products.json in the same shape as everything already there.

It does NOT touch git — review the result (open index.html locally, see
README) and commit/push it yourself once you're happy with it.

Usage:
  python3 scripts/add_product.py \
    --name "Product Name" \
    --link "https://s.shopee.com.my/xxxx" \
    --category "Tech Accessories" \
    --image path/or/url/to/photo.png \
    [--subcategory "iPhone" "Pro"] \
    [--price "$19.99"] [--badge "Top Pick"] [--code "ABC-123-XYZ"] \
    [--video path/or/url/to/clip.mp4] \
    [--slug custom-file-basename] \
    [--force] [--dry-run]

Requires Pillow (`pip install Pillow`) — nothing else beyond the
standard library.
"""

import argparse
import json
import re
import shutil
import sys
import tempfile
import urllib.request
from pathlib import Path

from PIL import Image, ImageChops

REPO_ROOT = Path(__file__).resolve().parent.parent
PRODUCTS_JSON = REPO_ROOT / "products.json"
IMAGES_DIR = REPO_ROOT / "images"
VIDEOS_DIR = REPO_ROOT / "videos"

# How much room to leave around the detected product before cropping —
# a small margin reads better than a frame cropped exactly to the pixel
# edge of the item.
CROP_PADDING_FRACTION = 0.12

# Cropped images are already square (see find_square_crop_box below);
# this only kicks in to avoid saving unnecessarily huge files when a
# source photo is much bigger than the site ever displays it at.
MAX_OUTPUT_SIZE = 1200


def slugify(name):
    slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    return re.sub(r"-{2,}", "-", slug)


def is_url(path):
    return path.startswith("http://") or path.startswith("https://")


def fetch_to_temp(url, suffix):
    # Some CDNs (Shopee's included) reject requests with no User-Agent at
    # all, so this sets a plain browser-like one rather than urllib's
    # default "Python-urllib/x.y".
    request = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(request) as response:
        data = response.read()
    tmp = tempfile.NamedTemporaryFile(suffix=suffix, delete=False)
    tmp.write(data)
    tmp.close()
    return Path(tmp.name)


def find_content_bbox(image):
    """Bounding box of the actual product within `image`, as (left, top,
    right, bottom), or None if nothing distinct from the background could
    be found (a flat/blank image).

    Two cases, since both show up in practice: a transparent PNG (MOFT,
    Tapo) where the background is simply absent, and a flattened photo on
    a solid backdrop (UGREEN's original) where "background" means
    "whatever color sits in the corners".
    """
    if image.mode == "RGBA" and image.getchannel("A").getextrema()[0] < 255:
        # Genuinely transparent somewhere — the alpha channel itself is
        # the mask of "product vs. nothing".
        return image.getchannel("A").point(lambda a: 255 if a > 10 else 0).getbbox()

    rgb = image.convert("RGB")
    corners = [rgb.getpixel((0, 0)), rgb.getpixel((rgb.width - 1, 0)),
               rgb.getpixel((0, rgb.height - 1)), rgb.getpixel((rgb.width - 1, rgb.height - 1))]
    bg_color = tuple(sum(c) // len(c) for c in zip(*corners))
    bg_layer = Image.new("RGB", rgb.size, bg_color)
    diff = ImageChops.difference(rgb, bg_layer).convert("L")
    # A flat threshold rather than diff.getbbox() directly: getbbox()
    # treats any pixel that differs from black (i.e. any nonzero diff) as
    # "content", which is too sensitive to JPEG noise/anti-aliasing right
    # at the background's own edges.
    mask = diff.point(lambda p: 255 if p > 24 else 0)
    return mask.getbbox()


def find_square_crop_box(image, bbox):
    left, top, right, bottom = bbox
    box_w, box_h = right - left, bottom - top
    pad = int(max(box_w, box_h) * CROP_PADDING_FRACTION)
    side = max(box_w, box_h) + pad * 2

    cx, cy = (left + right) / 2, (top + bottom) / 2
    crop_left = cx - side / 2
    crop_top = cy - side / 2

    # Clamp to the image's own bounds — shifting the box rather than
    # shrinking it, so the product never ends up off-center just because
    # it was near an edge. If the image is smaller than `side` in either
    # direction, this falls back to however much of it actually exists.
    crop_left = max(0, min(crop_left, image.width - side))
    crop_top = max(0, min(crop_top, image.height - side))
    side = min(side, image.width, image.height)

    return (int(crop_left), int(crop_top), int(crop_left + side), int(crop_top + side))


def process_image(source_path):
    """Returns a cropped, square-framed RGBA image ready to save."""
    image = Image.open(source_path).convert("RGBA")
    bbox = find_content_bbox(image)

    if bbox is None:
        print("  (couldn't detect a distinct product region — cropping a plain center square instead)")
        side = min(image.width, image.height)
        bbox = ((image.width - side) // 2, (image.height - side) // 2,
                (image.width + side) // 2, (image.height + side) // 2)
        crop_box = bbox
    else:
        crop_box = find_square_crop_box(image, bbox)

    cropped = image.crop(crop_box)
    if cropped.width > MAX_OUTPUT_SIZE:
        cropped = cropped.resize((MAX_OUTPUT_SIZE, MAX_OUTPUT_SIZE), Image.LANCZOS)
    return cropped


def dump_products(products):
    """Serializes products.json in the exact style the file already uses —
    plain json.dumps(..., indent=2) would work too, but it breaks any
    array value (subcategory) onto multiple lines, which would reformat
    every existing entry's subcategory the moment this script touches the
    file, turning a one-product diff into a whole-file one.
    """
    lines = ["["]
    for i, product in enumerate(products):
        lines.append("  {")
        keys = list(product.keys())
        for j, key in enumerate(keys):
            value = product[key]
            if isinstance(value, list):
                value_str = "[" + ", ".join(json.dumps(v) for v in value) + "]"
            else:
                value_str = json.dumps(value)
            comma = "," if j < len(keys) - 1 else ""
            lines.append(f'    "{key}": {value_str}{comma}')
        lines.append("  }" + ("," if i < len(products) - 1 else ""))
    lines.append("]")
    return "\n".join(lines) + "\n"


def build_entry(args, image_rel_path, video_rel_path):
    entry = {
        "name": args.name,
        "image": image_rel_path,
        "category": args.category,
    }
    if args.subcategory:
        entry["subcategory"] = args.subcategory
    entry["badge"] = args.badge or ""
    entry["price"] = args.price or ""
    entry["link"] = args.link
    if video_rel_path:
        entry["video"] = video_rel_path
    if args.code:
        entry["code"] = args.code
    return entry


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--name", required=True)
    parser.add_argument("--link", required=True)
    parser.add_argument("--category", required=True)
    parser.add_argument("--image", required=True, help="Local file path or URL to the product photo")
    parser.add_argument("--subcategory", nargs="+", default=None)
    parser.add_argument("--price", default=None)
    parser.add_argument("--badge", default=None)
    parser.add_argument("--code", default=None)
    parser.add_argument("--video", default=None, help="Local file path or URL to a preview clip")
    parser.add_argument("--slug", default=None, help="Filename base (default: derived from --name)")
    parser.add_argument("--force", action="store_true", help="Overwrite an existing file/entry")
    parser.add_argument("--dry-run", action="store_true", help="Show what would happen without writing anything")
    args = parser.parse_args()

    slug = args.slug or slugify(args.name)
    if not slug:
        sys.exit("Couldn't derive a filename from --name — pass --slug explicitly.")

    products = json.loads(PRODUCTS_JSON.read_text())
    is_duplicate = lambda p: p["name"] == args.name or p["link"] == args.link
    if any(is_duplicate(p) for p in products):
        if not args.force:
            sys.exit("A product with this name or link already exists — pass --force to replace it.")
        # --force replaces the existing entry in place rather than adding
        # a second copy alongside it.
        products = [p for p in products if not is_duplicate(p)]

    image_dest = IMAGES_DIR / f"{slug}.png"
    if image_dest.exists() and not args.force:
        sys.exit(f"{image_dest} already exists — pass --force to overwrite, or a different --slug.")

    print(f"Processing image from {args.image} ...")
    image_source = fetch_to_temp(args.image, Path(args.image).suffix or ".img") if is_url(args.image) else Path(args.image)
    if not image_source.exists():
        sys.exit(f"Image not found: {image_source}")
    cropped = process_image(image_source)
    print(f"  cropped to {cropped.size[0]}x{cropped.size[1]}")

    video_dest = None
    if args.video:
        video_ext = Path(args.video).suffix or ".mp4"
        if video_ext.lower() != ".mp4":
            print(f"  note: video is {video_ext}, not .mp4 — MP4 (H.264) has the broadest browser support (see README)")
        video_dest = VIDEOS_DIR / f"{slug}-demo{video_ext}"
        if video_dest.exists() and not args.force:
            sys.exit(f"{video_dest} already exists — pass --force to overwrite, or a different --slug.")

    entry = build_entry(
        args,
        image_rel_path=f"images/{image_dest.name}",
        video_rel_path=f"videos/{video_dest.name}" if video_dest else None,
    )

    print("\nEntry to add:")
    print(json.dumps(entry, indent=2))

    if args.dry_run:
        print("\n(dry run — nothing was written)")
        return

    IMAGES_DIR.mkdir(exist_ok=True)
    cropped.save(image_dest)
    print(f"\nSaved {image_dest}")

    if args.video:
        VIDEOS_DIR.mkdir(exist_ok=True)
        video_source = fetch_to_temp(args.video, Path(args.video).suffix or ".mp4") if is_url(args.video) else Path(args.video)
        if not video_source.exists():
            sys.exit(f"Video not found: {video_source}")
        shutil.copyfile(video_source, video_dest)
        print(f"Saved {video_dest}")

    products.append(entry)
    PRODUCTS_JSON.write_text(dump_products(products))
    print(f"Appended to {PRODUCTS_JSON}")
    print("\nNext: preview locally (see README) and commit/push when it looks right.")


if __name__ == "__main__":
    main()
