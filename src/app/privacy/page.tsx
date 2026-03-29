import type { Metadata } from "next";
import { LegalLayout } from "@/components/legal/LegalLayout";

export const metadata: Metadata = {
  title: "Privacy Policy — Quill AI",
  description: "How Quill AI collects, uses, and protects your personal data.",
};

export default function PrivacyPage() {
  return (
    <LegalLayout
      title="Privacy Policy"
      subtitle="How we collect, use, and protect your data."
      lastUpdated="March 29, 2026"
      sections={[
        {
          title: "Information We Collect",
          content: [
            "Account information: email address and display name provided at registration.",
            "Conversation data: messages, prompts, and AI responses within your sessions.",
            "Uploaded files: documents, images, and files you attach to conversations (processed in-memory, not stored permanently unless you explicitly save them).",
            "Usage data: feature usage, session length, model selections, and error logs for improving the service.",
            "Payment information: handled entirely by Stripe. We never store card numbers or payment credentials on our servers.",
          ],
        },
        {
          title: "How We Use Your Information",
          content: [
            "To provide and improve the Quill AI service.",
            "To process your requests and generate AI responses.",
            "To manage your account and subscription plan.",
            "To send transactional emails (account confirmation, billing receipts). We do not send marketing emails without explicit consent.",
            "To detect and prevent abuse, fraud, and misuse of the platform.",
            "To analyse aggregate usage patterns (never individual content) to improve model quality.",
          ],
        },
        {
          title: "Data Storage and Retention",
          content: [
            "Conversation history is stored in our Neon PostgreSQL database and linked to your account.",
            "Free plan users: chat history retained for 7 days. Silver: 90 days. Gold: indefinitely.",
            "Uploaded files are processed transiently and not stored after your session ends.",
            "You may delete your account and all associated data at any time from Settings → Account.",
            "Upon deletion, all personal data is permanently removed within 30 days.",
          ],
        },
        {
          title: "Third-Party Services",
          content: [
            "Google Gemini API: your prompts are sent to Google's AI infrastructure to generate responses. Google's data processing terms apply. We do not share your account identity with Google.",
            "Neon (PostgreSQL): hosts our database. Data is encrypted at rest and in transit.",
            "Stripe: processes all payments. We share only what Stripe requires (email, subscription tier).",
            "Vercel / hosting provider: serves the application. Standard infrastructure logging applies.",
          ],
        },
        {
          title: "Cookies and Tracking",
          content: [
            "We use a single session cookie (set by NextAuth) to keep you signed in. No advertising cookies.",
            "We do not use third-party analytics trackers (Google Analytics, Meta Pixel, etc.).",
            "We collect minimal server-side logs for security and error monitoring.",
          ],
        },
        {
          title: "Your Rights",
          content: [
            "Access: request a copy of all data we hold about you.",
            "Correction: update your account information at any time in Settings.",
            "Deletion: permanently delete your account and all data.",
            "Portability: export your conversation history in JSON format (Settings → Export).",
            "If you are located in the EU/EEA, you have additional rights under GDPR including the right to lodge a complaint with your local data protection authority.",
          ],
        },
        {
          title: "Security",
          content: "We use industry-standard encryption (TLS in transit, AES-256 at rest), JWT-based session tokens, and access controls to protect your data. No system is 100% secure — if you discover a vulnerability, please report it to security@quill.ai.",
        },
        {
          title: "Changes to This Policy",
          content: "We may update this policy from time to time. We will notify you by email or via an in-app banner at least 14 days before significant changes take effect. Your continued use of Quill AI after that date constitutes acceptance.",
        },
      ]}
    />
  );
}
