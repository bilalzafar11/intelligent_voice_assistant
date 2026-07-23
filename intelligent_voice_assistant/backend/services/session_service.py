"""
Session Service

Stores the current active column selected by the teacher.
"""

current_column = None


def set_current_column(column_name: str):
    global current_column
    current_column = column_name


def get_current_column():
    return current_column


def clear_current_column():
    global current_column
    current_column = None