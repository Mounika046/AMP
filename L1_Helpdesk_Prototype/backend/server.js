const http = require("http");
const { URL } = require("url");
const crypto = require("crypto");
const {
  categories,
  documents,
  tickets,
  settings,
  profiles,
  tools,
  metrics,
  logs,
  answerForMessage,
  buildTrace,
} = require("./mockData");

const PORT = Number(process.env.PORT || 4188);

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload, null, 2);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,PATCH,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  res.end(body);
}

function notFound(res) {
  sendJson(res, 404, { error: "Endpoint not found" });
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 1_000_000) {
        req.destroy();
        reject(new Error("Request body too large"));
      }
    });
    req.on("end", () => {
      if (!raw) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch (error) {
        reject(error);
      }
    });
  });
}

function nextTicketId() {
  const numeric = tickets
    .map((ticket) => Number(String(ticket.id).replace("HD-", "")))
    .filter(Number.isFinite);
  return `HD-${Math.max(...numeric, 10480) + 1}`;
}

function nowDisplay() {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(
    now.getHours()
  )}:${pad(now.getMinutes())}`;
}

async function handleApi(req, res, pathname) {
  if (req.method === "OPTIONS") {
    sendJson(res, 200, { ok: true });
    return;
  }

  if (req.method === "GET" && pathname === "/api/health") {
    sendJson(res, 200, {
      status: "ok",
      service: "L1 HelpDesk Agent mock backend",
      timestamp: new Date().toISOString(),
    });
    return;
  }

  if (req.method === "GET" && pathname === "/api/documents") {
    await wait(220);
    sendJson(res, 200, { documents });
    return;
  }

  if (req.method === "POST" && pathname === "/api/documents/upload") {
    const body = await parseBody(req);
    await wait(850);
    const names = Array.isArray(body.files) && body.files.length ? body.files : ["Uploaded policy draft.pdf"];
    const created = names.map((fileName, index) => ({
      id: `doc-upload-${crypto.randomUUID().slice(0, 8)}-${index}`,
      fileName,
      category: body.category || "IT Support",
      status: "Processing",
      pages: Math.max(4, Number(body.pages || 12) + index),
      chunks: 0,
      lastUpdated: nowDisplay(),
      owner: "Prototype Admin",
      health: 72,
      chunksPreview: [],
    }));
    documents.unshift(...created);
    sendJson(res, 201, {
      uploaded: created,
      pipeline: ["Upload", "Extract text", "Chunk", "Generate embeddings", "Store in vector store", "Ready for retrieval"],
    });
    return;
  }

  if (req.method === "GET" && pathname === "/api/categories") {
    sendJson(res, 200, { categories });
    return;
  }

  if (req.method === "POST" && pathname === "/api/categories") {
    const body = await parseBody(req);
    const name = String(body.name || "").trim();
    if (!name) {
      sendJson(res, 400, { error: "Category name is required" });
      return;
    }
    const category = {
      id: `cat-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`,
      name,
      color: "blue",
      documentCount: 0,
    };
    categories.push(category);
    sendJson(res, 201, { category });
    return;
  }

  if (req.method === "GET" && pathname === "/api/settings") {
    sendJson(res, 200, { settings, profiles, tools });
    return;
  }

  if (req.method === "PATCH" && pathname.startsWith("/api/settings/")) {
    const key = decodeURIComponent(pathname.split("/").pop());
    const body = await parseBody(req);
    if (!Object.prototype.hasOwnProperty.call(settings, key)) {
      sendJson(res, 404, { error: `Unknown setting: ${key}` });
      return;
    }
    settings[key] = body.value;
    sendJson(res, 200, { key, value: settings[key], settings });
    return;
  }

  if (req.method === "POST" && pathname === "/api/chat") {
    const body = await parseBody(req);
    await wait(950);
    const result = answerForMessage(body.message);
    const trace = buildTrace(result);
    const response = {
      id: `chat-${crypto.randomUUID().slice(0, 8)}`,
      message: body.message || "",
      ...result,
      trace,
      retrieval: result.sources.map((source) => ({
        document: source.document,
        page: source.page,
        section: source.section,
        similarityScore: source.score,
        contribution: source.score > 0.85 ? "Primary grounding" : "Supporting evidence",
      })),
      ociServices:
        "In production this response would use OCI Responses API, Embeddings, OCI Vector Store, Tool Calling, and Agent Memory.",
    };

    logs.unshift({
      id: `log-${crypto.randomUUID().slice(0, 6)}`,
      userQuery: response.message,
      responseSummary: response.answer.slice(0, 96),
      fullAnswer: response.answer,
      category: response.category,
      sourcesUsed: response.sources.map((source) => source.document),
      toolsCalled: ["route_question", "search_knowledge_base"],
      ticketCreated: false,
      latency: "1.8s",
      confidence: response.confidence,
      timestamp: nowDisplay(),
      trace,
      retrieval: response.retrieval.map((item) => ({
        document: item.document,
        page: item.page,
        score: item.similarityScore,
      })),
    });

    sendJson(res, 200, response);
    return;
  }

  if (req.method === "POST" && pathname === "/api/tickets") {
    const body = await parseBody(req);
    await wait(600);
    const ticket = {
      id: nextTicketId(),
      subject: body.subject || "HelpDesk support request",
      description: body.description || "Created from L1 HelpDesk Agent prototype.",
      category: body.category || "IT Support",
      priority: body.priority || "Medium",
      status: "New",
      employee: body.employee || "Demo User",
      email: body.email || "demo.user@example.com",
      createdAt: nowDisplay(),
      owner: "Unassigned",
      timeline: [
        { time: "Now", title: "Ticket created", detail: "Created from HelpDesk Agent escalation." },
        {
          time: "Next",
          title: "Queue routing",
          detail:
            "In production, tool calling can route this to Oracle HR Helpdesk or an Oracle-backed ticketing workflow.",
        },
      ],
    };
    tickets.unshift(ticket);
    sendJson(res, 201, { ticket });
    return;
  }

  if (req.method === "GET" && pathname === "/api/tickets") {
    await wait(180);
    sendJson(res, 200, { tickets });
    return;
  }

  if (req.method === "GET" && pathname === "/api/logs") {
    await wait(240);
    sendJson(res, 200, { logs });
    return;
  }

  if (req.method === "GET" && pathname === "/api/metrics") {
    sendJson(res, 200, { metrics });
    return;
  }

  notFound(res);
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (url.pathname.startsWith("/api/")) {
      await handleApi(req, res, url.pathname);
      return;
    }
    notFound(res);
  } catch (error) {
    sendJson(res, 500, { error: error.message || "Unexpected server error" });
  }
});

server.listen(PORT, () => {
  console.log(`L1 HelpDesk mock backend listening on http://localhost:${PORT}`);
});
