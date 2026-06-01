from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(r"C:\GB")
OUTPUT_DIR = ROOT / "output" / "pdf"
JPG_PATH = OUTPUT_DIR / "agent-crawler-flow-feedback-loop.jpg"
PDF_PATH = OUTPUT_DIR / "agent-crawler-flow-feedback-loop.pdf"

WIDTH = 1800
HEIGHT = 2400
BG = (247, 244, 238)
TEXT = (31, 36, 41)
MUTED = (95, 102, 111)
LINE = (78, 90, 107)
MAIN_FILL = (227, 236, 248)
MAIN_BORDER = (67, 104, 165)
SIDE_FILL = (233, 242, 231)
SIDE_BORDER = (75, 122, 79)
WARN_FILL = (251, 233, 214)
WARN_BORDER = (182, 101, 35)
REJECT_FILL = (245, 219, 219)
REJECT_BORDER = (157, 62, 62)
ACCENT = (212, 147, 48)


def load_font(name: str, size: int) -> ImageFont.FreeTypeFont:
    candidates = [
        Path(r"C:\Windows\Fonts") / name,
        Path(r"C:\Windows\Fonts\arial.ttf"),
    ]
    for candidate in candidates:
        if candidate.exists():
            try:
                return ImageFont.truetype(str(candidate), size=size)
            except OSError:
                pass
    return ImageFont.load_default()


FONT_TITLE = load_font("segoeuib.ttf", 60)
FONT_SUBTITLE = load_font("segoeui.ttf", 28)
FONT_BOX_TITLE = load_font("segoeuib.ttf", 28)
FONT_BODY = load_font("segoeui.ttf", 22)
FONT_SMALL = load_font("segoeui.ttf", 18)


def text_box(draw: ImageDraw.ImageDraw, xy, title, lines, fill, border, radius=28):
    x1, y1, x2, y2 = xy
    draw.rounded_rectangle(xy, radius=radius, fill=fill, outline=border, width=4)
    draw.text((x1 + 26, y1 + 20), title, fill=TEXT, font=FONT_BOX_TITLE)
    y = y1 + 66
    for line in lines:
        draw.text((x1 + 26, y), line, fill=TEXT, font=FONT_BODY)
        y += 31


def arrow(draw: ImageDraw.ImageDraw, start, end, color=LINE, width=7, head=18):
    draw.line([start, end], fill=color, width=width)
    x1, y1 = start
    x2, y2 = end
    if x1 == x2:
        if y2 > y1:
            pts = [(x2, y2), (x2 - head, y2 - head), (x2 + head, y2 - head)]
        else:
            pts = [(x2, y2), (x2 - head, y2 + head), (x2 + head, y2 + head)]
    elif y1 == y2:
        if x2 > x1:
            pts = [(x2, y2), (x2 - head, y2 - head), (x2 - head, y2 + head)]
        else:
            pts = [(x2, y2), (x2 + head, y2 - head), (x2 + head, y2 + head)]
    else:
        pts = [(x2, y2), (x2 - head, y2 - head), (x2 - head, y2 + head)]
    draw.polygon(pts, fill=color)


def elbow_arrow(draw: ImageDraw.ImageDraw, points, color=LINE, width=7, head=18):
    for a, b in zip(points, points[1:]):
        draw.line([a, b], fill=color, width=width)
    x1, y1 = points[-2]
    x2, y2 = points[-1]
    arrow(draw, (x1, y1), (x2, y2), color=color, width=width, head=head)


def center(box):
    x1, y1, x2, y2 = box
    return ((x1 + x2) // 2, (y1 + y2) // 2)


def top(box):
    x1, y1, x2, _ = box
    return ((x1 + x2) // 2, y1)


def bottom(box):
    x1, _, x2, y2 = box
    return ((x1 + x2) // 2, y2)


def left(box):
    x1, y1, _, y2 = box
    return (x1, (y1 + y2) // 2)


def right(box):
    _, y1, x2, y2 = box
    return (x2, (y1 + y2) // 2)


def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    image = Image.new("RGB", (WIDTH, HEIGHT), BG)
    draw = ImageDraw.Draw(image)

    draw.rounded_rectangle((50, 40, WIDTH - 50, HEIGHT - 50), radius=40, outline=(215, 204, 190), width=4)
    draw.text((100, 88), "How the Agent Crawler Works", fill=TEXT, font=FONT_TITLE)
    draw.text(
        (100, 162),
        "Including the self-reflection loop that improves crawling decisions over time",
        fill=MUTED,
        font=FONT_SUBTITLE,
    )

    mx1, mx2 = 360, 1040
    step_h = 140
    gap = 44
    y = 260
    main_boxes = []
    main_specs = [
        ("1. Seed or Discover Forum", ["Known source list or newly found forum", "Forum row enters SQLite queue"]),
        ("2. Calibration", ["Codex identifies engine, sections, selectors", "Crawler chooses where and how to look"]),
        ("3. Enumerate Threads", ["Batch crawl of candidate thread links", "Already seen or bad URLs are skipped"]),
        ("4. Fetch and Parse", ["Thread pages become normalized text", "Parser uses forum-specific hints and fallbacks"]),
        ("5. DeepSeek Classify", ["Decide whether the thread looks like a resolved case", "Low-signal threads are discarded"]),
        ("6. DeepSeek Extract", ["Pull problem, fix, parts, symptoms, confidence", "Can emit one or more candidate cases"]),
        ("7. Deterministic Validate", ["Check completeness, author consistency, resolution rules", "Reject malformed or weak cases"]),
        ("8. Codex Verify", ["Second-pass audit of extracted case", "PASS keeps it alive, FAIL rejects it"]),
        ("9. Dedupe and Import", ["Cross-check against existing knowledge base", "New verified cases are imported"]),
    ]
    for title, lines in main_specs:
        box = (mx1, y, mx2, y + step_h)
        main_boxes.append(box)
        text_box(draw, box, title, lines, MAIN_FILL, MAIN_BORDER)
        y += step_h + gap

    for box_a, box_b in zip(main_boxes, main_boxes[1:]):
        arrow(draw, bottom(box_a), top(box_b))

    sx1, sx2 = 1120, 1700
    side_boxes = {
        "runner": (sx1, 300, sx2, 430),
        "memory": (sx1, 500, sx2, 630),
        "quality": (sx1, 700, sx2, 870),
        "reflection": (1080, 980, 1720, 1265),
        "learning": (1080, 1360, 1720, 1705),
        "states": (sx1, 1810, sx2, 2115),
    }

    text_box(
        draw,
        side_boxes["runner"],
        "Batch Runner",
        ["Windows task starts short runs every few minutes", "No long fragile process is required"],
        SIDE_FILL,
        SIDE_BORDER,
    )
    text_box(
        draw,
        side_boxes["memory"],
        "SQLite Memory",
        ["forums, threads, cases, runs, diaries", "Every batch resumes from saved state"],
        SIDE_FILL,
        SIDE_BORDER,
    )
    text_box(
        draw,
        side_boxes["quality"],
        "Quality Gates",
        ["Classifier -> extractor -> deterministic rules -> Codex verifier", "Noise is removed before import"],
        SIDE_FILL,
        SIDE_BORDER,
    )
    text_box(
        draw,
        side_boxes["reflection"],
        "Self-reflection / adaptation",
        [
            "Crawler notices missed selectors, parser failures, low yield,",
            "engine clues, false rejects, and weak forum qualification.",
            "Those observations are written into the forum diary and run stats.",
        ],
        WARN_FILL,
        WARN_BORDER,
    )
    text_box(
        draw,
        side_boxes["learning"],
        "Next batch uses the findings",
        [
            "Adjust thread_list_selector and parser hints",
            "Re-rank sections and forum priority",
            "Trigger recalibration or diagnosis when structure changes",
            "Tighten prompts and validation around recurring mistakes",
        ],
        WARN_FILL,
        WARN_BORDER,
    )
    text_box(
        draw,
        side_boxes["states"],
        "Forum States",
        [
            "active",
            "exhausted with cooldown",
            "calibration_failed",
            "disqualified",
            "State controls what the next batch will attempt",
        ],
        SIDE_FILL,
        SIDE_BORDER,
    )

    reject_boxes = {
        "discard_classify": (90, 1180, 300, 1290),
        "discard_validate": (90, 1655, 300, 1765),
        "verify_reject": (90, 1915, 300, 2025),
    }
    text_box(draw, reject_boxes["discard_classify"], "Discarded thread", ["Rejected at classification"], REJECT_FILL, REJECT_BORDER, radius=20)
    text_box(draw, reject_boxes["discard_validate"], "Discarded case", ["Failed deterministic checks"], REJECT_FILL, REJECT_BORDER, radius=20)
    text_box(draw, reject_boxes["verify_reject"], "verify_rejected", ["Codex audit said FAIL"], REJECT_FILL, REJECT_BORDER, radius=20)

    elbow_arrow(
        draw,
        [left(main_boxes[4]), (250, center(main_boxes[4])[1]), right(reject_boxes["discard_classify"])],
        color=REJECT_BORDER,
        width=6,
    )
    elbow_arrow(
        draw,
        [left(main_boxes[6]), (250, center(main_boxes[6])[1]), right(reject_boxes["discard_validate"])],
        color=REJECT_BORDER,
        width=6,
    )
    elbow_arrow(
        draw,
        [left(main_boxes[7]), (250, center(main_boxes[7])[1]), right(reject_boxes["verify_reject"])],
        color=REJECT_BORDER,
        width=6,
    )

    elbow_arrow(
        draw,
        [right(main_boxes[3]), (1120, center(main_boxes[3])[1]), left(side_boxes["memory"])],
        color=SIDE_BORDER,
        width=6,
    )
    elbow_arrow(
        draw,
        [right(main_boxes[6]), (1120, center(main_boxes[6])[1]), left(side_boxes["quality"])],
        color=SIDE_BORDER,
        width=6,
    )
    elbow_arrow(
        draw,
        [right(main_boxes[8]), (1120, center(main_boxes[8])[1]), left(side_boxes["states"])],
        color=SIDE_BORDER,
        width=6,
    )

    loop_points = [
        right(main_boxes[4]),
        (1160, center(main_boxes[4])[1]),
        (1160, top(side_boxes["reflection"])[1] - 40),
        (center(side_boxes["reflection"])[0], top(side_boxes["reflection"])[1] - 40),
        (center(side_boxes["reflection"])[0], top(side_boxes["reflection"])[1]),
    ]
    elbow_arrow(draw, loop_points, color=ACCENT, width=8, head=20)

    arrow(draw, bottom(side_boxes["reflection"]), top(side_boxes["learning"]), color=ACCENT, width=8, head=20)

    elbow_arrow(
        draw,
        [
            left(side_boxes["learning"]),
            (980, center(side_boxes["learning"])[1]),
            (980, top(main_boxes[1])[1] - 24),
            (center(main_boxes[1])[0], top(main_boxes[1])[1] - 24),
            (center(main_boxes[1])[0], top(main_boxes[1])[1]),
        ],
        color=ACCENT,
        width=8,
        head=20,
    )

    elbow_arrow(
        draw,
        [
            left(side_boxes["learning"]),
            (915, center(side_boxes["learning"])[1]),
            (915, top(main_boxes[2])[1] - 10),
            (center(main_boxes[2])[0], top(main_boxes[2])[1] - 10),
            (center(main_boxes[2])[0], top(main_boxes[2])[1]),
        ],
        color=ACCENT,
        width=6,
        head=18,
    )

    draw.text((1085, 910), "Feedback loop from observed reality back into crawler behavior", fill=ACCENT, font=FONT_SMALL)
    draw.text((105, 2205), "Key idea: the crawler does not only collect cases. It also collects evidence about where it is wrong,", fill=MUTED, font=FONT_SUBTITLE)
    draw.text((105, 2243), "then uses that evidence in later batches to improve selectors, parsing, prioritization, and calibration.", fill=MUTED, font=FONT_SUBTITLE)

    image.save(JPG_PATH, quality=93)
    rgb = image.convert("RGB")
    rgb.save(PDF_PATH, "PDF", resolution=150.0)


if __name__ == "__main__":
    main()
