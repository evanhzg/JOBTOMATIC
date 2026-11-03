"""Edit the text of an existing CV PDF in place, keeping its original design.

How it works:
1. `extract_units` splits each page into "units": a heading, a bullet, a paragraph,
   a contact line... Each unit keeps its exact geometry (line baselines, x
   positions), fonts, sizes, colors and letter-spacing.
2. The AI rewrites some units (see app/cv/tailor.py). Rich text may use **bold**
   to reproduce mixed-weight sentences ("**Une grande adaptabilité** et ...").
3. `apply_edits` removes only the original glyphs of edited units (backgrounds,
   shapes and photos are untouched), then lays the new text out on the original
   baselines with the same fonts. Text that does not fit in the free space below
   the unit is shrunk slightly; if it still does not fit, the edit is rejected and
   the original text stays (reported as `overflow`).

Fonts: PDFs embed *subsets* of fonts, so new words may need glyphs that are not
in the file. We download the full font from Fontsource (Google Fonts mirror) when
the family is known, else fall back to the embedded subset if it covers the text,
else Helvetica.
"""
from __future__ import annotations

import logging
import re
import statistics
import unicodedata
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Tuple

import httpx
import pymupdf

from ..config import FONTS_DIR

log = logging.getLogger(__name__)

BULLET_RE = re.compile(r"^\s*([-•–·▪●○◦*]|\d+[.)])\s+")
EMAIL_RE = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")
PHONE_RE = re.compile(r"(\+33\s?|0)[1-9](?:[\s.-]?\d{2}){4}")
YEAR_RE = re.compile(r"\b(19|20)\d{2}\b")
SECTION_WORDS = {
    "experience", "experiences", "professionnelle", "professionnelles", "parcours", "scolaire",
    "formation", "formations", "education", "competences", "competence", "savoir-faire", "profil",
    "personnel", "loisirs", "passions", "interets", "coordonnees", "contact", "langues",
    "informations", "plus", "d'informations", "skills", "languages", "projects", "projets",
    "certifications", "references", "centres", "qualites", "atouts", "outils", "logiciels",
}


# --------------------------------------------------------------------------- model

@dataclass
class Run:
    text: str
    font: str          # base font name without subset prefix, e.g. "Montserrat-Bold"
    size: float
    color: int
    bold: bool


@dataclass
class LineGeom:
    x0: float
    x1: float
    y0: float
    y1: float
    baseline: float
    runs: List[Run]


@dataclass
class TextUnit:
    id: str
    page: int
    kind: str                       # name | section | tagline | meta | contact | bullet | body
    locked: bool
    text: str                       # plain text
    rich: str                       # text with **bold** markers
    bbox: Tuple[float, float, float, float]
    font: str
    bold_font: Optional[str]
    size: float
    color: int
    letter_spacing: float
    line_gap: float
    align: str                      # left | center
    right_limit: float
    bottom_limit: float
    max_chars: int
    min_chars: int = 0
    chars_per_line: int = 0
    spaced: bool = False
    lines: List[LineGeom] = field(default_factory=list)

    def public(self) -> dict:
        d = asdict(self)
        d.pop("lines", None)
        d["n_lines"] = len(self.lines)
        return d


# --------------------------------------------------------------------------- helpers

def _base_font(name: str) -> str:
    return name.split("+", 1)[1] if "+" in name else name


def _is_bold(font: str, flags: int) -> bool:
    f = font.lower()
    return bool(flags & 16) or any(k in f for k in ("bold", "black", "heavy", "semibold", "extrabold"))


def _fold(s: str) -> str:
    s = unicodedata.normalize("NFKD", s.lower())
    return "".join(c for c in s if not unicodedata.combining(c))


def _measure_letter_spacing(line: dict, font_cache: "FontResolver") -> float:
    """Average extra spacing per char (pt) compared with natural font advance."""
    total_extra, n = 0.0, 0
    for span in line["spans"]:
        chars = span.get("chars") or []
        if len(chars) < 4:
            continue
        font = font_cache.font_for(_base_font(span["font"]), span["size"], None)
        if font is None:
            continue
        txt = "".join(c["c"] for c in chars)
        natural = font.text_length(txt, fontsize=span["size"])
        actual = chars[-1]["bbox"][2] - chars[0]["bbox"][0]
        # last glyph advance approximated by its bbox width
        extra = (actual - natural) / max(1, len(chars) - 1)
        total_extra += extra * (len(chars) - 1)
        n += len(chars) - 1
    if not n:
        return 0.0
    ls = total_extra / n
    return round(ls, 2) if abs(ls) > 0.15 else 0.0


def _line_text_from_chars(line: dict, letter_spacing: float) -> str:
    """Rebuild text from glyphs across all spans of a line.

    Tracked (letter-spaced) text is rebuilt from glyph gaps so MuPDF's inserted
    spaces do not split words."""
    chars = [c for s in line["spans"] for c in (s.get("chars") or [])]
    if not chars:
        return "".join(s.get("text", "") for s in line["spans"]).strip()
    raw = "".join(c["c"] for c in chars).strip()
    if _is_fake_tracked(raw):
        letters = [c for c in chars if c["c"] != " "]
        gaps = [b["bbox"][0] - a["bbox"][2] for a, b in zip(letters, letters[1:])]
        med = statistics.median(gaps) if gaps else 0
        buf = [letters[0]["c"]]
        for g, c in zip(gaps, letters[1:]):
            if g > med * 1.8 + 0.3:
                buf.append(" ")
            buf.append(c["c"])
        return SPACED_MARK + "".join(buf)
    if letter_spacing <= 0.5:
        txt = "".join(c["c"] for c in chars)
    else:
        size = max(s["size"] for s in line["spans"])
        buf, prev = [], None
        for c in chars:
            if c["c"] == " ":
                continue
            if prev is not None and c["bbox"][0] - prev["bbox"][2] > letter_spacing + size * 0.22:
                buf.append(" ")
            buf.append(c["c"])
            prev = c
        txt = "".join(buf)
    return txt.strip()


SPACED_MARK = "\x00"


def _is_fake_tracked(text: str) -> bool:
    """'2 4 A N S - D I P L Ô M É' : some design tools fake tracking by typing a
    space between every letter."""
    toks = [t for t in text.split(" ") if t]
    return len(toks) >= 6 and sum(1 for t in toks if len(t) == 1) / len(toks) > 0.85


def _despace(text: str) -> Tuple[str, bool]:
    if text.startswith(SPACED_MARK):
        return text[len(SPACED_MARK):], True
    return text, False


def _join_lines(lines: List[str]) -> str:
    out = ""
    for ln in lines:
        if not out:
            out = ln
        elif re.search(r"\w-$", out) and ln[:1].isalpha():
            out += ln          # "Counter-" + "Strike"
        else:
            out += " " + ln
    return out


def _respace(text: str) -> str:
    return "  ".join(" ".join(list(w)) for w in text.split(" "))


# --------------------------------------------------------------------------- fonts

_WEIGHTS = [
    ("extralight", 200), ("ultralight", 200), ("thin", 100), ("light", 300), ("medium", 500),
    ("semibold", 600), ("demibold", 600), ("extrabold", 800), ("ultrabold", 800), ("black", 900),
    ("heavy", 900), ("bold", 700), ("regular", 400), ("book", 400), ("normal", 400),
]


def parse_font_name(base: str) -> Tuple[str, int, str]:
    """'Montserrat-BoldItalic' -> ('Montserrat', 700, 'italic')."""
    name = base.replace(",", "-")
    fam, _, style = name.partition("-")
    if not style:
        m = re.match(r"^(.*?)(Thin|ExtraLight|Light|Regular|Medium|SemiBold|Bold|ExtraBold|Black)?(Italic)?$", name)
        fam, style = (m.group(1), (m.group(2) or "") + (m.group(3) or "")) if m else (name, "")
    s = style.lower()
    italic = "italic" if ("italic" in s or "oblique" in s) else "normal"
    weight = 400
    for key, w in _WEIGHTS:
        if key in s:
            weight = w
            break
    fam = re.sub(r"(MT|PS|Std|Pro)$", "", fam).strip()
    return fam, weight, italic


def _slug(family: str) -> str:
    return re.sub(r"(?<!^)(?=[A-Z])", "-", family).lower().replace(" ", "-").replace("--", "-")


class FontResolver:
    """Finds a full font file for a PDF font name, with caching."""

    def __init__(self, doc: Optional[pymupdf.Document] = None, allow_download: bool = True):
        self.doc = doc
        self.allow_download = allow_download
        self._fonts: Dict[str, Optional[pymupdf.Font]] = {}
        self._files: Dict[str, Optional[str]] = {}
        self._embedded: Dict[str, bytes] = {}
        if doc is not None:
            for pno in range(len(doc)):
                for xref, _ext, _typ, name, _ref, _enc in doc[pno].get_fonts(full=False):
                    base = _base_font(name)
                    if base in self._embedded:
                        continue
                    try:
                        _n, _e, _t, buf = doc.extract_font(xref)
                        if buf:
                            self._embedded[base] = buf
                    except Exception:
                        pass

    def _download(self, base: str) -> Optional[str]:
        fam, weight, style = parse_font_name(base)
        FONTS_DIR.mkdir(parents=True, exist_ok=True)
        target = FONTS_DIR / f"{_slug(fam)}-{weight}-{style}.ttf"
        if target.exists() and target.stat().st_size > 1000:
            return str(target)
        if not self.allow_download:
            return None
        for subset in ("latin", "latin-ext"):
            url = f"https://cdn.jsdelivr.net/fontsource/fonts/{_slug(fam)}@latest/{subset}-{weight}-{style}.ttf"
            try:
                r = httpx.get(url, timeout=15, follow_redirects=True)
                if r.status_code == 200 and len(r.content) > 1000:
                    target.write_bytes(r.content)
                    return str(target)
            except Exception as e:  # network down: fall back below
                log.info("font download failed %s: %s", url, e)
                break
        return None

    def file_for(self, base: str) -> Optional[str]:
        if base not in self._files:
            self._files[base] = self._download(base)
        return self._files[base]

    def _load(self, key: str, loader) -> Optional[pymupdf.Font]:
        if key not in self._fonts:
            try:
                self._fonts[key] = loader()
            except Exception:
                self._fonts[key] = None
        return self._fonts[key]

    def font_for(self, base: str, size: float, text: Optional[str]) -> Optional[pymupdf.Font]:
        """Best font able to render `text` (None = measuring the original text).

        Order: embedded subset when it already has every glyph (exact original
        look), then the full downloaded family, then Helvetica."""
        emb = self._load(f"emb:{base}", lambda: pymupdf.Font(fontbuffer=self._embedded[base])) if base in self._embedded else None
        needed = {ord(ch) for ch in (text or "") if ch.strip()}
        if emb is not None and all(emb.has_glyph(c) for c in needed):
            return emb
        path = self.file_for(base)
        if path:
            full = self._load(f"file:{path}", lambda: pymupdf.Font(fontfile=path))
            if full is not None:
                return full
        if text is None:
            return emb
        return pymupdf.Font("hebo" if "bold" in base.lower() else "helv")


# --------------------------------------------------------------------------- extraction

def _classify(text: str, size: float, body_size: float, name_size: float, bold: bool) -> Tuple[str, bool]:
    folded = _fold(text).replace("’", "'")
    words = re.findall(r"[\w'-]+", folded)
    if size >= name_size - 0.1 and size > body_size * 1.8:
        return "name", True
    if EMAIL_RE.search(text) or PHONE_RE.search(text) or folded.startswith(("telephone", "tel", "mail", "e-mail", "adresse", "linkedin", "github")):
        return "contact", True
    upper_ratio = sum(1 for c in text if c.isupper()) / max(1, sum(1 for c in text if c.isalpha()))
    if upper_ratio > 0.8 and len(words) <= 5 and words and all(w in SECTION_WORDS or len(w) <= 3 for w in words):
        return "section", True
    if upper_ratio > 0.7 and len(words) >= 2 and (size > body_size * 1.25 or len(words) <= 8):
        return "tagline", False
    if BULLET_RE.match(text):
        return "bullet", False
    if YEAR_RE.search(text) and len(text) < 90:
        return "meta", True
    if bold and len(words) <= 7:
        return "meta", True        # role titles, school names: facts, not rewritten
    return "body", False


def extract_units(pdf_path: str | Path, resolver: Optional[FontResolver] = None) -> List[TextUnit]:
    doc = pymupdf.open(str(pdf_path))
    resolver = resolver or FontResolver(doc)
    units: List[TextUnit] = []

    for pno in range(len(doc)):
        page = doc[pno]
        raw = page.get_text("rawdict", flags=pymupdf.TEXT_PRESERVE_WHITESPACE | pymupdf.TEXT_MEDIABOX_CLIP)
        sizes = [s["size"] for b in raw["blocks"] if b["type"] == 0 for l in b["lines"] for s in l["spans"]
                 for _ in (s.get("chars") or [])]
        body_size = statistics.median(sizes) if sizes else 10
        name_size = max(sizes) if sizes else 20

        page_units: List[dict] = []
        for b in raw["blocks"]:
            if b["type"] != 0:
                continue
            current: Optional[dict] = None
            prev_line: Optional[LineGeom] = None
            for l in b["lines"]:
                if abs(l["dir"][1]) > 0.01:      # rotated text: leave untouched
                    continue
                ls = _measure_letter_spacing(l, resolver)
                text = _line_text_from_chars(l, ls)
                text, spaced = _despace(text)
                text = re.sub(r"\s{2,}", " ", text)
                if not text:
                    continue
                runs = []
                for s in l["spans"]:
                    if spaced or ls > 0.5:
                        st = _despace(_line_text_from_chars({"spans": [s]}, ls))[0]
                        if s.get("chars") and s["chars"][0]["c"] == " " and runs:
                            st = " " + st
                    else:
                        st = "".join(c["c"] for c in s.get("chars") or [])
                    st = re.sub(r"\s{2,}", " ", st)
                    if not st.strip() and not runs:
                        continue
                    runs.append(Run(st, _base_font(s["font"]), round(s["size"], 2), s["color"], _is_bold(s["font"], s["flags"])))
                if not runs:
                    continue
                origin_y = l["spans"][0]["origin"][1]
                visible = [c for sp in l["spans"] for c in (sp.get("chars") or []) if c["c"].strip()]
                gx0 = visible[0]["bbox"][0] if visible else l["bbox"][0]
                gx1 = visible[-1]["bbox"][2] if visible else l["bbox"][2]
                geom = LineGeom(gx0, gx1, l["bbox"][1], l["bbox"][3], origin_y, runs)
                main = max(runs, key=lambda r: len(r.text))
                new_unit = (
                    current is None
                    or BULLET_RE.match(text)
                    or abs(main.size - current["size"]) > 0.6
                    or (prev_line and (geom.baseline - prev_line.baseline) > main.size * 2.0)
                    or (prev_line and main.bold != current["main_bold"] and not any(not r.bold for r in runs))
                )
                if new_unit:
                    current = {"lines": [], "size": main.size, "main_bold": main.bold, "ls": ls, "spaced": spaced}
                    page_units.append(current)
                current["lines"].append(geom)
                prev_line = geom

        # Build TextUnit objects
        built: List[TextUnit] = []
        for idx, u in enumerate(page_units):
            lines: List[LineGeom] = u["lines"]
            all_runs = [r for ln in lines for r in ln.runs]
            regular = [r for r in all_runs if not r.bold] or all_runs
            base = max(regular, key=lambda r: len(r.text))
            bold_runs = [r for r in all_runs if r.bold]
            bold_font = max(bold_runs, key=lambda r: len(r.text)).font if bold_runs else None
            plain_lines, rich_lines = [], []
            for ln in lines:
                plain_lines.append("".join(r.text for r in ln.runs).strip())
                rich = ""
                for r in ln.runs:
                    if r.bold and not base.bold and r.text.strip():
                        lead = r.text[: len(r.text) - len(r.text.lstrip())]
                        trail = r.text[len(r.text.rstrip()):]
                        rich += f"{lead}**{r.text.strip()}**{trail}"
                    else:
                        rich += r.text
                rich_lines.append(rich.strip())
            text = _join_lines(plain_lines)
            rich = _join_lines(rich_lines).replace("** **", " ")
            gaps = [b.baseline - a.baseline for a, b in zip(lines, lines[1:])]
            line_gap = statistics.median(gaps) if gaps else base.size * 1.3
            # alignment: centered if left edges vary but centers agree
            centers = [(ln.x0 + ln.x1) / 2 for ln in lines]
            align = "left"
            if len(lines) > 1 and (max(ln.x0 for ln in lines) - min(ln.x0 for ln in lines)) > 4 and (max(centers) - min(centers)) < 3:
                align = "center"
            kind, locked = _classify(text, base.size, body_size, name_size, base.bold)
            bbox = (min(ln.x0 for ln in lines), min(ln.y0 for ln in lines), max(ln.x1 for ln in lines), max(ln.y1 for ln in lines))
            built.append(TextUnit(
                id=f"p{pno}-u{idx}", page=pno, kind=kind, locked=locked, text=text, rich=rich,
                bbox=tuple(round(v, 2) for v in bbox), font=base.font, bold_font=bold_font if bold_font != base.font else None,
                size=base.size, color=base.color, letter_spacing=u["ls"], line_gap=round(line_gap, 2),
                align=align, right_limit=bbox[2], bottom_limit=page.rect.height - 18, max_chars=0,
                spaced=u.get("spaced", False), lines=lines,
            ))

        # Shapes and images that text must not run into (banners, boxes, photos).
        obstacles = []
        for dr in page.get_drawings():
            r = dr.get("rect")
            if r is not None and r.width > 20 and r.height > 4 and dr.get("fill") is not None:
                obstacles.append(r)
        for img in page.get_image_info():
            obstacles.append(pymupdf.Rect(img["bbox"]))

        # Geometry limits: how far each unit may grow right/down without hitting another.
        for u in built:
            x0, y0, x1, y1 = u.bbox
            same_col = [o for o in built if o is not u and abs(o.bbox[0] - x0) < 12]
            u.right_limit = max([x1] + [o.bbox[2] for o in same_col])
            u.right_limit = min(u.right_limit, page.rect.width - 14)
            below = [o.bbox[1] for o in built if o is not u and o.bbox[1] >= y1 - 1
                     and o.bbox[0] < u.right_limit and o.bbox[2] > x0]
            below += [r.y0 for r in obstacles if r.y0 >= y1 - 1 and r.y0 > y0 + 2
                      and r.x0 < u.right_limit and r.x1 > x0]
            next_top = min(below) if below else page.rect.height - 18
            gap0 = next_top - y1
            # keep most of the original white space before the next element
            keep = max(1.5, min(gap0, max(u.line_gap * 0.9, gap0 * 0.6)))
            u.bottom_limit = next_top - keep
            free_lines = max(0, int((u.bottom_limit - y1) // max(u.line_gap, 1)))
            chars_per_line = max(10, len(u.text) / max(1, len(u.lines)) * (u.right_limit - x0) / max(1, x1 - x0))
            u.chars_per_line = int(chars_per_line)
            u.max_chars = int(min(len(u.text) * 1.6 + 20, chars_per_line * (len(u.lines) + free_lines)))
            # multi-line blocks should stay as tall, or a hole appears in the layout
            u.min_chars = int(chars_per_line * (len(u.lines) - 1) + 4) if len(u.lines) > 1 else 0
        built.sort(key=lambda t: (round(t.bbox[0] / 120), t.bbox[1]))
        units.extend(built)

    doc.close()
    return units


# --------------------------------------------------------------------------- layout

def _tokens(rich: str) -> List[List[Tuple[str, bool]]]:
    """'**Disponible 7j/7**, week-ends' -> [[('Disponible',B)], [('7j/7',B), (',',R)], [('week-ends',R)]]
    Each word is a list of styled pieces, so punctuation after bold text stays attached."""
    words: List[List[Tuple[str, bool]]] = []
    glue = False
    for i, part in enumerate(re.split(r"\*\*", rich)):
        bold = i % 2 == 1
        if not part:
            continue
        pieces = re.split(r"(\s+)", part)
        for j, piece in enumerate(pieces):
            if not piece:
                continue
            if piece.isspace():
                glue = False
                continue
            if words and glue and j == 0:
                words[-1].append((piece, bold))
            else:
                words.append([(piece, bold)])
            glue = True
        glue = not part[-1].isspace()
    return words


def _word_width(word: str, font: pymupdf.Font, size: float, ls: float) -> float:
    return font.text_length(word, fontsize=size) + ls * len(word)


def _pieces_width(pieces, reg, bold, size, ls) -> float:
    return sum(_word_width(t, bold if b else reg, size, ls) for t, b in pieces)


def layout_unit(unit: TextUnit, rich: str, resolver: FontResolver, scale: float = 1.0):
    """Wrap rich text in the unit's geometry. Returns (lines, fits) where each line is
    a list of (x, word, bold) and a baseline."""
    size = unit.size * scale
    ls = unit.letter_spacing * scale
    plain = re.sub(r"\*\*", "", rich)
    reg = resolver.font_for(unit.font, size, plain)
    bold = resolver.font_for(unit.bold_font, size, plain) if unit.bold_font else reg
    if reg is None:
        reg = pymupdf.Font("helv")
    if bold is None:
        bold = reg
    space = reg.text_length(" ", fontsize=size) + ls
    if unit.spaced:  # fake tracking: one space between letters, ~two between words
        ls += reg.text_length(" ", fontsize=size)
        space = 3 * reg.text_length(" ", fontsize=size)

    first_x = unit.lines[0].x0
    cont_x = unit.lines[1].x0 if len(unit.lines) > 1 else first_x
    is_bullet = bool(BULLET_RE.match(plain))
    if is_bullet and len(unit.lines) == 1:
        m = BULLET_RE.match(plain)
        cont_x = first_x  # original CV wraps bullets flush-left; keep that convention
        del m

    gap = unit.line_gap * (scale if len(unit.lines) == 1 else 1.0)
    lines: List[Tuple[float, List[Tuple[float, str, bool]]]] = []
    cur: List[Tuple[str, bool, float]] = []
    cur_w = 0.0
    line_idx = 0

    def width_limit(i):
        x = first_x if i == 0 else cont_x
        return unit.right_limit - x

    for pieces in _tokens(rich):
        w = _pieces_width(pieces, reg, bold, size, ls)
        add = w if not cur else cur_w + space + w
        if cur and add > width_limit(line_idx) + 0.5:
            lines.append(_place(cur, line_idx, unit, first_x, cont_x, space, gap, reg, bold, size, ls))
            line_idx += 1
            cur, cur_w = [(pieces, w)], w
        else:
            cur.append((pieces, w))
            cur_w = add
    if cur:
        lines.append(_place(cur, line_idx, unit, first_x, cont_x, space, gap, reg, bold, size, ls))

    if not lines:
        return [], True
    # Same or fewer lines always fits; extra lines must stay above the next element.
    last_baseline = lines[-1][0]
    orig_last = unit.lines[-1]
    new_bottom = orig_last.y1 + (last_baseline - orig_last.baseline)
    fits = len(lines) <= len(unit.lines) or new_bottom <= unit.bottom_limit
    return lines, fits


def _place(cur, idx, unit, first_x, cont_x, space, gap, reg, bold, size, ls):
    if idx < len(unit.lines):
        baseline = unit.lines[idx].baseline
    else:
        baseline = unit.lines[-1].baseline + gap * (idx - len(unit.lines) + 1)
    x = first_x if idx == 0 else cont_x
    total = sum(w for _, w in cur) + space * (len(cur) - 1)
    if unit.align == "center":
        center = (unit.bbox[0] + unit.bbox[2]) / 2
        x = center - total / 2
    placed = []
    for pieces, w in cur:
        px = x
        for text, is_b in pieces:
            placed.append((px, text, is_b))
            px += _word_width(text, bold if is_b else reg, size, ls)
        x += w + space
    return baseline, placed


# --------------------------------------------------------------------------- apply

@dataclass
class ApplyResult:
    applied: List[str] = field(default_factory=list)
    shrunk: List[str] = field(default_factory=list)
    overflow: List[str] = field(default_factory=list)
    skipped_locked: List[str] = field(default_factory=list)
    unknown: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)

    def as_dict(self) -> dict:
        return asdict(self)


def _rgb(color: int) -> Tuple[float, float, float]:
    return ((color >> 16) & 255) / 255, ((color >> 8) & 255) / 255, (color & 255) / 255


def _write_text(page: pymupdf.Page, unit: TextUnit, placed_lines, resolver: FontResolver, scale: float, plain: str):
    size = unit.size * scale
    ls = unit.letter_spacing * scale
    reg = resolver.font_for(unit.font, size, plain) or pymupdf.Font("helv")
    bold = (resolver.font_for(unit.bold_font, size, plain) if unit.bold_font else None) or reg
    if unit.spaced:
        ls += reg.text_length(" ", fontsize=size)
    tw = pymupdf.TextWriter(page.rect, color=_rgb(unit.color))
    for baseline, words in placed_lines:
        for x, word, is_b in words:
            font = bold if is_b else reg
            if ls:
                cx = x
                for ch in word:
                    tw.append((cx, baseline), ch, font=font, fontsize=size)
                    cx += font.text_length(ch, fontsize=size) + ls
            else:
                tw.append((x, baseline), word, font=font, fontsize=size)
    tw.write_text(page)


def apply_edits(
    pdf_path: str | Path,
    edits: Dict[str, str],
    out_path: str | Path,
    allow_locked: Iterable[str] = (),
    units: Optional[List[TextUnit]] = None,
    min_scale: float = 0.93,
) -> ApplyResult:
    """Write a copy of `pdf_path` to `out_path` with the given unit texts replaced.

    `edits` maps unit id -> new rich text ("" removes the unit's text).
    Locked units are only edited when listed in `allow_locked` (used for the
    contact email swap)."""
    result = ApplyResult()
    doc = pymupdf.open(str(pdf_path))
    resolver = FontResolver(doc)
    units = units or extract_units(pdf_path, resolver)
    by_id = {u.id: u for u in units}
    allow = set(allow_locked)

    plans = []
    for uid, new_text in edits.items():
        u = by_id.get(uid)
        if u is None:
            result.unknown.append(uid)
            continue
        if u.locked and uid not in allow:
            result.skipped_locked.append(uid)
            continue
        new_text = (new_text or "").strip()
        if not u.bold_font and "**" not in u.rich:
            new_text = new_text.replace("**", "")
        if new_text == u.rich.strip() or new_text == u.text.strip():
            continue
        plain = re.sub(r"\*\*", "", new_text)
        chosen = None
        for scale in (1.0, 0.97, min_scale):
            lines, fits = layout_unit(u, new_text, resolver, scale)
            if fits:
                chosen = (scale, lines)
                break
        if chosen is None:
            result.overflow.append(uid)
            continue
        plans.append((u, chosen[0], chosen[1], plain))

    # 1) remove original glyphs of every unit we rewrite (per page)
    for pno in {u.page for u, *_ in plans}:
        page = doc[pno]
        for u, *_ in [p for p in plans if p[0].page == pno]:
            for ln in u.lines:
                h = ln.y1 - ln.y0
                # middle band only, so neighbouring lines are never caught
                rect = pymupdf.Rect(ln.x0 - 0.5, ln.y0 + h * 0.3, ln.x1 + 0.5, ln.y1 - h * 0.3)
                page.add_redact_annot(rect, fill=False)
        page.apply_redactions(
            images=pymupdf.PDF_REDACT_IMAGE_NONE,
            graphics=pymupdf.PDF_REDACT_LINE_ART_NONE,
            text=pymupdf.PDF_REDACT_TEXT_REMOVE,
        )
        # Second pass: drop decorations fully inside the old lines (underlines,
        # strike-throughs) without touching text or larger shapes.
        for u, *_ in [p for p in plans if p[0].page == pno]:
            for ln in u.lines:
                page.add_redact_annot(pymupdf.Rect(ln.x0 - 1, ln.y0, ln.x1 + 1, ln.y1 + 2), fill=False)
        page.apply_redactions(
            images=pymupdf.PDF_REDACT_IMAGE_NONE,
            graphics=pymupdf.PDF_REDACT_LINE_ART_REMOVE_IF_COVERED,
            text=pymupdf.PDF_REDACT_TEXT_NONE,
        )

    # 2) write new text
    for u, scale, lines, plain in plans:
        if lines:
            _write_text(doc[u.page], u, lines, resolver, scale, plain)
        result.applied.append(u.id)
        if scale < 1.0:
            result.shrunk.append(u.id)

    doc.save(str(out_path), garbage=3, deflate=True)
    doc.close()
    return result


def email_swap_edits(units: List[TextUnit], new_email: str) -> Dict[str, str]:
    """Edits replacing any email address in contact units with `new_email`."""
    edits = {}
    for u in units:
        if EMAIL_RE.search(u.text) and new_email and new_email not in u.text:
            edits[u.id] = EMAIL_RE.sub(new_email, u.rich)
    return edits


# --------------------------------------------------------------------------- preview

def render_page_png(pdf_path: str | Path, page: int = 0, dpi: int = 110) -> bytes:
    doc = pymupdf.open(str(pdf_path))
    try:
        page = max(0, min(page, len(doc) - 1))
        return doc[page].get_pixmap(dpi=dpi, alpha=False).tobytes("png")
    finally:
        doc.close()


def page_count(pdf_path: str | Path) -> int:
    with pymupdf.open(str(pdf_path)) as doc:
        return len(doc)


def full_text(pdf_path: str | Path) -> str:
    with pymupdf.open(str(pdf_path)) as doc:
        return "\n".join(p.get_text("text", sort=True) for p in doc)
