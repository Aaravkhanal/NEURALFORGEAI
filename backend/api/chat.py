"""
NeuralForge — Chat API Routes
Handles chat messaging with streaming support and conversation management.
"""

import json
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.security import get_current_user_id, get_optional_user_id
from models.project import Project
from models.conversation import Conversation
from schemas import ChatRequest, ChatMessage, ConversationResponse

router = APIRouter(prefix="/api/chat", tags=["chat"])


@router.post("/send")
async def send_message(
    body: ChatRequest,
    user_id: str = Depends(get_optional_user_id),
    db: AsyncSession = Depends(get_db),
):
    """
    Send a message and receive a streaming response from the agent system.
    Returns Server-Sent Events (SSE) for real-time streaming.
    """
    if body.project_id != "playground" and not user_id:
        raise HTTPException(status_code=401, detail="Not authenticated")
        
    user_id = user_id or "guest"

    # Verify project ownership (skip for playground)
    if body.project_id != "playground":
        result = await db.execute(
            select(Project).where(
                Project.id == body.project_id, Project.user_id == user_id
            )
        )
        project = result.scalar_one_or_none()
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")

    # Get or create conversation
    if body.conversation_id:
        conv_result = await db.execute(
            select(Conversation).where(
                Conversation.id == body.conversation_id,
                Conversation.project_id == body.project_id,
            )
        )
        conversation = conv_result.scalar_one_or_none()
        if not conversation:
            raise HTTPException(status_code=404, detail="Conversation not found")
    else:
        conversation = Conversation(
            project_id=body.project_id,
            title=body.message[:100] if body.message else "New Conversation",
        )
        db.add(conversation)
        await db.flush()

    # Append user message
    user_msg = {
        "role": "user",
        "content": body.message,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    messages = list(conversation.messages or [])
    messages.append(user_msg)
    conversation.messages = messages
    await db.flush()

    async def stream_response():
        """Stream agent response as Server-Sent Events."""
        try:
            # Import agent orchestrator
            from agents.orchestrator import run_agent_workflow

            full_response = ""
            agent_flow = []

            async for event in run_agent_workflow(
                message=body.message,
                project_id=body.project_id,
                conversation_history=messages,
                agent_mode=body.agent_mode,
                model=body.model,
            ):
                event_type = event.get("type", "token")

                if event_type == "token":
                    token = event.get("content", "")
                    full_response += token
                    yield f"data: {json.dumps({'type': 'token', 'content': token})}\n\n"

                elif event_type == "agent_start":
                    agent_info = {
                        "agent": event.get("agent"),
                        "step": event.get("step"),
                        "status": "running",
                    }
                    agent_flow.append(agent_info)
                    yield f"data: {json.dumps({'type': 'agent_start', **agent_info})}\n\n"

                elif event_type == "agent_end":
                    yield f"data: {json.dumps({'type': 'agent_end', 'agent': event.get('agent')})}\n\n"

                elif event_type == "tool_call":
                    yield f"data: {json.dumps({'type': 'tool_call', 'tool': event.get('tool'), 'input': event.get('input')})}\n\n"

                elif event_type == "tool_result":
                    yield f"data: {json.dumps({'type': 'tool_result', 'tool': event.get('tool'), 'result': event.get('result', '')[:500]})}\n\n"

            # Save assistant response to conversation
            assistant_msg = {
                "role": "assistant",
                "content": full_response,
                "agent_flow": agent_flow,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }
            messages.append(assistant_msg)
            conversation.messages = messages
            conversation.agent_outputs = {"last_flow": agent_flow}

            # Final event with conversation ID
            yield f"data: {json.dumps({'type': 'done', 'conversation_id': conversation.id})}\n\n"

        except Exception as e:
            error_msg = f"Agent error: {str(e)}"
            yield f"data: {json.dumps({'type': 'error', 'content': error_msg})}\n\n"

    return StreamingResponse(
        stream_response(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Conversation-Id": conversation.id,
        },
    )


@router.get("/history/{project_id}", response_model=list[ConversationResponse])
async def get_conversations(
    project_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Get all conversations for a project."""
    # Verify project ownership
    result = await db.execute(
        select(Project).where(
            Project.id == project_id, Project.user_id == user_id
        )
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Project not found")

    conv_result = await db.execute(
        select(Conversation)
        .where(Conversation.project_id == project_id)
        .order_by(Conversation.updated_at.desc())
    )
    conversations = conv_result.scalars().all()

    return [ConversationResponse.model_validate(c) for c in conversations]


@router.get("/conversation/{conversation_id}", response_model=ConversationResponse)
async def get_conversation(
    conversation_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Get a specific conversation."""
    result = await db.execute(
        select(Conversation).where(Conversation.id == conversation_id)
    )
    conversation = result.scalar_one_or_none()

    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")

    return ConversationResponse.model_validate(conversation)


@router.delete("/conversation/{conversation_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_conversation(
    conversation_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Delete a conversation."""
    result = await db.execute(
        select(Conversation).where(Conversation.id == conversation_id)
    )
    conversation = result.scalar_one_or_none()

    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")

    await db.delete(conversation)
