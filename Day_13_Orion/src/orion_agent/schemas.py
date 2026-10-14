"""Pydantic schemas shared by the graphs.

For learners: a model returns text. A program wants fields. Wrapping a model
with `structured(llm, CodeOutput)` makes every reply an instance of one of these
classes, validated, so `.code` is code and `.explanation` is prose and nothing
has to be parsed out of a markdown fence. The `description` on each field is
sent to the model as part of the schema, so write it for the model.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class CodeOutput(BaseModel):
    code: str = Field(description="Complete, runnable Python code with no markdown fences")
    explanation: str = Field(description="One paragraph on what the code does")


class ReviewResult(BaseModel):
    approved: bool = Field(description="True if the code is acceptable as is")
    feedback: str = Field(description="Specific problems to fix, or 'Looks good' if approved")


class FileTask(BaseModel):
    filepath: str = Field(description="Path relative to the workspace root")
    description: str = Field(description="What to change in this file")
    action: Literal["create", "modify"] = Field(description="create a new file or modify an existing one")


class Plan(BaseModel):
    summary: str = Field(description="One paragraph describing the approach")
    file_tasks: list[FileTask] = Field(description="Files to create or modify, in order")


class CodeResult(BaseModel):
    filepath: str = Field(description="Path relative to the workspace root")
    code: str = Field(description="Complete file contents")
    explanation: str = Field(description="What changed and why")
