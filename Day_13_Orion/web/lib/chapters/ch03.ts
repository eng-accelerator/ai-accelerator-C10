import type { ChapterDef } from "../schema";

export const ch03: ChapterDef = {
  slug: "agent-graph",
  number: 3,
  lesson: "Lesson 1",
  subtopicLabel: "1.3 Agent Graph",
  title: "Building the Agent Graph",
  subtitle: "Wire up MessagesState, ToolNode, and conditional routing into a working agent loop.",
  cursorFeature: "Chat Mode",
  designPatterns: ["Agent Loop", "Tool Use"],
  intro: "A LangGraph agent is a state machine. You define nodes (LLM calls, tool execution) and edges (conditional routing based on whether the model wants to call a tool or return a final answer). MessagesState tracks the conversation, and ToolNode handles tool dispatch automatically.",
  takeaway: "The agent graph pattern — model node → should_continue → tool node → loop back — is the fundamental architecture of every LangGraph agent. Master this and everything else is an extension.",
  backendFilename: "agent_graph.py",
  backendCode: `/* lesson:begin */
# bind_tools hands the model the *schemas* (name, arguments, docstring) of the tools.
# Watch: the answer is empty and tool_calls is filled. The model decided; nothing ran.
llm_with_tools = llm.bind_tools(tools)
response = llm_with_tools.invoke("What files are in the current directory?")
print("Content:", response.content)
print("Tool calls:", response.tool_calls)

import inspect

from orion_agent.graphs import tool_agent

# Two nodes: agent and tools. One conditional edge: tool_calls or done.
print(inspect.getsource(tool_agent.build_tool_agent))
agent = tool_agent.build_tool_agent(llm, tools)
print("Graph compiled")

from langchain_core.messages import HumanMessage

result = agent.invoke({"messages": [HumanMessage(content="List the files in the current directory")]})
print_messages(result["messages"])
/* lesson:end */`,
  chatConfig: {
    mode: "agent-chat",
    graphVisualization: true,
    graphNodes: [
      { id: "__start__", label: "__start__" },
      { id: "agent", label: "agent" },
      { id: "tools", label: "tools" },
      { id: "__end__", label: "__end__" },
    ],
    graphEdges: [
      { from: "__start__", to: "agent" },
      { from: "agent", to: "tools" },
      { from: "tools", to: "agent" },
      { from: "agent", to: "__end__", style: "dashed" },
    ],
    animationSequence: ["__start__", "agent", "tools", "agent", "__end__"],
    graphRunSteps: {
      default: [
        {
          node: "agent",
          title: "Model call",
          detail: "The agent decides it needs the list_directory tool.",
        },
        {
          node: "tools",
          title: "list_directory",
          detail: "sample_project/\n  app.py\n  chat.py\n  config.py\norion/\n  agent_graph.py\ngenerated/",
          status: "success",
        },
        {
          node: "agent",
          title: "Final answer",
          detail: "The tool output is summarized for the user.",
          status: "success",
        },
        {
          node: "__end__",
          title: "Done",
          detail: "The graph exits after the agent returns a final answer.",
          status: "success",
        },
      ],
    },
    defaultPrompt: "List the files in the current directory",
    conversations: {
      default: [
        {
          role: "tool",
          content: "sample_project/\n  app.py\n  chat.py\n  config.py\norion/\n  agent_graph.py\ngenerated/",
          toolName: "list_directory",
          toolArgs: { directory: "." },
        },
        {
          role: "assistant",
          content: "The agent used `list_directory` and found the files shown in the Explorer:\n\n**sample_project/**\n- app.py\n- chat.py\n- config.py\n\n**orion/**\n- agent_graph.py\n\n**generated/**\n- empty for now",
        },
      ],
    },
  },
  demos: [],
};
