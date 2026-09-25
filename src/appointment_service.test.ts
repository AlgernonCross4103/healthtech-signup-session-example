import { strict as assert } from "node:assert";
import { appointmentDecision, appointmentRequest } from "./appointment_service.ts";

assert.equal(appointmentDecision("routine"), "confirmed");
assert.equal(appointmentDecision("urgent"), "manual_review");
assert.equal(appointmentRequest.safeParse({ email: "patient@example.com", password: "long-enough-password", name: "Pat", appointmentType: "routine", captchaWidgetRecordId: "widget-id", captchaToken: "token" }).success, true);
assert.equal(appointmentRequest.safeParse({ email: "patient@example.com", password: "long-enough-password", name: "Pat", appointmentType: "routine", captchaToken: "token" }).success, false);
console.log("appointment decision checks passed");
