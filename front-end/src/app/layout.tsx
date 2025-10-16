import type { Metadata } from 'next';
import localFont from 'next/font/local';
import './globals.css';
import { Providers } from '@/components/ui/provider';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';

const geistSans = localFont({
  src: './fonts/GeistVF.woff',
  variable: '--font-geist-sans',
  weight: '100 900',
});
const geistMono = localFont({
  src: './fonts/GeistMonoVF.woff',
  variable: '--font-geist-mono',
  weight: '100 900',
});

export const metadata: Metadata = {
  title: 'RATHER Strategy Protocol',
  description: 'An automated NFT accumulation strategy protocol built on Stacks. Non-custodial, fully on-chain, and built for composability.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`} style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        <Providers>
          <>
            <Navbar />
            <main style={{ flex: 1 }}>{children}</main>
            <Footer />
          </>
        </Providers>
      </body>
    </html>
  );
}
