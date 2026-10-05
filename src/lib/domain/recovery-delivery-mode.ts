export type RecoveryDeliveryMode = "ADMIN_MANUAL" | "EMAIL" | "DEVELOPMENT";

export function recoveryDeliveryMode(env: {
  NODE_ENV?: string;
  SMTP_HOST?: string;
  SMTP_USER?: string;
  SMTP_PASSWORD?: string;
}): RecoveryDeliveryMode {
  if (env.NODE_ENV !== "production") return "DEVELOPMENT";
  return env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASSWORD ? "EMAIL" : "ADMIN_MANUAL";
}
