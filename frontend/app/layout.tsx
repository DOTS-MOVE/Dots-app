import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth";
import { AuthGateProvider } from "@/lib/authGate";
import BetaBanner from "@/components/BetaBanner";
import ProfileOnboardingWrapper from "@/components/ProfileOnboardingWrapper";
import SuppressAbortErrors from "@/components/SuppressAbortErrors";
import { Analytics } from "@vercel/analytics/next";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Dots - Meet. Move. Motivate.",
  description: "Connect with fitness enthusiasts and discover local sports events",
  icons: {
    icon: "/favicon.png",
    apple: "/favicon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="scroll-smooth">
      <head>
        <link rel="icon" href="/favicon.png" type="image/png" />
        <link rel="apple-touch-icon" href="/favicon.png" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.addEventListener('unhandledrejection', function(e) {
                var r = e.reason;
                if (r && (r.name === 'AbortError' || (typeof r.message === 'string' && r.message.toLowerCase().indexOf('aborted') !== -1))) {
                  e.preventDefault();
                  e.stopPropagation();
                }
              }, true);
            `,
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-white`}
      >
        <AuthProvider>
          <AuthGateProvider>
            <SuppressAbortErrors />
            <ProfileOnboardingWrapper>
              <BetaBanner />
              {children}
            </ProfileOnboardingWrapper>
          </AuthGateProvider>
        </AuthProvider>
        <Analytics />
      </body>
    </html>
  );
}
