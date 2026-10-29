import type { Metadata } from "next";
import "../public/style.css";

export const metadata: Metadata = {
  title: "Raaga Studio",
  description: "Create songs from your lyrics and musical style.",
  icons: {
    icon: "/favicon.svg?v=raaga-1",
    shortcut: "/favicon.svg?v=raaga-1",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
