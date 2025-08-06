// ✅ Send email using local backend (NodeMailer via internal SMTP)
export const sendEmail = async (to, subject, message, fromEmail) => {
  try {
    // Use LAN IP or localhost depending on .env
const backendUrl = process.env.REACT_APP_API_URL || "http://10.27.16.58:5000";

    // Normalize sender email to ensure valid format
    const normalizedSender = fromEmail?.includes("@") ? fromEmail : `${fromEmail}@swd.bh`;

    const response = await fetch(`${backendUrl}/send-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to,
        subject,
        message,
        fromEmail: normalizedSender,
      }),
    });

    if (!response.ok) {
      const errorDetails = await response.text();
      console.error(`❌ Email failed to ${to}:`, errorDetails);
      return { success: false, error: errorDetails };
    }

    console.log(`✅ Email sent to ${to}`);
    return { success: true };
  } catch (error) {
    console.error(`❌ Failed to send email to ${to}:`, error);
    return { success: false, error: error.message };
  }
};
