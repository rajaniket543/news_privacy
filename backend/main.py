from __future__ import annotations

from contextlib import asynccontextmanager
import os
from typing import Literal

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from utils import SecureMessageStore


store = SecureMessageStore()


def get_allowed_origins() -> list[str]:
    configured = os.getenv("ALLOWED_ORIGINS")
    if configured:
        return [origin.strip() for origin in configured.split(",") if origin.strip()]

    return ["http://localhost:5173", "http://127.0.0.1:5173"]


class UserRegistrationRequest(BaseModel):
    user_id: str = Field(..., min_length=2, max_length=40, pattern=r"^[a-z0-9_-]+$")
    display_name: str = Field(..., min_length=2, max_length=60)
    public_key_pem: str = Field(..., min_length=64)


class SecureMessageRequest(BaseModel):
    sender_id: str = Field(..., min_length=2, max_length=40)
    recipient_id: str = Field(..., min_length=2, max_length=40)
    kind: Literal["chat", "task", "note", "friend_request"] = "chat"
    encrypted_message: str = Field(..., min_length=16)
    encrypted_aes_key: str = Field(..., min_length=16)
    iv: str = Field(..., min_length=16)
    message_hash: str = Field(..., min_length=32)
    digital_signature: str = Field(..., min_length=32)
    timestamp: str = Field(..., min_length=10)
    nonce: str = Field(..., min_length=8, max_length=128)
    title: str | None = Field(default=None, max_length=120)


@asynccontextmanager
async def lifespan(_: FastAPI):
    store.reset()
    yield


app = FastAPI(
    title="HabitFlow Secure API",
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=get_allowed_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health_check() -> dict[str, object]:
    return {
        "status": "ok",
        "users": len(store.users),
        "messages": len(store.messages),
        "threat_model": [
            "MITM mitigation via public-key encryption",
            "Integrity via SHA-256 hash checks",
            "Authentication via RSA signatures",
            "Replay defense via nonce registry",
        ],
    }


@app.get("/users")
async def list_users() -> list[dict[str, str]]:
    return [user.model_dump() for user in store.list_users()]


@app.post("/users/register")
async def register_user(payload: UserRegistrationRequest) -> dict[str, object]:
    user = store.register_user(
        user_id=payload.user_id,
        display_name=payload.display_name,
        public_key_pem=payload.public_key_pem,
    )
    return {"status": "registered", "user": user.model_dump()}


@app.get("/users/{user_id}/public-key")
async def get_public_key(user_id: str) -> dict[str, str]:
    user = store.get_user(user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found.")
    return {"user_id": user.user_id, "public_key_pem": user.public_key_pem}


@app.post("/messages")
async def store_message(payload: SecureMessageRequest) -> dict[str, object]:
    try:
        message = store.store_message(payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return {"status": "stored", "message": message}


@app.get("/conversations/{first_user_id}/{second_user_id}")
async def get_conversation(first_user_id: str, second_user_id: str) -> dict[str, object]:
    if store.get_user(first_user_id) is None or store.get_user(second_user_id) is None:
        raise HTTPException(status_code=404, detail="Conversation user not found.")

    messages = store.get_conversation(first_user_id, second_user_id)
    return {
        "participants": [first_user_id, second_user_id],
        "messages": messages,
        "metrics": store.metrics(first_user_id, second_user_id),
    }


@app.post("/demo/reset")
async def reset_demo() -> dict[str, str]:
    store.reset()
    return {"status": "reset"}
