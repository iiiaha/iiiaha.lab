export default function TermsPage() {
  return (
    <div className="max-w-[600px] mx-auto">
      <h1 className="text-[16px] font-bold mb-8">Terms of Service</h1>

      <div className="text-[13px] leading-[1.8] text-[#333] flex flex-col gap-6">
        <section>
          <h2 className="font-bold mb-2">1. Overview</h2>
          <p>
            These terms govern your use of iiiaha.lab (&quot;the Service&quot;) operated by iiiaha.
            By purchasing or using our products, you agree to these terms.
          </p>
        </section>

        <section>
          <h2 className="font-bold mb-2">2. Products & Licenses</h2>
          <p>
            Each license key is valid for one device at a time. You may deactivate and
            reactivate on a different device through your account page. Sharing, reselling,
            or distributing license keys is prohibited.
          </p>
        </section>

        <section>
          <h2 className="font-bold mb-2">3. Payments</h2>
          <p>
            All prices are listed in KRW (₩). Payments are processed securely through
            our payment provider. Prices may change without prior notice, but confirmed
            orders will not be affected.
          </p>
        </section>

        <section>
          <h2 className="font-bold mb-2">4. Refund Policy</h2>
          <p>
            Refund requests can be made within 7 days of purchase if the license has not
            been activated. Once a license is activated, refunds are handled on a
            case-by-case basis. Contact us at contact@iiiaha.com.
          </p>
        </section>

        <section>
          <h2 className="font-bold mb-2">5. Intellectual Property</h2>
          <p>
            All extensions, code, designs, and content are the property of iiiaha.
            Reverse engineering, decompiling, or circumventing license protection is
            strictly prohibited.
          </p>
        </section>

        <section>
          <h2 className="font-bold mb-2">6. Limitation of Liability</h2>
          <p>
            The Service is provided &quot;as is&quot; without warranty. iiiaha is not liable for
            any damages arising from the use or inability to use our products.
          </p>
        </section>

        <section>
          <h2 className="font-bold mb-2">7. Changes</h2>
          <p>
            We may update these terms at any time. Continued use of the Service after
            changes constitutes acceptance of the updated terms.
          </p>
        </section>

        <p className="text-[11px] text-[#999] mt-4">Last updated: April 2026</p>
      </div>
    </div>
  );
}
