import type { Metadata } from 'next';
import { LegalPage } from '@/app/components/LegalPage';

const contactEmail = 'echodeck.muse@gmail.com';

const sections = [
  {
    id: 'who-we-are',
    title: 'Who We Are',
    paragraphs: [
      `EchoDeck is operated at echodeck.avianage.in. You can contact us at ${contactEmail}.`,
    ],
  },
  {
    id: 'data-we-collect',
    title: 'Data We Collect',
    paragraphs: ['We collect the information needed to provide, secure, and maintain EchoDeck.'],
    items: [
      'Account data: email address and username, which are required to use the service.',
      'Authentication data: magic link tokens via Resend, not stored after use, and NextAuth session tokens stored as httpOnly cookies.',
      'Spotify OAuth tokens: stored encrypted and used solely to access your Spotify library on your behalf. We do not access your Spotify account beyond what you explicitly authorize during the OAuth flow.',
      'Queue data: YouTube video IDs and metadata such as title and thumbnail URL queued by users are stored to maintain stream queues. This data is not shared with YouTube or third parties.',
      'Usage data: stream activity, votes, and listening history associated with your account.',
    ],
  },
  {
    id: 'data-we-do-not-collect',
    title: 'Data We Do NOT Collect',
    paragraphs: ['EchoDeck limits collection to data needed for the service.'],
    items: [
      'We do not collect payment card data. Payment data is handled entirely by Razorpay if billing is active.',
      'We do not store YouTube audio or video content.',
      'We do not store Spotify audio content.',
      'We do not sell your data to third parties.',
    ],
  },
  {
    id: 'how-we-use-your-data',
    title: 'How We Use Your Data',
    paragraphs: ['We use your data only for operating EchoDeck and related account features.'],
    items: [
      'To provide and maintain the service.',
      'To authenticate you, including magic link email delivery via Resend.',
      'To associate your queued content and stream history with your account.',
      'To enforce usage quotas and RBAC roles.',
    ],
  },
  {
    id: 'third-party-services',
    title: 'Third Party Services',
    paragraphs: [
      'The following third parties may process your data as part of delivering EchoDeck. Your data is only shared with these services to the extent necessary to deliver their specific function.',
    ],
    items: [
      "YouTube / Google LLC: video playback via IFrame API. Google's Privacy Policy: policies.google.com/privacy.",
      "Spotify AB: library access via OAuth if connected. Spotify's Privacy Policy: spotify.com/legal/privacy-policy.",
      "Resend: transactional email for magic link delivery only. Resend's Privacy Policy: resend.com/legal/privacy-policy.",
      "Razorpay: payment processing if billing is active. Razorpay's Privacy Policy: razorpay.com/privacy.",
    ],
  },
  {
    id: 'data-retention',
    title: 'Data Retention',
    paragraphs: ['We retain data only as long as needed for the service or your account.'],
    items: [
      'Account data is retained until you delete your account.',
      'Session tokens expire per NextAuth configuration.',
      'Spotify OAuth tokens are deleted when you disconnect Spotify or delete your account.',
    ],
  },
  {
    id: 'your-rights-gdpr',
    title: 'Your Rights (GDPR)',
    paragraphs: [
      `If you are in the EU/EEA, you have the rights listed below. To exercise these rights, email ${contactEmail} or use the account deletion feature in Settings.`,
    ],
    items: [
      'Access your personal data.',
      'Correct inaccurate data.',
      'Request deletion of your data, also known as the right to erasure.',
      'Data portability.',
      'Withdraw consent at any time.',
    ],
  },
  {
    id: 'cookies',
    title: 'Cookies',
    paragraphs: ['EchoDeck uses limited cookies required for authentication and optional analytics.'],
    items: [
      'Strictly necessary: NextAuth session cookie, httpOnly and secure, which cannot be disabled.',
      'Analytics: used only if you consented via the cookie banner.',
      'We do not use third party advertising cookies.',
    ],
  },
  {
    id: 'security',
    title: 'Security',
    paragraphs: [
      'We use HTTPS, httpOnly cookies, and encrypted token storage. However, no system is 100% secure and we cannot guarantee absolute security.',
    ],
  },
  {
    id: 'changes-to-this-policy',
    title: 'Changes to This Policy',
    paragraphs: [
      'We will notify you of material changes via email. Continued use after changes constitutes acceptance.',
    ],
  },
  {
    id: 'contact',
    title: 'Contact',
    paragraphs: [`Privacy questions and requests may be sent to ${contactEmail}.`],
  },
];

export const metadata: Metadata = {
  title: 'Privacy Policy | EchoDeck',
  description:
    'EchoDeck Privacy Policy covering account data, authentication, Spotify OAuth, cookies, third party services, and GDPR rights.',
  alternates: {
    canonical: 'https://echodeck.avianage.in/privacy',
  },
};

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      description="This policy explains what EchoDeck collects, what it does not collect, how data is used, and the choices you have when using the service."
      lastUpdated="May 1, 2026"
      sections={sections}
    />
  );
}
