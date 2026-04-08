export default function PrivacyPage() {
  return (
    <div className="max-w-[600px] mx-auto">
      <h1 className="text-[16px] font-bold mb-8">Privacy Policy</h1>

      <div className="text-[13px] leading-[1.8] text-[#333] flex flex-col gap-6">
        <section>
          <h2 className="font-bold mb-2">1. Information We Collect</h2>
          <p>
            We collect your email address and name when you create an account (including
            via Google sign-in). When you activate a license, we generate a hardware
            identifier (HWID) from your device to bind the license.
          </p>
        </section>

        <section>
          <h2 className="font-bold mb-2">2. How We Use Your Information</h2>
          <ul className="list-disc pl-5 flex flex-col gap-1">
            <li>Account management and authentication</li>
            <li>License activation and verification</li>
            <li>Order processing and purchase history</li>
            <li>Product update notifications</li>
            <li>Customer support</li>
          </ul>
        </section>

        <section>
          <h2 className="font-bold mb-2">3. Hardware Identifier (HWID)</h2>
          <p>
            The HWID is a one-way hash derived from your device&apos;s hardware information.
            It cannot be used to identify you personally and is only used to ensure
            one-device-per-license compliance.
          </p>
        </section>

        <section>
          <h2 className="font-bold mb-2">4. Data Storage</h2>
          <p>
            Your data is stored securely on Supabase (hosted on AWS). We do not sell,
            share, or transfer your personal information to third parties, except as
            required by payment processing.
          </p>
        </section>

        <section>
          <h2 className="font-bold mb-2">5. Cookies</h2>
          <p>
            We use essential cookies for authentication and session management.
            No tracking or advertising cookies are used.
          </p>
        </section>

        <section>
          <h2 className="font-bold mb-2">6. Account Deletion</h2>
          <p>
            You can delete your account at any time from the My Page. Upon deletion,
            all personal data and associated licenses will be permanently removed.
          </p>
        </section>

        <section>
          <h2 className="font-bold mb-2">7. Contact</h2>
          <p>
            For privacy-related inquiries, contact us at contact@iiiahalab.com.
          </p>
        </section>

        <p className="text-[11px] text-[#999] mt-4">Last updated: April 2026</p>
      </div>
    </div>
  );
}
