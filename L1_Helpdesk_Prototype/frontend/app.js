const API_BASE = "http://localhost:4188/api";

const state = {
  role: "Admin",
  adminView: "dashboard",
  userView: "chat",
  loading: true,
  error: "",
  documents: [],
  categories: [],
  settings: null,
  profiles: [],
  tools: [],
  metrics: null,
  tickets: [],
  logs: [],
  selectedProfileId: "profile-it",
  selectedTicketId: null,
  modal: null,
  drawer: null,
  toast: "",
  filters: {
    knowledge: {
      query: "",
      category: "All categories",
      status: "All statuses",
    },
    monitoring: {
      dateRange: "Last 7 days",
      category: "All categories",
      escalatedOnly: false,
      lowConfidenceOnly: false,
    },
  },
  chatPending: false,
  chatInput: "",
  chatMessages: [
    {
      id: "welcome",
      role: "assistant",
      content:
        "Hi, I am the L1 HelpDesk Agent. I can help with IT support, HCM, payroll, onboarding, and access questions. Ask a question or choose a suggested prompt.",
      confidence: 0.98,
      status: "Ready",
      sources: [],
      suggestedPrompts: [
        "How do I reset my VPN?",
        "How do I request laptop replacement?",
        "What is the onboarding checklist?",
        "How can I update payroll details?",
      ],
    },
  ],
};

const nav = {
  Admin: [
    { id: "dashboard", label: "Dashboard", icon: "DB" },
    { id: "knowledge", label: "Knowledge Base", icon: "KB" },
    { id: "agent", label: "Agent Customization", icon: "AI" },
    { id: "monitoring", label: "Monitoring", icon: "MN" },
    { id: "settings", label: "Settings", icon: "ST" },
  ],
  User: [
    { id: "chat", label: "Ask HelpDesk", icon: "AS" },
    { id: "tickets", label: "My Tickets", icon: "TK" },
    { id: "topics", label: "Help Topics", icon: "HP" },
  ],
};

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function slug(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function confidenceLabel(value) {
  return `${Math.round(Number(value || 0) * 100)}% confidence`;
}

function badgeClass(value) {
  return slug(value).replace("not-configured", "not-configured");
}

function badge(value, extra = "") {
  return `<span class="badge ${badgeClass(value)} ${extra}">${escapeHtml(value)}</span>`;
}

function button(label, attrs = "", tone = "") {
  return `<button class="button ${tone}" ${attrs}>${label}</button>`;
}

function displayServiceName(service) {
  return String(service).replace(/OCI Vector Search/g, "OCI Vector Store");
}

function option(value, selectedValue) {
  return `<option ${value === selectedValue ? "selected" : ""}>${escapeHtml(value)}</option>`;
}

function parseTimestamp(timestamp) {
  if (timestamp === "Just now") return new Date();
  const match = String(timestamp || "").match(/^(\d{4})-(\d{2})-(\d{2})(?:\s+(\d{2}):(\d{2}))?/);
  if (!match) return null;
  return new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    Number(match[4] || 0),
    Number(match[5] || 0)
  );
}

function newestLogDate() {
  return state.logs
    .map((log) => parseTimestamp(log.timestamp))
    .filter(Boolean)
    .reduce((latest, date) => (date > latest ? date : latest), new Date(0));
}

function isWithinDateRange(timestamp, range) {
  const date = parseTimestamp(timestamp);
  if (!date) return true;

  const now = newestLogDate();
  if (range === "Today") {
    return date.toDateString() === now.toDateString();
  }

  const days = range === "Last 30 days" ? 30 : 7;
  const start = new Date(now);
  start.setDate(now.getDate() - days);
  start.setHours(0, 0, 0, 0);
  return date >= start && date <= now;
}

function filteredDocuments() {
  const { query, category, status } = state.filters.knowledge;
  const normalizedQuery = query.trim().toLowerCase();

  return state.documents.filter((doc) => {
    const matchesQuery =
      !normalizedQuery ||
      [doc.fileName, doc.owner, doc.category, doc.status]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalizedQuery));
    const matchesCategory = category === "All categories" || doc.category === category;
    const matchesStatus = status === "All statuses" || doc.status === status;
    return matchesQuery && matchesCategory && matchesStatus;
  });
}

function filteredLogs() {
  const { dateRange, category, escalatedOnly, lowConfidenceOnly } = state.filters.monitoring;

  return state.logs.filter((log) => {
    const matchesDate = isWithinDateRange(log.timestamp, dateRange);
    const matchesCategory = category === "All categories" || log.category === category;
    const matchesEscalation = !escalatedOnly || log.ticketCreated;
    const matchesConfidence = !lowConfidenceOnly || Number(log.confidence) < 0.8;
    return matchesDate && matchesCategory && matchesEscalation && matchesConfidence;
  });
}

async function api(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${response.status}`);
  }
  return response.json();
}

async function loadData() {
  state.loading = true;
  state.error = "";
  render();
  try {
    const [documents, categories, settings, tickets, logs, metrics] =
      await Promise.all([
        api("/documents"),
        api("/categories"),
        api("/settings"),
        api("/tickets"),
        api("/logs"),
        api("/metrics"),
      ]);

    state.documents = documents.documents;
    state.categories = categories.categories;
    state.settings = settings.settings;
    state.profiles = settings.profiles;
    state.tools = settings.tools;
    state.tickets = tickets.tickets;
    state.logs = logs.logs;
    state.metrics = metrics.metrics;
  } catch (error) {
    state.error = `${error.message}. Start the backend with npm run start:backend.`;
  } finally {
    state.loading = false;
    render();
  }
}

function setToast(message) {
  state.toast = message;
  render();
  window.clearTimeout(setToast.timer);
  setToast.timer = window.setTimeout(() => {
    state.toast = "";
    render();
  }, 2600);
}

function currentView() {
  return state.role === "Admin" ? state.adminView : state.userView;
}

function pageMeta() {
  const view = currentView();
  const map = {
    dashboard: {
      kicker: "Admin console",
      title: "L1 HelpDesk Agent operations",
      description:
        "Monitor the reusable agent framework, knowledge health, automation activity, and OCI-powered service readiness.",
    },
    knowledge: {
      kicker: "Knowledge operations",
      title: "Knowledge Base management",
      description:
        "Upload, categorize, index, and inspect enterprise documents used for retrieval-grounded answers.",
    },
    agent: {
      kicker: "Reusable agent framework",
      title: "Agent customization",
      description:
        "Switch profiles, tune persona, adjust retrieval controls, and configure tool behavior for future marketplace-ready assistants.",
    },
    monitoring: {
      kicker: "Observability",
      title: "Monitoring and review",
      description:
        "Inspect conversations, retrieved sources, execution traces, tool calls, latency, confidence, and escalation outcomes.",
    },
    settings: {
      kicker: "Pipeline configuration",
      title: "Settings",
      description:
        "Configure pipeline behaviour. Changes take effect on the next request.",
    },
    chat: {
      kicker: "Employee experience",
      title: "Ask HelpDesk",
      description:
        "Ask IT, HCM, payroll, onboarding, and access questions. Answers include confidence, source citations, and escalation options.",
    },
    tickets: {
      kicker: "Employee support",
      title: "My tickets",
      description: "Track support tickets created by the agent or submitted through the employee helpdesk.",
    },
    topics: {
      kicker: "Self-service",
      title: "Help topics",
      description: "Browse common enterprise helpdesk topics and launch guided prompts.",
    },
  };
  return map[view] || map.dashboard;
}

function render() {
  const app = document.querySelector("#app");
  const meta = pageMeta();
  const activeNav = nav[state.role];
  app.innerHTML = `
    <div class="app-shell">
      <header class="topbar">
        <div class="brand">
          <div class="brand-mark">L1</div>
          <div>
            <div class="brand-title">L1 HelpDesk Agent</div>
            <div class="brand-subtitle">prototype</div>
          </div>
        </div>
        <div class="topbar-actions">
          <span class="environment-pill">mock backend</span>
          <label class="role-control">
            <span>Role</span>
            <select data-action="role-change" aria-label="Select role">
              <option ${state.role === "Admin" ? "selected" : ""}>Admin</option>
              <option ${state.role === "User" ? "selected" : ""}>User</option>
            </select>
          </label>
        </div>
      </header>
      <aside class="sidebar">
        <div class="nav-section-label">${state.role}</div>
        ${activeNav
          .map(
            (item) => `
              <button class="nav-button ${currentView() === item.id ? "active" : ""}" data-action="nav" data-view="${item.id}">
                <span class="nav-icon">${item.icon}</span>
                <span class="nav-text">${item.label}</span>
              </button>
            `
          )
          .join("")}
        <div class="sidebar-note">
          Powered in production by OCI Responses API, Embeddings, OCI Vector Store, Tool Calling, Agent Memory, and observability.
        </div>
      </aside>
      <main class="main">
        <section class="page">
          <div class="page-header">
            <div>
              <div class="page-kicker">${meta.kicker}</div>
              <h1>${meta.title}</h1>
              <p class="page-description">${meta.description}</p>
            </div>
            <div class="page-actions">
              ${state.role === "Admin" ? button("Refresh data", 'data-action="refresh"', "ghost") : ""}
              ${
                state.role === "User"
                  ? button("Create ticket", 'data-action="open-ticket-modal"', "primary")
                  : button("View framework trace", 'data-action="open-framework-drawer"', "primary")
              }
            </div>
          </div>
          ${renderMainContent()}
        </section>
      </main>
    </div>
    ${renderModal()}
    ${renderDrawer()}
    ${state.toast ? `<div class="toast">${escapeHtml(state.toast)}</div>` : ""}
  `;
}

function renderMainContent() {
  if (state.loading) {
    return renderLoading();
  }

  if (state.error) {
    return `<div class="error">${escapeHtml(state.error)}</div>`;
  }

  if (state.role === "User") {
    if (state.userView === "chat") return renderChatView();
    if (state.userView === "tickets") return renderTicketsView();
    return renderHelpTopicsView();
  }

  if (state.adminView === "dashboard") return renderDashboardView();
  if (state.adminView === "knowledge") return renderKnowledgeView();
  if (state.adminView === "agent") return renderAgentView();
  if (state.adminView === "monitoring") return renderMonitoringView();
  return renderSettingsView();
}

function renderLoading() {
  return `
    <div class="grid cols-3">
      ${Array.from({ length: 6 })
        .map(
          () => `
            <div class="panel metric-card">
              <div class="skeleton" style="width: 48%;"></div>
              <div class="skeleton" style="width: 72%; height: 34px;"></div>
              <div class="skeleton" style="width: 36%;"></div>
            </div>
          `
        )
        .join("")}
    </div>
  `;
}

function renderDashboardView() {
  const metricCards = [
    ["Total documents", state.metrics.totalDocuments, "+12 this month"],
    ["Indexed chunks", state.metrics.indexedChunks.toLocaleString(), "+8.4%"],
    ["Questions answered", state.metrics.questionsAnswered.toLocaleString(), "+18%"],
    ["Tickets created", state.metrics.ticketsCreated, "-3.1% escalations"],
    ["Escalation rate", state.metrics.escalationRate, "Within target"],
    ["Avg response time", state.metrics.averageResponseTime, "P95 2.6s"],
    ["KB health", state.metrics.knowledgeBaseHealth, "4 docs need review"],
    ["Agent status", state.metrics.agentStatus, "All tools available"],
  ];

  return `
    <div class="grid cols-4">
      ${metricCards
        .map(
          ([label, value, trend]) => `
            <div class="panel metric-card">
              <div>
                <div class="metric-label">${label}</div>
                <div class="metric-value">${value}</div>
              </div>
              <div class="metric-trend">${trend}</div>
            </div>
          `
        )
        .join("")}
    </div>

    <div class="grid cols-2" style="margin-top: 16px;">
      <div class="panel">
        <div class="panel-header">
          <div>
            <h2>Agent activity trend</h2>
            <p class="panel-subtitle">Answered questions compared with ticket escalations.</p>
          </div>
          ${badge("Healthy")}
        </div>
        <div class="panel-body">
          <div class="chart-bars">
            ${state.metrics.weeklyTrends
              .map(
                (item) => `
                  <div class="bar-stack">
                    <div style="display: grid; align-items: end; height: 160px;">
                      <div>
                        <div class="bar" style="height: ${Math.round(item.answered / 5)}px;"></div>
                        <div class="bar-escalated" style="height: ${Math.max(10, item.escalated / 2)}px;"></div>
                      </div>
                    </div>
                    <div class="bar-label">${item.label}</div>
                  </div>
                `
              )
              .join("")}
          </div>
        </div>
      </div>

      <div class="panel">
        <div class="panel-header">
          <div>
            <h2>OCI services used</h2>
          </div>
        </div>
        <div class="panel-body">
          <div class="tag-list">
            ${state.metrics.ociServicesUsed.map((service) => `<span class="tag">${escapeHtml(displayServiceName(service))}</span>`).join("")}
          </div>
          <div class="grid cols-2" style="margin-top: 18px;">
            ${renderServiceCallout("Responses API", "Reasoning, orchestration, response generation, and tool calling.")}
            ${renderServiceCallout("Embeddings", "Document and query vectors for retrieval-grounded answers.")}
            ${renderServiceCallout("OCI Vector Store", "Retrieval over indexed chunks and source metadata.")}
            ${renderServiceCallout("Monitoring", "Audit trails, latency, confidence, and escalation tracking.")}
          </div>
        </div>
      </div>
    </div>

    <div class="panel" style="margin-top: 16px;">
      <div class="panel-header">
        <div>
          <h2>Agent configuration profiles</h2>
          <p class="panel-subtitle">The same RAG agent framework can power multiple enterprise assistants.</p>
        </div>
        ${button("Customize agent", 'data-action="nav" data-view="agent"', "ghost")}
      </div>
      <div class="panel-body">
        <div class="grid cols-4">
          ${state.profiles.map(renderProfileCard).join("")}
        </div>
      </div>
    </div>
  `;
}

function renderServiceCallout(title, text) {
  return `
    <div class="topic-card">
      <div class="card-head">
        <h3>${title}</h3>
        <span class="icon-box">OCI</span>
      </div>
      <p class="card-text">${text}</p>
    </div>
  `;
}

function renderProfileCard(profile) {
  return `
    <div class="profile-card ${state.selectedProfileId === profile.id ? "selected" : ""}" data-action="select-profile" data-id="${profile.id}">
      <div class="card-head">
        <h3>${escapeHtml(profile.name)}</h3>
        ${badge(profile.status)}
      </div>
      <p class="card-text">${escapeHtml(profile.persona)}</p>
      <div class="mini-metrics">
        <div class="mini-metric"><span>Confidence</span><strong>${Math.round(profile.metrics.confidence * 100)}%</strong></div>
        <div class="mini-metric"><span>Deflection</span><strong>${profile.metrics.deflection}</strong></div>
        <div class="mini-metric"><span>Latency</span><strong>${profile.metrics.avgLatency}</strong></div>
      </div>
    </div>
  `;
}

function renderKnowledgeView() {
  const documents = filteredDocuments();
  const categories = ["All categories", ...state.categories.map((category) => category.name)];
  const statuses = ["All statuses", ...Array.from(new Set(state.documents.map((doc) => doc.status)))];

  return `
    <div class="split">
      <div class="panel">
        <div class="panel-header">
          <div>
            <h2>Documents</h2>
            <p class="panel-subtitle">Manage uploaded source content and inspect generated chunks.</p>
          </div>
          ${button("Simulate upload", 'data-action="simulate-upload"', "primary")}
        </div>
        <div class="panel-body">
          <div class="upload-zone">
            <div>
              <div class="upload-title">Drop files to index knowledge</div>
              <p class="upload-text">Prototype upload simulates extraction, chunking, embeddings, vector storage, and readiness for search.</p>
            </div>
            <div class="filters">
              <select class="toolbar-select" data-field="upload-category">
                ${state.categories.map((category) => `<option>${escapeHtml(category.name)}</option>`).join("")}
              </select>
              ${button("Upload sample policy", 'data-action="simulate-upload"', "")}
            </div>
          </div>

          <div class="toolbar" style="margin-top: 18px;">
            <div class="filters">
              <input class="search-input" placeholder="Filter documents" data-filter-scope="knowledge" data-filter-key="query" value="${escapeHtml(
                state.filters.knowledge.query
              )}" />
              <select class="toolbar-select" data-filter-scope="knowledge" data-filter-key="category">
                ${categories.map((item) => option(item, state.filters.knowledge.category)).join("")}
              </select>
              <select class="toolbar-select" data-filter-scope="knowledge" data-filter-key="status">
                ${statuses.map((item) => option(item, state.filters.knowledge.status)).join("")}
              </select>
            </div>
            <span class="tag">${documents.length} of ${state.documents.length} documents</span>
          </div>

          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>File</th>
                  <th>Category</th>
                  <th>Status</th>
                  <th>Pages</th>
                  <th>Chunks</th>
                  <th>Last updated</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                ${
                  documents.length
                    ? documents
                        .map(
                          (doc) => `
                      <tr>
                        <td>
                          <div class="table-title">${escapeHtml(doc.fileName)}</div>
                          <div class="table-subtitle">${escapeHtml(doc.owner)} - KB health ${doc.health}%</div>
                        </td>
                        <td>${badge(doc.category, "blue")}</td>
                        <td>${badge(doc.status)}</td>
                        <td>${doc.pages}</td>
                        <td>${doc.chunks}</td>
                        <td>${escapeHtml(doc.lastUpdated)}</td>
                        <td>
                          <div class="row-actions">
                            ${button("Chunks", `data-action="open-chunks" data-id="${doc.id}"`, "small")}
                            ${button(doc.status === "Failed" ? "Retry" : "Pipeline", `data-action="open-pipeline" data-id="${doc.id}"`, "small ghost")}
                          </div>
                        </td>
                      </tr>
                    `
                        )
                        .join("")
                    : `<tr><td colspan="7"><div class="empty">No documents match the selected filters.</div></td></tr>`
                }
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div class="grid">
        <div class="panel">
          <div class="panel-header">
            <div>
              <h2>Categories</h2>
              <p class="panel-subtitle">Reusable retrieval scopes for future enterprise agents.</p>
            </div>
          </div>
          <div class="panel-body">
            <div class="tag-list">
              ${state.categories
                .map(
                  (category) =>
                    `<span class="tag">${escapeHtml(category.name)} <strong>${category.documentCount}</strong></span>`
                )
                .join("")}
            </div>
            <form class="field" style="margin-top: 16px;" data-action="create-category">
              <label for="category-name">Create category</label>
              <div class="composer-row">
                <input id="category-name" name="name" placeholder="Example: Facilities" />
                ${button("Add", 'type="submit"', "primary")}
              </div>
            </form>
            <div class="row-actions" style="margin-top: 12px;">
              ${button("Rename selected", 'data-action="prototype-toast" data-message="Rename category is mocked for this prototype."', "")}
              ${button("Delete selected", 'data-action="prototype-toast" data-message="Delete category is mocked for this prototype."', "danger")}
            </div>
          </div>
        </div>

        <div class="panel">
          <div class="panel-header">
            <div>
              <h2>Indexing pipeline</h2>
              <p class="panel-subtitle">Mock workflow that production would run with OCI services.</p>
            </div>
          </div>
          <div class="panel-body">
            ${renderPipeline()}
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderPipeline() {
  const steps = [
    ["Upload", "Document arrives from admin UI or enterprise repository."],
    ["Extract text", "OCR and parsers prepare text and metadata."],
    ["Chunk", "Content is split into retrieval-ready segments."],
    ["Generate embeddings", "OCI Embeddings converts chunks into vectors."],
    ["Store in vector store", "Vectors and metadata are saved to OCI Vector Store."],
    ["Ready for retrieval", "The agent can retrieve and cite source chunks."],
  ];
  return `
    <div class="pipeline">
      ${steps
        .map(
          ([title, detail], index) => `
            <div class="pipeline-step">
              <div class="step-number">${index + 1}</div>
              <div>
                <strong>${title}</strong>
                <div class="table-subtitle">${detail}</div>
              </div>
              ${badge(index < 4 ? "Complete" : index === 4 ? "Processing" : "Ready")}
            </div>
          `
        )
        .join("")}
    </div>
  `;
}

function renderAgentView() {
  const selected = state.profiles.find((profile) => profile.id === state.selectedProfileId) || state.profiles[0];
  return `
    <div class="grid cols-4">
      ${state.profiles.map(renderProfileCard).join("")}
    </div>

    <div class="grid cols-2" style="margin-top: 16px;">
      <div class="panel">
        <div class="panel-header">
          <div>
            <h2>Profile details</h2>
            <p class="panel-subtitle">${escapeHtml(selected.name)} configuration preview.</p>
          </div>
          ${badge(selected.status)}
        </div>
        <div class="panel-body">
          <div class="field-grid">
            <div class="field">
              <label>Agent name</label>
              <input value="${escapeHtml(state.settings.agentName)}" data-setting="agentName" />
            </div>
            <div class="field">
              <label>Response tone</label>
              <select data-setting="tone">
                ${["Concise", "Detailed", "Friendly", "Formal"]
                  .map((tone) => `<option ${state.settings.tone === tone ? "selected" : ""}>${tone}</option>`)
                  .join("")}
              </select>
            </div>
            <div class="field full-span">
              <label>Welcome message</label>
              <input value="${escapeHtml(state.settings.welcomeMessage)}" data-setting="welcomeMessage" />
            </div>
            <div class="field full-span">
              <label>System instructions / persona</label>
              <textarea data-setting="persona">${escapeHtml(state.settings.persona)}</textarea>
            </div>
            <div class="field">
              <label>Fallback behavior</label>
              <select data-setting="fallbackBehavior">
                ${["Ask clarifying question", "Create ticket", "Show I do not know"]
                  .map(
                    (behavior) =>
                      `<option ${state.settings.fallbackBehavior === behavior ? "selected" : ""}>${behavior}</option>`
                  )
                  .join("")}
              </select>
            </div>
            <div class="field">
              <label>Ticketing provider</label>
              <select data-setting="ticketingProvider">
                ${["Oracle HR Helpdesk", "Mock/local ticketing"]
                  .map(
                    (provider) =>
                      `<option ${state.settings.ticketingProvider === provider ? "selected" : ""}>${provider}</option>`
                  )
                  .join("")}
              </select>
            </div>
            <div class="field">
              <label>Confidence threshold</label>
              <input type="number" min="0" max="1" step="0.01" value="${state.settings.confidenceThreshold}" data-setting="confidenceThreshold" />
            </div>
            <div class="field">
              <label>Max sources returned</label>
              <input type="number" min="1" max="8" value="${state.settings.maxSources}" data-setting="maxSources" />
            </div>
          </div>
          <div class="tag-list" style="margin-top: 16px;">
            ${selected.knowledgeScope.map((item) => `<span class="tag">${escapeHtml(item)}</span>`).join("")}
          </div>
          <div class="row-actions" style="margin-top: 16px;">
            ${button("Save settings", 'data-action="save-settings"', "primary")}
            ${button("Preview reasoning trace", 'data-action="open-framework-drawer"', "")}
          </div>
        </div>
      </div>

      <div class="panel">
        <div class="panel-header">
          <div>
            <h2>Tool configuration</h2>
            <p class="panel-subtitle">Mock tools exposed through agentic tool calling.</p>
          </div>
        </div>
        <div class="panel-body">
          <div class="grid">
            ${state.tools
              .map(
                (tool) => `
                  <div class="tool-row">
                    <div>
                      <h3>${escapeHtml(tool.name)}</h3>
                      <p class="card-text">${escapeHtml(tool.description)}</p>
                      <div class="tag-list" style="margin-top: 8px;">
                        <span class="tag">Last used ${escapeHtml(tool.lastUsed)}</span>
                        <span class="tag">Success ${escapeHtml(tool.successRate)}</span>
                      </div>
                    </div>
                    <button class="toggle ${tool.enabled ? "on" : ""}" data-action="toggle-tool" data-id="${tool.id}" aria-label="Toggle ${escapeHtml(
                  tool.name
                )}"></button>
                  </div>
                `
              )
              .join("")}
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderMonitoringView() {
  const categories = ["All categories", ...state.categories.map((category) => category.name)];
  const dateRanges = ["Last 7 days", "Today", "Last 30 days"];
  const logs = filteredLogs();

  return `
    <div class="panel">
      <div class="panel-header">
        <div>
          <h2>Conversation logs</h2>
          <p class="panel-subtitle">Click a row to inspect full answer, retrieval visualization, tool trace, and ticket details.</p>
        </div>
        ${badge("Observability")}
      </div>
      <div class="panel-body">
        <div class="toolbar">
          <div class="filters">
            <select class="toolbar-select" data-filter-scope="monitoring" data-filter-key="dateRange">
              ${dateRanges.map((item) => option(item, state.filters.monitoring.dateRange)).join("")}
            </select>
            <select class="toolbar-select" data-filter-scope="monitoring" data-filter-key="category">
              ${categories.map((item) => option(item, state.filters.monitoring.category)).join("")}
            </select>
            <label class="tag"><input type="checkbox" data-filter-scope="monitoring" data-filter-key="escalatedOnly" ${
              state.filters.monitoring.escalatedOnly ? "checked" : ""
            } /> Escalated only</label>
            <label class="tag"><input type="checkbox" data-filter-scope="monitoring" data-filter-key="lowConfidenceOnly" ${
              state.filters.monitoring.lowConfidenceOnly ? "checked" : ""
            } /> Low confidence only</label>
          </div>
          <span class="tag">${logs.length} of ${state.logs.length} conversations</span>
          ${button("Export audit log", 'data-action="prototype-toast" data-message="Audit export is mocked for this prototype."', "")}
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>User query</th>
                <th>Response summary</th>
                <th>Sources</th>
                <th>Tools called</th>
                <th>Ticket</th>
                <th>Latency</th>
                <th>Confidence</th>
                <th>Timestamp</th>
              </tr>
            </thead>
            <tbody>
              ${
                logs.length
                  ? logs
                      .map(
                        (log) => `
                    <tr data-action="open-log" data-id="${log.id}" style="cursor: pointer;">
                      <td><div class="table-title">${escapeHtml(log.userQuery)}</div><div class="table-subtitle">${escapeHtml(log.category)}</div></td>
                      <td>${escapeHtml(log.responseSummary)}</td>
                      <td>${log.sourcesUsed.length}</td>
                      <td>${log.toolsCalled.map((tool) => `<span class="tag">${escapeHtml(tool)}</span>`).join(" ")}</td>
                      <td>${log.ticketCreated ? badge("Yes", "amber") : badge("No", "green")}</td>
                      <td>${escapeHtml(log.latency)}</td>
                      <td>${confidenceLabel(log.confidence)}</td>
                      <td>${escapeHtml(log.timestamp)}</td>
                    </tr>
                  `
                      )
                      .join("")
                  : `<tr><td colspan="8"><div class="empty">No conversations match the selected filters.</div></td></tr>`
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

function settingGroups() {
  return [
    {
      title: "Chunking",
      items: [
        {
          key: "chunkSize",
          label: "Chunk Size",
          description: "Number of tokens per text chunk when splitting documents.",
          defaultValue: 400,
          type: "number",
        },
        {
          key: "chunkOverlap",
          label: "Chunk Overlap",
          description: "Number of overlapping tokens between consecutive chunks.",
          defaultValue: 50,
          type: "number",
        },
        {
          key: "embeddingBatchSize",
          label: "Embedding Batch Size",
          description: "Number of text chunks sent to the embedding API in a single batch.",
          defaultValue: 96,
          type: "number",
        },
      ],
    },
    {
      title: "Retrieval",
      items: [
        {
          key: "vectorStoreTopK",
          label: "Vector Store Top K",
          description: "Maximum number of vector store results returned per query.",
          defaultValue: 5,
          type: "number",
        },
      ],
    },
    {
      title: "LLM",
      items: [
        {
          key: "llmModel",
          label: "Llm Model",
          description: "OCI model ID used to generate answers (Cohere Command).",
          defaultValue: "cohere.command-latest",
          type: "text",
        },
      ],
    },
    {
      title: "UI",
      items: [
        {
          key: "latencyWarnMs",
          label: "Latency Warn Ms",
          description: "Response-time threshold (ms) above which a yellow warning is shown in the UI.",
          defaultValue: 3000,
          type: "number",
        },
        {
          key: "latencyErrorMs",
          label: "Latency Error Ms",
          description: "Response-time threshold (ms) above which a red error indicator is shown in the UI.",
          defaultValue: 8000,
          type: "number",
        },
      ],
    },
  ];
}

function renderSettingItem(item) {
  const value = state.settings?.[item.key] ?? item.defaultValue;
  return `
    <form class="setting-row" data-action="save-pipeline-setting" data-key="${item.key}" data-type="${item.type}">
      <div>
        <h3>${escapeHtml(item.label)}</h3>
        <p class="card-text">${escapeHtml(item.description)}</p>
        <p class="setting-default">Default: ${escapeHtml(item.defaultValue)}</p>
      </div>
      <div class="setting-control">
        <input name="value" type="${item.type === "number" ? "number" : "text"}" value="${escapeHtml(value)}" />
        ${button("Save", 'type="submit"', "primary")}
      </div>
    </form>
  `;
}

function renderSettingsView() {
  return `
    <div class="panel">
      <div class="panel-header">
        <div>
          <h2>Settings</h2>
          <p class="panel-subtitle">Configure pipeline behaviour. Changes take effect on the next request.</p>
        </div>
      </div>
      <div class="panel-body">
        <div class="settings-stack">
          ${settingGroups()
            .map(
              (group) => `
                <section class="settings-group">
                  <h2>${escapeHtml(group.title)}</h2>
                  <div class="setting-list">
                    ${group.items.map(renderSettingItem).join("")}
                  </div>
                </section>
              `
            )
            .join("")}
        </div>
      </div>
    </div>
  `;
}

function renderChatView() {
  const lastAssistant = [...state.chatMessages].reverse().find((message) => message.role === "assistant");
  return `
    <div class="chat-layout">
      <div class="panel chat-panel">
        <div class="panel-header">
          <div>
            <h2>HelpDesk chat</h2>
            <p class="panel-subtitle">Knowledge-grounded answers with citations, confidence, and escalation.</p>
          </div>
          ${badge("Agent online")}
        </div>
        <div class="chat-stream" id="chat-stream">
          ${state.chatMessages.map(renderMessage).join("")}
          ${
            state.chatPending
              ? `<div class="message assistant"><div class="bubble"><span class="typing"><span></span><span></span><span></span></span></div></div>`
              : ""
          }
        </div>
        <form class="chat-composer" data-action="send-chat">
          <div class="prompt-chips">
            ${(lastAssistant?.suggestedPrompts || [])
              .map((prompt) => `<button type="button" class="prompt-chip" data-action="use-prompt" data-prompt="${escapeHtml(prompt)}">${escapeHtml(prompt)}</button>`)
              .join("")}
          </div>
          <div class="composer-row">
            <textarea name="message" placeholder="Ask about VPN, laptop replacement, onboarding, payroll, or access..." ${
              state.chatPending ? "disabled" : ""
            }>${escapeHtml(state.chatInput)}</textarea>
            ${button(state.chatPending ? "Thinking" : "Send", 'type="submit"', "primary")}
          </div>
        </form>
      </div>

      <aside class="chat-side">
        <div class="panel">
          <div class="panel-header">
            <div>
              <h2>Recent tickets</h2>
              <p class="panel-subtitle">Status lookup is mocked through ticket APIs.</p>
            </div>
            ${button("View all", 'data-action="nav" data-view="tickets"', "ghost small")}
          </div>
          <div class="panel-body">
            <div class="grid">
              ${state.tickets.slice(0, 3).map(renderTicketCard).join("")}
            </div>
          </div>
        </div>

      </aside>
    </div>
  `;
}

function renderMessage(message) {
  return `
    <div class="message ${message.role}">
      <div class="bubble">${escapeHtml(message.content)}</div>
      ${
        message.role === "assistant"
          ? `
            <div class="message-meta">
              ${message.status ? badge(message.status, "blue") : ""}
              ${message.confidence ? `<span class="tag">${confidenceLabel(message.confidence)}</span>` : ""}
              ${
                message.trace
                  ? button("Execution trace", `data-action="open-message-trace" data-id="${message.id}"`, "small")
                  : ""
              }
              ${button("Create ticket", 'data-action="open-ticket-modal"', "small ghost")}
            </div>
            ${
              message.sources?.length
                ? `<div class="source-list">${message.sources.map((source, index) => renderSourceCard(source, message.id, index)).join("")}</div>`
                : ""
            }
          `
          : ""
      }
    </div>
  `;
}

function renderSourceCard(source, messageId, index) {
  return `
    <button class="source-card" data-action="open-source" data-message-id="${messageId}" data-index="${index}">
      <div class="source-title">
        <span>${escapeHtml(source.document)}</span>
        <span>${Math.round(source.score * 100)}%</span>
      </div>
      <div class="source-preview">Page ${escapeHtml(source.page)}, ${escapeHtml(source.section)} - ${escapeHtml(source.preview)}</div>
    </button>
  `;
}

function renderTicketCard(ticket) {
  return `
    <div class="ticket-card" data-action="open-ticket" data-id="${ticket.id}" style="cursor: pointer;">
      <div class="card-head">
        <h3>${escapeHtml(ticket.id)}</h3>
        ${badge(ticket.status)}
      </div>
      <p class="card-text">${escapeHtml(ticket.subject)}</p>
      <div class="tag-list" style="margin-top: 10px;">
        <span class="tag">${escapeHtml(ticket.priority)} priority</span>
        <span class="tag">${escapeHtml(ticket.category)}</span>
      </div>
    </div>
  `;
}

function renderTicketsView() {
  return `
    <div class="panel">
      <div class="panel-header">
        <div>
          <h2>Recent tickets</h2>
          <p class="panel-subtitle">Click a ticket to see details and timeline.</p>
        </div>
        ${button("Create ticket", 'data-action="open-ticket-modal"', "primary")}
      </div>
      <div class="panel-body">
        <div class="grid cols-3">
          ${state.tickets.map(renderTicketCard).join("")}
        </div>
      </div>
    </div>
  `;
}

function renderHelpTopicsView() {
  const topics = [
    ["VPN and remote access", "Reset VPN profile, MFA checks, device certificates.", "How do I reset my VPN?"],
    ["Laptop replacement", "Eligibility, asset details, hardware review tickets.", "How do I request laptop replacement?"],
    ["Onboarding", "Day-one readiness, manager tasks, badge and training.", "What is the onboarding checklist?"],
    ["Payroll", "Payment methods, bank details, payroll lock timing.", "How can I update payroll details?"],
    ["Access management", "SSO, MFA, app access, group membership.", "Why does MFA fail?"],
    ["Human handoff", "Create a support ticket when the answer is not enough.", "Create support ticket"],
  ];

  return `
    <div class="grid cols-3">
      ${topics
        .map(
          ([title, text, prompt]) => `
            <div class="topic-card">
              <div class="card-head">
                <h3>${title}</h3>
                <span class="icon-box">HP</span>
              </div>
              <p class="card-text">${text}</p>
              <div class="row-actions" style="margin-top: 14px;">
                ${button("Ask", `data-action="topic-ask" data-prompt="${escapeHtml(prompt)}"`, "primary")}
              </div>
            </div>
          `
        )
        .join("")}
    </div>
  `;
}

function renderModal() {
  if (!state.modal) return "";

  if (state.modal.type === "ticket") return renderTicketModal();
  if (state.modal.type === "source") return renderSourceModal();
  if (state.modal.type === "chunks") return renderChunksModal();
  if (state.modal.type === "pipeline") return renderPipelineModal();
  return "";
}

function renderTicketModal() {
  return `
    <div class="overlay">
      <div class="modal">
        <div class="modal-header">
          <div>
            <h2>Create support ticket</h2>
            <p class="panel-subtitle">In production this could connect to Oracle HR Helpdesk or an Oracle-backed ticketing workflow.</p>
          </div>
          <button class="close-button" data-action="close-modal">X</button>
        </div>
        <form class="modal-body" data-action="submit-ticket">
          <div class="field-grid">
            <div class="field full-span">
              <label>Subject</label>
              <input name="subject" required value="${escapeHtml(state.modal.subject || "")}" placeholder="Brief summary" />
            </div>
            <div class="field full-span">
              <label>Description</label>
              <textarea name="description" required placeholder="Describe the issue or request">${escapeHtml(
                state.modal.description || ""
              )}</textarea>
            </div>
            <div class="field">
              <label>Category</label>
              <select name="category">${state.categories.map((category) => `<option>${escapeHtml(category.name)}</option>`).join("")}</select>
            </div>
            <div class="field">
              <label>Priority</label>
              <select name="priority"><option>Low</option><option selected>Medium</option><option>High</option></select>
            </div>
            <div class="field">
              <label>Employee/contact</label>
              <input name="employee" value="Demo User" />
            </div>
            <div class="field">
              <label>Email</label>
              <input name="email" type="email" value="demo.user@example.com" />
            </div>
          </div>
          <div class="row-actions" style="margin-top: 18px;">
            ${button("Create ticket", 'type="submit"', "primary")}
            ${button("Cancel", 'type="button" data-action="close-modal"', "")}
          </div>
        </form>
      </div>
    </div>
  `;
}

function renderSourceModal() {
  const source = state.modal.source;
  return `
    <div class="overlay">
      <div class="modal">
        <div class="modal-header">
          <div>
            <h2>Source details</h2>
            <p class="panel-subtitle">${escapeHtml(source.document)} - page ${escapeHtml(source.page)}</p>
          </div>
          <button class="close-button" data-action="close-modal">X</button>
        </div>
        <div class="modal-body">
          <div class="source-card">
            <div class="source-title">
              <span>${escapeHtml(source.section)}</span>
              <span>${Math.round(source.score * 100)}% similarity</span>
            </div>
            <p class="source-preview">${escapeHtml(source.preview)}</p>
            <div class="score-bar"><div class="score-fill" style="width: ${Math.round(source.score * 100)}%;"></div></div>
          </div>
          <p class="card-text" style="margin-top: 14px;">This demonstrates source citation expansion. In production, the same view could include chunk text, document permissions, page preview, and retrieval metadata.</p>
        </div>
      </div>
    </div>
  `;
}

function renderChunksModal() {
  const doc = state.documents.find((item) => item.id === state.modal.id);
  return `
    <div class="overlay">
      <div class="modal">
        <div class="modal-header">
          <div>
            <h2>Chunk viewer</h2>
            <p class="panel-subtitle">${escapeHtml(doc?.fileName || "Document")}</p>
          </div>
          <button class="close-button" data-action="close-modal">X</button>
        </div>
        <div class="modal-body">
          ${
            doc?.chunksPreview?.length
              ? `<div class="grid">${doc.chunksPreview
                  .map(
                    (chunk) => `
                      <div class="source-card">
                        <div class="source-title">
                          <span>${escapeHtml(chunk.id)} - page ${chunk.page}</span>
                          <span>${chunk.tokenCount} tokens</span>
                        </div>
                        <p class="source-preview">${escapeHtml(chunk.text)}</p>
                        <div class="score-bar"><div class="score-fill" style="width: ${Math.round((chunk.score || 0.7) * 100)}%;"></div></div>
                      </div>
                    `
                  )
                  .join("")}</div>`
              : `<div class="empty">${escapeHtml(doc?.error || "No chunks are available yet because the document is still processing.")}</div>`
          }
        </div>
      </div>
    </div>
  `;
}

function renderPipelineModal() {
  const doc = state.documents.find((item) => item.id === state.modal.id);
  return `
    <div class="overlay">
      <div class="modal">
        <div class="modal-header">
          <div>
            <h2>Indexing pipeline</h2>
            <p class="panel-subtitle">${escapeHtml(doc?.fileName || "Document")}</p>
          </div>
          <button class="close-button" data-action="close-modal">X</button>
        </div>
        <div class="modal-body">
          ${renderPipeline()}
        </div>
      </div>
    </div>
  `;
}

function renderDrawer() {
  if (!state.drawer) return "";

  if (state.drawer.type === "log") return renderLogDrawer();
  if (state.drawer.type === "ticket") return renderTicketDrawer();
  if (state.drawer.type === "trace") return renderTraceDrawer();
  if (state.drawer.type === "framework") return renderFrameworkDrawer();
  return "";
}

function renderLogDrawer() {
  const log = state.logs.find((item) => item.id === state.drawer.id);
  if (!log) return "";
  return `
    <div class="drawer">
      <div class="drawer-header">
        <div>
          <h2>Conversation detail</h2>
          <p class="panel-subtitle">${escapeHtml(log.timestamp)} - ${escapeHtml(log.category)}</p>
        </div>
        <button class="close-button" data-action="close-drawer">X</button>
      </div>
      <div class="drawer-body">
        <div class="grid">
          <div class="topic-card">
            <h3>User query</h3>
            <p class="card-text">${escapeHtml(log.userQuery)}</p>
          </div>
          <div class="topic-card">
            <h3>Agent answer</h3>
            <p class="card-text">${escapeHtml(log.fullAnswer)}</p>
          </div>
          <div class="topic-card">
            <h3>Retrieved sources</h3>
            <div class="retrieval-list" style="margin-top: 10px;">
              ${renderRetrievalItems(log.retrieval)}
            </div>
          </div>
          <div class="topic-card">
            <h3>Tool trace</h3>
            <div class="reasoning-list" style="margin-top: 10px;">
              ${renderTraceItems(log.trace)}
            </div>
          </div>
          ${
            log.ticketInfo
              ? `<div class="topic-card"><h3>Ticket info</h3><p class="card-text">${escapeHtml(log.ticketInfo)} created through mock ticket tool.</p></div>`
              : ""
          }
        </div>
      </div>
    </div>
  `;
}

function renderTicketDrawer() {
  const ticket = state.tickets.find((item) => item.id === state.drawer.id);
  if (!ticket) return "";
  return `
    <div class="drawer">
      <div class="drawer-header">
        <div>
          <h2>${escapeHtml(ticket.id)}</h2>
          <p class="panel-subtitle">${escapeHtml(ticket.subject)}</p>
        </div>
        <button class="close-button" data-action="close-drawer">X</button>
      </div>
      <div class="drawer-body">
        <div class="grid">
          <div class="topic-card">
            <div class="card-head">
              <h3>Ticket status</h3>
              ${badge(ticket.status)}
            </div>
            <div class="tag-list" style="margin-top: 12px;">
              <span class="tag">${escapeHtml(ticket.priority)} priority</span>
              <span class="tag">${escapeHtml(ticket.category)}</span>
              <span class="tag">Owner ${escapeHtml(ticket.owner)}</span>
              <span class="tag">Created ${escapeHtml(ticket.createdAt)}</span>
            </div>
            <p class="card-text">${escapeHtml(ticket.description)}</p>
          </div>
          <div class="topic-card">
            <h3>Timeline</h3>
            <div class="timeline" style="margin-top: 14px;">
              ${ticket.timeline
                .map(
                  (item) => `
                    <div class="timeline-item">
                      <div class="timeline-time">${escapeHtml(item.time)}</div>
                      <div class="timeline-card">
                        <strong>${escapeHtml(item.title)}</strong>
                        <p class="card-text">${escapeHtml(item.detail)}</p>
                      </div>
                    </div>
                  `
                )
                .join("")}
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderTraceDrawer() {
  const message = state.chatMessages.find((item) => item.id === state.drawer.id);
  if (!message) return "";
  return `
    <div class="drawer">
      <div class="drawer-header">
        <div>
          <h2>Agent reasoning and execution trace</h2>
          <p class="panel-subtitle">Mock trace for demonstration of Enterprise AI orchestration.</p>
        </div>
        <button class="close-button" data-action="close-drawer">X</button>
      </div>
      <div class="drawer-body">
        <div class="grid">
          <div class="topic-card">
            <h3>Execution steps</h3>
            <div class="reasoning-list" style="margin-top: 10px;">
              ${renderTraceItems(message.trace || [])}
            </div>
          </div>
          <div class="topic-card">
            <h3>Knowledge retrieval visualization</h3>
            <div class="retrieval-list" style="margin-top: 10px;">
              ${renderRetrievalItems(message.retrieval || [])}
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderFrameworkDrawer() {
  return `
    <div class="drawer">
      <div class="drawer-header">
        <div>
          <h2>Reusable Enterprise AI agent framework</h2>
          <p class="panel-subtitle">How this L1 HelpDesk prototype maps to future marketplace-ready agents.</p>
        </div>
        <button class="close-button" data-action="close-drawer">X</button>
      </div>
      <div class="drawer-body">
        <div class="grid">
          ${[
            ["1", "Intent understanding", "OCI Responses API classifies request type and chooses a plan."],
            ["2", "Retrieval", "Embeddings and OCI Vector Store retrieve source chunks from the selected knowledge scope."],
            ["3", "Tool selection", "Tool calling can create tickets, check ticket status, route questions, or summarize handoff."],
            ["4", "Response generation", "The agent writes a grounded answer with confidence and citations."],
            ["5", "Review loop", "Monitoring and audit data identify KB updates and prompt improvements."],
          ]
            .map(
              ([num, title, detail]) => `
                <div class="reasoning-step">
                  <div class="step-number">${num}</div>
                  <div>
                    <strong>${title}</strong>
                    <p class="card-text">${detail}</p>
                  </div>
                  ${badge("Mock")}
                </div>
              `
            )
            .join("")}
        </div>
      </div>
    </div>
  `;
}

function renderTraceItems(trace) {
  if (!trace.length) return `<div class="empty">No trace available.</div>`;
  return trace
    .map(
      (item, index) => `
        <div class="reasoning-step">
          <div class="step-number">${index + 1}</div>
          <div>
            <strong>${escapeHtml(item.step)}</strong>
            <p class="card-text">${escapeHtml(item.detail)}</p>
          </div>
          <span class="tag">${escapeHtml(item.timing || "")}</span>
        </div>
      `
    )
    .join("");
}

function renderRetrievalItems(retrieval) {
  if (!retrieval.length) return `<div class="empty">No retrieval data available.</div>`;
  return retrieval
    .map((item) => {
      const score = Number(item.similarityScore ?? item.score ?? 0);
      return `
        <div class="source-card">
          <div class="source-title">
            <span>${escapeHtml(item.document)}</span>
            <span>${Math.round(score * 100)}%</span>
          </div>
          <p class="source-preview">Page ${escapeHtml(item.page)}${item.section ? `, ${escapeHtml(item.section)}` : ""}${
        item.contribution ? ` - ${escapeHtml(item.contribution)}` : ""
      }</p>
          <div class="score-bar"><div class="score-fill" style="width: ${Math.round(score * 100)}%;"></div></div>
        </div>
      `;
    })
    .join("");
}

async function sendChat(form) {
  const formData = new FormData(form);
  const message = String(formData.get("message") || "").trim();
  if (!message || state.chatPending) return;

  state.chatInput = "";
  state.chatPending = true;
  state.chatMessages.push({ id: `user-${Date.now()}`, role: "user", content: message });
  render();
  scrollChatToBottom();

  try {
    const response = await api("/chat", {
      method: "POST",
      body: JSON.stringify({ message }),
    });
    state.chatMessages.push({
      id: response.id,
      role: "assistant",
      content: response.answer,
      confidence: response.confidence,
      status: response.status,
      sources: response.sources,
      trace: response.trace,
      retrieval: response.retrieval,
      suggestedPrompts: response.suggestedPrompts,
    });
    state.logs.unshift({
      id: `log-local-${Date.now()}`,
      userQuery: message,
      responseSummary: response.answer.slice(0, 96),
      fullAnswer: response.answer,
      category: response.category,
      sourcesUsed: response.sources.map((source) => source.document),
      toolsCalled: ["route_question", "search_knowledge_base"],
      ticketCreated: false,
      latency: "1.8s",
      confidence: response.confidence,
      timestamp: "Just now",
      trace: response.trace,
      retrieval: response.retrieval.map((item) => ({
        document: item.document,
        page: item.page,
        score: item.similarityScore,
      })),
    });
  } catch (error) {
    state.chatMessages.push({
      id: `error-${Date.now()}`,
      role: "assistant",
      content: `I could not reach the mock backend. ${error.message}`,
      confidence: 0,
      status: "Error",
      sources: [],
      suggestedPrompts: ["Try again", "Create support ticket"],
    });
  } finally {
    state.chatPending = false;
    render();
    scrollChatToBottom();
  }
}

function scrollChatToBottom() {
  window.setTimeout(() => {
    const stream = document.querySelector("#chat-stream");
    if (stream) stream.scrollTop = stream.scrollHeight;
  }, 0);
}

async function submitTicket(form) {
  const formData = new FormData(form);
  const payload = Object.fromEntries(formData.entries());
  try {
    const result = await api("/tickets", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    state.tickets.unshift(result.ticket);
    state.modal = null;
    state.drawer = { type: "ticket", id: result.ticket.id };
    setToast(`Ticket ${result.ticket.id} created`);
  } catch (error) {
    setToast(error.message);
  }
}

async function simulateUpload() {
  try {
    const categorySelect = document.querySelector('[data-field="upload-category"]');
    const category = categorySelect?.value || "IT Support";
    const result = await api("/documents/upload", {
      method: "POST",
      body: JSON.stringify({
        files: ["Remote Work Support Addendum.pdf"],
        category,
      }),
    });
    state.documents.unshift(...result.uploaded);
    setToast("Sample document uploaded and processing");
  } catch (error) {
    setToast(error.message);
  }
}

async function createCategory(form) {
  const formData = new FormData(form);
  const name = String(formData.get("name") || "").trim();
  if (!name) return;
  try {
    const result = await api("/categories", {
      method: "POST",
      body: JSON.stringify({ name }),
    });
    state.categories.push(result.category);
    setToast(`Category ${result.category.name} created`);
  } catch (error) {
    setToast(error.message);
  }
}

function saveSettings() {
  document.querySelectorAll("[data-setting]").forEach((field) => {
    const key = field.dataset.setting;
    let value = field.value;
    if (field.type === "number") {
      value = Number(value);
    }
    state.settings[key] = value;
  });
  setToast("Settings saved in mock UI");
}

function updateFilterFromElement(target, restoreFocus = false) {
  const scope = target.dataset.filterScope;
  const key = target.dataset.filterKey;
  if (!scope || !key || !state.filters[scope]) return false;

  state.filters[scope][key] = target.type === "checkbox" ? target.checked : target.value;
  const selectionStart = target.selectionStart;
  const selectionEnd = target.selectionEnd;
  render();

  if (restoreFocus) {
    window.requestAnimationFrame(() => {
      const selector = `[data-filter-scope="${scope}"][data-filter-key="${key}"]`;
      const nextTarget = document.querySelector(selector);
      if (nextTarget) {
        nextTarget.focus();
        if (typeof nextTarget.setSelectionRange === "function") {
          nextTarget.setSelectionRange(selectionStart, selectionEnd);
        }
      }
    });
  }

  return true;
}

async function savePipelineSetting(form) {
  const key = form.dataset.key;
  const type = form.dataset.type;
  const formData = new FormData(form);
  let value = formData.get("value");
  if (type === "number") {
    value = Number(value);
  }

  try {
    const result = await api(`/settings/${encodeURIComponent(key)}`, {
      method: "PATCH",
      body: JSON.stringify({ value }),
    });
    state.settings = result.settings;
    setToast(`${key} saved`);
  } catch (error) {
    setToast(error.message);
  }
}

function handleClick(event) {
  const target = event.target.closest("[data-action]");
  if (!target) return;

  const action = target.dataset.action;

  if (action === "nav") {
    if (state.role === "Admin") state.adminView = target.dataset.view;
    else state.userView = target.dataset.view;
    render();
    return;
  }

  if (action === "refresh") {
    loadData();
    return;
  }

  if (action === "select-profile") {
    state.selectedProfileId = target.dataset.id;
    if (state.role === "Admin") state.adminView = "agent";
    render();
    return;
  }

  if (action === "toggle-tool") {
    const tool = state.tools.find((item) => item.id === target.dataset.id);
    if (tool) tool.enabled = !tool.enabled;
    render();
    return;
  }

  if (action === "save-settings") {
    saveSettings();
    return;
  }

  if (action === "simulate-upload") {
    simulateUpload();
    return;
  }

  if (action === "open-chunks") {
    state.modal = { type: "chunks", id: target.dataset.id };
    render();
    return;
  }

  if (action === "open-pipeline") {
    state.modal = { type: "pipeline", id: target.dataset.id };
    render();
    return;
  }

  if (action === "open-log") {
    state.drawer = { type: "log", id: target.dataset.id };
    render();
    return;
  }

  if (action === "open-ticket") {
    state.drawer = { type: "ticket", id: target.dataset.id };
    render();
    return;
  }

  if (action === "open-message-trace") {
    state.drawer = { type: "trace", id: target.dataset.id };
    render();
    return;
  }

  if (action === "open-framework-drawer") {
    state.drawer = { type: "framework" };
    render();
    return;
  }

  if (action === "open-source") {
    const message = state.chatMessages.find((item) => item.id === target.dataset.messageId);
    const source = message?.sources?.[Number(target.dataset.index)];
    if (source) state.modal = { type: "source", source };
    render();
    return;
  }

  if (action === "open-ticket-modal") {
    const lastUser = [...state.chatMessages].reverse().find((message) => message.role === "user");
    state.modal = {
      type: "ticket",
      subject: lastUser ? `Follow up: ${lastUser.content.slice(0, 68)}` : "",
      description: lastUser ? `Question asked in HelpDesk chat: ${lastUser.content}` : "",
    };
    render();
    return;
  }

  if (action === "close-modal") {
    const toast = target.dataset.toast;
    state.modal = null;
    render();
    if (toast) setToast(toast);
    return;
  }

  if (action === "close-drawer") {
    state.drawer = null;
    render();
    return;
  }

  if (action === "use-prompt") {
    state.chatInput = target.dataset.prompt;
    render();
    const textarea = document.querySelector('textarea[name="message"]');
    if (textarea) textarea.focus();
    return;
  }

  if (action === "topic-ask") {
    state.userView = "chat";
    state.chatInput = target.dataset.prompt;
    render();
    return;
  }

  if (action === "prototype-toast") {
    setToast(target.dataset.message || "This interaction is mocked.");
  }
}

function handleChange(event) {
  const target = event.target;
  if (target.dataset.action === "role-change") {
    state.role = target.value;
    render();
    return;
  }

  if (target.dataset.filterScope) {
    updateFilterFromElement(target);
  }
}

function handleSubmit(event) {
  const form = event.target;
  const action = form.dataset.action;
  if (!action) return;
  event.preventDefault();

  if (action === "send-chat") {
    sendChat(form);
  }

  if (action === "submit-ticket") {
    submitTicket(form);
  }

  if (action === "create-category") {
    createCategory(form);
  }

  if (action === "save-pipeline-setting") {
    savePipelineSetting(form);
  }
}

function handleInput(event) {
  if (event.target.dataset.filterScope) {
    updateFilterFromElement(event.target, true);
    return;
  }

  if (event.target.name === "message") {
    state.chatInput = event.target.value;
  }
}

document.addEventListener("click", handleClick);
document.addEventListener("change", handleChange);
document.addEventListener("submit", handleSubmit);
document.addEventListener("input", handleInput);
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    if (state.modal) state.modal = null;
    else if (state.drawer) state.drawer = null;
    render();
  }
});

loadData();
