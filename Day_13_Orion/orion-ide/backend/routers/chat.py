import json

from fastapi import APIRouter, Header, HTTPException
from starlette.responses import StreamingResponse

from config import DEFAULT_MODEL, OPENROUTER_API_KEY
from models.schemas import ChatRequest
from routers.agent import NO_KEY

router = APIRouter(tags=["chat"])


@router.post("/chat")
async def chat(
    request: ChatRequest,
    x_api_key: str | None = Header(None),
):
    api_key = (request.api_key or x_api_key or OPENROUTER_API_KEY or "").strip()
    if not api_key:
        raise HTTPException(status_code=401, detail=NO_KEY)
    model = request.model or DEFAULT_MODEL

    from agent.chat_graph import create_chat_graph

    graph = create_chat_graph(api_key=api_key, model=model)

    messages = [{"role": m.role, "content": m.content} for m in request.messages]

    async def event_generator():
        async for event in graph.astream_events(
            {"messages": messages},
            version="v2",
        ):
            kind = event["event"]
            if kind == "on_chat_model_stream":
                content = event["data"]["chunk"].content
                if content:
                    yield f"data: {json.dumps({'type': 'token', 'content': content})}\n\n"
            elif kind == "on_tool_start":
                yield f"data: {json.dumps({'type': 'tool_start', 'name': event['name'], 'args': event['data'].get('input', {})})}\n\n"
            elif kind == "on_tool_end":
                yield f"data: {json.dumps({'type': 'tool_end', 'name': event['name'], 'result': str(event['data'].get('output', ''))})}\n\n"
        yield f"data: {json.dumps({'type': 'done'})}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")
