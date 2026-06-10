# Code Style Guide

This guide explains how code is written in this project. The goal is to keep everything easy to read so any new person can understand it fast. Follow these rules when you add or change code.

## 1. General Rules

- Write code that reads like plain English when possible.
- Keep each function small. One function should do one job.
- If you cannot explain what a function does in one sentence, split it.
- Delete dead code. Do not leave commented out blocks lying around.

## 2. Naming

Names should say what a thing is or does. Avoid short or cryptic names.

```python
# Good: the name tells you what it holds
manuscript_count = 0
scholar_name = "Ibn Razik"

# Bad: you have to guess
mc = 0
sn = "Ibn Razik"
```

Use these patterns:

- Variables and functions: `lower_snake_case`
- Classes: `PascalCase`
- Constants: `UPPER_SNAKE_CASE`
- Database tables and columns: `lower_snake_case`

## 3. Comments

Comments explain **why**, not **what**. The code already shows what it does. A comment should add the reason behind a choice.

```python
# Good: explains the reason
# We keep the witness text exactly as written, even with spelling errors,
# because it is the raw evidence and must never change.
witness_text = raw_page_text

# Bad: just repeats the code
# set witness_text to raw_page_text
witness_text = raw_page_text
```

Keep comments short and balanced. One or two lines is usually enough. Do not comment every single line.

## 4. Functions

- Put the most important functions near the top of the file.
- Give each function a short docstring that says what it does.

```python
def find_scholar_works(scholar_id):
    """Return every manuscript linked to a scholar in any role."""
    ...
```

## 5. The Core Idea: Witness vs Interpretation

This project has one rule that shapes everything. Keep it in mind in every file.

- **Witness** is the text exactly as it appears on the manuscript page. It never changes.
- **Interpretation** is what a researcher concludes from that text. It can change and it carries a confidence level.

Always keep these two separate in code, in names, and in the database. Never mix raw evidence with a researcher guess.

```python
# witness: what the page says
witness_name = "ابن رزيق"

# interpretation: what the researcher decided this name means
interpreted_person_id = 42  # linked back to the witness above
```

## 6. Database Style

- Every table has a surrogate auto generated key for internal linking.
- The human readable serial follows the fixed format: four digit place key, a hyphen, then four digit document count. Example: `0001-0448`.
- Write SQL keywords in upper case so they stand out.

```sql
SELECT person_name, role
FROM person_script_link
WHERE manuscript_id = ?;
```

## 7. Error Handling

- Never let the program fail in silence. If something goes wrong, say so clearly.
- Check for duplicate person records at entry time. A silent duplicate corrupts the trace a scholar feature, so this matters a lot.

```python
if is_possible_duplicate(new_name):
    # Warn the user before saving so we do not split one scholar
    # into two records by mistake.
    show_duplicate_warning(new_name)
```

## 8. File and Folder Layout

- Group files by what they do, not by file type.
- Keep the data model code in one place.
- Keep the user interface code in another place.

```
project/
  data/        # database schema and access code
  domain/      # core rules like witness vs interpretation
  ui/          # the desktop app screens
  tests/       # tests for everything above
```

## 9. Formatting

- Indent with four spaces. Do not use tabs.
- Keep lines short enough to read without scrolling.
- Leave one blank line between functions.
- Use a formatter so style stays the same everywhere.

## 10. Before You Commit

Run this quick check:

- Does the code do one clear job?
- Are the names easy to understand?
- Did you add a short comment where the reason is not obvious?
- Did you keep witness and interpretation separate?
- Did you run the tests?

If all answers are yes, your code is ready.
