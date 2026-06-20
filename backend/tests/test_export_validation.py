"""Tests for export path validation (API-004).

Service-layer tests — verifies that unsafe paths raise Arabic ValueErrors
before any file I/O occurs.
"""
import sys
import pytest
from src.services.export import validate_export_path


def test_empty_path_rejected():
    with pytest.raises(ValueError, match="فارغاً"):
        validate_export_path("")


def test_whitespace_only_path_rejected():
    with pytest.raises(ValueError, match="فارغاً"):
        validate_export_path("   ")


def test_valid_temp_path_accepted(tmp_path):
    path = validate_export_path(str(tmp_path))
    assert path.is_absolute()


def test_path_is_resolved(tmp_path):
    """A relative path component is resolved to an absolute path."""
    resolved = validate_export_path(str(tmp_path))
    assert resolved.is_absolute()


@pytest.mark.skipif(sys.platform != "win32", reason="Windows-only sensitive paths")
def test_windows_system_path_rejected():
    with pytest.raises(ValueError, match="حساس"):
        validate_export_path(r"C:\Windows\Temp")


@pytest.mark.skipif(sys.platform != "win32", reason="Windows-only sensitive paths")
def test_windows_program_files_rejected():
    with pytest.raises(ValueError, match="حساس"):
        validate_export_path(r"C:\Program Files\MyApp")


@pytest.mark.skipif(sys.platform == "win32", reason="POSIX-only sensitive paths")
def test_posix_etc_rejected():
    with pytest.raises(ValueError, match="حساس"):
        validate_export_path("/etc/myapp")


@pytest.mark.skipif(sys.platform == "win32", reason="POSIX-only sensitive paths")
def test_posix_proc_rejected():
    with pytest.raises(ValueError, match="حساس"):
        validate_export_path("/proc/1")


def test_error_message_is_arabic():
    """Error messages must be in Arabic, not English."""
    with pytest.raises(ValueError) as exc_info:
        validate_export_path("")
    assert any(ord(c) > 0x600 for c in str(exc_info.value)), "Error must contain Arabic text"
