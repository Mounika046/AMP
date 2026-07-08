const categories = [
  { id: "cat-it", name: "IT Support", color: "blue", documentCount: 5 },
  { id: "cat-hcm", name: "HCM", color: "green", documentCount: 3 },
  { id: "cat-payroll", name: "Payroll", color: "amber", documentCount: 2 },
  { id: "cat-onboarding", name: "Onboarding", color: "purple", documentCount: 4 },
  { id: "cat-access", name: "Access Management", color: "rose", documentCount: 3 },
];

const documents = [
  {
    id: "doc-vpn",
    fileName: "VPN Reset and Remote Access Guide.pdf",
    category: "IT Support",
    status: "Indexed",
    pages: 18,
    chunks: 64,
    lastUpdated: "2026-06-13 09:45",
    owner: "IT Operations",
    health: 96,
    chunksPreview: [
      {
        id: "chunk-vpn-01",
        page: 4,
        tokenCount: 218,
        score: 0.92,
        text:
          "Employees can reset their VPN profile from the Secure Access portal. After reset, remove the old device binding, restart the VPN client, and sign in with MFA.",
      },
      {
        id: "chunk-vpn-02",
        page: 7,
        tokenCount: 184,
        score: 0.87,
        text:
          "If the VPN client reports certificate mismatch, refresh the device certificate from endpoint management and reconnect after five minutes.",
      },
    ],
  },
  {
    id: "doc-laptop",
    fileName: "Laptop Replacement Policy 2026.docx",
    category: "IT Support",
    status: "Indexed",
    pages: 12,
    chunks: 43,
    lastUpdated: "2026-06-10 15:20",
    owner: "Workplace Technology",
    health: 91,
    chunksPreview: [
      {
        id: "chunk-laptop-01",
        page: 3,
        tokenCount: 196,
        score: 0.89,
        text:
          "Standard laptop replacement is available after thirty-six months, verified hardware failure, or approved role change requiring a different device class.",
      },
    ],
  },
  {
    id: "doc-onboarding",
    fileName: "New Hire Onboarding Checklist.pdf",
    category: "Onboarding",
    status: "Indexed",
    pages: 24,
    chunks: 88,
    lastUpdated: "2026-06-12 11:10",
    owner: "People Operations",
    health: 94,
    chunksPreview: [
      {
        id: "chunk-onboarding-01",
        page: 2,
        tokenCount: 243,
        score: 0.94,
        text:
          "Before day one, confirm laptop delivery, corporate email activation, badge request, payroll profile, and required training assignments.",
      },
    ],
  },
  {
    id: "doc-payroll",
    fileName: "Payroll Self-Service FAQ.pdf",
    category: "Payroll",
    status: "Indexed",
    pages: 16,
    chunks: 52,
    lastUpdated: "2026-06-08 17:00",
    owner: "Payroll Services",
    health: 88,
    chunksPreview: [
      {
        id: "chunk-payroll-01",
        page: 6,
        tokenCount: 205,
        score: 0.86,
        text:
          "Bank details can be updated from Employee Self-Service. Changes submitted before payroll lock are effective in the current cycle.",
      },
    ],
  },
  {
    id: "doc-sso",
    fileName: "SSO and MFA Troubleshooting.md",
    category: "Access Management",
    status: "Processing",
    pages: 9,
    chunks: 21,
    lastUpdated: "2026-06-14 08:30",
    owner: "Identity Team",
    health: 77,
    chunksPreview: [
      {
        id: "chunk-sso-01",
        page: 1,
        tokenCount: 174,
        score: 0.79,
        text:
          "MFA failures should be checked against user enrollment status, device time sync, and conditional access policy assignments.",
      },
    ],
  },
  {
    id: "doc-benefits",
    fileName: "Benefits Enrollment Quick Reference.pdf",
    category: "HCM",
    status: "Failed",
    pages: 31,
    chunks: 0,
    lastUpdated: "2026-06-05 13:25",
    owner: "Benefits Team",
    health: 42,
    chunksPreview: [],
    error: "Document contains scanned pages without OCR text layer.",
  },
];

const tickets = [
  {
    id: "HD-10482",
    subject: "VPN client does not accept MFA code",
    description:
      "The VPN client rejects the MFA code after a device replacement. User can access email but not internal network resources.",
    category: "IT Support",
    priority: "High",
    status: "In Progress",
    employee: "Alex Morgan",
    email: "alex.morgan@example.com",
    createdAt: "2026-06-14 10:22",
    owner: "Network Support",
    timeline: [
      { time: "10:22", title: "Ticket created", detail: "Created from HelpDesk Agent escalation." },
      { time: "10:26", title: "Assigned", detail: "Assigned to Network Support queue." },
      { time: "10:51", title: "Investigation", detail: "Device certificate refresh requested." },
    ],
  },
  {
    id: "HD-10477",
    subject: "Laptop replacement eligibility question",
    description: "Need confirmation on replacement eligibility for an aging developer workstation.",
    category: "IT Support",
    priority: "Medium",
    status: "Waiting",
    employee: "Maya Chen",
    email: "maya.chen@example.com",
    createdAt: "2026-06-13 16:05",
    owner: "Workplace Technology",
    timeline: [
      { time: "16:05", title: "Ticket created", detail: "Request submitted through self-service." },
      { time: "16:12", title: "Waiting", detail: "Awaiting asset age verification." },
    ],
  },
  {
    id: "HD-10451",
    subject: "Payroll bank account update",
    description: "Employee updated banking details and wants confirmation before payroll lock.",
    category: "Payroll",
    priority: "Low",
    status: "Resolved",
    employee: "Jordan Lee",
    email: "jordan.lee@example.com",
    createdAt: "2026-06-11 09:18",
    owner: "Payroll Services",
    timeline: [
      { time: "09:18", title: "Ticket created", detail: "Payroll question escalated by agent." },
      { time: "11:40", title: "Resolved", detail: "Payroll profile update confirmed." },
    ],
  },
];

const settings = {
  agentName: "L1 HelpDesk Agent",
  welcomeMessage: "Hi, I can help with IT, HCM, payroll, onboarding, and access questions.",
  persona:
    "You are a precise enterprise helpdesk assistant. Answer from approved knowledge sources, cite sources, and escalate when confidence is low.",
  tone: "Concise",
  fallbackBehavior: "Ask clarifying question",
  requireCitations: true,
  confidenceThreshold: 0.72,
  maxSources: 4,
  retrievalCategories: ["IT Support", "HCM", "Payroll", "Onboarding", "Access Management"],
  ticketingProvider: "Mock/local ticketing",
  chunkSize: 400,
  chunkOverlap: 50,
  embeddingBatchSize: 96,
  vectorStoreTopK: 5,
  llmModel: "cohere.command-latest",
  latencyWarnMs: 3000,
  latencyErrorMs: 8000,
  tools: {
    knowledgeBaseSearch: true,
    ticketCreation: true,
    ticketStatusLookup: true,
    humanHandoff: true,
  },
};

const profiles = [
  {
    id: "profile-it",
    name: "IT Support Agent",
    status: "Active",
    persona: "Fast, precise IT support assistant for access, devices, VPN, and software issues.",
    instructions:
      "Search IT and Access Management knowledge first. Provide steps, cite sources, and offer escalation for unresolved incidents.",
    knowledgeScope: ["IT Support", "Access Management"],
    enabledTools: ["search_knowledge_base", "create_ticket", "get_ticket_status", "route_question"],
    metrics: { confidence: 0.87, deflection: "71%", avgLatency: "1.7s" },
  },
  {
    id: "profile-hr",
    name: "HR Assistant",
    status: "Ready",
    persona: "Helpful HCM assistant for benefits, policies, employee records, and people operations.",
    instructions:
      "Use HCM-approved policy documents. Avoid legal advice and route sensitive cases to HR operations.",
    knowledgeScope: ["HCM", "Onboarding"],
    enabledTools: ["search_knowledge_base", "route_question", "summarize_conversation"],
    metrics: { confidence: 0.82, deflection: "64%", avgLatency: "1.9s" },
  },
  {
    id: "profile-payroll",
    name: "Payroll Assistant",
    status: "Draft",
    persona: "Accurate payroll support assistant for pay statements, bank details, and payroll dates.",
    instructions:
      "Answer only from payroll source documents. Escalate anything involving corrections or confidential payroll exceptions.",
    knowledgeScope: ["Payroll"],
    enabledTools: ["search_knowledge_base", "create_ticket", "route_question"],
    metrics: { confidence: 0.8, deflection: "58%", avgLatency: "2.1s" },
  },
  {
    id: "profile-onboarding",
    name: "Onboarding Assistant",
    status: "Ready",
    persona: "Warm onboarding guide for new hires, managers, and coordinators.",
    instructions:
      "Provide checklists and next steps by role. Use onboarding and access management sources.",
    knowledgeScope: ["Onboarding", "Access Management", "IT Support"],
    enabledTools: ["search_knowledge_base", "route_question", "summarize_conversation"],
    metrics: { confidence: 0.85, deflection: "69%", avgLatency: "1.8s" },
  },
];

const tools = [
  {
    id: "search_knowledge_base",
    name: "search_knowledge_base",
    enabled: true,
    description: "Retrieves relevant chunks from approved enterprise knowledge sources.",
    lastUsed: "4 minutes ago",
    successRate: "98.4%",
  },
  {
    id: "create_ticket",
    name: "create_ticket",
    enabled: true,
    description: "Creates a support ticket in the configured ticketing provider.",
    lastUsed: "18 minutes ago",
    successRate: "96.7%",
  },
  {
    id: "get_ticket_status",
    name: "get_ticket_status",
    enabled: true,
    description: "Looks up ticket status and timeline for the requesting employee.",
    lastUsed: "27 minutes ago",
    successRate: "97.1%",
  },
  {
    id: "route_question",
    name: "route_question",
    enabled: true,
    description: "Classifies intent and routes the request to the best knowledge domain or queue.",
    lastUsed: "2 minutes ago",
    successRate: "99.0%",
  },
  {
    id: "summarize_conversation",
    name: "summarize_conversation",
    enabled: false,
    description: "Summarizes the conversation before human handoff or audit review.",
    lastUsed: "Yesterday",
    successRate: "94.2%",
  },
];

const metrics = {
  totalDocuments: 128,
  indexedChunks: 9842,
  questionsAnswered: 4826,
  ticketsCreated: 316,
  escalationRate: "6.5%",
  averageResponseTime: "1.8s",
  knowledgeBaseHealth: "91%",
  agentStatus: "Healthy",
  ociServicesUsed: [
    "OCI Responses API",
    "OCI Embeddings",
    "OCI Vector Store",
    "Tool Calling",
    "Agent Memory",
    "Monitoring",
  ],
  weeklyTrends: [
    { label: "Mon", answered: 620, escalated: 39 },
    { label: "Tue", answered: 710, escalated: 44 },
    { label: "Wed", answered: 695, escalated: 42 },
    { label: "Thu", answered: 760, escalated: 48 },
    { label: "Fri", answered: 702, escalated: 46 },
  ],
};

const logs = [
  {
    id: "log-1001",
    userQuery: "How do I reset my VPN?",
    responseSummary: "Provided Secure Access reset steps and MFA troubleshooting guidance.",
    fullAnswer:
      "Reset your VPN profile from the Secure Access portal, remove the old device binding, restart the VPN client, and sign in again with MFA. If the client reports a certificate mismatch, refresh the device certificate before reconnecting.",
    category: "IT Support",
    sourcesUsed: ["VPN Reset and Remote Access Guide.pdf", "SSO and MFA Troubleshooting.md"],
    toolsCalled: ["route_question", "search_knowledge_base"],
    ticketCreated: false,
    latency: "1.5s",
    confidence: 0.91,
    timestamp: "2026-06-15 09:04",
    trace: [
      { step: "Intent understanding", status: "Complete", timing: "120ms", detail: "Detected VPN reset request." },
      { step: "Retrieval", status: "Complete", timing: "430ms", detail: "Retrieved 4 chunks from IT Support." },
      { step: "Tool selection", status: "Complete", timing: "85ms", detail: "No ticket tool required." },
      { step: "Response generation", status: "Complete", timing: "620ms", detail: "Generated cited answer." },
    ],
    retrieval: [
      { document: "VPN Reset and Remote Access Guide.pdf", page: 4, score: 0.92 },
      { document: "SSO and MFA Troubleshooting.md", page: 1, score: 0.79 },
    ],
  },
  {
    id: "log-1002",
    userQuery: "How can I update payroll details?",
    responseSummary: "Explained Employee Self-Service path and payroll lock timing.",
    fullAnswer:
      "Open Employee Self-Service, choose Payroll, then Payment Methods. Updates submitted before payroll lock are effective in the current cycle. Changes after lock move to the next cycle.",
    category: "Payroll",
    sourcesUsed: ["Payroll Self-Service FAQ.pdf"],
    toolsCalled: ["route_question", "search_knowledge_base"],
    ticketCreated: true,
    latency: "1.9s",
    confidence: 0.84,
    timestamp: "2026-06-15 08:41",
    trace: [
      { step: "Intent understanding", status: "Complete", timing: "116ms", detail: "Detected payroll profile update." },
      { step: "Retrieval", status: "Complete", timing: "392ms", detail: "Retrieved payroll self-service chunks." },
      { step: "Tool selection", status: "Complete", timing: "132ms", detail: "Ticket offered for confirmation." },
      { step: "Escalation", status: "Complete", timing: "510ms", detail: "Ticket HD-10451 linked." },
    ],
    retrieval: [{ document: "Payroll Self-Service FAQ.pdf", page: 6, score: 0.86 }],
    ticketInfo: "HD-10451",
  },
  {
    id: "log-1003",
    userQuery: "What is the onboarding checklist?",
    responseSummary: "Listed day-one readiness tasks for new hires.",
    fullAnswer:
      "Before day one, confirm laptop delivery, email activation, badge request, payroll profile, and required training assignments. Managers should confirm team access and first-week meetings.",
    category: "Onboarding",
    sourcesUsed: ["New Hire Onboarding Checklist.pdf"],
    toolsCalled: ["route_question", "search_knowledge_base"],
    ticketCreated: false,
    latency: "1.6s",
    confidence: 0.89,
    timestamp: "2026-06-14 16:38",
    trace: [
      { step: "Intent understanding", status: "Complete", timing: "104ms", detail: "Detected onboarding checklist request." },
      { step: "Retrieval", status: "Complete", timing: "398ms", detail: "Retrieved onboarding checklist chunks." },
      { step: "Response generation", status: "Complete", timing: "590ms", detail: "Generated checklist answer." },
    ],
    retrieval: [{ document: "New Hire Onboarding Checklist.pdf", page: 2, score: 0.94 }],
  },
  {
    id: "log-1004",
    userQuery: "Can I get a new laptop this week?",
    responseSummary: "Explained eligibility and suggested a replacement request.",
    fullAnswer:
      "Replacement is normally available after thirty-six months, verified hardware failure, or an approved role change. If your device is failing, I can create a support ticket for hardware review.",
    category: "IT Support",
    sourcesUsed: ["Laptop Replacement Policy 2026.docx"],
    toolsCalled: ["route_question", "search_knowledge_base", "create_ticket"],
    ticketCreated: true,
    latency: "2.2s",
    confidence: 0.78,
    timestamp: "2026-06-14 14:19",
    trace: [
      { step: "Intent understanding", status: "Complete", timing: "126ms", detail: "Detected device replacement request." },
      { step: "Retrieval", status: "Complete", timing: "442ms", detail: "Retrieved laptop policy chunks." },
      { step: "Tool selection", status: "Complete", timing: "165ms", detail: "Ticket creation recommended." },
      { step: "Escalation", status: "Complete", timing: "640ms", detail: "Ticket HD-10477 linked." },
    ],
    retrieval: [{ document: "Laptop Replacement Policy 2026.docx", page: 3, score: 0.89 }],
    ticketInfo: "HD-10477",
  },
];

function answerForMessage(message) {
  const text = String(message || "").toLowerCase();

  if (text.includes("vpn")) {
    return {
      answer:
        "To reset VPN access, open the Secure Access portal, choose Reset VPN Profile, remove the old device binding, then restart the VPN client and sign in with MFA. If you recently changed devices, wait five minutes after the reset before reconnecting.",
      category: "IT Support",
      confidence: 0.91,
      status: "Answered from knowledge base",
      sources: [
        {
          document: "VPN Reset and Remote Access Guide.pdf",
          section: "Reset VPN profile",
          page: 4,
          preview:
            "Employees can reset their VPN profile from the Secure Access portal and re-enroll the VPN client with MFA.",
          score: 0.92,
        },
        {
          document: "SSO and MFA Troubleshooting.md",
          section: "MFA device checks",
          page: 1,
          preview:
            "MFA failures should be checked against enrollment status, device time sync, and conditional access policy assignments.",
          score: 0.79,
        },
      ],
      suggestedPrompts: ["Create a VPN support ticket", "Why does MFA fail?", "Show my open tickets"],
    };
  }

  if (text.includes("laptop") || text.includes("replacement")) {
    return {
      answer:
        "Laptop replacement is normally available after thirty-six months, verified hardware failure, or an approved role change. If the device is failing, gather the asset tag and a short issue description, then submit a hardware review ticket.",
      category: "IT Support",
      confidence: 0.78,
      status: "Ticket recommended",
      sources: [
        {
          document: "Laptop Replacement Policy 2026.docx",
          section: "Eligibility",
          page: 3,
          preview:
            "Standard laptop replacement is available after thirty-six months, verified hardware failure, or approved role change.",
          score: 0.89,
        },
      ],
      suggestedPrompts: ["Create laptop ticket", "What is my device age?", "Show replacement policy"],
    };
  }

  if (text.includes("onboarding") || text.includes("new hire")) {
    return {
      answer:
        "The onboarding checklist includes laptop delivery, corporate email activation, badge request, payroll profile setup, required training, manager intro, and access validation. New hires should complete profile and payroll tasks before day one when possible.",
      category: "Onboarding",
      confidence: 0.89,
      status: "Answered from knowledge base",
      sources: [
        {
          document: "New Hire Onboarding Checklist.pdf",
          section: "Before day one",
          page: 2,
          preview:
            "Before day one, confirm laptop delivery, corporate email activation, badge request, payroll profile, and required training assignments.",
          score: 0.94,
        },
      ],
      suggestedPrompts: ["Manager onboarding tasks", "Badge request steps", "Required training"],
    };
  }

  if (text.includes("payroll") || text.includes("bank") || text.includes("payment")) {
    return {
      answer:
        "Update payroll details in Employee Self-Service under Payroll > Payment Methods. Changes submitted before payroll lock apply to the current cycle; changes after lock apply to the next cycle. For confirmation, I can create a payroll support ticket.",
      category: "Payroll",
      confidence: 0.84,
      status: "Answered with escalation option",
      sources: [
        {
          document: "Payroll Self-Service FAQ.pdf",
          section: "Payment methods",
          page: 6,
          preview:
            "Bank details can be updated from Employee Self-Service. Changes submitted before payroll lock are effective in the current cycle.",
          score: 0.86,
        },
      ],
      suggestedPrompts: ["Create payroll ticket", "When is payroll lock?", "Show payroll FAQ source"],
    };
  }

  return {
    answer:
      "I found a partial match, but I need one detail to answer confidently. Is this about IT support, HCM, payroll, onboarding, or access management? If you prefer, I can create a support ticket for a human specialist.",
    category: "General",
    confidence: 0.56,
    status: "Clarification needed",
    sources: [
      {
        document: "Enterprise HelpDesk Routing Guide.pdf",
        section: "Intent routing",
        page: 5,
        preview:
          "Questions with low retrieval confidence should ask a clarifying question or route to the proper support queue.",
        score: 0.61,
      },
    ],
    suggestedPrompts: ["Create support ticket", "Ask about VPN", "Ask about onboarding"],
  };
}

function buildTrace(result) {
  const shouldEscalate = result.confidence < 0.8 || result.status.toLowerCase().includes("ticket");

  return [
    {
      step: "Intent understanding",
      status: "Complete",
      timing: "118ms",
      detail: `Classified as ${result.category}. Powered by OCI Responses API reasoning.`,
    },
    {
      step: "Knowledge retrieval",
      status: "Complete",
      timing: "426ms",
      detail: `Retrieved ${result.sources.length} source chunk(s) with OCI Embeddings and OCI Vector Store.`,
    },
    {
      step: "Tool selection",
      status: "Complete",
      timing: "92ms",
      detail: shouldEscalate ? "Ticket tool is available for escalation." : "No external tool required.",
    },
    {
      step: "Response generation",
      status: "Complete",
      timing: "641ms",
      detail: "Generated grounded response with citations and confidence metadata.",
    },
  ];
}

module.exports = {
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
};
