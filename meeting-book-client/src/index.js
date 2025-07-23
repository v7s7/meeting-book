import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { MsalProvider } from "@azure/msal-react";
import { msalInstance } from "./utils/msalConfig";

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <MsalProvider instance={msalInstance}>
    <App />
  </MsalProvider>
);

