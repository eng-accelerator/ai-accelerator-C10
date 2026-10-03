import os
from google import genai
from app.config import GEMINI_MODEL, GEMINI_API_KEY

def generate_answer(prompt: str) -> str:
    """
    Sends the prompt to the Gemini API using the google-genai SDK.
    
    Args:
        prompt (str): Grounded prompt text.
        
    Returns:
        str: LLM generated answer.
    """
    # Check for presence of API key
    if not GEMINI_API_KEY:
        raise ValueError(
            "GEMINI_API_KEY is not configured. Please ensure it is defined "
            "in your .env file or set as an environment variable."
        )

    try:
        # Instantiate Client with our config key
        client = genai.Client(api_key=GEMINI_API_KEY)
        response = client.models.generate_content(
            model=GEMINI_MODEL,
            contents=prompt
        )
        return response.text
    except Exception as e:
        # Do not silently swallow exceptions, raise them clearly
        raise RuntimeError(f"Gemini API Exception occurred: {e}") from e
