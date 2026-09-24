import pytest

from _helpers import (
    clean_xml,
    is_rate_limited,
    origin_is_allowed,
    sanitize_latin1,
    valid_extension,
    valid_language,
    valid_voice,
    MAX_BODY_BYTES,
    RATE_LIMIT_MAX_REQUESTS,
)


def test_origin_is_allowed():
    assert origin_is_allowed("https://neffex010.github.io") is True
    assert origin_is_allowed("http://localhost:3000") is True
    assert origin_is_allowed("https://localhost:8080") is True
    assert origin_is_allowed("https://evil.example.com") is False
    assert origin_is_allowed("") is True


def test_valid_language():
    assert valid_language("es") is True
    assert valid_language("EN") is True
    assert valid_language("fr") is False
    assert valid_language(None) is False
    assert valid_language(123) is False


def test_valid_voice():
    assert valid_voice("alloy") is True
    assert valid_voice("NOVA") is True
    assert valid_voice("robot") is False


def test_valid_extension():
    assert valid_extension("PDF", {"pdf", "docx", "txt"}) is True
    assert valid_extension("exe", {"pdf", "docx", "txt"}) is False
    assert valid_extension(None, {"pdf"}) is False


def test_clean_xml_removes_control_chars():
    assert clean_xml("texto\u0001normal") == "textonormal"
    assert clean_xml("ok\nlinea") == "ok\nlinea"


def test_sanitize_latin1_replaces_typographic_chars():
    result = sanitize_latin1("Hola — mundo “entre” comillas…")
    assert "—" not in result
    assert "“" not in result
    assert result == "Hola - mundo \"entre\" comillas..."


def test_sanitize_latin1_encodes_non_latin1():
    result = sanitize_latin1("emoji 🤖 aquí")
    assert "🤖" not in result


def test_rate_limiter_blocks_after_limit():
    ip = "192.0.2.99"
    for _ in range(RATE_LIMIT_MAX_REQUESTS):
        assert is_rate_limited(ip) is False
    assert is_rate_limited(ip) is True


def test_rate_limiter_isolates_ips():
    assert is_rate_limited("198.51.100.1") is False
    assert is_rate_limited("198.51.100.2") is False


def test_max_body_is_sane_ceiling():
    # 15MB de JSON debe ser suficiente para audio 10MB en base64
    assert MAX_BODY_BYTES > 10 * 1024 * 1024 * 4 / 3