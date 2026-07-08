export type Role = "Admin" | "User";

export type Agent = {
  id: string;
  name: string;
  description: string;
  response_tone: "Concise" | "Friendly" | "Formal";
  instructions: string;
  knowledge_categories: string[];
};

export type DocumentRow = {
  id: string;
  name: string;
  category: string;
  status: "Processing" | "Indexed" | "Failed";
  chunks: number;
  vector_store_file_id?: string | null;
  vector_store_batch_id?: string | null;
  error?: string | null;
  created_at: string;
};

export type Category = {
  id: number;
  name: string;
  description?: string | null;
  created_at: string;
};

export type SettingItem = {
  key: string;
  value: string;
  updated_at: string;
  default_value: string;
  label: string;
  description: string;
  type_hint: "text" | "textarea" | "int" | "float" | "boolean";
  section: "chunking" | "retrieval" | "llm" | "ui" | "tools";
};

export type Citation = {
  document_id: string;
  document_name: string;
  page_number: number;
  source_text: string;
  score: number;
};

export type ChatResponse = {
  conversation_id: string;
  user_message_id: string;
  assistant_message_id: string;
  answer: string;
  confidence: number;
  citations: Citation[];
  suggested_prompts: string[];
};

export type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  confidence?: number | null;
  created_at: string;
  citations: Citation[];
};

export type Conversation = {
  id: string;
  agent_id: string;
  agent_name: string;
  knowledge_categories: string[];
  title: string;
  created_at: string;
  updated_at: string;
  escalated: boolean;
  messages: Message[];
};

export type Ticket = {
  id: number;
  conversation_id?: string | null;
  subject: string;
  description: string;
  priority: "Low" | "Medium" | "High";
  status: "New" | "Open" | "Pending" | "On Hold" | "Solved" | "Closed" | "In Progress" | "Resolved";
  zendesk_ticket_id?: number | null;
  zendesk_ticket_url?: string | null;
  created_at: string;
};

export type DashboardMetrics = {
  documents: number;
  chunks: number;
  questions_asked: number;
  tickets_created: number;
  escalation_rate: number;
};

export type MonitoringRow = {
  conversation_id: string;
  agent_name: string;
  knowledge_categories: string[];
  query: string;
  answer: string;
  response_summary: string;
  category: string;
  sources: number;
  tools_called: string[];
  ticket_created: boolean;
  escalated: boolean;
  latency: string;
  confidence: number;
  input_tokens?: number | null;
  output_tokens?: number | null;
  total_tokens?: number | null;
  time: string;
};

export type ExecutionTrace = {
  conversation_id: string;
  question: string;
  retrieval_summary: string;
  sources_found: number;
  answer_summary: string;
  tools_called: string[];
  tool_summary?: string | null;
  input_tokens?: number | null;
  output_tokens?: number | null;
  total_tokens?: number | null;
  created_at: string;
};
