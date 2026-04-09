# HabitFlow Secure

HabitFlow Secure is a full-stack demo for your Cryptography and Network Security project. It shows secure communication between two people using end-to-end encryption, hybrid cryptography, digital signatures, integrity checks, and replay protection.

## What the app demonstrates

- RSA-2048 key generation for each user device
- AES-256-GCM encryption for every message payload
- RSA-encrypted AES session keys
- SHA-256 hashing for ciphertext integrity verification
- RSA digital signatures for sender authentication
- Nonce and timestamp validation for replay-attack resistance
- Secure flows for chat, task assignment, secure notes, and friend requests

The frontend performs encryption and decryption in the browser, so plaintext stays on the client side. The backend stores only ciphertext and cryptographic metadata.

## Stack

- Frontend: React, Vite, Tailwind CSS, Web Crypto API
- Backend: FastAPI, Pydantic, `cryptography`

## Project structure

```text
project-root/
├── backend/
│   ├── main.py
│   ├── requirements.txt
│   └── utils.py
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   └── Navbar.jsx
│   │   ├── lib/
│   │   │   └── crypto.js
│   │   ├── pages/
│   │   │   └── Home.jsx
│   │   ├── App.jsx
│   │   ├── index.css
│   │   └── main.jsx
│   ├── index.html
│   └── package.json
└── README.md
```

## API overview

### `POST /users/register`

Registers or refreshes a user's RSA public key.

### `POST /messages`

Stores a secure payload:

```json
{
  "sender_id": "alice",
  "recipient_id": "bob",
  "kind": "chat",
  "encrypted_message": "<base64 ciphertext>",
  "encrypted_aes_key": "<base64 RSA-encrypted AES key>",
  "iv": "<base64 iv>",
  "message_hash": "<sha256 hex>",
  "digital_signature": "<base64 signature>",
  "timestamp": "2026-04-01T15:30:00.000Z",
  "nonce": "<uuid>"
}
```

The backend verifies the ciphertext hash, validates the RSA signature using the sender's public key, and rejects replayed nonces.

### `GET /conversations/{userA}/{userB}`

Returns encrypted conversation history plus summary metrics.

## Run locally

### 1. Start the backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload
```

Backend runs at `http://127.0.0.1:8000`.

### 2. Start the frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at `http://127.0.0.1:5173`.

## Verification already completed

- `python3 -m py_compile backend/main.py backend/utils.py`
- `npm run build`

## Notes for your final project presentation

- The app currently uses in-memory backend storage for demo simplicity.
- The cryptography flow is ready to map onto Firebase or Firestore later because the backend never needs plaintext.
- For a production mobile version, private keys should move from browser local storage to platform secure storage.
