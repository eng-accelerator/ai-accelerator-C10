import type { ChapterDef } from "../schema";

export const ch05: ChapterDef = {
  slug: "system-prompt",
  number: 5,
  lesson: "Lesson 1",
  subtopicLabel: "1.5 System Prompt",
  title: "System Prompt & Rules Files",
  subtitle: "The system prompt comes from files: AGENTS.md and .cursor/rules, scoped by path.",
  cursorFeature: "Cursor Rules",
  designPatterns: ["Prompt Chaining"],
  intro: "A system prompt sets the agent's persona and conventions. In this course it is not a string in the code: it is assembled from AGENTS.md and the .mdc files under .cursor/rules, the same files Cursor reads. A rule can apply everywhere or only to files that match its globs, so the agent gets Python conventions for .py files and design rules for .tsx files without anyone pasting prompts.",
  takeaway: "Rules in files beat rules in prompts. They live with the code, they are scoped by path, and every tool that opens the repo reads the same ones.",
  codeFilename: "data_processor.py",
  codeContent: "",
  backendFilename: "ch05_rules.py",
  backendCode: `/* lesson:begin */
for rule in list_rules(ROOT):
    print(f"{rule.source:40} always={rule.always_apply!s:5} globs={rule.globs}")

SYSTEM_PROMPT = load_rules(ROOT, "workspace/generated/data_processor.py")
print("\\n" + SYSTEM_PROMPT)

agent = build_tool_agent(llm, tools, system_prompt=SYSTEM_PROMPT)
result = agent.invoke({"messages": [HumanMessage(content="""
Create a file 'generated/data_processor.py' with a DataProcessor class that:
- Takes a list of dictionaries in __init__
- Has filter_by(key, value) -> returns filtered list
- Has group_by(key) -> returns dict of grouped items
- Has summarize() -> returns count, keys present, sample row
""")]})
for msg in result["messages"]:
    if msg.type == "ai" and not msg.tool_calls:
        print(msg.content)
/* lesson:end */`,
  chatConfig: {
    mode: "system-prompt",
    systemPrompts: [
      {
        id: "basic",
        label: "No rules",
        prompt: "You are a helpful assistant. Write code when asked.",
      },
      {
        id: "expert",
        label: "python.mdc",
        prompt: `You are an expert Python developer. When generating or editing Python:
- Use type hints on all function parameters and return values.
- Add a concise docstring to every public function and class.
- Follow PEP 8: 4-space indentation, snake_case names, two blank lines between top-level definitions.
- Prefer modern Python (3.12+): pathlib over os.path, f-strings, match/case where it reads better, dataclasses for plain data.
- Never write bare \`except:\`; catch the exception you expect.
- Keep functions under 40 lines. Split when they grow.`,
      },
    ],
    defaultPrompt: "Create a DataProcessor class with filter_by, group_by, and summarize methods.",
    conversations: {
      basic: [
        {
          role: "tool",
          content: "File written: generated/data_processor.py",
          toolName: "write_file",
          toolArgs: { filepath: "generated/data_processor.py" },
        },
        {
          role: "assistant",
          content: "Here's the DataProcessor class:\n\n```python\nclass DataProcessor:\n    def __init__(self, data):\n        self.data = data\n\n    def filter_by(self, key, value):\n        return [x for x in self.data if x.get(key) == value]\n\n    def group_by(self, key):\n        groups = {}\n        for item in self.data:\n            k = item.get(key)\n            groups.setdefault(k, []).append(item)\n        return groups\n\n    def summarize(self):\n        return len(self.data), list(self.data[0].keys()), self.data[0]\n```\n\nNote: No type hints, no docstrings, basic implementation.",
        },
      ],
      expert: [
        {
          role: "tool",
          content: "File written: generated/data_processor.py",
          toolName: "write_file",
          toolArgs: { filepath: "generated/data_processor.py" },
        },
        {
          role: "assistant",
          content: "Here's the DataProcessor class with full typing and documentation:\n\n```python\nfrom typing import List, Dict, Any, Tuple\n\nclass DataProcessor:\n    \"\"\"Process and analyze collections of data records.\"\"\"\n\n    def __init__(self, data: List[Dict[str, Any]]) -> None:\n        \"\"\"Initialize with a list of dictionaries.\"\"\"\n        self.data = data\n\n    def filter_by(self, key: str, value: Any) -> List[Dict[str, Any]]:\n        \"\"\"Return records where key matches value.\"\"\"\n        return [item for item in self.data if item.get(key) == value]\n\n    def group_by(self, key: str) -> Dict[Any, List[Dict[str, Any]]]:\n        \"\"\"Group records by the specified key.\"\"\"\n        grouped: Dict[Any, List[Dict[str, Any]]] = {}\n        for item in self.data:\n            group_key = item.get(key)\n            grouped.setdefault(group_key, []).append(item)\n        return grouped\n\n    def summarize(self) -> Tuple[int, List[str], Dict[str, Any]]:\n        \"\"\"Return count, keys present, and a sample row.\"\"\"\n        count = len(self.data)\n        keys = list({k for item in self.data for k in item.keys()})\n        sample = self.data[0] if self.data else {}\n        return count, keys, sample\n```\n\nNote the difference: full type hints, docstrings, PEP 8, modern Python conventions.",
        },
      ],
      default: [
        { role: "assistant", content: "Select a system prompt above and send to see the difference in output quality." },
      ],
    },
  },
  demos: [],
};
