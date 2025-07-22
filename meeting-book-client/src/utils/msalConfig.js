import { PublicClientApplication } from "@azure/msal-browser";

const msalConfig = {
  auth: {
    clientId: "1fff571d-d94c-4603-a021-b1c62830bdf5", // Your App ID
    authority: "https://login.microsoftonline.com/85c4f037-2a6d-4213-b75c-b005446ce2a9", // Tenant-specific
    redirectUri:
      window.location.hostname === "localhost"
        ? "http://localhost:3000"
        : "https://meeting-book.vercel.app",
  },
  cache: {
    cacheLocation: "sessionStorage",
    storeAuthStateInCookie: false,
  },
};

// Scopes required for user profile and sending emails
export const loginRequest = {
  scopes: ["User.Read", "Mail.Send"],
};

export const msalInstance = new PublicClientApplication(msalConfig);
