import type { ChapterDef } from "../schema";

export const ch08: ChapterDef = {
  slug: "structured-output",
  number: 8,
  lesson: "Lesson 2",
  subtopicLabel: "2.1 Structured Output",
  title: "Structured Output",
  subtitle: "Force the LLM to return Pydantic-validated JSON with with_structured_output.",
  cursorFeature: "Bugbot",
  designPatterns: ["Prompt Chaining"],
  intro: "Free-text LLM responses are unpredictable. with_structured_output binds a Pydantic model to the LLM call, ensuring every response is valid, typed JSON. This is essential for agents that need to parse results programmatically — bug reports, code plans, review verdicts.",
  takeaway: "Structured output eliminates parsing fragility. When your agent returns a Pydantic model instead of raw text, downstream nodes can rely on typed fields rather than regex or string matching.",
  demos: [],
  backendCode: `/* lesson:begin */
result = llm.invoke("Write a Python function that checks if a number is prime")
print(result.content)

from orion_agent.llm import structured
from orion_agent.schemas import CodeOutput

structured_llm = structured(llm, CodeOutput)
result = structured_llm.invoke("Write a Python function that checks if a number is prime")
/* lesson:end */`,
  backendFilename: "structured_output.py",
  chatConfig: {
    mode: "structured-output",
    defaultPrompt: "Write a Python function that checks if a number is prime",
    conversations: {
      raw: [
        {
          role: "assistant",
          renderAs: "plain",
          content: `Certainly! Here's a Python function that checks if a number is prime:

\`\`\`python
def is_prime(n):
    """Check if a number is prime."""
    if n <= 1:
        return False
    if n <= 3:
        return True
    if n % 2 == 0 or n % 3 == 0:
        return False
    i = 5
    while (i * i) <= n:
        if n % i == 0 or n % (i + 2) == 0:
            return False
        i += 6
    return True

# Example usage:
number = 29
if is_prime(number):
    print(f"{number} is a prime number.")
else:
    print(f"{number} is not a prime number.")
\`\`\`

### Explanation:
1. **Input Check**: The function first checks if the number is less than or equal to 1. If so, it returns \`False\`.
2. **Small Numbers**: It then checks if \`n\` is 2 or 3, which are prime numbers.
3. **Even and Divisible by 3**: It eliminates all even numbers greater than 2 and multiples of 3.
4. **Loop for Larger Numbers**: It checks for factors from 5 upwards, skipping even numbers, until \`i²\` is greater than \`n\`.

You can test this function with various inputs to see whether they are prime or not.`,
        },
      ],
      structured: [
        {
          role: "assistant",
          content: `✓ Structured output received (CodeOutput)

Explanation:
The function is_prime checks if a given number n is a prime number. It returns False for numbers ≤ 1, then checks for factors from 2 to √n. If any number divides n evenly, it returns False; otherwise True.

Code:
\`\`\`python
def is_prime(n):
    if n <= 1:
        return False
    for i in range(2, int(n**0.5) + 1):
        if n % i == 0:
            return False
    return True
\`\`\`

Notice: the structured response still has separate fields internally, but the UI can present each field in the right format.`,
        },
      ],
    },
  },
};
