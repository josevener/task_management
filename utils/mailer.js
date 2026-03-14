const nodemailer = require('nodemailer');

// Setup NodeMailer transport for Hostinger
const createTransporter = () => {
  const port = parseInt(process.env.SMTP_PORT) || 465;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.hostinger.com',
    port: port,
    secure: port === 465, // true for 465, false for other ports (like 587)
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
};

/**
 * Send an email
 * 
 * @param {Object} options
 * @param {string} options.to - Recipient email
 * @param {string} options.subject - Email subject
 * @param {string} options.html - HTML content
 * @param {string} [options.text] - Plain text content fallback
 */
const sendMail = async ({ to, subject, html, text }) => {
  try {
    const transporter = createTransporter();

    // Check if configuration is present, if not just log (useful for dev environments without SMTP config)
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      console.warn('SMTP credentials are not configured. Email would have been sent to:', to);
      console.warn('Subject:', subject);
      console.log('--- HTML Content ---');
      console.log(html);
      return true; // Simulate success in dev
    }

    const info = await transporter.sendMail({
      from: `"Zentrix Task Management" <${process.env.SMTP_USER}>`,
      to,
      subject,
      text: text || html.replace(/<[^>]*>?/gm, ''), // naive html to text fallback
      html,
    });

    console.log('Message sent: %s', info.messageId);
    return true;
  }
  catch (error) {
    console.error('Error sending email:', error);
    throw error;
  }
};

module.exports = {
  sendMail,
};
