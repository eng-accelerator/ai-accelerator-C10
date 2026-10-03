def build_prompt(question: str, context: str) -> str:
    """
    Builds the complete grounded instruction prompt.
    
    Args:
        question (str): User's question.
        context (str): Retreived context blocks.
        
    Returns:
        str: Final prompt for LLM.
    """
    return f"""You are a company policy assistant.

Answer the user's question ONLY using the provided context.

If the answer cannot be found in the context, say:

"I don't have enough information in the provided documents."

Do not invent company policies.

CONTEXT:
{context}

QUESTION:
{question}"""

def debug_prompt(question: str, context: str):
    """
    Prints the exact prompt to be dispatched to the Gemini API.
    """
    prompt = build_prompt(question, context)
    print("\n==============================")
    print("PROMPT CONSTRUCTION DEBUG")
    print("==============================")
    print(prompt)
    print("==============================\n")
