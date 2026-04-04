import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendLicenseEmail(
  to: string,
  productName: string,
  licenseKey: string
) {
  const { error } = await resend.emails.send({
    from: "iiiaha.lab <noreply@iiiaha.com>",
    to,
    subject: `[iiiaha.lab] License Key — ${productName}`,
    html: `
      <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 40px 20px;">
        <h2 style="font-size: 18px; font-weight: bold; margin-bottom: 8px;">iiiaha.lab</h2>
        <hr style="border: none; border-top: 1px solid #111; margin-bottom: 30px;" />

        <p style="font-size: 14px; color: #333; margin-bottom: 4px;">Thank you for your purchase.</p>
        <p style="font-size: 14px; color: #666; margin-bottom: 24px;">Here is your license key for <strong>${productName}</strong>:</p>

        <div style="background: #f5f5f5; border: 1px solid #ddd; padding: 16px; text-align: center; margin-bottom: 24px;">
          <code style="font-size: 18px; letter-spacing: 2px; font-weight: bold;">${licenseKey}</code>
        </div>

        <p style="font-size: 13px; color: #999; margin-bottom: 4px;">1. Install the .rbz file in SketchUp</p>
        <p style="font-size: 13px; color: #999; margin-bottom: 4px;">2. Run the extension</p>
        <p style="font-size: 13px; color: #999; margin-bottom: 24px;">3. Enter the license key above</p>

        <hr style="border: none; border-top: 1px solid #ddd; margin-bottom: 16px;" />
        <p style="font-size: 11px; color: #999;">
          This license is valid for one device. If you need to change devices, visit your account page.<br/>
          <a href="https://www.instagram.com/iiiaha.lab/" style="color: #666;">@iiiaha.lab</a>
        </p>
      </div>
    `,
  });

  if (error) throw error;
}
