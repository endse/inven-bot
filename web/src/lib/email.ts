import nodemailer from 'nodemailer';

// You will need to set these in your .env
// SMTP_HOST="smtp.gmail.com"
// SMTP_PORT="587"
// SMTP_USER="your-email@gmail.com"
// SMTP_PASS="your-app-password"
// SMTP_FROM="your-email@gmail.com"

export const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: Number(process.env.SMTP_PORT) || 587,
  secure: process.env.SMTP_PORT === '465',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export async function sendEmailWithPdf(to: string, subject: string, text: string, pdfBuffer: Buffer, filename: string) {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn("SMTP credentials missing. Simulating email send for:", to, subject);
    return { simulated: true };
  }

  const info = await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to,
    subject,
    text,
    attachments: [
      {
        filename,
        content: pdfBuffer,
        contentType: 'application/pdf',
      }
    ]
  });

  return info;
}

export async function sendEmail(to: string, subject: string, text: string, html?: string) {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn("SMTP credentials missing. Simulating email send for:", to, subject);
    return { simulated: true };
  }

  const info = await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to,
    subject,
    text,
    html,
  });

  return info;
}
