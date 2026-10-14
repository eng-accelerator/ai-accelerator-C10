import type { ChapterDef } from "../schema";

export const ch15: ChapterDef = {
  slug: "multi-agent",
  number: 15,
  lesson: "Lesson 3",
  subtopicLabel: "3.3 Multi-Agent",
  title: "Multi-Agent: Planner, Coder, Reviewer",
  subtitle: "Three specialists, and what each one is told, including the feedback from the last round.",
  cursorFeature: "Agent Mode",
  designPatterns: ["Multi-Agent", "Routing"],
  intro: "The planner researches and plans. The coder generates one complete file per task, with the rules that apply to that path folded into its prompt, plus whatever came back from the last round: a failing test output, a reviewer's objections, or a human's reason for rejecting. The reviewer sees only the files and the test output, with no memory of how they were written. That fresh context is what makes its second opinion worth having.",
  takeaway: "A loop only improves if feedback reaches the node that acts on it. Every prompt in this chapter is printed so you can see where the traceback, the review, and the human's note land.",
  demos: [],
  backendCode: `/* lesson:begin */
print(orchestrator.RESEARCH_PROMPT)
print(orchestrator.PLAN_PROMPT)
print(inspect.getsource(orchestrator.check_task_paths))

print(inspect.getsource(orchestrator.build_code_prompt))
task = {"filepath": "config.py", "action": "modify", "description": "add DEFAULT_SYSTEM_PROMPT"}
state = {
    "codebase_context": "config.py: PAGE_TITLE, PAGE_ICON, MODEL, BASE_URL",
    "status": "needs_revision",
    "review_result": "Name the constant DEFAULT_SYSTEM_PROMPT and add a docstring.",
    "human_feedback": "",
}
print(orchestrator.build_code_prompt(state, task, rules_root=ROOT))

print(inspect.getsource(orchestrator.build_review_prompt))
print(inspect.getsource(orchestrator.run_tests))
/* lesson:end */`,
  backendFilename: "ch15_specialists.py",
  chatConfig: {
    mode: "multi-agent-pipeline",
    defaultPrompt: "Add a system prompt feature to the chatbot",
    conversations: {
      default: [
        {
          role: "tool",
          toolName: "plan",
          toolArgs: { feature: "Add a system prompt feature" },
          content: `Plan: Add system prompt feature with default config, modify chat logic to accept system prompt parameter, and add sidebar UI for editing system prompt

File Tasks:
  [modify] sample_project/config.py
  [modify] sample_project/chat.py
  [modify] sample_project/app.py`,
        },
        {
          role: "tool",
          toolName: "code",
          toolArgs: { files: "3 file tasks" },
          content: `Generated: sample_project/config.py (244 chars)
Generated: sample_project/chat.py (546 chars)
Generated: sample_project/app.py (1385 chars)`,
        },
        {
          role: "tool",
          toolName: "review",
          toolArgs: { attempt: "1/2" },
          content: `Review [1/2]: APPROVED — Code is functional and well-structured. The implementation correctly handles OpenRouter API configuration, system prompt injection, and streaming responses.`,
        },
        {
          role: "assistant",
          content: `**Pipeline Complete** ✓\n\nThe 3-agent pipeline executed successfully:\n\n1. **Planner** → Searched codebase, produced plan with 3 file tasks\n2. **Coder** → Generated complete code for all 3 files\n3. **Reviewer** → APPROVED on first attempt\n\nThe agent is now paused at the human review gate, waiting for your decision to apply or reject the changes.`,
        },
      ],
    },
    generatedFile: {
      filename: "app.py",
      content: `import streamlit as st
from chat import get_client, stream_response
from config import PAGE_ICON, PAGE_TITLE, DEFAULT_SYSTEM_PROMPT

st.set_page_config(page_title=PAGE_TITLE, page_icon=PAGE_ICON)
st.title(f"{PAGE_ICON} {PAGE_TITLE}")

api_key = st.sidebar.text_input("OpenRouter API Key", type="password")
if not api_key:
    st.warning("Enter your OpenRouter API key to start.")
    st.stop()

if "system_prompt" not in st.session_state:
    st.session_state.system_prompt = DEFAULT_SYSTEM_PROMPT

st.session_state.system_prompt = st.sidebar.text_area(
    "System Prompt",
    value=st.session_state.system_prompt,
    height=150,
    help="Edit the system prompt to customize the assistant's behavior"
)

client = get_client(api_key)

if "messages" not in st.session_state:
    st.session_state.messages = []

for msg in st.session_state.messages:
    with st.chat_message(msg["role"]):
        st.markdown(msg["content"])

if prompt := st.chat_input("Ask me anything..."):
    st.session_state.messages.append({"role": "user", "content": prompt})
    with st.chat_message("user"):
        st.markdown(prompt)

    with st.chat_message("assistant"):
        response_text = st.write_stream(
            stream_response(client, st.session_state.messages, st.session_state.system_prompt)
        )

    st.session_state.messages.append({"role": "assistant", "content": response_text})
`,
    },
  },
};
