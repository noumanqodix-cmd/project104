import { getEmailTransporter } from "./email-config";

interface EmailOptions {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export const sendEmail = async (options: EmailOptions) => {
  const emailTransporter = getEmailTransporter();

  if (!emailTransporter) {
    console.error("[EMAIL] Email transporter not initialized. Cannot send email.");
    throw new Error("Email service is not configured.");
  }

  try {
    console.log(`[EMAIL] Sending email to ${options.to}`);
    const info = await emailTransporter.sendMail({
      from: '"Morphit" <zyousaf475@gmail.com>', // Sender address
      ...options,
    });
    console.log(`[EMAIL] Message sent: ${info.messageId}`);
    return info;
  } catch (error) {
    console.error(`[EMAIL] Failed to send email to ${options.to}:`, error);
    throw new Error("Failed to send email.");
  }
};
