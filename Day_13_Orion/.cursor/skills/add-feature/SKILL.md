---
name: add-feature
description: How to add a feature to a codebase safely. Use when asked to add, change, or extend behaviour across one or more files.
---
# Add a feature

1. Find the code first. Run `grep_files` for the words in the request and `read_file` on every hit before planning.
2. Write a plan with one entry per file: path, create or modify, what changes.
3. Generate each file in full. Never emit a diff or a snippet.
4. Run the tests. If the workspace has none, import every module you changed.
5. Fix failures from the traceback, not from memory.
6. Ask for review only after tests pass. Include the test output.
7. Stop and wait for the human before writing to the real workspace.
