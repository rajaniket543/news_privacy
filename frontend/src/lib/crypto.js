const encoder = new TextEncoder();
const decoder = new TextDecoder();

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";

  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return window.btoa(binary);
}

function base64ToUint8Array(value) {
  const binary = window.atob(value);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function stringToPem(label, base64Body) {
  const lines = base64Body.match(/.{1,64}/g) ?? [];
  return `-----BEGIN ${label}-----\n${lines.join("\n")}\n-----END ${label}-----`;
}

function pemToBase64(pem) {
  return pem.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
}

async function exportPublicPem(key) {
  const exported = await window.crypto.subtle.exportKey("spki", key);
  return stringToPem("PUBLIC KEY", arrayBufferToBase64(exported));
}

async function importPublicKeyFromPem(pem, algorithm, usages) {
  const binary = base64ToUint8Array(pemToBase64(pem));
  return window.crypto.subtle.importKey(
    "spki",
    binary,
    algorithm,
    true,
    usages
  );
}

async function importPrivateKeyFromJwk(jwk, algorithm, usages) {
  return window.crypto.subtle.importKey("jwk", jwk, algorithm, true, usages);
}

async function importPublicKeyFromJwk(jwk, algorithm, usages) {
  return window.crypto.subtle.importKey("jwk", jwk, algorithm, true, usages);
}

async function sha256Hex(value) {
  const digest = await window.crypto.subtle.digest("SHA-256", encoder.encode(value));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function hexToUint8Array(hex) {
  const pairs = hex.match(/.{1,2}/g) ?? [];
  return Uint8Array.from(pairs, (pair) => parseInt(pair, 16));
}

function serialiseIdentity(identity) {
  return {
    userId: identity.userId,
    displayName: identity.displayName,
    publicPem: identity.publicPem,
    publicJwk: identity.publicJwk,
    privateJwk: identity.privateJwk,
  };
}

export async function buildIdentity({ userId, displayName, existingIdentity }) {
  if (existingIdentity) {
    const decryptPrivateKey = await importPrivateKeyFromJwk(
      existingIdentity.privateJwk,
      {
        name: "RSA-OAEP",
        hash: "SHA-256",
      },
      ["decrypt"]
    );
    const signPrivateKey = await importPrivateKeyFromJwk(
      existingIdentity.privateJwk,
      {
        name: "RSASSA-PKCS1-v1_5",
        hash: "SHA-256",
      },
      ["sign"]
    );
    const encryptPublicKey = await importPublicKeyFromJwk(
      existingIdentity.publicJwk,
      {
        name: "RSA-OAEP",
        hash: "SHA-256",
      },
      ["encrypt"]
    );
    const verifyPublicKey = await importPublicKeyFromJwk(
      existingIdentity.publicJwk,
      {
        name: "RSASSA-PKCS1-v1_5",
        hash: "SHA-256",
      },
      ["verify"]
    );

    return {
      ...existingIdentity,
      decryptPrivateKey,
      signPrivateKey,
      encryptPublicKey,
      verifyPublicKey,
      serialised: serialiseIdentity(existingIdentity),
    };
  }

  const keyPair = await window.crypto.subtle.generateKey(
    {
      name: "RSA-OAEP",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["encrypt", "decrypt"]
  );

  const publicJwk = await window.crypto.subtle.exportKey("jwk", keyPair.publicKey);
  const privateJwk = await window.crypto.subtle.exportKey("jwk", keyPair.privateKey);
  const verifyPublicKey = await importPublicKeyFromJwk(
    publicJwk,
    {
      name: "RSASSA-PKCS1-v1_5",
      hash: "SHA-256",
    },
    ["verify"]
  );
  const signPrivateKey = await importPrivateKeyFromJwk(
    privateJwk,
    {
      name: "RSASSA-PKCS1-v1_5",
      hash: "SHA-256",
    },
    ["sign"]
  );
  const publicPem = await exportPublicPem(keyPair.publicKey);

  const identity = {
    userId,
    displayName,
    publicPem,
    publicJwk,
    privateJwk,
    decryptPrivateKey: keyPair.privateKey,
    signPrivateKey,
    encryptPublicKey: keyPair.publicKey,
    verifyPublicKey,
  };

  return {
    ...identity,
    serialised: serialiseIdentity(identity),
  };
}

export async function encryptMessage({
  plaintext,
  senderIdentity,
  recipientPublicPem,
  kind,
  title,
}) {
  const aesKey = await window.crypto.subtle.generateKey(
    {
      name: "AES-GCM",
      length: 256,
    },
    true,
    ["encrypt", "decrypt"]
  );

  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const ciphertextBuffer = await window.crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv,
    },
    aesKey,
    encoder.encode(plaintext)
  );
  const rawAesKey = await window.crypto.subtle.exportKey("raw", aesKey);
  const recipientEncryptKey = await importPublicKeyFromPem(
    recipientPublicPem,
    {
      name: "RSA-OAEP",
      hash: "SHA-256",
    },
    ["encrypt"]
  );
  const encryptedAesKeyBuffer = await window.crypto.subtle.encrypt(
    {
      name: "RSA-OAEP",
    },
    recipientEncryptKey,
    rawAesKey
  );

  const encrypted_message = arrayBufferToBase64(ciphertextBuffer);
  const encrypted_aes_key = arrayBufferToBase64(encryptedAesKeyBuffer);
  const message_hash = await sha256Hex(encrypted_message);
  const digitalSignatureBuffer = await window.crypto.subtle.sign(
    {
      name: "RSASSA-PKCS1-v1_5",
    },
    senderIdentity.signPrivateKey,
    hexToUint8Array(message_hash)
  );

  return {
    sender_id: senderIdentity.userId,
    kind,
    title: title?.trim() ? title.trim() : null,
    encrypted_message,
    encrypted_aes_key,
    iv: arrayBufferToBase64(iv),
    message_hash,
    digital_signature: arrayBufferToBase64(digitalSignatureBuffer),
    timestamp: new Date().toISOString(),
    nonce: window.crypto.randomUUID(),
  };
}

export async function decryptMessage({ record, recipientIdentity, senderIdentity }) {
  const recalculatedHash = await sha256Hex(record.encrypted_message);
  const hashValid = recalculatedHash === record.message_hash;
  const signatureValid = await window.crypto.subtle.verify(
    {
      name: "RSASSA-PKCS1-v1_5",
    },
    senderIdentity.verifyPublicKey,
    base64ToUint8Array(record.digital_signature),
    hexToUint8Array(record.message_hash)
  );

  const decryptedAesKey = await window.crypto.subtle.decrypt(
    {
      name: "RSA-OAEP",
    },
    recipientIdentity.decryptPrivateKey,
    base64ToUint8Array(record.encrypted_aes_key)
  );
  const aesKey = await window.crypto.subtle.importKey(
    "raw",
    decryptedAesKey,
    {
      name: "AES-GCM",
    },
    false,
    ["decrypt"]
  );
  const plaintextBuffer = await window.crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: base64ToUint8Array(record.iv),
    },
    aesKey,
    base64ToUint8Array(record.encrypted_message)
  );

  return {
    plaintext: decoder.decode(plaintextBuffer),
    hashValid,
    signatureValid,
  };
}
