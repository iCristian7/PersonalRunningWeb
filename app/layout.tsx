import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Running Plan · Cristian',
  description: 'Histórico y planes de running.',
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'),
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body><div className="container">{children}</div></body>
    </html>
  );
}
