import nodemailer from "nodemailer";

export async function sendContactEmail(opts: {
  to: string;
  subject: string;
  text: string;
}) {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM || user;

  if (!host || !user || !pass || !opts.to) {
    console.warn("[mail] SMTP not configured or missing recipient; logging only:", opts);
    return { ok: false as const, error: "SMTP not configured" };
  }

  const transporter = nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT || 587),
    secure: false,
    auth: { user, pass },
  });

  await transporter.sendMail({
    from,
    to: opts.to,
    subject: opts.subject,
    text: opts.text,
  });

  return { ok: true as const };
}
