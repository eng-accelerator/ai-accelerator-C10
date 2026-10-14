import type { ChapterDef } from "../schema";

export const ch02: ChapterDef = {
  slug: "defining-tools",
  number: 2,
  lesson: "Lesson 1",
  subtopicLabel: "1.2 Tools",
  title: "Defining Tools",
  subtitle: "Give your agent capabilities with @tool decorator, docstrings, and type hints.",
  cursorFeature: "Chat Mode",
  designPatterns: ["Tool Use"],
  intro: "Tools are how an LLM interacts with the outside world. Using LangChain's @tool decorator, you define Python functions with type hints and docstrings — the framework auto-generates a JSON schema so the model knows when and how to call each tool.",
  takeaway: "Well-typed, well-documented tool functions let the LLM self-select the right tool at the right time. The @tool decorator bridges natural language intent to executable code.",
  backendFilename: "defining_tools.py",
  backendCode: `/* lesson:begin */
from orion_agent.tools import basic_tools

tools = basic_tools(ws)
# The decorator turns the docstring and type hints into the schema the model sees.
for t in tools:
    print(f"{t.name}: {t.description}")
    print(f"  schema: {t.args_schema.model_json_schema()['properties']}\\n")

# Open src/orion_agent/tools.py to read the three functions. Every path is resolved
# against workspace/ and an escape comes back as an "Error: ..." string.

# %%
/* lesson:end */`,
  chatConfig: {
    mode: "tool-toggles",
    tools: [
      { id: "read_file", name: "read_file", enabled: false },
      { id: "write_file", name: "write_file", enabled: false },
      { id: "list_directory", name: "list_directory", enabled: false },
    ],
    defaultPrompt: "What files are in the current directory?",
    conversations: {
      enabled: [
        {
          role: "tool",
          content: "sample_project/\n  app.py\n  chat.py\n  config.py\norion/\n  defining_tools.py\ngenerated/",
          toolName: "list_directory",
          toolArgs: { directory: "." },
        },
        {
          role: "assistant",
          content: "The current Explorer contains:\n\n**sample_project/**\n- app.py\n- chat.py\n- config.py\n\n**orion/**\n- defining_tools.py\n\n**generated/**\n- empty for now",
        },
      ],
      disabled: [
        {
          role: "assistant",
          content: "I don't have the tools available to list directory contents. Please enable the list_directory tool to perform this operation.",
        },
      ],
    },
  },
  demos: [],
};
