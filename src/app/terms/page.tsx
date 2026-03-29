import type { Metadata } from "next";
import { LegalLayout } from "@/components/legal/LegalLayout";

export const metadata: Metadata = {
  title: "Terms of Service — Quill AI",
  description: "The terms and conditions governing your use of Quill AI.",
};

export default function TermsPage() {
  return (
    <LegalLayout
      title="Terms of Service"
      subtitle="The rules of the road for using Quill AI."
      lastUpdated="March 29, 2026"
      sections={[
        {
          title: "Acceptance of Terms",
          content: "By creating an account or using Quill AI (including as a guest), you agree to these Terms of Service and our Privacy Policy. If you do not agree, do not use the service. These terms form a binding legal agreement between you and Quill AI.",
        },
        {
          title: "Description of Service",
          content: "Quill AI is a personal AI agent platform that allows users to research, write, code, analyze data, and generate images using large language models. The service is provided on a subscription basis with a free tier and paid plans.",
        },
        {
          title: "Account Registration",
          content: [
            "You must provide a valid email address to create an account.",
            "You are responsible for maintaining the security of your account.",
            "You must be at least 13 years old to use Quill AI (16 in the EU/EEA).",
            "One account per person. Creating multiple accounts to circumvent usage limits is prohibited.",
            "We reserve the right to terminate accounts that violate these terms.",
          ],
        },
        {
          title: "Acceptable Use",
          content: [
            "You may not use Quill AI to generate illegal content, including but not limited to CSAM, instructions for violence, or content that violates applicable law.",
            "You may not use Quill AI to deceive, harass, or harm other individuals.",
            "You may not attempt to reverse-engineer, scrape, or abuse the API in ways that circumvent rate limits or usage restrictions.",
            "You may not resell or sublicense access to Quill AI without written permission.",
            "Automated bulk usage requires an appropriate paid plan and prior written approval.",
          ],
        },
        {
          title: "Intellectual Property",
          content: [
            "Content you submit remains yours. You grant Quill AI a limited licence to process it solely to provide the service.",
            "AI-generated outputs are provided for your use. We make no claim of ownership over outputs generated from your prompts.",
            "You are responsible for ensuring your use of AI outputs complies with applicable copyright law.",
            "The Quill AI name, logo, and platform code are our intellectual property and may not be used without permission.",
          ],
        },
        {
          title: "Subscriptions and Billing",
          content: [
            "Paid plans are billed monthly or annually in advance via Stripe.",
            "You may cancel your subscription at any time. Cancellation takes effect at the end of the current billing period — no partial refunds.",
            "We reserve the right to change pricing with 30 days' notice. Existing subscribers will not be affected until their next renewal.",
            "If payment fails, your account will be downgraded to the Free plan after a 7-day grace period.",
          ],
        },
        {
          title: "Service Availability and Limitations",
          content: [
            "Quill AI is provided 'as is' without guarantees of uptime or availability.",
            "AI responses may be inaccurate, incomplete, or inappropriate. Always review outputs before acting on them.",
            "We do not guarantee that the service will always be available. Planned maintenance will be announced in advance where possible.",
            "Usage limits (messages, storage) are enforced per plan. Exceeding limits will result in requests being paused until the next billing cycle.",
          ],
        },
        {
          title: "Limitation of Liability",
          content: "To the maximum extent permitted by law, Quill AI shall not be liable for any indirect, incidental, special, or consequential damages arising from your use of the service. Our total liability for any claim shall not exceed the amount you paid us in the 12 months preceding the claim.",
        },
        {
          title: "Termination",
          content: "We may suspend or terminate your account if you violate these terms, engage in fraudulent activity, or misuse the service. You may delete your account at any time from Settings. Termination does not entitle you to a refund of any pre-paid subscription fees.",
        },
        {
          title: "Governing Law",
          content: "These terms are governed by and construed in accordance with applicable law. Any disputes shall be resolved through binding arbitration, except where prohibited by local law. Nothing in these terms limits your statutory consumer rights.",
        },
      ]}
    />
  );
}
