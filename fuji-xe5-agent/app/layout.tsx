import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Fuji X-E5 Research Agent",
  description: "An AI agent that searches the web for Fujifilm X-E5 content — film recipes, settings, locations, gear.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;0,900;1,400&family=DM+Sans:wght@300;400;500&family=DM+Mono:wght@400&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
