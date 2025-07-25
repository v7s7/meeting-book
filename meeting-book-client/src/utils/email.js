// For pending booking notifications (NodeMailer)
export const sendPendingEmail = async (to, subject, message) => {
  try {
    const backendUrl = process.env.REACT_APP_API_URL || "http://localhost:5000";
    const response = await fetch(`${backendUrl}/send-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to, subject, message }),
    });

    if (!response.ok) {
      const errorDetails = await response.text();
      console.error(`❌ Pending email failed to ${to}:`, errorDetails);
      return { success: false, error: errorDetails };
    }

    console.log(`✅ Pending email sent to ${to}`);
    return { success: true };
  } catch (error) {
    console.error(`❌ Failed to send pending email to ${to}:`, error);
    return { success: false, error: error.message };
  }
};

// For approve/decline booking notifications (Microsoft Graph)
export const sendGraphEmail = async (to, subject, message, accessToken, getFreshAccessToken) => {
  try {
    // Ensure we have a valid MSAL access token
    let token = accessToken;
    if (!token && typeof getFreshAccessToken === 'function') {
      token = await getFreshAccessToken();
    }

    if (!token) {
      console.warn(`No Graph access token available for ${to}.`);
      return { success: false, error: "Missing Graph access token" };
    }

    const backendUrl = process.env.REACT_APP_API_URL || "http://localhost:5000";
    const response = await fetch(`${backendUrl}/send-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to, subject, message, accessToken: token }),
    });

    if (!response.ok) {
      const errorDetails = await response.text();
      console.error(`❌ Graph email failed to ${to}:`, errorDetails);
      return { success: false, error: errorDetails };
    }

    console.log(`✅ Graph email sent to ${to}`);
    return { success: true };
  } catch (error) {
    console.error(`❌ Failed to send Graph email to ${to}:`, error);
    return { success: false, error: error.message };
  }
};
