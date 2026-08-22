#!/usr/bin/env python3
"""Extract the 52 product photographs from the flattened Mr. Clean PDF catalog.

The source PDF stores each page as one raster image, so the crop boxes are tied
to the catalog's native 3508 x 2480 page artwork. Output files retain the
catalog background to avoid inventing or altering any product photography.
"""

from __future__ import annotations

import argparse
import io
from pathlib import Path

from PIL import Image
from pypdf import PdfReader


PRODUCTS: dict[str, tuple[int, tuple[int, int, int, int], str]] = {
    "0001": (2, (170, 500, 1885, 1630), "salveta-servimi-33x33"),
    "0002": (2, (2180, 750, 3260, 1590), "salveta-servimi-30x30"),
    "0003": (3, (320, 500, 1460, 1000), "fleteza-duar-2p-12x200"),
    "0004": (3, (1870, 490, 3000, 1000), "fleteza-duar-2p-kafe-20x200"),
    "0005": (3, (290, 1340, 1810, 1870), "fleteza-duar-2p-20x200"),
    "0006": (3, (2160, 1340, 3050, 1850), "fleteza-tualeti-2p-24x250"),
    "0007": (4, (180, 500, 1070, 990), "fleteza-tualeti-2p-40x200"),
    "0008": (4, (2080, 490, 2920, 980), "rollne-duar-700g"),
    "0009": (4, (300, 1335, 1240, 1870), "rollne-duar-550g"),
    "0010": (4, (2110, 1335, 3060, 1870), "rollne-duar-600g"),
    "0011": (5, (280, 500, 900, 970), "rollne-shtrati-60cm-50m"),
    "0012": (5, (2170, 500, 3070, 930), "rollne-centerfeed-300g"),
    "0013": (5, (300, 1320, 1010, 1830), "rollne-tualeti-140-flete"),
    "0014": (5, (2160, 1340, 3050, 1900), "rollne-duar-1kg"),
    "0015": (6, (580, 350, 1050, 930), "shampo-duar-ocean-5l"),
    "0016": (6, (1670, 350, 2150, 930), "shampo-duar-fresh-5l"),
    "0017": (6, (2740, 350, 3190, 930), "shampo-toke-sapun-5l"),
    "0018": (6, (580, 1340, 1020, 1950), "shkume-duar-ocean-5l"),
    "0019": (6, (1640, 1340, 2150, 1950), "shkume-duar-premium-5l"),
    "0020": (6, (2720, 1340, 3170, 1950), "shampo-toke-bubble-gum-5l"),
    "0021": (7, (600, 340, 1020, 930), "dezinfektues-inventari-5l"),
    "0022": (7, (1680, 320, 2110, 930), "pastrues-dru-portokall-1l"),
    "0023": (7, (2770, 340, 3190, 930), "zbardhues-5l"),
    "0024": (7, (600, 1330, 1030, 1950), "detergjent-enesh-limon-5l"),
    "0025": (7, (1750, 1340, 2050, 1950), "heqes-njollash-750ml"),
    "0026": (7, (2840, 1340, 3180, 1950), "politur-inox-750ml"),
    "0027": (8, (700, 330, 980, 930), "krem-pastrues-arf-1l"),
    "0028": (8, (1860, 320, 2080, 930), "domestos-1l"),
    "0029": (8, (2770, 340, 3190, 930), "detergjent-enesh-molle-5l"),
    "0030": (8, (650, 1335, 1000, 1910), "shampo-dyshemeje-makineri-5l"),
    "0031": (8, (1700, 1335, 2150, 1910), "detergjent-enelarese-20l"),
    "0032": (8, (2800, 1335, 3190, 1910), "shkelqyes-enelarese-20l"),
    "0033": (9, (620, 330, 990, 930), "detergjent-rrobash-1-5kg"),
    "0034": (9, (1680, 330, 2100, 930), "detergjent-rrobash-3kg"),
    "0035": (9, (2780, 340, 3170, 930), "degresant-5l"),
    "0036": (9, (600, 1335, 1040, 1910), "pastrues-gelqereje-5l"),
    "0037": (9, (1760, 1340, 2050, 1910), "sprej-xhami-750ml"),
    "0038": (9, (2820, 1340, 3160, 1910), "pastrues-xhami-5l"),
    "0039": (10, (600, 340, 1040, 930), "shampo-flokesh-reposak-5l"),
    "0040": (10, (1680, 340, 2160, 930), "shampo-trupi-5l"),
    "0041": (10, (2760, 340, 3190, 930), "shampo-flokesh-celestia-5l"),
    "0042": (10, (650, 1335, 1000, 1910), "arome-ambienti-sprej-550ml"),
    "0043": (10, (1840, 1335, 2120, 1910), "dezinfektues-duar-1l"),
    "0044": (10, (2840, 1335, 3170, 1910), "dezinfektues-duar-5l"),
    "0045": (11, (620, 340, 1030, 930), "shporte-hapur-6l"),
    "0046": (11, (1530, 340, 2140, 930), "shporte-hapur-25l"),
    "0047": (11, (2810, 340, 3170, 930), "shporte-hapur-50l"),
    "0048": (11, (620, 1335, 1020, 1910), "shporte-mbeturinash-15l"),
    "0049": (11, (1810, 1335, 2120, 1910), "shporte-basketi-15l"),
    "0050": (11, (2800, 1335, 3180, 1910), "shporte-inox-5l"),
    "0051": (12, (1110, 270, 2030, 1390), "hygiene-fresh-250ml"),
    "0052": (12, (2070, 340, 2550, 1390), "hygiene-zone-insekte"),
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("output", type=Path)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    reader = PdfReader(args.source)
    args.output.mkdir(parents=True, exist_ok=True)
    page_cache: dict[int, Image.Image] = {}

    for code, (page_number, box, slug) in PRODUCTS.items():
        page_image = page_cache.get(page_number)
        if page_image is None:
            raw = reader.pages[page_number - 1].images[0].data
            page_image = Image.open(io.BytesIO(raw)).convert("RGB")
            if page_image.size != (3508, 2480):
                raise RuntimeError(
                    f"Unexpected source page dimensions: {page_image.size}"
                )
            page_cache[page_number] = page_image

        crop = page_image.crop(box)
        crop.thumbnail((900, 900), Image.Resampling.LANCZOS)
        destination = args.output / f"{code}-{slug}.webp"
        crop.save(destination, "WEBP", quality=90, method=6)

    written = sorted(args.output.glob("*.webp"))
    if len(written) != 52:
        raise RuntimeError(f"Expected 52 product images, wrote {len(written)}")
    print(f"Extracted {len(written)} catalog product images to {args.output}")


if __name__ == "__main__":
    main()
