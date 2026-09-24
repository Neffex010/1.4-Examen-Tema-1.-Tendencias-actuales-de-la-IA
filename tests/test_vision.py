import os
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "api"))

from vision import NO_TEXT_MARKER, ORIGINAL_MARKER, TRANSLATION_MARKER, split_ocr_result


def test_split_ocr_result_returns_original_and_translation():
    result = (
        f"{ORIGINAL_MARKER}\nHola mundo\n"
        f"{TRANSLATION_MARKER}\nHello world"
    )
    original, translation = split_ocr_result(result)
    assert original == "Hola mundo"
    assert translation == "Hello world"


def test_split_ocr_result_tolerates_extra_lines():
    result = (
        "Aquí va el texto:\n"
        f"{ORIGINAL_MARKER}\nBuenos días\n"
        f"{TRANSLATION_MARKER}\nGood morning"
    )
    original, translation = split_ocr_result(result)
    assert original == "Buenos días"
    assert translation == "Good morning"


def test_split_ocr_result_no_markers_defaults_to_translation():
    result = "traduccion solamente"
    original, translation = split_ocr_result(result)
    assert original == ""
    assert translation == "traduccion solamente"


def test_split_ocr_result_no_text_marker_returns_none():
    assert split_ocr_result(NO_TEXT_MARKER) is None
    assert split_ocr_result("cualquier cosa" + NO_TEXT_MARKER) is None


def test_split_ocr_result_missing_translation_marker_preserves_full_output():
    result = f"{ORIGINAL_MARKER}\nsolo original"
    original, translation = split_ocr_result(result)
    assert original == ""
    assert translation == result