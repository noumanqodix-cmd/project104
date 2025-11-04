import nodemailer from 'nodemailer';

// Email transporter configuration
// Make sure you have these environment variables set in your .env file:
// SMTP_HOST=smtp.gmail.com (or your SMTP server)
// SMTP_PORT=587
// SMTP_USER=your-email@gmail.com
// SMTP_PASSWORD=your-app-password

let emailTransporter: nodemailer.Transporter | null = null;

// Initialize email transporter
export const initializeEmailTransporter = () => {
  const smtpHost = process.env.SMTP_HOST || "smtp.gmail.com";
  const smtpPort = process.env.SMTP_PORT || "587";
  const smtpUser = process.env.SMTP_USER || "zyousaf475@gmail.com";
  const smtpPassword = process.env.SMTP_PASSWORD || "ezsi posl hunt dzkq";

  // Check if all required SMTP variables are set
  if (!smtpHost || !smtpPort || !smtpUser || !smtpPassword) {
    console.error('⚠️  Email service not configured. Missing SMTP environment variables.');
    console.error('Required variables: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD');
    return null;
  }

  try {
    emailTransporter = nodemailer.createTransport({
      host: smtpHost,
      port: parseInt(smtpPort),
      secure: parseInt(smtpPort) === 465, // true for port 465, false for other ports
      auth: {
        user: smtpUser,
        pass: smtpPassword,
      },
    });

    console.log('✓ Email transporter initialized successfully');
    return emailTransporter;
  } catch (error) {
    console.error('Failed to initialize email transporter:', error);
    return null;
  }
};

// Get the email transporter instance
export const getEmailTransporter = () => {
  if (!emailTransporter) {
    return initializeEmailTransporter();
  }
  return emailTransporter;
};

// Verify email connection (optional but recommended)
export const verifyEmailConnection = async () => {
  if (!emailTransporter) {
    console.error('Email transporter not initialized');
    return false;
  }

  try {
    await emailTransporter.verify();
    console.log('✓ Email server connection verified');
    return true;
  } catch (error) {
    console.error('Email server connection failed:', error);
    return false;
  }
};

export { emailTransporter };