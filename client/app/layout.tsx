import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Feeding Brennen',
  description: 'Track restaurants, visits, and spending.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <header className="border-b border-orange-100 bg-white/95 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center gap-3 px-5 py-4 sm:px-8">
            <div
              className="grid h-11 w-11 rotate-[-3deg] place-items-center rounded-[15px_15px_15px_5px] bg-[#f4512c] text-sm font-black tracking-tight text-white shadow-sm"
              aria-hidden="true"
            >
              FB
            </div>
            <div>
              <h1 className="font-brand text-2xl font-black leading-none tracking-[-0.04em] text-stone-950">
                Feeding Brennen
              </h1>
              <p className="mt-1 text-xs font-medium text-stone-500">
                Brennen-approved. Receipt-verified.
              </p>
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-5 py-7 sm:px-8 sm:py-10">
          {children}
        </main>
      </body>
    </html>
  );
}
