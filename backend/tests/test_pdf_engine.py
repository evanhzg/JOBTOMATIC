"""The CV engine must rewrite text in place and leave everything else untouched."""
import pymupdf
import pytest

from app.cv import pdf_engine as pe


@pytest.fixture()
def cv_pdf(tmp_path):
    doc = pymupdf.open()
    page = doc.new_page(width=595, height=842)
    page.draw_rect(pymupdf.Rect(0, 0, 200, 842), color=None, fill=(0.33, 0.55, 0.38))  # sidebar
    page.insert_text((20, 60), "JEAN TEST", fontsize=26, fontname="hebo")
    page.insert_text((220, 120), "EXPÉRIENCE PROFESSIONNELLE", fontsize=12, fontname="hebo")
    page.insert_text((220, 145), "Serveur - Brasserie (2023 - Lyon)", fontsize=10, fontname="hebo")
    page.insert_text((220, 165), "- Accueil des clients et service en salle", fontsize=8, fontname="helv")
    page.insert_text((220, 178), "- Encaissement et mise en place", fontsize=8, fontname="helv")
    page.insert_text((220, 260), "- Ligne lointaine pour laisser de la place", fontsize=8, fontname="helv")
    page.insert_text((20, 800), "Mail : ancien@exemple.fr", fontsize=9, fontname="helv", color=(1, 1, 1))
    path = tmp_path / "cv.pdf"
    doc.save(str(path))
    return path


def unit(units, start):
    return next(u for u in units if u.text.startswith(start))


def test_extract_classifies(cv_pdf):
    units = pe.extract_units(cv_pdf)
    assert unit(units, "JEAN").locked and unit(units, "JEAN").kind == "name"
    assert unit(units, "EXPÉRIENCE").kind == "section"
    assert unit(units, "Serveur").locked                      # dated fact
    assert unit(units, "- Accueil").kind == "bullet" and not unit(units, "- Accueil").locked
    assert unit(units, "Mail").kind == "contact"


def test_apply_edit_and_email_swap(cv_pdf, tmp_path):
    units = pe.extract_units(cv_pdf)
    b = unit(units, "- Accueil")
    edits = {b.id: "- Accueil et placement des clients en salle"}
    swap = pe.email_swap_edits(units, "evhoizey@gmail.com")
    edits.update(swap)
    out = tmp_path / "out.pdf"
    res = pe.apply_edits(cv_pdf, edits, out, allow_locked=swap.keys(), units=units)
    assert b.id in res.applied and not res.overflow
    text = pe.full_text(out)
    assert "Accueil et placement des clients en salle" in text
    assert "evhoizey@gmail.com" in text and "ancien@exemple.fr" not in text
    assert "Encaissement et mise en place" in text          # neighbour untouched
    with pymupdf.open(str(out)) as d:                         # sidebar shape kept
        assert any(dr.get("fill") for dr in d[0].get_drawings())


def test_locked_and_overflow_are_refused(cv_pdf, tmp_path):
    units = pe.extract_units(cv_pdf)
    name = unit(units, "JEAN")
    b = unit(units, "- Encaissement")
    res = pe.apply_edits(cv_pdf, {name.id: "Autre Nom", b.id: "- " + "très long texte " * 40}, tmp_path / "o.pdf", units=units)
    assert name.id in res.skipped_locked
    assert b.id in res.overflow
    assert "JEAN TEST" in pe.full_text(tmp_path / "o.pdf")


def test_tokens_keep_punctuation_after_bold():
    toks = pe._tokens("**Disponible 7j/7**, week-ends")
    assert toks[1] == [("7j/7", True), (",", False)]
