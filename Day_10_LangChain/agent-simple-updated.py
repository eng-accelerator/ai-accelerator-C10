#from langgraph.prebuilt import create_react_agent #Reasoning + Acting agent
from langchain.agents import create_agent
from langchain_core.tools import tool
from langchain_core.messages import HumanMessage, AIMessage
from langchain_openai import ChatOpenAI
import os
from dotenv import load_dotenv

#something from real life, some API call, some MCP, some function that does something useful

load_dotenv()

@tool
def calculator(expression: str) -> str:
    """Does math calculations. Pass a mathematical expression like '25 * 4'."""
    try:
        allowed_chars = set("0123456789+-*/(). ")
        if all(c in allowed_chars for c in expression):
            return str(eval(expression))
        else:
            return "Error: Invalid characters in expression"
    except Exception as e:
        return f"Error in calculation: {e}"

@tool
def text_length(text: str) -> str:
    """Counts the length of the provided text in characters."""
    return f"Length: {len(text)} characters"

tools = [calculator, text_length] 

llm = ChatOpenAI(
    model="openai/gpt-4o",
    openai_api_key=os.getenv("OPENROUTER_API_KEY"),
    openai_api_base="https://openrouter.ai/api/v1",
    temperature=0 
)


'''
Human message: "What is 25 * 4?"
AI Message: "To answer that, I need to use the calculator tool. I'll pass the expression '25 * 4' to it."
Human Message: "calculator(expression='25 * 4')" 
AI Message: "The calculator returns '100'. So the answer to 'What is 25 * 4?' is 100."


'''



agent = create_agent(llm, tools)

def run(query: str) -> str:
    response = agent.invoke({"messages": [HumanMessage(content=query)]}) #run the agent
    for msg in reversed(response["messages"]):
        if isinstance(msg, AIMessage) and msg.content:
            return msg.content
    return "No response"

#1st LLM Call: it decides which tool to use, 
# either answer from its own knowledge, or call one of the tools with the right input

#It decides to call a tool 

# the tool runs and gives a result back to the LLM

#2nd LLM Call: it takes the tool result and formats it into a human-friendly answer

#Answer is returned 100 to the user

#LLM own knowledge, Tool 1 Calculator, Tool 2 Text Length
def main():
    print("\n=== Test 1: Calculator ===")
    print(run("What is 25 * 4 and what is the text length of that answer?"))

    print("\n=== Test 2: Text Length ===")
    print(run("How long is the text 'Hello World'?"))

    print("\n=== Test 3: General Knowledge ===")
    print(run("Who is Mark Zuckerberg?"))

if __name__ == "__main__":
    main()


'''
Call 1 — GPT-4o decides which tool and what input
Call 2 — GPT-4o formats the tool result into a human answer

'''


'''
**ReAct stands for Reasoning + Acting.**

It's just a loop:
```
Reason  → which tool should I use?
Act     → call the tool
Reason  → what does the result mean?
Act     → call another tool if needed, or give final answer
```

---

**In your code specifically, the ReAct agent is:**

The thing that manages the back and forth between GPT-4o and your tools. It's the middleman.
```
You → ReAct Agent → GPT-4o (call 1) → calculator runs → GPT-4o (call 2) → You

'''