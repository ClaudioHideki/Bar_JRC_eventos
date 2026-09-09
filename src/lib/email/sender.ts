import nodemailer from "nodemailer";

interface OtpCaptureEntry {
  email: string;
  otp: string;
  type: string;
  sentAt: Date;
}

// In-memory capture sink exclusively for automated tests
export const testOtpSink: OtpCaptureEntry[] = [];

export function getLastTestOtp(email: string): string | undefined {
  const normalized = email.toLowerCase().trim();
  for (let i = testOtpSink.length - 1; i >= 0; i--) {
    if (testOtpSink[i].email.toLowerCase().trim() === normalized) {
      return testOtpSink[i].otp;
    }
  }
  return undefined;
}

export function clearTestOtpSink(): void {
  testOtpSink.length = 0;
}

export async function sendEmailOtp({
  email,
  otp,
  type,
}: {
  email: string;
  otp: string;
  type: "LOGIN" | "INVITATION_ACTIVATION";
}): Promise<void> {
  const isTest = process.env.NODE_ENV === "test";

  if (isTest) {
    testOtpSink.push({ email, otp, type, sentAt: new Date() });
    return;
  }

  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = parseInt(process.env.SMTP_PORT || "587", 10);
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASSWORD;
  const smtpFrom = process.env.SMTP_FROM || "Passaporte JRC <no-reply@jrc.com.br>";

  if (!smtpHost || !smtpUser || !smtpPass) {
    // Modo de desenvolvimento sem SMTP configurado: armazena no sink e imprime no terminal
    testOtpSink.push({ email, otp, type, sentAt: new Date() });
    console.log(`
============================================================
🔑 [CÓDIGO DE ACESSO - LOCAL / DEV]
Destinatário: ${email}
Código OTP:   ${otp}
Finalidade:   ${type}
Validade:     5 minutos
============================================================
`);
    return;
  }

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
  });

  const subject =
    type === "INVITATION_ACTIVATION"
      ? "Seu Código de Ativação - Passaporte JRC"
      : "Seu Código de Acesso - Passaporte JRC";

  await transporter.sendMail({
    from: smtpFrom,
    to: email,
    subject,
    text: `Olá,\n\nSeu código de verificação para o Passaporte JRC é: ${otp}\n\nEste código expira em 5 minutos.`,
    html: `
      <div style="font-family: sans-serif; background-color: #071725; color: #f7f8fa; padding: 24px; border-radius: 8px;">
        <h2 style="color: #cdaa63; margin-bottom: 16px;">Passaporte de Eventos JRC</h2>
        <p>Seu código de uso único é:</p>
        <div style="font-size: 32px; font-weight: bold; letter-spacing: 4px; color: #19b8c4; margin: 20px 0;">${otp}</div>
        <p style="color: #9eacba; font-size: 13px;">O código expira em 5 minutos. Se você não solicitou, desconsidere esta mensagem.</p>
      </div>
    `,
  });
}
