import './globals.css';
import type { ReactNode } from 'react';

export const metadata = {
  title: 'Entity Reviews',
  description: 'Minimal review app with SQLite'
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <main className="container">{children}</main>
      </body>
    </html>
  );
}
