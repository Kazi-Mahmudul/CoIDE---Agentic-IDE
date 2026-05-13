"""
Agent loop: proxies to any OpenAI-compatible LLM with function calling,
executes tools, and streams the final response back.
"""

import json
import httpx
from fastapi import APIRouter, Depends, Request
from fastapi.responses import StreamingResponse
from tools import TOOL_SCHEMAS, execute_tool
from auth import UserContext, get_current_user, get_workspace_dir

router = APIRouter(prefix="/agent", tags=["agent"])

MAX_ITERATIONS = 10


@router.post("/chat")
async def agent_chat(request: Request, user: UserContext = Depends(get_current_user)):
    body = await request.json()
    messages = body.get("messages", [])
    config = body.get("model_config", {})
    
    base_url = config.get("base_url", "").rstrip("/")
    model = config.get("model", "")
    api_key = config.get("api_key", "")
    
    if not base_url or not model:
        async def error_stream():
            yield json.dumps({"type": "error", "content": "Missing model configuration"}) + "\n"
        return StreamingResponse(error_stream(), media_type="text/plain")
    
    async def generate():
        nonlocal messages
        headers = {"Content-Type": "application/json"}
        if api_key:
            headers["Authorization"] = f"Bearer {api_key}"
        
        iteration = 0
        async with httpx.AsyncClient(timeout=120.0) as client:
            while iteration < MAX_ITERATIONS:
                iteration += 1
                payload = {
                    "model": model,
                    "messages": messages,
                    "tools": TOOL_SCHEMAS,
                    "tool_choice": "auto",
                }
                try:
                    response = await client.post(
                        f"{base_url}/chat/completions",
                        headers=headers, json=payload,
                    )
                    if response.status_code != 200:
                        yield json.dumps({"type": "error", "content": f"LLM API error ({response.status_code}): {response.text}"}) + "\n"
                        return
                    
                    data = response.json()
                    choice = data.get("choices", [{}])[0]
                    message = choice.get("message", {})
                    tool_calls = message.get("tool_calls", [])
                    
                    if tool_calls:
                        messages.append(message)
                        for tc in tool_calls:
                            func = tc.get("function", {})
                            tool_name = func.get("name", "unknown")
                            try:
                                tool_args = json.loads(func.get("arguments", "{}"))
                            except json.JSONDecodeError:
                                tool_args = {}
                            result = await execute_tool(tool_name, tool_args, workspace_dir=workspace_dir)
                            yield json.dumps({"type": "tool_call", "name": tool_name, "args": tool_args, "result": result}) + "\n"
                            messages.append({"role": "tool", "tool_call_id": tc.get("id", ""), "content": result})
                        continue
                    else:
                        content = message.get("content", "")
                        if content:
                            chunk_size = 20
                            for i in range(0, len(content), chunk_size):
                                yield json.dumps({"type": "text", "content": content[i:i+chunk_size]}) + "\n"
                        yield json.dumps({"type": "done"}) + "\n"
                        return
                except httpx.TimeoutException:
                    yield json.dumps({"type": "error", "content": "LLM request timed out"}) + "\n"
                    return
                except Exception as e:
                    yield json.dumps({"type": "error", "content": f"LLM error: {str(e)}"}) + "\n"
                    return
            
            yield json.dumps({"type": "error", "content": f"Max iterations ({MAX_ITERATIONS}) reached"}) + "\n"
    
    return StreamingResponse(generate(), media_type="text/plain")
    workspace_dir = get_workspace_dir(user)
