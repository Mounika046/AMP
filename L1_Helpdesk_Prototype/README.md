# L1 HelpDesk Agent Prototype

High fidelity standalone prototype for an enterprise L1 HelpDesk agent. The app demonstrates a reusable Enterprise AI RAG Agent framework with the L1 HelpDesk use case as the primary profile.

## Run Locally

Start both local servers with one command:

```powershell
npm run dev
```

Or open two terminals from this folder:

```powershell
npm run start:backend
```

```powershell
npm run start:frontend
```

Then open:

```text
http://localhost:5288
```

The mock backend runs at:

```text
http://localhost:4188/api/health
```

To stop servers started with `npm run dev`:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/stop-dev.ps1
```

## Prototype Scope

- No production authentication.
- No real database.
- No real OCI, Oracle HR Helpdesk, or vector store connection.
- APIs return realistic mock data with small simulated delays.
- UI labels show where OCI Responses API, Embeddings, OCI Vector Store, Tool Calling, Agent Memory, and monitoring would be used in production.

## App Structure

```text
backend/
  mockData.js
  server.js
frontend/
  app.js
  index.html
  server.js
  styles.css
```
