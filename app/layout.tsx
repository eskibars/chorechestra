import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const origin = `${protocol}://${host}`;

  return {
    title: "Chore Club — Family weekly chore chart",
    description: "A cheerful, private weekly chore matrix for families. Plan routines, track rewards, and print the week.",
    openGraph: {
      title: "Chore Club",
      description: "Small jobs. Big wins.",
      images: [{ url: `${origin}/og.png`, width: 1200, height: 630, alt: "Chore Club weekly family chore board" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "Chore Club",
      description: "Small jobs. Big wins.",
      images: [`${origin}/og.png`],
    },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
