from config import BASE_URL, MODEL
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
            yield content
