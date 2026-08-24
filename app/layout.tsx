import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://onboard-ai.shadowxoxo.chatgpt.site"),
  title: "OnboardAI — From request to approved workflow",
  description: "A trustworthy AI client-onboarding agent with policy controls, human approval, and traceable tool execution.",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
  openGraph: {
    title: "OnboardAI — From request to approved workflow",
    description: "Watch an AI operations agent interpret, validate, and execute a client onboarding workflow.",
    type: "website",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "OnboardAI — From request to approved workflow" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "OnboardAI — From request to approved workflow",
    description: "Trustworthy AI automation with human approval and a complete audit trail.",
    images: ["/og.png"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
