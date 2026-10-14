import type { ChapterDef } from "../schema";

export const ch06: ChapterDef = {
  slug: "streaming",
  number: 6,
  lesson: "Lesson 1",
  subtopicLabel: "1.6 Streaming",
  title: "Streaming with astream_events",
  subtitle: "Stream tokens in real-time for a responsive agent experience.",
  cursorFeature: "Chat Mode",
  designPatterns: ["Agent Loop"],
  intro: "Waiting for a complete response is a poor UX. With astream_events, you get real-time token-by-token output, tool call notifications, and step-level visibility as the agent works. This is how Cursor shows you the agent's thinking process in real-time.",
  takeaway: "astream_events gives you a firehose of typed events — token deltas, tool calls, state transitions. Filter by event kind to build responsive UIs that show exactly what the agent is doing at each moment.",
  backendFilename: "streaming.py",
  backendCode: `/* lesson:begin */
async def stream_agent(user_message: str) -> None:
    inputs = {"messages": [SystemMessage(content=SYSTEM_PROMPT), HumanMessage(content=user_message)]}
    async for event in agent.astream_events(inputs, version="v2"):
        if event["event"] == "on_chat_model_stream":
            chunk = event["data"]["chunk"]
            if chunk.content:
                print(chunk.content, end="", flush=True)
        elif event["event"] == "on_tool_start":
            print(f"\\n--- calling tool: {event['name']} ---")
        elif event["event"] == "on_tool_end":
            print("--- tool done ---\\n")


run(stream_agent("List files in the 'generated' directory and read calculator.py"))
/* lesson:end */`,
  chatConfig: {
    mode: "streaming",
    defaultPrompt: "List files in the 'generated' directory and read calculator.py",
    conversations: {
      default: [
        {
          role: "tool",
          content: "calculator.py\ndata_processor.py",
          toolName: "list_directory",
          toolArgs: { directory: "generated" },
        },
        {
          role: "tool",
          content: "class Calculator:\n    def __init__(self):\n        self.history = []...",
          toolName: "read_file",
          toolArgs: { filepath: "generated/calculator.py" },
        },
        {
          role: "assistant",
          content: "### Files in the Explorer's `generated` folder\n- `calculator.py`\n- `data_processor.py`\n\n### Contents of `calculator.py`\n```python\nclass Calculator:\n    def __init__(self):\n        self.history = []\n\n    def add(self, a: float, b: float) -> float:\n        result = a + b\n        self.history.append(f'Added {a} + {b} = {result}')\n        return result\n\n    def subtract(self, a: float, b: float) -> float:\n        result = a - b\n        self.history.append(f'Subtracted {a} - {b} = {result}')\n        return result\n\n    def multiply(self, a: float, b: float) -> float:\n        result = a * b\n        self.history.append(f'Multiplied {a} * {b} = {result}')\n        return result\n\n    def divide(self, a: float, b: float) -> float:\n        if b == 0:\n            raise ValueError('Cannot divide by zero')\n        result = a / b\n        self.history.append(f'Divided {a} / {b} = {result}')\n        return result\n\n    def get_history(self) -> list[str]:\n        return self.history\n```",
        },
      ],
    },
  },
  demos: [],
};
