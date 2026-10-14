import type { ChapterDef } from "../schema";

const loggerV1 = `import os
import logging


class SimpleLogger:
    """A simple logger that writes timestamped messages to a log file."""

    def __init__(self, log_file: str) -> None:
        """Initialize the SimpleLogger with a specified log file."""
        self.log_file = log_file
        self.setup_logger()

    def setup_logger(self) -> None:
        """Set up the logger configuration."""
        logging.basicConfig(
            filename=self.log_file,
            level=logging.INFO,
            format="%(asctime)s - %(levelname)s - %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S",
        )

    def log(self, message: str) -> None:
        """Log an info message with a timestamp."""
        logging.info(message)

    def log_error(self, message: str) -> None:
        """Log an error message with a timestamp."""
        logging.error(message)`;

const loggerV2 = `import logging
from enum import Enum


class LogLevel(Enum):
    """Supported log levels."""

    INFO = "INFO"
    WARNING = "WARNING"
    ERROR = "ERROR"


class SimpleLogger:
    """A simple logger that writes timestamped messages to a log file."""

    def __init__(self, log_file: str) -> None:
        """Initialize the SimpleLogger with a specified log file."""
        self.log_file = log_file
        self.setup_logger()

    def setup_logger(self) -> None:
        """Set up the logger configuration."""
        logging.basicConfig(
            filename=self.log_file,
            level=logging.INFO,
            format="%(asctime)s - %(levelname)s - %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S",
        )

    def log(self, message: str, level: LogLevel = LogLevel.INFO) -> None:
        """Log a message with the selected level."""
        if level == LogLevel.ERROR:
            logging.error(message)
        elif level == LogLevel.WARNING:
            logging.warning(message)
        else:
            logging.info(message)

    def log_error(self, message: str) -> None:
        """Log an error message with a timestamp."""
        self.log(message, LogLevel.ERROR)

    def filter_logs(self, level: LogLevel) -> list[str]:
        """Return log lines that match the selected level."""
        with open(self.log_file, "r") as log_file:
            return [line for line in log_file if f" - {level.value} - " in line]`;

export const ch07: ChapterDef = {
  slug: "multi-turn",
  number: 7,
  lesson: "Lesson 1",
  subtopicLabel: "1.7 Multi Turn Conversation",
  title: "Multi-Turn Conversations",
  subtitle: "Maintain message history across turns for contextual follow-ups.",
  cursorFeature: "Chat Mode",
  designPatterns: ["Agent Loop"],
  intro: "A single-turn agent forgets everything after each response. By maintaining message history in MessagesState, the agent can handle follow-up questions, refine previous outputs, and build on context from earlier in the conversation — just like a chat session in Cursor.",
  takeaway: "Multi-turn capability transforms a stateless function into a conversational partner. The key is appending each exchange to MessagesState so the agent has full context for every decision.",
  backendFilename: "multi_turn.py",
  backendCode: `/* lesson:begin */
messages = [
    SystemMessage(content=SYSTEM_PROMPT),
    HumanMessage(content="Create 'generated/logger.py' with a SimpleLogger class that writes timestamped messages to a log file."),
]
result = agent.invoke({"messages": messages})
messages = result["messages"]
print("=== Turn 1 complete ===")
print(ws.read("generated/logger.py")[:300])

messages.append(HumanMessage(content="""
Now read the logger.py file and add these features:
- Log levels: INFO, WARNING, ERROR
- A method to filter logs by level
Write the updated file.
"""))
result = agent.invoke({"messages": messages})
print("=== Turn 2 complete ===")
print_file(ws, "generated/logger.py")

result = agent.invoke({"messages": [
    SystemMessage(content=SYSTEM_PROMPT),
    HumanMessage(content="Read generated/calculator.py, then create generated/test_calculator.py with pytest tests for all methods."),
]})
print_messages(result["messages"], width=100)
/* lesson:end */`,
  chatConfig: {
    mode: "multi-turn",
    turnFiles: {
      turn_1: {
        filename: "logger.py",
        content: loggerV1,
      },
      turn_2: {
        filename: "logger.py",
        content: loggerV2,
      },
    },
    defaultPrompt: "Create 'generated/logger.py' with a SimpleLogger class that writes timestamped messages to a log file.",
    conversations: {
      turn_1: [
        {
          role: "tool",
          content: "File written: generated/logger.py",
          toolName: "write_file",
          toolArgs: { filepath: "generated/logger.py" },
        },
        {
          role: "assistant",
          content: "I've created `generated/logger.py` with a SimpleLogger class. It includes:\n\n- `__init__(log_file)` — takes a log file path\n- `log(message)` — writes a timestamped message to the file\n- Timestamps are in ISO format\n\nYou can now ask me to modify or extend this file.",
        },
      ],
      turn_2: [
        {
          role: "tool",
          content: "import datetime\nfrom enum import Enum\n\nclass LogLevel(Enum):\n    INFO = 'INFO'\n    WARNING = 'WARNING'\n    ERROR = 'ERROR'\n...",
          toolName: "read_file",
          toolArgs: { filepath: "generated/logger.py" },
        },
        {
          role: "tool",
          content: "File written: generated/logger.py",
          toolName: "write_file",
          toolArgs: { filepath: "generated/logger.py" },
        },
        {
          role: "assistant",
          content: "Done! I've updated `logger.py` with:\n\n- **LogLevel enum** — INFO, WARNING, ERROR\n- **Updated `log()` method** — now accepts a `level` parameter\n- **New `filter_logs(level)` method** — returns only entries matching that level\n\nThe agent read the existing file first (full context from Turn 1), then wrote the updated version.",
        },
      ],
    },
  },
  demos: [],
};
