import type { ChapterDef } from "../schema";

export const ch11: ChapterDef = {
  slug: "dynamic-rules",
  number: 11,
  lesson: "Lesson 2",
  subtopicLabel: "2.4 Dynamic Rules",
  title: "Rules & Skills",
  subtitle: "Rules are always on and scoped by glob. Skills load on demand when their description matches the task.",
  cursorFeature: "Cursor Rules, Skills",
  designPatterns: ["Prompt Chaining"],
  intro: "Two ways to shape an agent without editing its code. Rules (.cursor/rules/*.mdc) are injected for every file that matches their globs, so test files get stricter conventions than app code. Skills (.cursor/skills/<name>/SKILL.md) are longer playbooks: the agent sees one line per skill and calls read_skill to load a body only when it needs it. The trace shows that decision.",
  takeaway: "Rules are context you always pay for; skills are context you load when it earns its place. Both are files in the repo, so Cursor and your own agent follow the same instructions.",
  demos: [],
  backendCode: `/* lesson:begin */
# .cursor/rules/python.mdc applies to every .py file. .cursor/rules/tests.mdc applies only to test files.
app_rules = load_rules(ROOT, "workspace/app.py")
test_rules = load_rules(ROOT, "workspace/tests/test_sort.py")
print("rules for app.py mention tests.mdc:", "tests.mdc" in app_rules)
print("rules for tests/test_sort.py mention tests.mdc:", "tests.mdc" in test_rules)

result_with_rules = full_agent.invoke({
    "task": "Write a function to sort a list of dictionaries by a given key. Test with sample data.",
    "rules": test_rules,
    "attempts": 0,
    "max_attempts": 3,
})
print("=== With the test-file rules ===")
print(result_with_rules["code"])

from orion_agent.skills import load_skills, make_read_skill_tool, skills_catalog

skills = load_skills(ROOT)
print(skills_catalog(skills))
# The agent sees only these lines. It loads a body when a description matches.

from langchain_core.messages import HumanMessage

from orion_agent.graphs.tool_agent import build_tool_agent

skill_agent = build_tool_agent(llm, [make_read_skill_tool(skills)], system_prompt=skills_catalog(skills))
result = skill_agent.invoke({"messages": [HumanMessage(content=(
    "I am about to add a feature to an unfamiliar codebase. Load the skill that covers this "
    "and give me its steps, one line each."
))]})
print_messages(result["messages"], width=300)

# %%
/* lesson:end */`,
  backendFilename: "ch11_rules_and_skills.py",
  chatConfig: {
    mode: "rules-toggle",
    defaultPrompt: "Write a function to sort a list of dictionaries by a given key. Test with sample data.",
    rules: `Rules for test code, on top of the Python conventions:
- Every test function name starts with \`test_\` and states the behaviour, for example \`test_timeout_returns_failed_result\`.
- One behaviour per test. No loops that hide multiple assertions.
- Use pytest fixtures and \`tmp_path\`; never write to the real filesystem outside \`tmp_path\`.
- No network calls. Use the stub model and \`httpx.MockTransport\`.
- Use list comprehensions instead of loops where they read better.
- Variable names must be descriptive: no single letters except loop counters.
- Add an \`if __name__ == "__main__":\` guard to any test helper that is also a script.`,
    conversations: {
      no_rules: [
        {
          role: "assistant",
          content: `Generated without coding rules:

\`\`\`python
def sort_by_key(data, key):
    return sorted(data, key=lambda x: x.get(key))


d = [
    {'name': 'Alice', 'age': 30},
    {'name': 'Bob', 'age': 25},
    {'name': 'Charlie', 'age': 35}
]

print(sort_by_key(d, 'age'))
\`\`\`

Output: [{'name': 'Bob', 'age': 25}, {'name': 'Alice', 'age': 30}, {'name': 'Charlie', 'age': 35}]

Note: This works, but it has no type hints, no docstring, no \`if __name__\` guard, and terse variable names like \`d\` and \`x\`.`,
        },
      ],
      strict: [
        {
          role: "tool",
          toolName: "rules_injected",
          toolArgs: { count: "5" },
          content: `- ALL functions must have type hints on parameters and return type
- ALL functions must have a Google-style docstring
- Use list comprehensions instead of loops where possible
- Add if __name__ == '__main__' guard for test code
- Variable names must be descriptive (no single letters except loop counters)`,
        },
        {
          role: "assistant",
          content: `Generated with strict coding rules enforced:

\`\`\`python
from typing import List, Dict, Any


def sort_dicts_by_key(list_of_dicts: List[Dict[str, Any]], sort_key: str) -> List[Dict[str, Any]]:
    """Sort a list of dictionaries by a specified key.

    Args:
        list_of_dicts: The list of dictionaries to be sorted.
        sort_key: The key in the dictionaries to sort by.

    Returns:
        A new list of dictionaries sorted by the specified key.
    """
    return sorted(list_of_dicts, key=lambda dictionary: dictionary.get(sort_key, None))


if __name__ == '__main__':
    sample_data = [
        {'name': 'Alice', 'age': 30},
        {'name': 'Bob', 'age': 25},
        {'name': 'Charlie', 'age': 35},
        {'name': 'David', 'age': 20},
    ]

    sorted_data = sort_dicts_by_key(sample_data, 'age')
    print(sorted_data)
\`\`\`

Output: [{'name': 'David', 'age': 20}, {'name': 'Bob', 'age': 25}, {'name': 'Alice', 'age': 30}, {'name': 'Charlie', 'age': 35}]

✓ All 5 rules enforced: type hints, Google-style docstring, list comprehension (via sorted), \`if __name__\` guard, descriptive variable names.`,
        },
      ],
    },
    generatedFile: {
      filename: "sort_dicts.py",
      content: `from typing import List, Dict, Any


def sort_dicts_by_key(list_of_dicts: List[Dict[str, Any]], sort_key: str) -> List[Dict[str, Any]]:
    """Sort a list of dictionaries by a specified key.

    Args:
        list_of_dicts: The list of dictionaries to be sorted.
        sort_key: The key in the dictionaries to sort by.

    Returns:
        A new list of dictionaries sorted by the specified key.
    """
    return sorted(list_of_dicts, key=lambda dictionary: dictionary.get(sort_key, None))


if __name__ == '__main__':
    sample_data = [
        {'name': 'Alice', 'age': 30},
        {'name': 'Bob', 'age': 25},
        {'name': 'Charlie', 'age': 35},
        {'name': 'David', 'age': 20},
    ]

    sorted_data = sort_dicts_by_key(sample_data, 'age')
    print(sorted_data)`,
    },
  },
};
