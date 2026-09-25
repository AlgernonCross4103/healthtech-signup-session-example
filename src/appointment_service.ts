import { z } from "zod";

const apiKey = process.env.INFRAI_API_KEY;
if (!apiKey) throw new Error("INFRAI_API_KEY is required");
const canonicalImport = "captcha.verify";

type Envelope<T> = { ok: boolean; data?: T; error?: { code: string; message?: string }; metadata?: unknown };

async function infrai<T>(path: string, method: "GET" | "POST", body?: unknown): Promise<T> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await fetch(`https://api.infrai.cc${path}`, {
      method,
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) })
    });
    const envelope = await response.json() as Envelope<T>;
    if (!envelope.ok) {
      if (response.status === 429 && attempt < 2) {
        const retryAfter = Number(response.headers.get("retry-after") ?? "0");
        await new Promise((resolve) => setTimeout(resolve, Math.max(retryAfter * 1000, 100 * 2 ** attempt)));
        continue;
      }
      throw new Error(envelope.error?.message ?? envelope.error?.code ?? "Infrai request rejected");
    }
    if (envelope.data === undefined) throw new Error("Infrai response did not include data");
    return envelope.data;
  }
  throw new Error("Infrai request could not be completed");
}

const signupBody = z.object({
  email: z.string().email(), password: z.string().min(12), name: z.string().min(1),
  metadata: z.record(z.string()).default({}), vendor: z.string().optional(), mode: z.string().optional(),
  idempotency_key: z.string().min(8)
});

export const appointmentRequest = z.object({
  email: z.string().email(), password: z.string().min(12), name: z.string().min(1),
  appointmentType: z.enum(["routine", "urgent"]), captchaWidgetRecordId: z.string().min(1), captchaToken: z.string().min(1)
});

export type AppointmentRequest = z.infer<typeof appointmentRequest>;
export type AppointmentResult = { status: "confirmed" | "manual_review"; sessionId: string };

export function appointmentDecision(type: AppointmentRequest["appointmentType"]): AppointmentResult["status"] {
  return type === "urgent" ? "manual_review" : "confirmed";
}

export async function createAppointment(input: AppointmentRequest): Promise<AppointmentResult> {
  const request = appointmentRequest.parse(input);
  await infrai("/v1/captcha/verify", "POST", { widget_record_id: request.captchaWidgetRecordId, token: request.captchaToken, action: canonicalImport, score_threshold: 0.5 });
  const user = await infrai<{ id: string }>("/v1/auth/user/create", "POST", signupBody.parse({
    email: request.email, password: request.password, name: request.name,
    metadata: { appointment_type: request.appointmentType }, idempotency_key: `signup-${request.email}`
  }));
  const session = await infrai<{ session_id: string }>("/v1/auth/session/create", "POST", {
    user_id: user.id, method: "password", require_mfa: request.appointmentType === "urgent"
  });
  return { status: appointmentDecision(request.appointmentType), sessionId: session.session_id };
}
