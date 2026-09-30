import type { Metadata } from "next";
import "./globals.css";
import { Sidebar } from "@/components/sidebar";

export const metadata: Metadata = {
  title: "Revenue OS — Control Center",
  description: "Freelance Growth + Revenue Operating System",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        {/* Ambient background blobs */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
          <div
            className="ambient-blob animate-blob-1"
            style={{ width: 600, height: 600, top: "-10%", left: "-5%", background: "var(--accent)" }}
          />
          <div
            className="ambient-blob animate-blob-2"
            style={{ width: 500, height: 500, bottom: "-10%", right: "-5%", background: "var(--purple)" }}
          />
        </div>

        <div className="relative flex h-screen">
          <Sidebar />
          <main className="flex-1 overflow-y-auto">
            <div className="p-6 lg:p-8 max-w-[1400px]">
              {children}
            </div>
          </main>
        </div>
      </body>
    </html>
  );
}
