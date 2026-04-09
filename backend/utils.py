from __future__ import annotations

from base64 import b64decode
from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta
import hashlib
from itertools import count
from typing import Any

from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding
from pydantic import BaseModel


MAX_CLOCK_SKEW_SECONDS = 300
MAX_MESSAGE_AGE_HOURS = 24


class RegisteredUser(BaseModel):
    user_id: str
    display_name: str
    public_key_pem: str


@dataclass
class SecureMessageStore:
    users: dict[str, RegisteredUser] = field(default_factory=dict)
    messages: list[dict[str, Any]] = field(default_factory=list)
    seen_nonces: set[tuple[str, str]] = field(default_factory=set)
    _id_counter: Any = field(default_factory=lambda: count(1))

    def reset(self) -> None:
        self.users.clear()
        self.messages.clear()
        self.seen_nonces.clear()
        self._id_counter = count(1)

    def list_users(self) -> list[RegisteredUser]:
        return sorted(self.users.values(), key=lambda user: user.display_name.lower())

    def get_user(self, user_id: str) -> RegisteredUser | None:
        return self.users.get(user_id)

    def register_user(self, user_id: str, display_name: str, public_key_pem: str) -> RegisteredUser:
        validate_public_key(public_key_pem)
        user = RegisteredUser(
            user_id=user_id,
            display_name=display_name.strip(),
            public_key_pem=public_key_pem.strip(),
        )
        self.users[user_id] = user
        return user

    def store_message(self, payload: Any) -> dict[str, Any]:
        sender = self.get_user(payload.sender_id)
        recipient = self.get_user(payload.recipient_id)
        if sender is None or recipient is None:
            raise ValueError("Both sender and recipient must be registered before sending.")

        nonce_key = (payload.sender_id, payload.nonce)
        if nonce_key in self.seen_nonces:
            raise ValueError("Replay attack detected: nonce has already been used.")

        parsed_timestamp = parse_timestamp(payload.timestamp)
        validate_timestamp(parsed_timestamp)

        computed_hash = hashlib.sha256(payload.encrypted_message.encode("utf-8")).hexdigest()
        if computed_hash != payload.message_hash.lower():
            raise ValueError("Ciphertext hash mismatch. Integrity verification failed.")

        verify_signature(
            public_key_pem=sender.public_key_pem,
            message_hash_hex=payload.message_hash,
            signature_b64=payload.digital_signature,
        )

        message_id = next(self._id_counter)
        record = {
            "id": message_id,
            "sender_id": payload.sender_id,
            "recipient_id": payload.recipient_id,
            "kind": payload.kind,
            "title": payload.title,
            "encrypted_message": payload.encrypted_message,
            "encrypted_aes_key": payload.encrypted_aes_key,
            "iv": payload.iv,
            "message_hash": payload.message_hash.lower(),
            "digital_signature": payload.digital_signature,
            "timestamp": parsed_timestamp.isoformat(),
            "nonce": payload.nonce,
            "verification": {
                "hash_valid": True,
                "signature_valid": True,
                "replay_blocked": True,
            },
        }

        self.messages.append(record)
        self.seen_nonces.add(nonce_key)
        return record

    def get_conversation(self, first_user_id: str, second_user_id: str) -> list[dict[str, Any]]:
        chat = [
            message
            for message in self.messages
            if {message["sender_id"], message["recipient_id"]} == {first_user_id, second_user_id}
        ]
        return sorted(chat, key=lambda message: message["timestamp"])

    def metrics(self, first_user_id: str, second_user_id: str) -> dict[str, Any]:
        messages = self.get_conversation(first_user_id, second_user_id)
        total_messages = len(messages)
        kind_counts = {
            kind: len([message for message in messages if message["kind"] == kind])
            for kind in ["chat", "task", "note", "friend_request"]
        }
        return {
            "total_messages": total_messages,
            "ciphertext_only_storage": True,
            "signature_verification_rate": "100%" if total_messages else "0%",
            "kind_counts": kind_counts,
        }


def validate_public_key(public_key_pem: str) -> None:
    try:
        serialization.load_pem_public_key(public_key_pem.encode("utf-8"))
    except ValueError as exc:
        raise ValueError("Invalid RSA public key.") from exc


def parse_timestamp(value: str) -> datetime:
    normalised = value.replace("Z", "+00:00")
    try:
        parsed = datetime.fromisoformat(normalised)
    except ValueError as exc:
        raise ValueError("Timestamp must be ISO-8601 compatible.") from exc

    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=UTC)
    return parsed.astimezone(UTC)


def validate_timestamp(timestamp: datetime) -> None:
    now = datetime.now(UTC)
    if timestamp > now + timedelta(seconds=MAX_CLOCK_SKEW_SECONDS):
        raise ValueError("Message timestamp is too far in the future.")
    if timestamp < now - timedelta(hours=MAX_MESSAGE_AGE_HOURS):
        raise ValueError("Message timestamp is too old for replay-safe delivery.")


def verify_signature(public_key_pem: str, message_hash_hex: str, signature_b64: str) -> None:
    public_key = serialization.load_pem_public_key(public_key_pem.encode("utf-8"))
    hash_bytes = bytes.fromhex(message_hash_hex)
    signature_bytes = b64decode(signature_b64)

    try:
        public_key.verify(
            signature_bytes,
            hash_bytes,
            padding.PKCS1v15(),
            hashes.SHA256(),
        )
    except InvalidSignature as exc:
        raise ValueError("Digital signature verification failed.") from exc
