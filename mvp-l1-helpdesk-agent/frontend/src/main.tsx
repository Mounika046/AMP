import React from "react";
import ReactDOM from "react-dom/client";
import { defaultEnabledProviders, NitroProviders } from "@idp/nitro-providers";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App";
import { applyNitroAppDocumentTheme, NITRO_APP_THEME_PROVIDER_PROPS } from "./app-theme";
import "./styles.css";

const queryClient = new QueryClient();

const nitroConfig = {
  developerId: "oci-l1-helpdesk",
  prefix: "idp",
  ENABLE_ASK_ORACLE: false,
  ENABLE_NOTIFICATIONS: false,
  USER_DISPLAY_NAME: "HelpDesk Admin",
  AVATAR_INITIALS: "HD",
};

applyNitroAppDocumentTheme(document.documentElement);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <NitroProviders
      enabledProviders={[...defaultEnabledProviders, "AuthProvider", "DirtyDataProvider"]}
      providersProps={{
        ConfigurationProvider: {
          defaultConfig: nitroConfig,
        },
        ThemeProvider: NITRO_APP_THEME_PROVIDER_PROPS,
      }}
    >
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </NitroProviders>
  </React.StrictMode>
);
