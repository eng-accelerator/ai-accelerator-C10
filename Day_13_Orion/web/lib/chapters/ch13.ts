import type { ChapterDef } from "../schema";

export const ch13: ChapterDef = {
  slug: "codebase-rag",
  number: 13,
  lesson: "Lesson 3",
  subtopicLabel: "3.1 Codebase RAG",
  title: "Codebase Search: grep, glob, read",
  subtitle: "The codebase brain is a model with grep in its hands, not an index.",
  cursorFeature: "Agent Mode",
  designPatterns: ["Knowledge Retrieval"],
  intro: "Before it plans, the agent has to find the code the request touches. It does that the way Cursor, Claude Code, and Codex do now: grep for the words in the request, rank the files by hits, read the ones that matter, repeat if needed. No index to build or keep fresh. Embeddings get one cell at the end as the approach these tools used from 2023 to 2025, and why grep won.",
  takeaway: "Search is a loop the model drives, not a database you maintain. A small set of tools (grep, glob, read) plus a capable model finds the right code in a codebase of any size.",
  demos: [],
  backendCode: `/* lesson:begin */
from orion_agent.search import repo_map, search_codebase

for match in ws.grep("stream"):
    print(f"{match.path}:{match.line}: {match.text}")
print()
print(repo_map(ws))
print()
print(search_codebase(ws, "streaming chat response"))

from langchain_core.messages import HumanMessage

from orion_agent.graphs.tool_agent import build_tool_agent
from orion_agent.sandbox import LocalSandbox
from orion_agent.tools import make_tools

tools = make_tools(ws, LocalSandbox())
searcher = build_tool_agent(llm, [tools["grep_files"], tools["glob_files"], tools["read_file"]])
result = searcher.invoke({"messages": [HumanMessage(content=(
    "How does the streaming response work in this project? Name the file and the function, in brief."
))]})
print_messages(result["messages"], width=160)
/* lesson:end */`,
  backendFilename: "ch13_codebase_search.py",
  chatConfig: {
    mode: "codebase-search",
    defaultPrompt: "how does streaming work",
    conversations: {
      default: [
        {
          role: "tool",
          toolName: "grep_files",
          toolArgs: { pattern: "stream" },
          content: `app.py:2: from chat import get_client, stream_response
app.py:30:            stream_response(client, st.session_state.messages)
chat.py:9: def stream_response(client, messages):
chat.py:13:        stream=True,`,
        },
        {
          role: "tool",
          toolName: "read_file",
          toolArgs: { filepath: "chat.py" },
          content: `from config import BASE_URL, MODEL
from openai import OpenAI


def get_client(api_key):
    return OpenAI(base_url=BASE_URL, api_key=api_key)


def stream_response(client, messages):
    response = client.chat.completions.create(
        model=MODEL,
        messages=messages,
        stream=True,
    )
    for chunk in response:
        content = chunk.choices[0].delta.content
        if content:
            yield content`,
        },
        {
          role: "assistant",
          content: "Streaming lives in chat.py. stream_response opens a streaming completion and yields each chunk's text; app.py passes that generator to st.write_stream, which renders tokens as they arrive.",
        },
      ],
      "system prompt configuration": [
        {
          role: "tool",
          toolName: "grep_files",
          toolArgs: { pattern: "system|prompt" },
          content: "No matches.",
        },
        {
          role: "tool",
          toolName: "read_file",
          toolArgs: { filepath: "config.py" },
          content: `PAGE_TITLE = "My ChatBot"
PAGE_ICON = "🤖"
MODEL = "openai/gpt-4o-mini"
BASE_URL = "https://openrouter.ai/api/v1"`,
        },
        {
          role: "assistant",
          content: "There is no system prompt anywhere yet. config.py holds four constants and chat.py sends messages straight through. Adding one means a constant in config.py and a system message prepended in stream_response.",
        },
      ],
    },
  },
};
