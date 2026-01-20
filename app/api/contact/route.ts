import { NextRequest, NextResponse } from "next/server";
import { gmailClient } from "@/lib/gmail/gmail-client";

interface ContactFormData {
  name: string;
  email: string;
  subject: string;
  message: string;
}

// Rate limiting: simple in-memory store (resets on server restart)
const submissionTimestamps: Map<string, number[]> = new Map();
const RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1 hour
const MAX_SUBMISSIONS_PER_WINDOW = 5;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const timestamps = submissionTimestamps.get(ip) || [];

  // Filter out old timestamps
  const recentTimestamps = timestamps.filter(
    (ts) => now - ts < RATE_LIMIT_WINDOW
  );

  // Update the store
  submissionTimestamps.set(ip, recentTimestamps);

  return recentTimestamps.length >= MAX_SUBMISSIONS_PER_WINDOW;
}

function recordSubmission(ip: string): void {
  const timestamps = submissionTimestamps.get(ip) || [];
  timestamps.push(Date.now());
  submissionTimestamps.set(ip, timestamps);
}

function validateFormData(data: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!data.name || typeof data.name !== "string" || data.name.trim().length === 0) {
    errors.push("Name is required");
  }

  if (!data.email || typeof data.email !== "string") {
    errors.push("Email is required");
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    errors.push("Invalid email format");
  }

  if (!data.subject || typeof data.subject !== "string" || data.subject.trim().length === 0) {
    errors.push("Subject is required");
  }

  if (!data.message || typeof data.message !== "string" || data.message.trim().length < 10) {
    errors.push("Message must be at least 10 characters");
  }

  // Basic XSS prevention - check for suspicious content
  const suspiciousPatterns = [/<script/i, /javascript:/i, /on\w+=/i];
  const allContent = `${data.name} ${data.email} ${data.subject} ${data.message}`;
  for (const pattern of suspiciousPatterns) {
    if (pattern.test(allContent)) {
      errors.push("Invalid content detected");
      break;
    }
  }

  return { valid: errors.length === 0, errors };
}

function escapeHtml(text: string): string {
  const htmlEntities: { [key: string]: string } = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };
  return text.replace(/[&<>"']/g, (char) => htmlEntities[char]);
}

function createEmailHtml(data: ContactFormData): string {
  const escapedName = escapeHtml(data.name);
  const escapedEmail = escapeHtml(data.email);
  const escapedSubject = escapeHtml(data.subject);
  const escapedMessage = escapeHtml(data.message).replace(/\n/g, "<br>");

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>New Contact Form Submission</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 24px;">New Contact Form Submission</h1>
      </div>

      <div style="background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb; font-weight: 600; width: 100px;">From:</td>
            <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb;">${escapedName}</td>
          </tr>
          <tr>
            <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb; font-weight: 600;">Email:</td>
            <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb;">
              <a href="mailto:${escapedEmail}" style="color: #4f46e5;">${escapedEmail}</a>
            </td>
          </tr>
          <tr>
            <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb; font-weight: 600;">Subject:</td>
            <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb;">${escapedSubject}</td>
          </tr>
        </table>

        <div style="margin-top: 24px;">
          <h3 style="margin: 0 0 12px 0; font-size: 16px; font-weight: 600;">Message:</h3>
          <div style="background: white; padding: 20px; border-radius: 8px; border: 1px solid #e5e7eb;">
            ${escapedMessage}
          </div>
        </div>

        <div style="margin-top: 24px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #6b7280;">
          <p style="margin: 0;">This message was sent from the contact form on gsdesignresearch.com</p>
          <p style="margin: 8px 0 0 0;">Received at: ${new Date().toLocaleString("en-US", { timeZone: "America/Chicago" })} CT</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

export async function POST(request: NextRequest) {
  try {
    // Get client IP for rate limiting
    const forwardedFor = request.headers.get("x-forwarded-for");
    const ip = forwardedFor?.split(",")[0]?.trim() || "unknown";

    // Check rate limit
    if (isRateLimited(ip)) {
      console.log(`Rate limited contact form submission from IP: ${ip}`);
      return NextResponse.json(
        { success: false, error: "Too many submissions. Please try again later." },
        { status: 429 }
      );
    }

    // Parse request body
    const body = await request.json();

    // Validate form data
    const validation = validateFormData(body);
    if (!validation.valid) {
      return NextResponse.json(
        { success: false, error: validation.errors.join(", ") },
        { status: 400 }
      );
    }

    const formData: ContactFormData = {
      name: body.name.trim(),
      email: body.email.trim().toLowerCase(),
      subject: body.subject.trim(),
      message: body.message.trim(),
    };

    console.log("📧 Processing contact form submission:", {
      name: formData.name,
      email: formData.email,
      subject: formData.subject,
      messageLength: formData.message.length,
    });

    // Get the from email address
    const fromEmail = process.env.EMAIL_FROM_ADDRESS || "noreply@gsdesignresearch.com";
    const toEmail = "contact@gsdesignresearch.com";

    // Create and send email
    const emailHtml = createEmailHtml(formData);

    const result = await gmailClient.sendEmail({
      to: toEmail,
      from: fromEmail,
      subject: `[Contact Form] ${formData.subject} - from ${formData.name}`,
      html: emailHtml,
    });

    if (result.success) {
      // Record successful submission for rate limiting
      recordSubmission(ip);

      console.log(`✅ Contact form email sent successfully. Message ID: ${result.messageId}`);

      return NextResponse.json({
        success: true,
        message: "Your message has been sent successfully!",
      });
    } else {
      console.error("❌ Failed to send contact form email:", result.error);

      return NextResponse.json(
        { success: false, error: "Failed to send message. Please try again later." },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("❌ Contact form error:", error);

    return NextResponse.json(
      { success: false, error: "An unexpected error occurred. Please try again." },
      { status: 500 }
    );
  }
}

// Health check endpoint
export async function GET() {
  return NextResponse.json({
    status: "ok",
    endpoint: "/api/contact",
    method: "POST",
    requiredFields: ["name", "email", "subject", "message"],
  });
}
