import { useEffect, useState } from "react";
import axios from "axios";
import Navbar from "../components/Navbar";
import { buildIdentity, decryptMessage, encryptMessage } from "../lib/crypto";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000";

const IDENTITY_STORAGE_KEY = "habitflow-secure-identities";

const demoUsers = [
  { userId: "alice", displayName: "Aniket" },
  { userId: "bob", displayName: "Ansh" },
];

const techniqueCards = [
  {
    title: "Hybrid Encryption",
    value: "RSA-2048 + AES-256-GCM",
    detail: "AES handles fast payload encryption, while RSA protects the session key.",
  },
  {
    title: "Integrity",
    value: "SHA-256",
    detail: "Every ciphertext is hashed before it is accepted into storage.",
  },
  {
    title: "Authentication",
    value: "Digital signatures",
    detail: "The receiver verifies the sender with an RSA signature check.",
  },
  {
    title: "Replay Defense",
    value: "Timestamp + nonce",
    detail: "The backend rejects duplicate nonces and stale payloads.",
  },
];

const securityMetrics = [
  { label: "MITM resistance", value: "Encrypted AES key" },
  { label: "Server visibility", value: "Ciphertext only" },
  { label: "Friend workflow", value: "Secure requests" },
  { label: "Project scope", value: "Chat, tasks, notes" },
];

function kindLabel(kind) {
  if (kind === "friend_request") {
    return "Friend request";
  }

  return kind.charAt(0).toUpperCase() + kind.slice(1);
}

function shortHash(value) {
  return `${value.slice(0, 10)}...${value.slice(-8)}`;
}

function formatTimestamp(value) {
  return new Date(value).toLocaleString();
}

function Home({ theme, toggleTheme }) {
  const [identities, setIdentities] = useState({});
  const [messages, setMessages] = useState([]);
  const [selectedMessageId, setSelectedMessageId] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [status, setStatus] = useState("Preparing secure devices");
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState("");
  const [composer, setComposer] = useState({
    senderId: "alice",
    recipientId: "bob",
    kind: "chat",
    title: "",
    plaintext:
      "Your study sprint starts at 9 PM. I encrypted the task note before sending it.",
  });

  useEffect(() => {
    initialiseDemo();
  }, []);

  async function initialiseDemo() {
    setIsBootstrapping(true);
    setError("");
    setStatus("Generating RSA key pairs");

    try {
      const storedIdentities = JSON.parse(
        window.localStorage.getItem(IDENTITY_STORAGE_KEY) ?? "{}"
      );
      const builtEntries = await Promise.all(
        demoUsers.map(async (user) => {
          const identity = await buildIdentity({
            userId: user.userId,
            displayName: user.displayName,
            existingIdentity: storedIdentities[user.userId],
          });
          return [user.userId, identity];
        })
      );
      const identityMap = Object.fromEntries(builtEntries);

      window.localStorage.setItem(
        IDENTITY_STORAGE_KEY,
        JSON.stringify(
          Object.fromEntries(
            Object.entries(identityMap).map(([userId, identity]) => [
              userId,
              identity.serialised,
            ])
          )
        )
      );

      setIdentities(identityMap);
      setStatus("Registering public keys");

      await Promise.all(
        Object.values(identityMap).map((identity) =>
          axios.post(`${API_BASE_URL}/users/register`, {
            user_id: identity.userId,
            display_name: identity.displayName,
            public_key_pem: identity.publicPem,
          })
        )
      );

      await refreshConversation(identityMap);
      setStatus("Secure channel ready");
    } catch (bootError) {
      const detail =
        bootError.response?.data?.detail ??
        bootError.message ??
        "Unable to initialise the secure demo.";
      setError(detail);
      setStatus("Initialisation failed");
    } finally {
      setIsBootstrapping(false);
    }
  }

  async function refreshConversation(identityMap = identities) {
    const response = await axios.get(
      `${API_BASE_URL}/conversations/alice/bob`
    );
    const decryptedMessages = await Promise.all(
      response.data.messages.map(async (record) => {
        try {
          const decrypted = await decryptMessage({
            record,
            recipientIdentity: identityMap[record.recipient_id],
            senderIdentity: identityMap[record.sender_id],
          });

          return {
            ...record,
            plaintext: decrypted.plaintext,
            clientVerification: {
              hashValid: decrypted.hashValid,
              signatureValid: decrypted.signatureValid,
            },
          };
        } catch (decryptError) {
          return {
            ...record,
            plaintext: "Unable to decrypt payload with current key material.",
            clientVerification: {
              hashValid: false,
              signatureValid: false,
            },
            decryptError: decryptError.message,
          };
        }
      })
    );

    setMessages(decryptedMessages);
    setMetrics(response.data.metrics);
    if (decryptedMessages.length > 0) {
      setSelectedMessageId(decryptedMessages[decryptedMessages.length - 1].id);
    }
  }

  async function handleSend(event) {
    event.preventDefault();
    setError("");

    if (!composer.plaintext.trim()) {
      setError("Enter a message, task, note, or friend request first.");
      return;
    }

    const senderIdentity = identities[composer.senderId];
    const recipientIdentity = identities[composer.recipientId];
    if (!senderIdentity || !recipientIdentity) {
      setError("Device identities are still loading.");
      return;
    }

    setIsSending(true);
    setStatus("Encrypting with AES-256-GCM");

    try {
      const encryptedPayload = await encryptMessage({
        plaintext: composer.plaintext.trim(),
        senderIdentity,
        recipientPublicPem: recipientIdentity.publicPem,
        kind: composer.kind,
        title: composer.title,
      });

      setStatus("Uploading ciphertext and signature");

      await axios.post(`${API_BASE_URL}/messages`, {
        ...encryptedPayload,
        recipient_id: composer.recipientId,
      });

      await refreshConversation();
      setComposer((current) => ({
        ...current,
        title: "",
        plaintext: "",
      }));
      setStatus("Secure channel ready");
    } catch (sendError) {
      const detail =
        sendError.response?.data?.detail ??
        sendError.message ??
        "Secure message delivery failed.";
      setError(detail);
      setStatus("Delivery failed");
    } finally {
      setIsSending(false);
    }
  }

  async function handleResetDemo() {
    setStatus("Resetting secure storage");
    setError("");

    try {
      await axios.post(`${API_BASE_URL}/demo/reset`);
      await Promise.all(
        Object.values(identities).map((identity) =>
          axios.post(`${API_BASE_URL}/users/register`, {
            user_id: identity.userId,
            display_name: identity.displayName,
            public_key_pem: identity.publicPem,
          })
        )
      );
      await refreshConversation();
      setStatus("Secure channel ready");
    } catch (resetError) {
      const detail =
        resetError.response?.data?.detail ??
        resetError.message ??
        "Unable to reset the demo.";
      setError(detail);
      setStatus("Reset failed");
    }
  }

  const selectedMessage =
    messages.find((message) => message.id === selectedMessageId) ?? null;

  return (
    <div className="min-h-screen">
      <Navbar theme={theme} toggleTheme={toggleTheme} status={status} />

      <main className="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">
        <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-[2rem] border border-white/60 bg-white/85 p-7 shadow-[0_30px_80px_rgba(15,23,42,0.12)] backdrop-blur-xl dark:border-slate-800/80 dark:bg-slate-950/75">
            <p className="text-sm font-semibold uppercase tracking-[0.35em] text-cyan-700 dark:text-cyan-300">
              Project brief mapped into a live demo
            </p>
            <h2 className="mt-4 max-w-3xl text-4xl font-semibold leading-tight text-slate-950 dark:text-white sm:text-5xl">
              Two-user secure communication with end-to-end encryption,
              signatures, and integrity proofs.
            </h2>
            <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-600 dark:text-slate-300">
              This app simulates HabitFlow Secure with two people exchanging
              chats, task assignments, private notes, and friend requests.
              Plaintext stays in the browser; the backend stores only ciphertext
              plus the cryptographic metadata required by your CNS project.
            </p>

            <div className="mt-8 grid gap-4 md:grid-cols-2">
              {techniqueCards.map((card) => (
                <article
                  key={card.title}
                  className="rounded-[1.5rem] border border-slate-200/70 bg-slate-50/90 p-5 dark:border-slate-800 dark:bg-slate-900/80"
                >
                  <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500 dark:text-slate-400">
                    {card.title}
                  </p>
                  <p className="mt-3 text-xl font-semibold text-slate-950 dark:text-white">
                    {card.value}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                    {card.detail}
                  </p>
                </article>
              ))}
            </div>
          </div>

          <div className="rounded-[2rem] border border-cyan-200/70 bg-[linear-gradient(135deg,rgba(6,182,212,0.12),rgba(14,165,233,0.04),rgba(248,250,252,0.9))] p-6 shadow-[0_30px_80px_rgba(6,182,212,0.14)] dark:border-cyan-950/80 dark:bg-[linear-gradient(135deg,rgba(8,47,73,0.85),rgba(2,6,23,0.92))]">
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-800 dark:text-cyan-300">
              Demo devices
            </p>
            <div className="mt-5 space-y-4">
              {demoUsers.map((user) => {
                const identity = identities[user.userId];
                return (
                  <article
                    key={user.userId}
                    className="rounded-[1.5rem] border border-white/60 bg-white/80 p-5 dark:border-slate-800 dark:bg-slate-950/70"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500 dark:text-slate-400">
                          {user.userId}
                        </p>
                        <h3 className="mt-2 text-xl font-semibold text-slate-950 dark:text-white">
                          {user.displayName}
                        </h3>
                      </div>
                      <div className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300">
                        {identity ? "RSA ready" : "Creating"}
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 text-sm text-slate-600 dark:text-slate-300">
                      <div className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-900">
                        Encryption key: RSA-2048 public/private pair
                      </div>
                      <div className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-900">
                        Signature key: same RSA material reused for signature
                        verification
                      </div>
                      <div className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-900">
                        Public key fingerprint:{" "}
                        {identity ? shortHash(identity.publicPem.replace(/\s/g, "")) : "..."}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <section className="rounded-[2rem] border border-white/60 bg-white/85 p-6 shadow-[0_25px_70px_rgba(15,23,42,0.12)] backdrop-blur-xl dark:border-slate-800/80 dark:bg-slate-950/75">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.28em] text-slate-500 dark:text-slate-400">
                  Secure composer
                </p>
                <h3 className="mt-2 text-2xl font-semibold text-slate-950 dark:text-white">
                  Encrypt before upload
                </h3>
              </div>
              <button
                type="button"
                onClick={handleResetDemo}
                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-cyan-500 hover:text-cyan-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              >
                Reset demo
              </button>
            </div>

            <form className="mt-6 space-y-4" onSubmit={handleSend}>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                    Sender
                  </span>
                  <select
                    value={composer.senderId}
                    onChange={(event) =>
                      setComposer((current) => ({
                        ...current,
                        senderId: event.target.value,
                        recipientId:
                          event.target.value === "alice" ? "bob" : "alice",
                      }))
                    }
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-cyan-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                  >
                    {demoUsers.map((user) => (
                      <option key={user.userId} value={user.userId}>
                        {user.displayName}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                    Payload type
                  </span>
                  <select
                    value={composer.kind}
                    onChange={(event) =>
                      setComposer((current) => ({
                        ...current,
                        kind: event.target.value,
                      }))
                    }
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-cyan-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                  >
                    <option value="chat">Chat</option>
                    <option value="task">Task assignment</option>
                    <option value="note">Secure note</option>
                    <option value="friend_request">Friend request</option>
                  </select>
                </label>
              </div>

              <label className="block space-y-2">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                  Title
                </span>
                <input
                  value={composer.title}
                  onChange={(event) =>
                    setComposer((current) => ({
                      ...current,
                      title: event.target.value,
                    }))
                  }
                  placeholder="Optional heading for tasks, notes, or requests"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-cyan-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                />
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                  Plaintext content
                </span>
                <textarea
                  rows="6"
                  value={composer.plaintext}
                  onChange={(event) =>
                    setComposer((current) => ({
                      ...current,
                      plaintext: event.target.value,
                    }))
                  }
                  placeholder="Type the content that should be encrypted with AES-256-GCM."
                  className="w-full rounded-[1.75rem] border border-slate-200 bg-slate-50 px-4 py-4 text-slate-900 outline-none transition focus:border-cyan-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                />
              </label>

              {error ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900/80 dark:bg-rose-950/60 dark:text-rose-300">
                  {error}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={isBootstrapping || isSending}
                className="w-full rounded-[1.75rem] bg-slate-950 px-5 py-4 text-sm font-semibold uppercase tracking-[0.25em] text-white transition hover:-translate-y-0.5 hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-cyan-500 dark:text-slate-950"
              >
                {isSending ? "Encrypting and sending..." : "Send secure payload"}
              </button>
            </form>

            <div className="mt-6 grid gap-3 md:grid-cols-2">
              {securityMetrics.map((metric) => (
                <div
                  key={metric.label}
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900"
                >
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {metric.label}
                  </p>
                  <p className="mt-2 text-lg font-semibold text-slate-950 dark:text-white">
                    {metric.value}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section className="space-y-6">
            <article className="rounded-[2rem] border border-white/60 bg-white/85 p-6 shadow-[0_25px_70px_rgba(15,23,42,0.12)] backdrop-blur-xl dark:border-slate-800/80 dark:bg-slate-950/75">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.28em] text-slate-500 dark:text-slate-400">
                    Conversation timeline
                  </p>
                  <h3 className="mt-2 text-2xl font-semibold text-slate-950 dark:text-white">
                    Decrypted only on the receiving device
                  </h3>
                </div>
                <div className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                  {metrics?.total_messages ?? 0} secure items
                </div>
              </div>

              <div className="mt-6 space-y-4">
                {messages.length === 0 ? (
                  <div className="rounded-[1.75rem] border border-dashed border-slate-300 p-8 text-center text-slate-500 dark:border-slate-700 dark:text-slate-400">
                    Send the first encrypted payload to populate the secure
                    conversation.
                  </div>
                ) : (
                  messages.map((message) => (
                    <button
                      type="button"
                      key={message.id}
                      onClick={() => setSelectedMessageId(message.id)}
                      className={`w-full rounded-[1.6rem] border p-5 text-left transition ${
                        selectedMessageId === message.id
                          ? "border-cyan-500 bg-cyan-50 shadow-[0_10px_35px_rgba(6,182,212,0.18)] dark:border-cyan-400 dark:bg-cyan-950/30"
                          : "border-slate-200 bg-slate-50 hover:border-cyan-300 dark:border-slate-800 dark:bg-slate-900"
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
                            {kindLabel(message.kind)}
                          </p>
                          <h4 className="mt-2 text-lg font-semibold text-slate-950 dark:text-white">
                            {message.title || message.plaintext}
                          </h4>
                        </div>
                        <div className="text-right text-sm text-slate-500 dark:text-slate-400">
                          <div>{formatTimestamp(message.timestamp)}</div>
                          <div>
                            {identities[message.sender_id]?.displayName} to{" "}
                            {identities[message.recipient_id]?.displayName}
                          </div>
                        </div>
                      </div>
                      {message.title ? (
                        <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
                          {message.plaintext}
                        </p>
                      ) : null}
                      <div className="mt-4 flex flex-wrap gap-2 text-xs font-medium">
                        <span className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300">
                          Hash {message.clientVerification.hashValid ? "verified" : "failed"}
                        </span>
                        <span className="rounded-full bg-sky-100 px-3 py-1 text-sky-700 dark:bg-sky-950/70 dark:text-sky-300">
                          Signature{" "}
                          {message.clientVerification.signatureValid
                            ? "verified"
                            : "failed"}
                        </span>
                        <span className="rounded-full bg-violet-100 px-3 py-1 text-violet-700 dark:bg-violet-950/70 dark:text-violet-300">
                          Nonce protected
                        </span>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </article>

            <article className="rounded-[2rem] border border-white/60 bg-white/85 p-6 shadow-[0_25px_70px_rgba(15,23,42,0.12)] backdrop-blur-xl dark:border-slate-800/80 dark:bg-slate-950/75">
              <p className="text-sm font-semibold uppercase tracking-[0.28em] text-slate-500 dark:text-slate-400">
                Payload inspector
              </p>
              <h3 className="mt-2 text-2xl font-semibold text-slate-950 dark:text-white">
                What the server stores
              </h3>

              {selectedMessage ? (
                <div className="mt-6 space-y-4">
                  <div className="rounded-[1.5rem] bg-slate-50 p-4 dark:bg-slate-900">
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
                      Decrypted payload
                    </p>
                    <p className="mt-3 text-base leading-7 text-slate-700 dark:text-slate-200">
                      {selectedMessage.plaintext}
                    </p>
                  </div>

                  {[
                    ["Ciphertext", selectedMessage.encrypted_message],
                    ["Encrypted AES key", selectedMessage.encrypted_aes_key],
                    ["IV", selectedMessage.iv],
                    ["SHA-256 hash", selectedMessage.message_hash],
                    ["Digital signature", selectedMessage.digital_signature],
                    ["Nonce", selectedMessage.nonce],
                  ].map(([label, value]) => (
                    <div
                      key={label}
                      className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900"
                    >
                      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
                        {label}
                      </p>
                      <p className="mt-3 break-all font-mono text-xs leading-6 text-slate-700 dark:text-slate-200">
                        {value}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-6 rounded-[1.5rem] border border-dashed border-slate-300 p-8 text-center text-slate-500 dark:border-slate-700 dark:text-slate-400">
                  Select a message to inspect the encrypted payload and its
                  crypto proof.
                </div>
              )}
            </article>
          </section>
        </section>
      </main>
    </div>
  );
}

export default Home;
