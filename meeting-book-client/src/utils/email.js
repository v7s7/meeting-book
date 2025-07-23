export const sendEmail = async (to, subject, message, accessToken, getFreshAccessToken) => {
  try {
    const token = accessToken || (await getFreshAccessToken());
    if (!token) {
      console.warn(`No access token available for sending email to ${to}.`);
      return { success: false, error: "Missing access token" };
    }

    const response = await fetch("/send-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to, subject, message, accessToken: token }),
    });

    if (!response.ok) {
      const errorDetails = await response.text();
      console.error(`Email send failed to ${to}:`, errorDetails);
      return { success: false, error: errorDetails };
    }

    return { success: true };
  } catch (error) {
    console.error(`Failed to send email to ${to}:`, error);
    return { success: false, error: error.message };
  }
};
