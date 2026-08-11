// Ported from the original Express api-server `connectors/email-connector.ts`
// and `templates/appointment-email.ts`. Uses the Resend HTTP API via `fetch`
// instead of nodemailer/SMTP, since Node-only APIs are unavailable here.

export type EmailResult = {
  success: boolean;
  messageId?: string;
  error?: string;
};

export type AppointmentEmailPayload = {
  to: string;
  patientName: string;
  appointmentReference: string;
  doctorName: string;
  specialty: string;
  clinicName: string;
  appointmentDate: string;
  appointmentTime: string;
  status: string;
  htmlBody: string;
};

export type AppointmentEmailData = {
  patientName: string;
  appointmentReference: string;
  doctorName: string;
  specialty: string;
  clinicName: string;
  appointmentDate: string;
  appointmentTime: string;
  status: string;
};

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

export function buildAppointmentEmailHtml(data: AppointmentEmailData): string {
  const statusColor =
    data.status === "Confirmed" ? "#1D9E75" : data.status === "Pending" ? "#F59E0B" : "#EF4444";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Appointment Confirmation</title>
</head>
<body style="margin:0;padding:0;background:#F3F4F6;font-family:'Inter',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F3F4F6;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#FFFFFF;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.07);">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#4A4FC4 0%,#3A3FA0 100%);padding:32px 40px;text-align:center;">
              <h1 style="margin:0;color:#FFFFFF;font-size:28px;font-weight:700;letter-spacing:-0.5px;">SugboDoc</h1>
              <p style="margin:6px 0 0;color:rgba(255,255,255,0.75);font-size:13px;">Your lifelong digital health record</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:36px 40px;">
              <p style="margin:0 0 8px;color:#6B7280;font-size:14px;">Hello,</p>
              <h2 style="margin:0 0 24px;color:#1A1A2E;font-size:22px;font-weight:700;">${escapeHtml(data.patientName)}</h2>

              <p style="margin:0 0 28px;color:#4B5563;font-size:15px;line-height:1.6;">
                Your appointment has been successfully booked. Please review the details below.
              </p>

              <!-- Appointment card -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#F8F9FF;border:1px solid #E8E9FB;border-radius:12px;overflow:hidden;margin-bottom:28px;">
                <tr>
                  <td style="padding:20px 24px;border-bottom:1px solid #E8E9FB;">
                    <p style="margin:0;color:#6B7280;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.8px;">Appointment Reference</p>
                    <p style="margin:4px 0 0;color:#4A4FC4;font-size:18px;font-weight:700;">${escapeHtml(data.appointmentReference)}</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:20px 24px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding:6px 0;width:50%;vertical-align:top;">
                          <p style="margin:0;color:#6B7280;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.8px;">Doctor</p>
                          <p style="margin:4px 0 0;color:#1A1A2E;font-size:14px;font-weight:600;">${escapeHtml(data.doctorName)}</p>
                        </td>
                        <td style="padding:6px 0;width:50%;vertical-align:top;">
                          <p style="margin:0;color:#6B7280;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.8px;">Specialty</p>
                          <p style="margin:4px 0 0;color:#1A1A2E;font-size:14px;font-weight:600;">${escapeHtml(data.specialty)}</p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:6px 0;width:50%;vertical-align:top;">
                          <p style="margin:0;color:#6B7280;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.8px;">Date</p>
                          <p style="margin:4px 0 0;color:#1A1A2E;font-size:14px;font-weight:600;">${escapeHtml(data.appointmentDate)}</p>
                        </td>
                        <td style="padding:6px 0;width:50%;vertical-align:top;">
                          <p style="margin:0;color:#6B7280;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.8px;">Time</p>
                          <p style="margin:4px 0 0;color:#1A1A2E;font-size:14px;font-weight:600;">${escapeHtml(data.appointmentTime)}</p>
                        </td>
                      </tr>
                      <tr>
                        <td colspan="2" style="padding:6px 0;vertical-align:top;">
                          <p style="margin:0;color:#6B7280;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.8px;">Clinic</p>
                          <p style="margin:4px 0 0;color:#1A1A2E;font-size:14px;font-weight:600;">${escapeHtml(data.clinicName)}</p>
                        </td>
                      </tr>
                      <tr>
                        <td colspan="2" style="padding:6px 0;vertical-align:top;">
                          <p style="margin:0;color:#6B7280;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.8px;">Status</p>
                          <span style="display:inline-block;margin-top:4px;padding:3px 10px;border-radius:20px;background:${statusColor}20;color:${statusColor};font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">${escapeHtml(data.status)}</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Reminder -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#FFFBEB;border:1px solid #FDE68A;border-radius:10px;margin-bottom:28px;">
                <tr>
                  <td style="padding:14px 18px;">
                    <p style="margin:0;color:#92400E;font-size:13px;line-height:1.5;">
                      <strong>Reminder:</strong> Please arrive at least <strong>15 minutes</strong> before your scheduled appointment time.
                    </p>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 4px;color:#6B7280;font-size:13px;line-height:1.6;">
                To cancel or reschedule, please contact the clinic directly or use the SugboDoc portal.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 40px;background:#F9FAFB;border-top:1px solid #E5E7EB;text-align:center;">
              <p style="margin:0;color:#9CA3AF;font-size:12px;">
                This is an automated message from <strong style="color:#4A4FC4;">SugboDoc</strong>.<br />
                Please do not reply to this email.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function encodeSubject(subject: string): string {
  const encoded = base64Url(new TextEncoder().encode(subject)).replace(/-/g, "+").replace(/_/g, "/");
  return `=?UTF-8?B?${encoded}?=`;
}

export async function sendAppointmentEmail(payload: AppointmentEmailPayload): Promise<EmailResult> {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const gmailKey = process.env["GOOGLE_MAIL_API_KEY"];

  if (!lovableKey || !gmailKey) {
    return { success: false, error: "Gmail is not connected yet. Link the Gmail connector to enable email." };
  }

  const subject = `SugboDoc Appointment Confirmation — ${payload.appointmentReference}`;
  const rfc2822 = [
    `To: ${payload.to}`,
    `Subject: ${encodeSubject(subject)}`,
    "MIME-Version: 1.0",
    'Content-Type: text/html; charset="UTF-8"',
    "",
    payload.htmlBody,
  ].join("\r\n");

  try {
    const response = await fetch(
      "https://connector-gateway.lovable.dev/google_mail/gmail/v1/users/me/messages/send",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${lovableKey}`,
          "X-Connection-Api-Key": gmailKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ raw: base64Url(new TextEncoder().encode(rfc2822)) }),
      },
    );

    const bodyText = await response.text();
    if (!response.ok) {
      console.error(`[gmail send] failed [${response.status}]: ${bodyText}`);
      return { success: false, error: `Gmail send failed [${response.status}]: ${bodyText}` };
    }
    const result = JSON.parse(bodyText || "{}") as { id?: string };
    return { success: true, messageId: result.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown email error";
    return { success: false, error: message };
  }
}

