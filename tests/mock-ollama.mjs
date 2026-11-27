/**
 * Azm diagnostic fixture — NOT part of the application.
 *
 * A minimal, clearly-labeled OpenAI-compatible stand-in for Ollama so the
 * Azm provider plumbing (URL normalization, model discovery, chat ping,
 * error staging) can be verified end-to-end on machines without a real
 * Ollama install. Every reply is prefixed "[mock]" and the only model it
 * serves is "mock-llama" — it can never be mistaken for a real model.
 *
 * Run:  bun tests/mock-ollama.mjs   (listens on 127.0.0.1:11434)
 */

import { createServer } from "node:http";

const MODELS = [{ id: "mock-llama", owned_by: "azm-mock" }];

const server = createServer((req, res) => {
  const url = new URL(req.url ?? "/", "http://x");
  res.setHeader("Content-Type", "application/json");

  if (req.method === "GET" && (url.pathname === "/v1/models" || url.pathname === "/api/tags")) {
    if (url.pathname === "/api/tags") {
      res.end(JSON.stringify({ models: MODELS.map((m) => ({ name: m.id })) }));
    } else {
      res.end(JSON.stringify({ object: "list", data: MODELS }));
    }
    return;
  }

  if (req.method === "POST" && (url.pathname === "/v1/chat/completions" || url.pathname === "/api/chat")) {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      res.end(
        JSON.stringify({
          id: "mock-" + Date.now(),
          object: "chat.completion",
          created: Math.floor(Date.now() / 1000),
          model: "mock-llama",
          choices: [
            {
              index: 0,
              message: {
                role: "assistant",
                content: "[mock] connectivity OK — this reply comes from Azm's diagnostic fixture, not a real model.",
              },
              finish_reason: "stop",
            },
          ],
          usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
        })
      );
    });
    return;
  }

  res.statusCode = 404;
  res.end(JSON.stringify({ error: { message: `no route: ${url.pathname}`, code: "not_found" } }));
});

server.listen(11434, "127.0.0.1", () => {
  console.log("[mock-ollama] OpenAI-compatible mock listening on http://127.0.0.1:11434 (models: mock-llama)");
});
