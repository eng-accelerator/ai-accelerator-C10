import type { ChapterDef } from "../schema";

export const ch04: ChapterDef = {
  slug: "code-generation",
  number: 4,
  lesson: "Lesson 1",
  subtopicLabel: "1.4 Code Generation",
  title: "Code Generation Task",
  subtitle: "Have the agent generate code and write it to files using tool calls.",
  cursorFeature: "Chat Mode",
  designPatterns: ["Tool Use"],
  intro: "Now that the agent has tools and a graph, it's time for the first real task: generating Python code from a natural language description and writing it to disk. The agent decides which file operations to use, generates the code, and persists the result — all through the tool-calling loop.",
  takeaway: "Code generation is just tool use with a purpose. The agent generates content via the LLM and persists it via write_file — the same pattern scales to any generative task.",
  backendFilename: "code_generation.py",
  backendCode: `/* lesson:begin */
result = agent.invoke({"messages": [HumanMessage(content="""
Create a Python file called 'generated/calculator.py' with a Calculator class that has:
- add, subtract, multiply, divide methods
- A history list that tracks all operations
- A get_history method that returns the history

Write the file using the write_file tool.
""")]})
print_messages(result["messages"])
/* lesson:end */`,
  chatConfig: {
    mode: "code-gen",
    defaultPrompt: `Create a Python file called 'generated/calculator.py' with a Calculator class that has:
- add, subtract, multiply, divide methods
- A history list that tracks all operations
- A get_history method that returns the history

Write the file using the write_file tool.`,
    generatedFile: {
      filename: "calculator.py",
      content: `class Calculator:
    def __init__(self):
        self.history = []

    def add(self, a, b):
        result = a + b
        self.history.append(f'Added {a} + {b} = {result}')
        return result

    def subtract(self, a, b):
        result = a - b
        self.history.append(f'Subtracted {a} - {b} = {result}')
        return result

    def multiply(self, a, b):
        result = a * b
        self.history.append(f'Multiplied {a} * {b} = {result}')
        return result

    def divide(self, a, b):
        if b == 0:
            raise ValueError('Cannot divide by zero')
        result = a / b
        self.history.append(f'Divided {a} / {b} = {result}')
        return result

    def get_history(self):
        return self.history`,
    },
    conversations: {
      default: [
        {
          role: "tool",
          content: "File written: generated/calculator.py",
          toolName: "write_file",
          toolArgs: { filepath: "generated/calculator.py", content: "(Calculator class)" },
        },
        {
          role: "assistant",
          content: "The Python file `generated/calculator.py` has been created with the requested `Calculator` class. Here are the details:\n\n- It includes methods for addition, subtraction, multiplication, and division.\n- It maintains a history list to track all operations.\n- The `get_history` method returns the full operation history.\n\nYou can see the generated file in the code editor.",
        },
      ],
    },
  },
  demos: [],
};
