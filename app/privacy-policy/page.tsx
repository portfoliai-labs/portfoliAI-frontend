import type { Metadata } from "next";
import { LegalLayout, LegalSection } from "../components/legal/LegalLayout";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How PortfoliAI collects, uses, and protects your data.",
};

export default function PrivacyPolicyPage() {
  return (
    <LegalLayout title="Privacy Policy" lastUpdated="[DD Month YYYY]">
      <p className="text-[14px] leading-[1.75]" style={{ color: "#4a4642" }}>
        This Privacy Policy explains how <strong>[Company Legal Name]</strong> (&quot;PortfoliAI&quot;,
        &quot;we&quot;, &quot;us&quot;) collects, uses, discloses, and safeguards information
        when you use our website and application (the &quot;Service&quot;). This is a draft
        template — the bracketed placeholders must be completed and the whole document
        reviewed by qualified legal counsel before publication.
      </p>

      <LegalSection heading="1. Who we are">
        <p>
          PortfoliAI is operated by <strong>[Company Legal Name]</strong>, registered at
          <strong> [Registered Address]</strong>. For any question about this policy or your
          data, contact us at <strong>[privacy@portfoliai.example]</strong>.
        </p>
      </LegalSection>

      <LegalSection heading="2. Data we collect">
        <p>We collect the following categories of data:</p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li><strong>Account data</strong> — name, email address, and profile picture provided via Google Sign-In, plus your declared role (Private Investor / Financial Advisor).</li>
          <li><strong>Financial data you upload</strong> — transaction history (dates, tickers/ISINs, quantities, prices, fees, brokers) imported from CSV/Excel broker exports, or entered manually.</li>
          <li><strong>Generated reports</strong> — the PDF analyses produced from your transaction data, and metadata about them (status, tags, timestamps).</li>
          <li><strong>Usage data</strong> — log data, device/browser information, and interactions with the Service, collected automatically.</li>
        </ul>
      </LegalSection>

      <LegalSection heading="3. How we use your data">
        <ul className="list-disc pl-5 space-y-1.5">
          <li>To generate the portfolio analyses and PDF reports you request.</li>
          <li>To operate, maintain, and secure your account and the Service.</li>
          <li>To send service-related notifications (e.g. report completed/failed), subject to your notification preferences.</li>
          <li>To comply with legal obligations and enforce our Terms of Service.</li>
        </ul>
        <p>We do not sell your personal or financial data to third parties.</p>
      </LegalSection>

      <LegalSection heading="4. Legal basis for processing (GDPR)">
        <p>
          Where the General Data Protection Regulation (GDPR) applies, we process your data
          on the basis of: performance of a contract (providing the Service you signed up
          for), your consent (e.g. optional marketing communications), and our legitimate
          interest in maintaining and improving the Service.
        </p>
      </LegalSection>

      <LegalSection heading="5. Financial Advisors acting on behalf of clients">
        <p>
          If you use PortfoliAI as a Financial Advisor to generate reports for your clients,
          you act as the data controller for your clients&apos; data, and you are responsible
          for obtaining any necessary consents from your clients before uploading their
          transaction data. PortfoliAI acts as a data processor in that context.
        </p>
      </LegalSection>

      <LegalSection heading="6. Data sharing">
        <p>
          We share data only with service providers strictly necessary to operate PortfoliAI
          (e.g. cloud hosting, market data providers, email delivery), each bound by
          appropriate data processing agreements. We do not share your data with third
          parties for their own marketing purposes.
        </p>
      </LegalSection>

      <LegalSection heading="7. Data retention">
        <p>
          We retain account and financial data for as long as your account is active, and for
          a limited period afterwards as required to comply with legal, accounting, or
          reporting obligations. You may request deletion at any time (see Section 8).
        </p>
      </LegalSection>

      <LegalSection heading="8. Your rights">
        <p>Subject to applicable law, you have the right to:</p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>Access the personal data we hold about you.</li>
          <li>Correct inaccurate or incomplete data.</li>
          <li>Request deletion of your data (&quot;right to be forgotten&quot;).</li>
          <li>Export your data in a portable format.</li>
          <li>Object to or restrict certain processing.</li>
        </ul>
        <p>To exercise these rights, contact us at <strong>[privacy@portfoliai.example]</strong>.</p>
      </LegalSection>

      <LegalSection heading="9. Security">
        <p>
          We use industry-standard technical and organizational measures — including
          encryption in transit, access controls, and short-lived signed URLs for document
          downloads — to protect your data. No method of transmission or storage is
          completely secure, and we cannot guarantee absolute security.
        </p>
      </LegalSection>

      <LegalSection heading="10. Cookies">
        <p>
          The Service uses only strictly necessary cookies/local storage required for
          authentication. If we introduce analytics or marketing cookies in the future, we
          will update this policy and request consent where required.
        </p>
      </LegalSection>

      <LegalSection heading="11. International data transfers">
        <p>
          Where data is transferred outside your country of residence, we rely on appropriate
          safeguards (such as Standard Contractual Clauses) as required by applicable law.
        </p>
      </LegalSection>

      <LegalSection heading="12. Changes to this policy">
        <p>
          We may update this Privacy Policy from time to time. Material changes will be
          notified via the Service or by email before they take effect.
        </p>
      </LegalSection>

      <LegalSection heading="13. Contact">
        <p>
          Questions about this Privacy Policy can be sent to
          <strong> [privacy@portfoliai.example]</strong>.
        </p>
      </LegalSection>
    </LegalLayout>
  );
}
