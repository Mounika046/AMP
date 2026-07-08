import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient, type UseMutationResult } from "@tanstack/react-query";
import {
  NavigationList,
  PillarTheme,
  Table as NitroTable,
} from "@idp/nitro-redwood";
import {
  BarChart3,
  Bot,
  Boxes,
  ChevronRight,
  Clock3,
  FileText,
  History,
  LayoutDashboard,
  MessageSquare,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Settings,
  Sparkles,
  Ticket,
  Trash2,
  Upload,
  UserCircle,
  UserRoundCog,
  type LucideIcon,
} from "lucide-react";
import { api } from "./lib/api";
import type {
  Citation,
  Conversation,
  DashboardMetrics,
  DocumentRow,
  ExecutionTrace,
  MonitoringRow,
  Role,
  SettingItem,
  Ticket as TicketType,
} from "./lib/types";
import { confidenceLabel, formatDate } from "./lib/utils";
import { Badge, Button, Card, CardBody, CardHeader, Drawer, EmptyPanel, Input, Select, Textarea } from "./components/ui";

const userNav = [
  { id: "chat", label: "Ask HelpDesk", icon: MessageSquare },
  { id: "tickets", label: "My tickets", icon: Ticket },
  { id: "topics", label: "Help topics", icon: Sparkles },
] as const;

const adminNav = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "knowledge", label: "Knowledge base", icon: FileText },
  { id: "profiles", label: "Agents", icon: UserRoundCog },
  { id: "configuration", label: "Agent Configuration", icon: Settings },
  { id: "monitoring", label: "Monitoring", icon: BarChart3 },
] as const;

const DEFAULT_PROFILE_ID = "general-helpdesk";
const DEMO_USERS = [
  { id: "EMP001", name: "Mounika" },
  { id: "EMP002", name: "Madhuri" },
] as const;

type UserView = (typeof userNav)[number]["id"];
type AdminView = (typeof adminNav)[number]["id"];
type DemoUserId = (typeof DEMO_USERS)[number]["id"];

type ChatItem = {
  role: "user" | "assistant";
  content: string;
  confidence?: number;
  citations?: Citation[];
  suggestedPrompts?: string[];
};

type PageMeta = {
  kicker: string;
  title: string;
  description: string;
  action?: string;
};

function storedRole(): Role {
  const value = window.localStorage.getItem("l1-helpdesk-role");
  return value === "User" || value === "Admin" ? value : "Admin";
}

function storedAdminView(): AdminView {
  const value = window.localStorage.getItem("l1-helpdesk-admin-view");
  return adminNav.some((item) => item.id === value) ? (value as AdminView) : "dashboard";
}

function storedUserView(): UserView {
  const value = window.localStorage.getItem("l1-helpdesk-user-view");
  return userNav.some((item) => item.id === value) ? (value as UserView) : "chat";
}

function storedDemoUserId(): DemoUserId {
  const value = window.localStorage.getItem("l1-helpdesk-demo-user-id");
  return DEMO_USERS.some((user) => user.id === value) ? (value as DemoUserId) : "EMP001";
}

type AgentSetting = {
  key: string;
  label: string;
  description: string;
  defaultValue: string;
};

const AGENT_CONFIG_GROUPS: Array<{ title: string; settings: AgentSetting[] }> = [
  {
    title: "Chunking",
    settings: [
      {
        key: "chunk_size",
        label: "Chunk Size",
        description: "Number of tokens per text chunk when splitting documents.",
        defaultValue: "400",
      },
      {
        key: "chunk_overlap",
        label: "Chunk Overlap",
        description: "Number of overlapping tokens between consecutive chunks.",
        defaultValue: "50",
      },
    ],
  },
  {
    title: "Retrieval",
    settings: [
      {
        key: "vector_store_top_k",
        label: "Vector Store Top K",
        description: "Maximum number of vector store results returned per query.",
        defaultValue: "5",
      },
    ],
  },
  {
    title: "LLM",
    settings: [
      {
        key: "llm_model",
        label: "Llm Model",
        description: "OCI model ID used to generate answers. Leave blank to use OCI_FILE_SEARCH_MODEL from .env.",
        defaultValue: "",
      },
    ],
  },
  {
    title: "UI",
    settings: [
      {
        key: "latency_warn_ms",
        label: "Latency Warn Ms",
        description: "Response-time threshold (ms) above which a yellow warning is shown in the UI.",
        defaultValue: "3000",
      },
      {
        key: "latency_error_ms",
        label: "Latency Error Ms",
        description: "Response-time threshold (ms) above which a red error indicator is shown in the UI.",
        defaultValue: "8000",
      },
    ],
  },
];

const AGENT_CONFIG_DEFAULTS = AGENT_CONFIG_GROUPS.flatMap((group) => group.settings).reduce<Record<string, string>>(
  (values, setting) => {
    values[setting.key] = setting.defaultValue;
    return values;
  },
  {}
);

const FALLBACK_SETTINGS: SettingItem[] = [
  ...AGENT_CONFIG_GROUPS.flatMap((group) =>
    group.settings.map((setting) => ({
      key: setting.key,
      value: setting.defaultValue,
      updated_at: "",
      default_value: setting.defaultValue,
      label: setting.label,
      description: setting.description,
      type_hint: setting.key === "llm_model" ? ("text" as const) : ("int" as const),
      section:
        group.title === "Chunking"
          ? ("chunking" as const)
          : group.title === "Retrieval"
            ? ("retrieval" as const)
            : group.title === "LLM"
              ? ("llm" as const)
              : ("ui" as const),
    }))
  ),
];

function settingsWithFallback(settings: SettingItem[]) {
  return settings.length ? settings : FALLBACK_SETTINGS;
}

function statusClass(status: string) {
  if (status === "Indexed" || status === "Resolved" || status === "Solved" || status === "Closed" || status === "Active") return "bg-[#e4f3e8] text-[#2d7d46]";
  if (status === "Processing" || status === "In Progress" || status === "Pending" || status === "On Hold" || status === "New") return "bg-[#fff0d6] text-[#9d5b00]";
  if (status === "Failed") return "bg-[#f9d8d2] text-[#b3311f]";
  return "bg-[#dcebf8] text-[#2567a8]";
}

function tokenLabel(value?: number | null) {
  return value == null ? "Not returned" : value.toLocaleString();
}

function shortResponseSummary(value: string) {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= 130) return normalized;
  return `${normalized.slice(0, 130).trim()} ....`;
}

function categoryScopeLabel(categories: string[]) {
  return categories.length ? categories.join(", ") : "All categories";
}

function App() {
  const queryClient = useQueryClient();
  const [role, setRole] = useState<Role>(() => storedRole());
  const [adminView, setAdminView] = useState<AdminView>(() => storedAdminView());
  const [userView, setUserView] = useState<UserView>(() => storedUserView());
  const [demoUserId, setDemoUserId] = useState<DemoUserId>(() => storedDemoUserId());
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [chatText, setChatText] = useState("");
  const [chatItems, setChatItems] = useState<ChatItem[]>([]);
  const [source, setSource] = useState<Citation | null>(null);
  const [ticketDraft, setTicketDraft] = useState(false);
  const [ticketDetails, setTicketDetails] = useState<TicketType | null>(null);
  const [conversationDetails, setConversationDetails] = useState<Conversation | null>(null);
  const [traceConversationId, setTraceConversationId] = useState<string | null>(null);

  const metrics = useQuery({ queryKey: ["metrics"], queryFn: api.metrics });
  const agents = useQuery({ queryKey: ["agents"], queryFn: api.agents });
  const documents = useQuery({ queryKey: ["documents"], queryFn: api.documents });
  const categories = useQuery({ queryKey: ["categories"], queryFn: api.categories });
  const settings = useQuery({ queryKey: ["settings"], queryFn: api.settings });
  const tickets = useQuery({ queryKey: ["tickets"], queryFn: api.tickets });
  const monitoring = useQuery({ queryKey: ["monitoring"], queryFn: api.monitoring });
  const conversations = useQuery({ queryKey: ["conversations"], queryFn: api.conversations });
  const trace = useQuery({
    queryKey: ["trace", traceConversationId],
    queryFn: () => api.trace(traceConversationId!),
    enabled: Boolean(traceConversationId),
  });

  useEffect(() => {
    window.localStorage.setItem("l1-helpdesk-role", role);
  }, [role]);

  useEffect(() => {
    window.localStorage.setItem("l1-helpdesk-admin-view", adminView);
  }, [adminView]);

  useEffect(() => {
    window.localStorage.setItem("l1-helpdesk-user-view", userView);
  }, [userView]);

  useEffect(() => {
    window.localStorage.setItem("l1-helpdesk-demo-user-id", demoUserId);
  }, [demoUserId]);

  const chatMutation = useMutation({
    mutationFn: (message: string) => api.chat(message, DEFAULT_PROFILE_ID, demoUserId, conversationId),
    onSuccess: (response) => {
      setConversationId(response.conversation_id);
      setChatItems((items) => [
        ...items,
        {
          role: "assistant",
          content: response.answer,
          confidence: response.confidence,
          citations: response.citations,
          suggestedPrompts: response.suggested_prompts,
        },
      ]);
      void queryClient.invalidateQueries({ queryKey: ["metrics"] });
      void queryClient.invalidateQueries({ queryKey: ["monitoring"] });
      void queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
    onError: (error) => {
      setChatItems((items) => [
        ...items,
        {
          role: "assistant",
          content: `I could not get an OCI response. ${error.message}`,
          confidence: 0,
          citations: [],
        },
      ]);
    },
  });

  const ticketMutation = useMutation({
    mutationFn: api.createTicket,
    onSuccess: (ticket) => {
      setTicketDraft(false);
      setTicketDetails(ticket);
      void queryClient.invalidateQueries({ queryKey: ["tickets"] });
      void queryClient.invalidateQueries({ queryKey: ["metrics"] });
      void queryClient.invalidateQueries({ queryKey: ["monitoring"] });
    },
  });

  const uploadMutation = useMutation({
    mutationFn: ({ file, category }: { file: File; category: string }) => api.uploadDocument(file, category),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["documents"] });
      void queryClient.invalidateQueries({ queryKey: ["metrics"] });
    },
  });

  const activeMeta = pageMeta(role, role === "Admin" ? adminView : userView);
  const mainContent =
    role === "Admin"
      ? renderAdminView(adminView, {
          metrics: metrics.data,
          documents: documents.data ?? [],
          categories: categories.data ?? [],
          agents: agents.data ?? [],
          settings: settings.data ?? [],
          monitoring: monitoring.data ?? [],
          conversations: conversations.data ?? [],
          setTraceConversationId,
          uploadMutation,
          setConversationDetails,
        })
      : renderUserView(userView, {
          agents: agents.data ?? [],
          chatItems,
          chatText,
          setChatText,
          chatPending: chatMutation.isPending,
          sendChat: (message) => {
            setChatItems((items) => [...items, { role: "user", content: message }]);
            setChatText("");
            chatMutation.mutate(message);
          },
          setSource,
          openTicketDraft: () => setTicketDraft(true),
          tickets: tickets.data ?? [],
          conversations: conversations.data ?? [],
          loadConversation: (conversation) => {
            setConversationId(conversation.id);
            setChatItems(
              conversation.messages.map((message) => ({
                role: message.role,
                content: message.content,
                confidence: message.confidence ?? undefined,
                citations: message.citations,
                suggestedPrompts: [],
              }))
            );
            setUserView("chat");
          },
          setTicketDetails,
        });

  return (
    <>
      <NitroHelpDeskShell
        meta={activeMeta}
        role={role}
        setRole={setRole}
        demoUserId={demoUserId}
        setDemoUserId={setDemoUserId}
        adminView={adminView}
        setAdminView={setAdminView}
        userView={userView}
        setUserView={setUserView}
      >
        {mainContent}
      </NitroHelpDeskShell>

      {source && (
        <Drawer title="Source details" onClose={() => setSource(null)}>
          <SourceDetails source={source} />
        </Drawer>
      )}

      {ticketDraft && (
        <Drawer title="Create support ticket" onClose={() => setTicketDraft(false)}>
          <TicketForm
            conversationId={conversationId}
            defaultSubject={[...chatItems].reverse().find((item) => item.role === "user")?.content ?? ""}
            isSubmitting={ticketMutation.isPending}
            onSubmit={(payload) => ticketMutation.mutate(payload)}
          />
        </Drawer>
      )}

      {ticketDetails && (
        <Drawer title={`Ticket #${ticketDetails.id}`} onClose={() => setTicketDetails(null)}>
          <TicketDetails ticket={ticketDetails} />
        </Drawer>
      )}

      {conversationDetails && (
        <Drawer
          title="Conversation details"
          onClose={() => {
            setConversationDetails(null);
            setTraceConversationId(null);
          }}
        >
          <ConversationDetails conversation={conversationDetails} traces={trace.data ?? []} traceLoading={trace.isFetching} />
        </Drawer>
      )}
    </>
  );
}

function NitroHelpDeskShell({
  meta,
  role,
  setRole,
  demoUserId,
  setDemoUserId,
  adminView,
  setAdminView,
  userView,
  setUserView,
  children,
}: {
  meta: PageMeta;
  role: Role;
  setRole: (role: Role) => void;
  demoUserId: DemoUserId;
  setDemoUserId: (userId: DemoUserId) => void;
  adminView: AdminView;
  setAdminView: (view: AdminView) => void;
  userView: UserView;
  setUserView: (view: UserView) => void;
  children: ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const isAdmin = role === "Admin";

  return (
    <PillarTheme pillar="gbu" mode="light" scale="large">
      <div
        className={`page-shell nitro-helpdesk-shell ${isAdmin ? "nitro-helpdesk-shell-admin" : "nitro-helpdesk-shell-user"}`}
        style={
          isAdmin
            ? {
                gridTemplateColumns: `${collapsed ? "var(--admin-sidebar-width-collapsed)" : "var(--admin-sidebar-width-expanded)"} minmax(0,1fr)`,
              }
            : undefined
        }
        data-testid="nitro-helpdesk-shell"
      >
        <header className="nitro-helpdesk-topbar">
          <div className="flex min-w-0 items-center gap-3">
            <div className="nitro-helpdesk-logo">L1</div>
            <div className="min-w-0">
              <div className="truncate text-sm font-bold text-[#1f1f1f]">L1 HelpDesk Agent</div>
              <div className="text-xs text-[#6f6f6f]">{isAdmin ? "Admin console" : "Self-service workspace"}</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-xs font-semibold text-[#4f4f4f]">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-[#ded9cf] bg-[#f8f7f4] text-[#4f4f4f]">
                <UserCircle size={20} aria-hidden="true" />
              </span>
              <span className="hidden sm:inline">Account</span>
              <Select value={demoUserId} onChange={(event) => setDemoUserId(event.target.value as DemoUserId)}>
                {DEMO_USERS.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name}
                  </option>
                ))}
              </Select>
            </label>
            <label className="flex items-center gap-2 text-xs font-semibold text-[#4f4f4f]">
              Role
              <Select value={role} onChange={(event) => setRole(event.target.value as Role)}>
                <option>Admin</option>
                <option>User</option>
              </Select>
            </label>
          </div>
        </header>

        {isAdmin ? (
          <aside className="nitro-helpdesk-sidebar">
            <button
              type="button"
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              aria-expanded={!collapsed}
              onClick={() => setCollapsed(!collapsed)}
              className="mb-3 flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border border-[#ded9cf] bg-[#f8f7f4] text-sm font-semibold text-[#4f4f4f] hover:bg-[#f1efea]"
            >
              {collapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
              {!collapsed && <span>Collapse</span>}
            </button>
            <NavigationList
              aria-label="Admin navigation"
              selectedKey={adminView}
              display={collapsed ? "icons" : "standard"}
              edge="start"
              items={adminNav.map((item) => {
                const Icon = item.icon;
                return {
                  key: item.id,
                  label: item.label,
                  icon: <Icon size={18} />,
                };
              })}
              onSelect={(key) => setAdminView(key as AdminView)}
            />
          </aside>
        ) : null}

        <main className={isAdmin ? "nitro-helpdesk-main" : "nitro-helpdesk-main-user"}>
          <div className="mx-auto max-w-[var(--admin-content-max-width)]">
            {isAdmin && <CompactPageHeader meta={meta} />}
            {!isAdmin && (
              <nav className="nitro-helpdesk-user-tabs" aria-label="User navigation">
                {userNav.map((item) => {
                  const Icon = item.icon;
                  const active = userView === item.id;
                  return (
                    <Button
                      key={item.id}
                      type="button"
                      variant={active ? "primary" : "default"}
                      onClick={() => setUserView(item.id)}
                      className="rounded-full"
                    >
                      <Icon size={16} />
                      {item.label}
                    </Button>
                  );
                })}
              </nav>
            )}
            {children}
          </div>
        </main>
      </div>
    </PillarTheme>
  );
}

function CompactPageHeader({ meta }: { meta: PageMeta }) {
  return (
    <header className="nitro-helpdesk-page-header">
      <div>
        <p className="nitro-helpdesk-page-kicker">{meta.kicker}</p>
        <h1 className="nitro-helpdesk-page-title">{meta.title}</h1>
        <p className="nitro-helpdesk-page-description">{meta.description}</p>
      </div>
    </header>
  );
}

function pageMeta(role: Role, view: string): PageMeta {
  const meta: Record<string, PageMeta> = {
    dashboard: {
      kicker: "Admin",
      title: "Dashboard",
      description: "Monitor knowledge readiness, conversation volume, and escalation activity.",
    },
    knowledge: {
      kicker: "Admin",
      title: "Knowledge base",
      description: "Upload approved documents directly into OCI Vector Store for retrieval.",
    },
    profiles: {
      kicker: "Admin",
      title: "Agents",
      description: "Review specialist agents, instructions, tools, and knowledge category scope.",
    },
    configuration: {
      kicker: "Admin",
      title: "Agent Configuration",
      description: "Configure pipeline behaviour. Changes take effect on the next request.",
    },
    monitoring: {
      kicker: "Admin",
      title: "Conversation monitoring",
      description: "Review user queries, cited answers, confidence, and timestamps.",
    },
    chat: {
      kicker: "User",
      title: "What can I help you solve?",
      description: "Ask a helpdesk question and review the cited answer before creating a ticket.",
    },
    tickets: {
      kicker: "User",
      title: "My tickets",
      description: "Track requests created when a chat answer needs helpdesk follow-up.",
    },
    topics: {
      kicker: "User",
      title: "Start with a common topic",
      description: "Choose a suggested helpdesk prompt to begin a guided conversation.",
    },
  };
  return meta[view] ?? meta[role === "Admin" ? "dashboard" : "chat"];
}

function renderAdminView(
  view: AdminView,
  data: {
    metrics?: DashboardMetrics;
    documents: DocumentRow[];
    categories: Awaited<ReturnType<typeof api.categories>>;
    agents: Awaited<ReturnType<typeof api.agents>>;
    settings: SettingItem[];
    monitoring: MonitoringRow[];
    conversations: Conversation[];
    setTraceConversationId: (id: string) => void;
    uploadMutation: UseMutationResult<DocumentRow, Error, { file: File; category: string }>;
    setConversationDetails: (conversation: Conversation) => void;
  }
) {
  if (view === "dashboard") return <Dashboard metrics={data.metrics} conversations={data.conversations} />;
  if (view === "knowledge") return <KnowledgeBase documents={data.documents} categories={data.categories} uploadMutation={data.uploadMutation} />;
  if (view === "profiles") return <Agents agents={data.agents} categories={data.categories} />;
  if (view === "configuration") return <AgentConfiguration settings={data.settings} />;
  if (view === "monitoring")
    return (
      <Monitoring
        rows={data.monitoring}
        conversations={data.conversations}
        setConversationDetails={data.setConversationDetails}
        setTraceConversationId={data.setTraceConversationId}
      />
    );
  return <Dashboard metrics={data.metrics} conversations={data.conversations} />;
}

function renderUserView(
  view: UserView,
  data: {
    agents: Awaited<ReturnType<typeof api.agents>>;
    chatItems: ChatItem[];
    chatText: string;
    setChatText: (value: string) => void;
    chatPending: boolean;
    sendChat: (message: string) => void;
    setSource: (source: Citation) => void;
    openTicketDraft: () => void;
    tickets: TicketType[];
    conversations: Conversation[];
    loadConversation: (conversation: Conversation) => void;
    setTicketDetails: (ticket: TicketType) => void;
  }
) {
  if (view === "tickets") return <Tickets tickets={data.tickets} setTicketDetails={data.setTicketDetails} />;
  if (view === "topics") return <HelpTopics sendChat={data.sendChat} />;
  return <Chat {...data} />;
}

function Dashboard({
  metrics,
  conversations,
}: {
  metrics?: Awaited<ReturnType<typeof api.metrics>>;
  conversations: Conversation[];
}) {
  const cards: Array<[string, string | number, LucideIcon, string]> = [
    ["Documents", metrics?.documents ?? 0, FileText, "Indexed and ready"],
    ["Chunks", metrics?.chunks ?? 0, Boxes, "Local previews"],
    ["Questions asked", metrics?.questions_asked ?? 0, MessageSquare, "User turns"],
    ["Tickets created", metrics?.tickets_created ?? 0, Ticket, "Escalations"],
    ["Escalation rate", `${metrics?.escalation_rate ?? 0}%`, BarChart3, "Ticket handoff ratio"],
    ["Agent status", "OCI, Zendesk", Bot, "Responses and Vector Store"],
  ];
  return (
    <div className="grid gap-6">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {cards.map(([label, value, Icon, helper]) => (
          <Card key={String(label)} className="p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.04em] text-[#6f6f6f]">{String(label)}</div>
                <div className="mt-3 text-3xl font-bold text-[#1f1f1f]">{String(value)}</div>
                <div className="mt-2 text-sm text-[#6f6f6f]">{helper}</div>
              </div>
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#f7ddd7] text-[#c74634]">
                <Icon size={20} />
              </div>
            </div>
          </Card>
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
        <Card>
          <CardHeader className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold">Operational activity</h2>
              <p className="mt-1 text-sm text-[#6f6f6f]">Newest conversations and support activity.</p>
            </div>
            <Badge className="bg-[#dcebf8] text-[#2567a8]">{metrics?.escalation_rate ?? 0}% escalation</Badge>
          </CardHeader>
          <CardBody>
            <Table
              headers={["Conversation", "Status", "Updated"]}
              rows={conversations.slice(0, 5).map((conversation) => [
                <span className="font-semibold">{conversation.title}</span>,
                <Badge className={conversation.escalated ? "bg-[#fff0d6] text-[#9d5b00]" : "bg-[#e4f3e8] text-[#2d7d46]"}>
                  {conversation.escalated ? "Escalated" : "Answered"}
                </Badge>,
                formatDate(conversation.updated_at),
              ])}
              empty="No conversations yet."
            />
          </CardBody>
        </Card>

        <div className="grid gap-4">
          <Card>
            <CardHeader>
              <h2 className="text-xl font-semibold">OCI services used</h2>
            </CardHeader>
            <CardBody className="grid gap-3">
              <Capability icon={Bot} title="OCI Generative AI Responses" text="Generates cited answers using the selected model." />
              <Capability icon={Boxes} title="OCI Vector Store" text="Indexes uploaded knowledge and supports document retrieval." />
            </CardBody>
          </Card>
        </div>
      </section>
    </div>
  );
}

function KnowledgeBase({
  documents,
  categories,
  uploadMutation,
}: {
  documents: DocumentRow[];
  categories: Awaited<ReturnType<typeof api.categories>>;
  uploadMutation: UseMutationResult<DocumentRow, Error, { file: File; category: string }>;
}) {
  const queryClient = useQueryClient();
  const categoryOptions = categories.length
    ? categories
    : [
        { id: 0, name: "IT Support", description: null, created_at: "" },
        { id: 1, name: "HCM", description: null, created_at: "" },
        { id: 2, name: "Payroll", description: null, created_at: "" },
        { id: 3, name: "Onboarding", description: null, created_at: "" },
        { id: 4, name: "Access Management", description: null, created_at: "" },
      ];
  const [category, setCategory] = useState("IT Support");
  const [file, setFile] = useState<File | null>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("All");
  const [categoryFilter, setCategoryFilter] = useState("All categories");
  const [newCategory, setNewCategory] = useState("");

  const createCategory = useMutation({
    mutationFn: api.createCategory,
    onSuccess: () => {
      setNewCategory("");
      void queryClient.invalidateQueries({ queryKey: ["categories"] });
    },
  });
  const deleteDocument = useMutation({
    mutationFn: api.deleteDocument,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["documents"] });
      void queryClient.invalidateQueries({ queryKey: ["metrics"] });
    },
  });

  const filteredDocuments = useMemo(
    () =>
      documents.filter((doc) => {
        const matchesQuery = doc.name.toLowerCase().includes(query.toLowerCase()) || doc.category.toLowerCase().includes(query.toLowerCase());
        const matchesStatus = status === "All" || doc.status === status;
        const matchesCategory = categoryFilter === "All categories" || doc.category === categoryFilter;
        return matchesQuery && matchesStatus && matchesCategory;
      }),
    [documents, query, status, categoryFilter]
  );

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(720px,1fr)_420px]">
      <Card className="xl:col-start-2">
        <CardHeader className="grid gap-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-xl font-semibold">Documents</h2>
              <p className="mt-1 text-sm text-[#6f6f6f]">Search, filter, and review knowledge indexed for the helpdesk agent.</p>
            </div>
            <Badge className="bg-[#dcebf8] text-[#2567a8]">{filteredDocuments.length} shown</Badge>
          </div>
          <div className="flex flex-col gap-3 lg:flex-row">
            <label className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#6f6f6f]" size={16} />
              <Input value={query} onChange={(event) => setQuery(event.target.value)} className="w-full pl-9" placeholder="Search by document name or category" />
            </label>
            <Select value={status} onChange={(event) => setStatus(event.target.value)} className="lg:w-44">
              <option>All</option>
              <option>Indexed</option>
              <option>Processing</option>
              <option>Failed</option>
            </Select>
            <Select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} className="lg:w-56">
              <option>All categories</option>
              {categoryOptions.map((item) => (
                <option key={item.name}>{item.name}</option>
              ))}
            </Select>
          </div>
        </CardHeader>
        <CardBody>
          <Table
            headers={["Name", "Status", "Category", "OCI file ID", "Chunks", "Actions"]}
            rows={filteredDocuments.map((doc) => [
              <div>
                <div className="font-semibold">{doc.name}</div>
                <div className="text-xs text-[#6f6f6f]">Uploaded {formatDate(doc.created_at)}</div>
              </div>,
              <Badge className={statusClass(doc.status)}>{doc.status}</Badge>,
              doc.category,
              <span className="font-mono text-xs text-[#4f4f4f]">
                {doc.vector_store_file_id ? `${doc.vector_store_file_id.slice(0, 18)}...` : "Pending"}
              </span>,
              doc.chunks,
              <Button
                variant="ghost"
                disabled={deleteDocument.isPending}
                onClick={() => {
                  if (window.confirm(`Delete "${doc.name}" from the OCI Vector Store and knowledge base?`)) {
                    deleteDocument.mutate(doc.id);
                  }
                }}
              >
                <Trash2 size={15} />
                Delete
              </Button>,
            ])}
            empty={query || status !== "All" ? "No documents match the current filters." : "No documents uploaded yet."}
          />
          {deleteDocument.error && <div className="mt-3 text-sm text-[#b3311f]">{deleteDocument.error.message}</div>}
        </CardBody>
      </Card>

      <Card className="xl:col-span-2">
        <CardHeader>
          <h2 className="text-xl font-semibold">Upload document</h2>
          <p className="mt-1 text-sm text-[#6f6f6f]">Send approved knowledge directly to OCI Vector Store for retrieval.</p>
        </CardHeader>
        <CardBody className="grid gap-4">
          <label className="grid gap-2 text-sm font-semibold">
            Category
            <Select value={category} onChange={(event) => setCategory(event.target.value)}>
              {categoryOptions.map((item) => (
                <option key={item.name}>{item.name}</option>
              ))}
            </Select>
          </label>
          <label className="grid gap-2 text-sm font-semibold">
            Source file
            <Input type="file" accept=".pdf,.docx,.txt" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
          </label>
          <div className="rounded-xl border border-[#ded9cf] bg-[#f8f7f4] p-3 text-sm leading-6 text-[#4f4f4f]">
            Supported files: PDF, DOCX, and TXT. Large documents may take longer while OCI indexing completes.
          </div>
          <Button variant="primary" disabled={!file || uploadMutation.isPending} onClick={() => file && uploadMutation.mutate({ file, category })}>
            <Upload size={16} />
            {uploadMutation.isPending ? "Uploading" : "Upload"}
          </Button>
          {uploadMutation.error && (
            <div className="rounded-xl border border-[#f1b8ae] bg-[#f9d8d2] p-3 text-sm text-[#b3311f]">{uploadMutation.error.message}</div>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-xl font-semibold">Knowledge categories</h2>
          <p className="mt-1 text-sm text-[#6f6f6f]">Manage reusable scopes for agents and document routing.</p>
        </CardHeader>
        <CardBody className="grid gap-3">
          {categoryOptions.map((item) => (
            <div key={item.name} className="rounded-xl border border-[#ded9cf] bg-[#f8f7f4] p-3">
              <div className="text-sm font-semibold">{item.name}</div>
              {item.description && <p className="mt-1 text-xs leading-5 text-[#6f6f6f]">{item.description}</p>}
            </div>
          ))}
          <form
            className="grid gap-2 border-t border-[#ded9cf] pt-3"
            onSubmit={(event) => {
              event.preventDefault();
              if (newCategory.trim()) createCategory.mutate({ name: newCategory.trim() });
            }}
          >
            <Input value={newCategory} onChange={(event) => setNewCategory(event.target.value)} placeholder="Add category" />
            <Button disabled={!newCategory.trim() || createCategory.isPending}>{createCategory.isPending ? "Adding" : "Add category"}</Button>
          </form>
          {createCategory.error && <div className="text-sm text-[#b3311f]">{createCategory.error.message}</div>}
        </CardBody>
      </Card>
    </div>
  );
}

function Agents({
  agents,
  categories,
}: {
  agents: Awaited<ReturnType<typeof api.agents>>;
  categories: Awaited<ReturnType<typeof api.categories>>;
}) {
  const queryClient = useQueryClient();
  const editableAgents = agents;
  const [selectedAgentId, setSelectedAgentId] = useState(
    editableAgents.find((agent) => agent.id === DEFAULT_PROFILE_ID)?.id ?? editableAgents[0]?.id ?? DEFAULT_PROFILE_ID
  );
  const selected = editableAgents.find((agent) => agent.id === selectedAgentId) ?? editableAgents[0];
  const updateAgent = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<Awaited<ReturnType<typeof api.agents>>[number]> }) =>
      api.updateAgent(id, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["agents"] });
    },
  });

  if (!editableAgents.length) {
    return <EmptyPanel title="No agents yet" text="Agents will appear after the backend starts and loads default data." />;
  }

  return (
    <div className="grid gap-4">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {editableAgents.map((agent) => (
          <button
            key={agent.id}
            type="button"
            onClick={() => setSelectedAgentId(agent.id)}
            className={`rounded-2xl border bg-white p-5 text-left shadow-sm transition ${
              selected?.id === agent.id ? "border-[#c74634] ring-4 ring-[#c7463420]" : "border-[#ded9cf] hover:border-[#c74634]"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">{agent.name}</h2>
                <p className="mt-2 text-sm leading-6 text-[#4f4f4f]">{agent.description}</p>
              </div>
              <div className="flex flex-col items-end gap-2">
                <Badge className="bg-[#dcebf8] text-[#2567a8]">{agent.response_tone}</Badge>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {agent.knowledge_categories.map((category) => (
                <Badge key={category}>{category}</Badge>
              ))}
            </div>
          </button>
        ))}
      </div>

      {selected && (
        <div className="grid gap-4">
          <Card>
            <CardHeader>
              <h2 className="text-xl font-semibold">Agent details</h2>
              <p className="mt-1 text-sm text-[#6f6f6f]">{selected.name} configuration preview.</p>
            </CardHeader>
            <CardBody>
              <form
                key={selected.id}
                className="grid gap-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  const form = new FormData(event.currentTarget);
                  const selectedCategories = form.getAll("knowledge_categories").map(String);
                  updateAgent.mutate({
                    id: selected.id,
                    payload: {
                      description: String(form.get("description") ?? ""),
                      response_tone: String(form.get("response_tone") ?? selected.response_tone) as typeof selected.response_tone,
                      instructions: String(form.get("instructions") ?? ""),
                      knowledge_categories: selectedCategories.length ? selectedCategories : selected.knowledge_categories,
                    },
                  });
                }}
              >
                <label className="grid gap-2 text-sm font-semibold">
                  Description
                  <Textarea name="description" defaultValue={selected.description} />
                </label>
                <label className="grid gap-2 text-sm font-semibold">
                  Response tone
                  <Select name="response_tone" defaultValue={selected.response_tone}>
                    <option value="Concise">Concise</option>
                    <option value="Friendly">Friendly</option>
                    <option value="Formal">Formal</option>
                  </Select>
                </label>
                <label className="grid gap-2 text-sm font-semibold">
                  System instructions / persona
                  <Textarea name="instructions" defaultValue={selected.instructions} />
                </label>
                <div className="grid gap-2">
                  <div className="text-sm font-semibold">Knowledge scope</div>
                  <p className="text-sm leading-6 text-[#6f6f6f]">Selected categories control which OCI Vector Store files this agent can retrieve from.</p>
                  <div className="flex flex-wrap gap-2">
                    {categories.map((category) => (
                      <label key={category.id} className="inline-flex min-h-7 items-center rounded-full border border-[#ded9cf] bg-[#f8f7f4] px-3 py-1 text-xs font-semibold">
                        <input
                          className="mr-2"
                          type="checkbox"
                          name="knowledge_categories"
                          value={category.name}
                          defaultChecked={selected.knowledge_categories.includes(category.name)}
                        />
                        {category.name}
                      </label>
                    ))}
                  </div>
                  {!categories.length && <div className="text-sm text-[#6f6f6f]">Add categories in Knowledge Base before assigning agent scope.</div>}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button variant="primary" disabled={updateAgent.isPending}>
                    {updateAgent.isPending ? "Saving" : "Save agent"}
                  </Button>
                  {updateAgent.isSuccess && <Badge className="bg-[#e4f3e8] text-[#2d7d46]">Saved</Badge>}
                </div>
              </form>
            </CardBody>
          </Card>
        </div>
      )}
    </div>
  );
}

function AgentConfiguration({ settings }: { settings: SettingItem[] }) {
  const [showFrameworkTrace, setShowFrameworkTrace] = useState(false);
  const allSettings = settingsWithFallback(settings);
  const groups: Array<{ title: string; section: SettingItem["section"] }> = [
    { title: "Chunking", section: "chunking" },
    { title: "Retrieval", section: "retrieval" },
    { title: "LLM", section: "llm" },
    { title: "UI", section: "ui" },
  ];

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-xl font-semibold">Settings</h2>
            <p className="mt-1 text-sm leading-6 text-[#6f6f6f]">Configure pipeline behaviour. Changes take effect on the next request.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" onClick={() => setShowFrameworkTrace(true)}>
              <History size={16} />
              View framework trace
            </Button>
          </div>
        </CardHeader>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {groups.map((group) => (
          <Card key={group.title}>
            <CardHeader>
              <h2 className="text-xl font-semibold">{group.title}</h2>
            </CardHeader>
            <CardBody className="grid gap-4">
              {allSettings.filter((setting) => setting.section === group.section).map((setting) => (
                <SettingControl key={`${setting.key}-${setting.value}`} setting={setting} />
              ))}
            </CardBody>
          </Card>
        ))}
      </div>

      {showFrameworkTrace && (
        <Drawer title="Enterprise AI framework trace" onClose={() => setShowFrameworkTrace(false)}>
          <div className="grid gap-3">
            {[
              ["Receive request", "The user question enters the selected helpdesk agent."],
              ["Load configuration", "Saved settings, agent instructions, and tool toggles are applied."],
              ["Search knowledge", "OCI Responses uses OCI Vector Store to retrieve approved documents."],
              ["Generate answer", "The selected OCI model drafts a concise answer with citations."],
              ["Escalate when needed", "The user can create a ticket and the conversation is retained for audit."],
            ].map(([title, text], index) => (
              <div key={title} className="grid grid-cols-[34px_minmax(0,1fr)] gap-3 rounded-xl border border-[#ded9cf] bg-[#f8f7f4] p-3">
                <div className="grid h-7 w-7 place-items-center rounded-full bg-[#1f1f1f] text-xs font-bold text-white">{index + 1}</div>
                <div>
                  <strong>{title}</strong>
                  <p className="mt-1 text-sm leading-6 text-[#4f4f4f]">{text}</p>
                </div>
              </div>
            ))}
          </div>
        </Drawer>
      )}
    </div>
  );
}

function SettingControl({ setting }: { setting: SettingItem }) {
  const queryClient = useQueryClient();
  const [value, setValue] = useState(setting.value);
  const updateSetting = useMutation({
    mutationFn: () => api.updateSetting(setting.key, value),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["settings"] });
    },
  });

  return (
    <div className="rounded-2xl border border-[#ded9cf] bg-[#f8f7f4] p-4">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div className="min-w-0 flex-1">
          <label className="grid gap-2 text-sm font-semibold text-[#1f1f1f]">
            {setting.label}
            <span className="text-sm font-normal leading-6 text-[#4f4f4f]">{setting.description}</span>
            <span className="text-xs font-normal text-[#6f6f6f]">Default: {setting.default_value}</span>
            {setting.type_hint === "textarea" ? (
              <Textarea value={value} onChange={(event) => setValue(event.target.value)} />
            ) : (
              <Input
                value={value}
                onChange={(event) => setValue(event.target.value)}
                type={setting.type_hint === "int" || setting.type_hint === "float" ? "number" : "text"}
                inputMode={setting.type_hint === "int" || setting.type_hint === "float" ? "numeric" : "text"}
              />
            )}
          </label>
        </div>
        <div className="flex items-center gap-2">
          {updateSetting.isSuccess && <Badge className="bg-[#e4f3e8] text-[#2d7d46]">Saved</Badge>}
          <Button disabled={updateSetting.isPending} onClick={() => updateSetting.mutate()}>
            {updateSetting.isPending ? "Saving" : "Save"}
          </Button>
        </div>
      </div>
      {updateSetting.error && <div className="mt-3 text-sm text-[#b3311f]">{updateSetting.error.message}</div>}
    </div>
  );
}

function SettingToggle({ setting }: { setting: SettingItem }) {
  const queryClient = useQueryClient();
  const enabled = setting.value === "true";
  const updateSetting = useMutation({
    mutationFn: () => api.updateSetting(setting.key, enabled ? "false" : "true"),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["settings"] });
    },
  });

  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-[#ded9cf] bg-[#f8f7f4] p-4">
      <div>
        <h3 className="text-sm font-semibold">{setting.label}</h3>
        <p className="mt-1 text-sm leading-6 text-[#4f4f4f]">{setting.description}</p>
        <div className="mt-2 text-xs text-[#6f6f6f]">Default: {setting.default_value}</div>
      </div>
      <button
        type="button"
        aria-label={`Toggle ${setting.label}`}
        aria-pressed={enabled}
        disabled={updateSetting.isPending}
        onClick={() => updateSetting.mutate()}
        className={`h-7 w-12 rounded-full border p-1 transition ${
          enabled ? "border-[#2d7d46] bg-[#2d7d46]" : "border-[#b8b1a7] bg-white"
        }`}
      >
        <span className={`block h-5 w-5 rounded-full bg-white shadow-sm transition ${enabled ? "translate-x-5" : "translate-x-0"}`} />
      </button>
    </div>
  );
}

function Monitoring({
  rows,
  conversations,
  setConversationDetails,
  setTraceConversationId,
}: {
  rows: MonitoringRow[];
  conversations: Conversation[];
  setConversationDetails: (conversation: Conversation) => void;
  setTraceConversationId: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All categories");
  const [dateRange, setDateRange] = useState("Last 7 days");
  const [escalatedOnly, setEscalatedOnly] = useState(false);
  const [lowConfidenceOnly, setLowConfidenceOnly] = useState(false);
  const categories = Array.from(new Set(rows.map((row) => row.category).filter(Boolean)));
  const filteredRows = rows.filter((row) => {
    const matchesQuery = row.query.toLowerCase().includes(query.toLowerCase()) || row.answer.toLowerCase().includes(query.toLowerCase());
    const matchesCategory = category === "All categories" || row.category === category;
    const matchesEscalation = !escalatedOnly || row.escalated || row.ticket_created;
    const matchesConfidence = !lowConfidenceOnly || row.confidence < 0.7;
    return matchesQuery && matchesCategory && matchesEscalation && matchesConfidence;
  });
  return (
    <Card>
      <CardHeader className="grid gap-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-xl font-semibold">Conversation logs</h2>
            <p className="mt-1 text-sm text-[#6f6f6f]">Inspect answer quality and cited source usage.</p>
          </div>
          <Badge className="bg-[#dcebf8] text-[#2567a8]">{filteredRows.length} results</Badge>
        </div>
        <div className="grid gap-3 xl:grid-cols-[minmax(260px,1fr)_180px_220px_auto_auto]">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#6f6f6f]" size={16} />
            <Input value={query} onChange={(event) => setQuery(event.target.value)} className="w-full pl-9" placeholder="Search by query or answer" />
          </label>
          <Select value={dateRange} onChange={(event) => setDateRange(event.target.value)}>
            <option>Last 7 days</option>
            <option>Today</option>
            <option>Last 30 days</option>
          </Select>
          <Select value={category} onChange={(event) => setCategory(event.target.value)}>
            <option>All categories</option>
            {categories.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </Select>
          <label className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[#ded9cf] bg-[#f8f7f4] px-3 text-sm font-semibold">
            <input type="checkbox" checked={escalatedOnly} onChange={(event) => setEscalatedOnly(event.target.checked)} />
            Escalated
          </label>
          <label className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[#ded9cf] bg-[#f8f7f4] px-3 text-sm font-semibold">
            <input type="checkbox" checked={lowConfidenceOnly} onChange={(event) => setLowConfidenceOnly(event.target.checked)} />
            Low confidence
          </label>
        </div>
      </CardHeader>
      <CardBody>
        <Table
          headers={["User query", "Agent", "Knowledge checked", "Response summary", "Sources", "Ticket", "Tokens", "Confidence", "Time"]}
          rows={filteredRows.map((row) => [
            <button
              className="text-left font-semibold hover:text-[#c74634]"
              onClick={() => {
                const conversation = conversations.find((item) => item.id === row.conversation_id);
                if (conversation) {
                  setConversationDetails(conversation);
                  setTraceConversationId(conversation.id);
                }
              }}
            >
              {row.query}
            </button>,
            <Badge className="bg-[#dcebf8] text-[#2567a8]">{row.agent_name}</Badge>,
            <span className="text-sm leading-5 text-[#4f4f4f]">{categoryScopeLabel(row.knowledge_categories)}</span>,
            <span className="nitro-helpdesk-response-summary">{shortResponseSummary(row.response_summary || row.answer)}</span>,
            row.sources,
            row.ticket_created ? <Badge className="bg-[#fff0d6] text-[#9d5b00]">Yes</Badge> : <Badge className="bg-[#e4f3e8] text-[#2d7d46]">No</Badge>,
            tokenLabel(row.total_tokens),
            confidenceLabel(row.confidence),
            formatDate(row.time),
          ])}
          empty={query || category !== "All categories" || escalatedOnly || lowConfidenceOnly ? "No conversations match the selected filters." : "No conversations yet."}
        />
      </CardBody>
    </Card>
  );
}

function TraceCard({ trace }: { trace: ExecutionTrace }) {
  const steps = [
    ["Question", trace.question],
    ["Retrieval", trace.retrieval_summary],
    ["Tools selected by OCI", trace.tools_called.length ? trace.tools_called.join(", ") : "No tool calls recorded"],
    ["Connector result", trace.tool_summary || "No transactional connector output"],
    ["Sources found", `${trace.sources_found} source(s)`],
    ["Answer generated", trace.answer_summary],
    ["Token usage", `Input: ${tokenLabel(trace.input_tokens)} | Output: ${tokenLabel(trace.output_tokens)} | Total: ${tokenLabel(trace.total_tokens)}`],
  ];
  return (
    <div className="grid gap-2">
      {steps.map(([label, detail], index) => (
        <div key={label} className="grid grid-cols-[34px_minmax(0,1fr)] gap-3 rounded-xl border border-[#ded9cf] bg-[#f8f7f4] p-3">
          <div className="grid h-7 w-7 place-items-center rounded-full bg-[#1f1f1f] text-xs font-bold text-white">{index + 1}</div>
          <div>
            <strong>{label}</strong>
            <p className="mt-1 text-sm leading-6 text-[#4f4f4f]">{detail}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function Chat({
  agents,
  chatItems,
  chatText,
  setChatText,
  chatPending,
  sendChat,
  setSource,
  openTicketDraft,
  conversations,
  loadConversation,
}: {
  agents: Awaited<ReturnType<typeof api.agents>>;
  chatItems: ChatItem[];
  chatText: string;
  setChatText: (value: string) => void;
  chatPending: boolean;
  sendChat: (message: string) => void;
  setSource: (source: Citation) => void;
  openTicketDraft: () => void;
  conversations: Conversation[];
  loadConversation: (conversation: Conversation) => void;
}) {
  const selectedAgent = agents.find((agent) => agent.id === DEFAULT_PROFILE_ID) ?? agents[0];
  const lastAssistant = [...chatItems].reverse().find((item) => item.role === "assistant");
  const prompts = lastAssistant?.suggestedPrompts?.length
    ? lastAssistant.suggestedPrompts
    : ["How do I reset my VPN?", "How do I request laptop replacement?", "What is the onboarding checklist?"];
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px] 2xl:grid-cols-[minmax(0,1fr)_380px]">
      <Card className="nitro-helpdesk-chat-card grid grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden">
        <CardHeader>
          <div>
            <h2 className="text-xl font-semibold">HelpDesk chat</h2>
            <p className="mt-1 text-sm text-[#6f6f6f]">Ask a question, review cited sources, then create a ticket only if needed.</p>
          </div>
        </CardHeader>
        <div className="nitro-helpdesk-chat-transcript scrollbar-thin overflow-auto p-4">
          {!chatItems.length && selectedAgent && (
            <div className="nitro-helpdesk-chat-message nitro-helpdesk-chat-message-assistant">
              <div className="nitro-helpdesk-chat-bubble nitro-helpdesk-chat-bubble-assistant">
                Ask a helpdesk question. The supervisor will route it to the right specialist agent.
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge className="bg-[#dcebf8] text-[#2567a8]">{selectedAgent.response_tone}</Badge>
              </div>
            </div>
          )}
          {chatItems.map((item, index) => (
            <div
              key={index}
              className={`nitro-helpdesk-chat-message ${
                item.role === "user" ? "nitro-helpdesk-chat-message-user" : "nitro-helpdesk-chat-message-assistant"
              }`}
            >
              <div
                className={`nitro-helpdesk-chat-bubble ${
                  item.role === "user" ? "nitro-helpdesk-chat-bubble-user" : "nitro-helpdesk-chat-bubble-assistant"
                }`}
              >
                {item.content}
              </div>
              {item.role === "assistant" && (
                <div className="flex flex-wrap items-center gap-2">
                  {item.confidence !== undefined && <Badge className="bg-[#dcebf8] text-[#2567a8]">{confidenceLabel(item.confidence)} confidence</Badge>}
                  {item.citations?.map((citation) => (
                    <Button key={`${citation.document_id}-${citation.page_number}-${citation.document_name}`} onClick={() => setSource(citation)}>
                      {citation.document_name || "Source"}
                    </Button>
                  ))}
                  <Button variant="ghost" onClick={openTicketDraft}>
                    Create ticket
                  </Button>
                </div>
              )}
            </div>
          ))}
          {chatPending && (
            <div className="nitro-helpdesk-chat-bubble nitro-helpdesk-chat-bubble-assistant max-w-md self-start">
              <Clock3 className="mr-2 inline text-[#c74634]" size={16} />
              Searching approved knowledge and drafting an answer...
            </div>
          )}
        </div>
        <form
          className="grid gap-3 border-t border-[#ded9cf] bg-white p-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (chatText.trim()) sendChat(chatText.trim());
          }}
        >
          <div className="flex flex-wrap gap-2">
            {prompts.map((prompt) => (
              <Button
                key={prompt}
                type="button"
                variant="ghost"
                className="nitro-helpdesk-prompt-chip"
                onClick={() => setChatText(prompt)}
              >
                {prompt}
              </Button>
            ))}
          </div>
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_104px]">
            <Textarea
              value={chatText}
              onChange={(event) => setChatText(event.target.value)}
              placeholder="Ask a helpdesk question..."
              className="nitro-helpdesk-chat-input"
            />
            <Button variant="primary" disabled={chatPending} className="self-end">
              Send
              <ChevronRight size={16} />
            </Button>
          </div>
        </form>
      </Card>

      <aside className="grid content-start gap-4">
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold">Recent conversations</h2>
          </CardHeader>
          <CardBody className="grid gap-2">
            {conversations.length ? (
              conversations.slice(0, 6).map((conversation) => (
                <button
                  key={conversation.id}
                  className="nitro-helpdesk-conversation-button"
                  onClick={() => loadConversation(conversation)}
                >
                  <strong>{conversation.title}</strong>
                  <div className="mt-1 text-xs text-[#6f6f6f]">{formatDate(conversation.updated_at)}</div>
                </button>
              ))
            ) : (
              <EmptyPanel title="No chat history yet" text="Your conversations will appear here." />
            )}
          </CardBody>
        </Card>
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold">Agent context</h2>
          </CardHeader>
          <CardBody className="grid gap-3 text-sm text-[#4f4f4f]">
            <Capability icon={Bot} title="OCI Responses API" text="Maintains the multi-turn agent response." />
            <Capability icon={Boxes} title="OCI Vector Store" text="Searches approved source documents." />
            <Capability icon={Ticket} title="Ticket escalation" text="Creates a follow-up request when needed." />
          </CardBody>
        </Card>
      </aside>
    </div>
  );
}

function Capability({ icon: Icon, title, text }: { icon: LucideIcon; title: string; text: string }) {
  return (
    <div className="nitro-helpdesk-capability">
      <div className="flex items-center gap-2 font-semibold text-[#1f1f1f]">
        <Icon size={16} className="text-[#c74634]" />
        {title}
      </div>
      <p className="mt-1 text-sm leading-5">{text}</p>
    </div>
  );
}

function Tickets({ tickets, setTicketDetails }: { tickets: TicketType[]; setTicketDetails: (ticket: TicketType) => void }) {
  return (
    <Card className="mx-auto max-w-4xl">
      <CardHeader>
        <h2 className="text-xl font-semibold">Requests</h2>
        <p className="mt-1 text-sm text-[#6f6f6f]">Tickets created from helpdesk conversations.</p>
      </CardHeader>
      <CardBody>
        <Table
          headers={["Ticket", "Status", "Priority", "Created"]}
          rows={tickets.map((ticket) => [
            <button className="font-semibold hover:text-[#c74634]" onClick={() => setTicketDetails(ticket)}>
              #{ticket.zendesk_ticket_id ?? ticket.id} {ticket.subject}
            </button>,
            <Badge className={statusClass(ticket.status)}>{ticket.status}</Badge>,
            ticket.priority,
            formatDate(ticket.created_at),
          ])}
          empty="No tickets created yet."
        />
      </CardBody>
    </Card>
  );
}

function HelpTopics({ sendChat }: { sendChat: (message: string) => void }) {
  const topics = [
    ["IT Support", "How do I reset my VPN?"],
    ["HCM", "What HR policy applies to remote work?"],
    ["Payroll", "How do I update payroll details?"],
    ["Onboarding", "What is the onboarding checklist?"],
    ["Access Management", "Why does MFA fail after changing phones?"],
    ["Human handoff", "Create support ticket"],
  ];
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {topics.map(([title, prompt]) => (
        <Card key={title} className="p-5">
          <div className="mb-4 grid h-10 w-10 place-items-center rounded-xl bg-[#f7ddd7] text-[#c74634]">
            <Sparkles size={18} />
          </div>
          <h2 className="text-lg font-semibold">{title}</h2>
          <p className="mt-2 text-sm leading-6 text-[#4f4f4f]">{prompt}</p>
          <Button className="mt-5" variant="primary" onClick={() => sendChat(prompt)}>
            Ask
          </Button>
        </Card>
      ))}
    </div>
  );
}

function SourceDetails({ source }: { source: Citation }) {
  return (
    <div className="grid gap-3">
      <div className="rounded-2xl border border-[#ded9cf] bg-[#f8f7f4] p-4">
        <div className="font-semibold">{source.document_name || "Source"}</div>
        <div className="mt-1 text-sm text-[#6f6f6f]">Page {source.page_number || "not provided"}</div>
      </div>
      <div className="rounded-2xl border border-[#ded9cf] bg-white p-4 text-sm leading-6">{source.source_text || "No source excerpt was returned."}</div>
      <Badge className="bg-[#dcebf8] text-[#2567a8]">{confidenceLabel(source.score)} similarity</Badge>
    </div>
  );
}

function TicketForm({
  conversationId,
  defaultSubject,
  isSubmitting,
  onSubmit,
}: {
  conversationId: string | null;
  defaultSubject: string;
  isSubmitting: boolean;
  onSubmit: (payload: { conversation_id?: string | null; subject: string; description: string; priority: string }) => void;
}) {
  const [subject, setSubject] = useState(defaultSubject ? `Follow up: ${defaultSubject}` : "");
  const [description, setDescription] = useState(defaultSubject);
  const [priority, setPriority] = useState("Medium");
  return (
    <form
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit({ conversation_id: conversationId, subject, description, priority });
      }}
    >
      <label className="grid gap-2 text-sm font-semibold">
        Subject
        <Input value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="Subject" required />
      </label>
      <label className="grid gap-2 text-sm font-semibold">
        Description
        <Textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Description" required />
      </label>
      <label className="grid gap-2 text-sm font-semibold">
        Priority
        <Select value={priority} onChange={(event) => setPriority(event.target.value)}>
          <option>Low</option>
          <option>Medium</option>
          <option>High</option>
        </Select>
      </label>
      <Button variant="primary" disabled={isSubmitting}>
        {isSubmitting ? "Creating" : "Create ticket"}
      </Button>
    </form>
  );
}

function TicketDetails({ ticket }: { ticket: TicketType }) {
  const isClosed = ticket.status === "Resolved" || ticket.status === "Solved" || ticket.status === "Closed";
  const timeline = [
    ["Created", formatDate(ticket.created_at)],
    ["Routed", ticket.zendesk_ticket_id ? `Zendesk ticket #${ticket.zendesk_ticket_id}` : "Assigned to L1 HelpDesk queue"],
    [ticket.status, isClosed ? "Resolution recorded" : "Awaiting support update"],
  ];
  return (
    <div className="grid gap-3 text-sm">
      <Badge className={statusClass(ticket.status)}>{ticket.status}</Badge>
      <div className="rounded-2xl border border-[#ded9cf] bg-white p-4">
        <h3 className="font-semibold">{ticket.subject}</h3>
        <p className="mt-2 leading-6 text-[#4f4f4f]">{ticket.description}</p>
      </div>
      <div className="rounded-2xl border border-[#ded9cf] bg-[#f8f7f4] p-4">
        Priority: <strong>{ticket.priority}</strong>
      </div>
      {ticket.zendesk_ticket_url && (
        <a
          className="inline-flex min-h-10 items-center justify-center rounded-full border border-[#c74634] px-4 text-sm font-semibold text-[#b23a2b] hover:bg-[#f7ddd7]"
          href={ticket.zendesk_ticket_url}
          target="_blank"
          rel="noreferrer"
        >
          Open in Zendesk
        </a>
      )}
      <div className="rounded-2xl border border-[#ded9cf] bg-white p-4">
        <h3 className="mb-3 font-semibold">Timeline</h3>
        <div className="grid gap-3">
          {timeline.map(([label, detail], index) => (
            <div key={`${label}-${index}`} className="grid grid-cols-[24px_minmax(0,1fr)] gap-3">
              <div className="mt-1 h-3 w-3 rounded-full bg-[#c74634]" />
              <div>
                <div className="font-semibold">{label}</div>
                <div className="text-xs text-[#6f6f6f]">{detail}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ConversationDetails({
  conversation,
  traces,
  traceLoading,
}: {
  conversation: Conversation;
  traces: ExecutionTrace[];
  traceLoading: boolean;
}) {
  const latestUserMessage = conversation.messages.find((message) => message.role === "user");
  const latestAssistantMessage = [...conversation.messages].reverse().find((message) => message.role === "assistant");
  return (
    <div className="grid gap-4">
      <div className="rounded-2xl border border-[#ded9cf] bg-[#f8f7f4] p-4">
        <div className="text-xs font-semibold uppercase tracking-[0.04em] text-[#6f6f6f]">Query</div>
        <h3 className="mt-2 text-lg font-semibold">{conversation.title}</h3>
        <div className="mt-2 text-xs text-[#6f6f6f]">Updated {formatDate(conversation.updated_at)}</div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-[#ded9cf] bg-white p-3">
            <div className="text-xs font-semibold uppercase tracking-[0.04em] text-[#6f6f6f]">Agent</div>
            <div className="mt-1 text-sm font-semibold">{conversation.agent_name}</div>
          </div>
          <div className="rounded-xl border border-[#ded9cf] bg-white p-3">
            <div className="text-xs font-semibold uppercase tracking-[0.04em] text-[#6f6f6f]">Knowledge checked</div>
            <div className="mt-1 text-sm font-semibold">{categoryScopeLabel(conversation.knowledge_categories)}</div>
          </div>
        </div>
      </div>

      {latestUserMessage && (
        <div className="rounded-2xl border border-[#ded9cf] bg-white p-4">
          <div className="mb-2 text-xs font-semibold uppercase tracking-[0.04em] text-[#6f6f6f]">User query</div>
          <p className="text-sm leading-6">{latestUserMessage.content}</p>
        </div>
      )}

      {latestAssistantMessage && (
        <div className="rounded-2xl border border-[#ded9cf] bg-white p-4">
          <div className="mb-2 text-xs font-semibold uppercase tracking-[0.04em] text-[#6f6f6f]">Full response</div>
          <p className="text-sm leading-6">{latestAssistantMessage.content}</p>
          {latestAssistantMessage.confidence !== undefined && latestAssistantMessage.confidence !== null && (
            <Badge className="mt-3 bg-[#dcebf8] text-[#2567a8]">{confidenceLabel(latestAssistantMessage.confidence)} confidence</Badge>
          )}
          {latestAssistantMessage.citations.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {latestAssistantMessage.citations.map((citation) => (
                <Badge key={`${citation.document_id}-${citation.page_number}-${citation.document_name}`}>{citation.document_name}</Badge>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="rounded-2xl border border-[#ded9cf] bg-white p-4">
        <div className="mb-3">
          <h3 className="text-lg font-semibold">Execution trace</h3>
          <p className="mt-1 text-sm text-[#6f6f6f]">Request path, retrieval result, source count, generation, and token usage.</p>
        </div>
        <div className="grid gap-3">
          {traceLoading ? (
            <div className="rounded-xl border border-[#ded9cf] bg-[#f8f7f4] p-3 text-sm text-[#4f4f4f]">Loading execution trace...</div>
          ) : traces.length ? (
            traces.map((item) => <TraceCard key={`${item.conversation_id}-${item.created_at}`} trace={item} />)
          ) : (
            <EmptyPanel title="No execution trace" text="Trace data will appear here after the agent records an OCI request." />
          )}
        </div>
      </div>
    </div>
  );
}

function Table({
  headers,
  rows,
  empty,
}: {
  headers: string[];
  rows: Array<Array<ReactNode>>;
  empty: string;
}) {
  type RowData = { id: string; cells: ReactNode[] };
  type ColumnKey = `c${number}`;
  const data: RowData[] = rows.map((cells, index) => ({ id: String(index), cells }));
  const columnKeys = headers.map((_, index) => `c${index}` as ColumnKey);
  const columns = headers.reduce<Record<ColumnKey, { headerText: string; renderer: (ctx: { rowData: RowData; columnKey: ColumnKey }) => ReactNode; minWidth: number }>>(
    (values, header, index) => {
      const key = `c${index}` as ColumnKey;
      values[key] = {
        headerText: header,
        minWidth: index === 0 ? 180 : 140,
        renderer: ({ rowData }) => <div className="nitro-helpdesk-table-cell">{rowData.cells[index]}</div>,
      };
      return values;
    },
    {} as Record<ColumnKey, { headerText: string; renderer: (ctx: { rowData: RowData; columnKey: ColumnKey }) => ReactNode; minWidth: number }>
  );
  const minWidth = `${Math.max(760, headers.length * 150)}px`;

  return (
    <div className="nitro-helpdesk-table-wrap">
      <NitroTable<string, RowData, ColumnKey>
        aria-label={headers.join(", ")}
        data={data}
        getRowKey={(item) => item.id}
        columns={columns}
        columnOrder={columnKeys}
        getAccessibleRowHeaders={() => new Set([columnKeys[0]])}
        gridlines={{ horizontal: "visible", vertical: "hidden" }}
        layout="fixed"
        minWidth={minWidth}
        noData={<div className="p-6 text-center text-[#6f6f6f]">{empty}</div>}
      />
    </div>
  );
}

export default App;
