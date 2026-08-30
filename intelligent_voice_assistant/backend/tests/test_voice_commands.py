from types import SimpleNamespace

import openpyxl

from backend.api import routes
from backend.services import excel_service


def test_voice_command_updates_multiple_roll_entries_in_one_sentence(monkeypatch):
    calls = []

    def fake_update_marks(roll_no, marks):
        calls.append((roll_no, marks))
        return True, f"Marks Updated Successfully for roll {roll_no}."

    monkeypatch.setattr(routes, "update_marks", fake_update_marks)
    monkeypatch.setattr(routes, "get_current_column", lambda: "assignment")

    payload = SimpleNamespace(text="roll no 1 marks 80 and roll no 2 marks 90")
    response = routes.voice_command(payload)

    assert response["multi"] is True
    assert response["updated_count"] == 2
    assert calls == [(1, 80), (2, 90)]
    assert response["message"] == "Updated 2 marks entries."


def test_voice_command_splits_back_to_back_roll_entries(monkeypatch):
    calls = []

    def fake_update_marks(roll_no, marks):
        calls.append((roll_no, marks))
        return True, f"Marks Updated Successfully for roll {roll_no}."

    monkeypatch.setattr(routes, "update_marks", fake_update_marks)
    monkeypatch.setattr(routes, "get_current_column", lambda: "assignment")

    payload = SimpleNamespace(text="roll no 1 marks 2 roll no 2 marks 3")
    response = routes.voice_command(payload)

    assert response["multi"] is True
    assert response["updated_count"] == 2
    assert calls == [(1, 2), (2, 3)]
    assert response["message"] == "Updated 2 marks entries."


def test_update_marks_creates_row_when_roll_does_not_exist(tmp_path, monkeypatch):
    workbook = openpyxl.Workbook()
    sheet = workbook.active
    sheet.title = "Sheet1"
    sheet["A1"] = "Roll_No"
    sheet["B1"] = "Assignment"
    workbook.save(tmp_path / "test.xlsx")

    monkeypatch.setattr(excel_service, "EXCEL_FILE", str(tmp_path / "test.xlsx"))
    monkeypatch.setattr(excel_service, "get_current_column", lambda: "assignment")

    success, message = excel_service.update_marks(90, 8)

    assert success is True
    assert "New row created" in message

    updated = openpyxl.load_workbook(tmp_path / "test.xlsx", data_only=True)
    row_values = list(updated.active.iter_rows(min_row=1, max_row=2, values_only=True))
    assert row_values[1][0] == 90
    assert row_values[1][1] == 8
