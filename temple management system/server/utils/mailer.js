import nodemailer from 'nodemailer';

function createTransport() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    // SMTP_HOST is typically 'localhost' (the box's own mail relay on cPanel);
    // its cert is issued for the shared hosting hostname, not 'localhost', so skip hostname verification.
    tls: { rejectUnauthorized: false },
  });
}

export async function sendOtpEmail(to, name, otp) {
  const transporter = createTransport();
  const from = process.env.SMTP_FROM || process.env.SMTP_USER;

  await transporter.sendMail({
    from,
    to,
    subject: 'Password Reset OTP — Temple Management System',
    text: `Hi ${name},\n\nYour OTP for password reset is: ${otp}\n\nValid for 10 minutes. Do not share this code.\n\n— Temple Management System`,
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f5f0e8;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f0e8;padding:40px 0;">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">

        <!-- Header -->
        <tr><td style="background:#5C1A1B;padding:28px 32px;text-align:center;">
          <div style="font-size:22px;font-weight:700;color:#ffffff;letter-spacing:0.04em;">Temple Management System</div>
        </td></tr>

        <!-- Body -->
        <tr><td style="padding:36px 32px 28px;">
          <p style="margin:0 0 8px;font-size:15px;color:#222;">Hi <strong>${name}</strong>,</p>
          <p style="margin:0 0 24px;font-size:14px;color:#555;line-height:1.6;">
            We received a request to reset your password. Use the OTP below to continue.
            This code is valid for <strong>10 minutes</strong>.
          </p>

          <!-- OTP Box -->
          <div style="text-align:center;margin:0 0 28px;">
            <div style="display:inline-block;background:#fdf8f0;border:2px solid #c8a035;border-radius:8px;padding:18px 40px;">
              <div style="font-size:11px;color:#888;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:6px;">Your OTP Code</div>
              <div style="font-size:36px;font-weight:700;color:#5C1A1B;letter-spacing:0.2em;">${otp}</div>
            </div>
          </div>

          <p style="margin:0 0 8px;font-size:13px;color:#888;text-align:center;">
            Do not share this code with anyone.
          </p>
          <p style="margin:0;font-size:13px;color:#888;text-align:center;">
            If you did not request a password reset, you can safely ignore this email.
          </p>
        </td></tr>

        <!-- Footer -->
        <tr><td style="background:#f5f0e8;padding:16px 32px;text-align:center;border-top:1px solid #e8dcc8;">
          <div style="font-size:11px;color:#aaa;">
            &copy; ${new Date().getFullYear()} Temple Management System
          </div>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`,
  });
}
