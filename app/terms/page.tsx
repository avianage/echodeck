import type { Metadata } from 'next';
import { LegalPage } from '@/app/components/LegalPage';

const contactEmail = 'echodeck.muse@gmail.com';

const sections = [
  {
    id: 'acceptance-of-terms',
    title: 'Acceptance of Terms',
    paragraphs: [
      'By accessing or using EchoDeck, you agree to these Terms of Service. If you do not agree to these terms, you must not use EchoDeck.',
    ],
  },
  {
    id: 'description-of-service',
    title: 'Description of Service',
    paragraphs: [
      'EchoDeck is a collaborative music queue and streaming coordination tool. Users can create streams, queue music, and listen together in real time.',
    ],
  },
  {
    id: 'third-party-content',
    title: 'Third Party Content',
    paragraphs: [
      "YouTube: All video and audio content played through EchoDeck is sourced directly from YouTube and played back using the official YouTube IFrame Player API. All content remains on YouTube's infrastructure and is subject to YouTube's Terms of Service at youtube.com/t/terms and the rights of the respective content creators and rights holders. EchoDeck does not host, download, cache, or redistribute any YouTube content. We are not responsible for the availability, accuracy, or legality of any content accessible via YouTube.",
      "Spotify: Track metadata, search results, and album artwork displayed in EchoDeck may be sourced via the Spotify Web API. EchoDeck does not stream, host, or store any Spotify audio content. All Spotify content is subject to Spotify's Terms of Service at spotify.com/legal/end-user-agreement.",
      'EchoDeck is a coordination and discovery tool. We are not a content provider or music streaming service.',
    ],
  },
  {
    id: 'user-responsibilities',
    title: 'User Responsibilities',
    paragraphs: ['When using EchoDeck, you are responsible for your account activity and queued content.'],
    items: [
      'You must not queue content that infringes third party intellectual property rights.',
      "You must not use EchoDeck in violation of YouTube's or Spotify's Terms of Service.",
      'You must not use EchoDeck to circumvent any content protection or access restrictions.',
      'You are solely responsible for the content you add to queues.',
    ],
  },
  {
    id: 'dmca-copyright',
    title: 'DMCA / Copyright',
    paragraphs: [
      'EchoDeck respects intellectual property rights and complies with the Digital Millennium Copyright Act (DMCA). EchoDeck does not host user-uploaded content. All media is played back from YouTube via official embed APIs.',
      `If you believe content accessible through EchoDeck infringes your copyright, contact us at ${contactEmail} with the information listed below. We will investigate and respond within 14 business days.`,
    ],
    items: [
      'Identification of the copyrighted work claimed.',
      'URL or description of where the allegedly infringing content appears.',
      'Your contact information, including name, address, email, and phone.',
      'A statement of good faith belief that the use is not authorized.',
      'A statement that the information is accurate and, under penalty of perjury, that you are the rights holder or authorized to act on their behalf.',
    ],
  },
  {
    id: 'account-termination',
    title: 'Account Termination',
    paragraphs: [
      'We reserve the right to suspend or terminate accounts that repeatedly violate copyright or these Terms of Service.',
    ],
  },
  {
    id: 'disclaimer-of-warranties',
    title: 'Disclaimer of Warranties',
    paragraphs: [
      'EchoDeck is provided as is and as available. We do not guarantee uptime, uninterrupted access, availability, accuracy, or error-free operation.',
    ],
  },
  {
    id: 'limitation-of-liability',
    title: 'Limitation of Liability',
    paragraphs: [
      'To the maximum extent permitted by law, EchoDeck is not liable for indirect, incidental, special, consequential, or punitive damages arising from your use of the service.',
    ],
  },
  {
    id: 'changes-to-terms',
    title: 'Changes to Terms',
    paragraphs: [
      'We may update these terms from time to time. Continued use of EchoDeck after changes become effective constitutes acceptance of the updated terms. Material changes will be communicated via email.',
    ],
  },
  {
    id: 'contact',
    title: 'Contact',
    paragraphs: [`Questions about these terms may be sent to ${contactEmail}.`],
  },
];

export const metadata: Metadata = {
  title: 'Terms of Service | EchoDeck',
  description:
    'EchoDeck Terms of Service covering account use, third party content, copyright, and user responsibilities.',
  alternates: {
    canonical: 'https://echodeck.avianage.in/terms',
  },
};

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Service"
      description="These terms describe the rules for using EchoDeck, including collaborative queues, third party playback, copyright responsibilities, and account limitations."
      lastUpdated="May 1, 2026"
      sections={sections}
    />
  );
}
