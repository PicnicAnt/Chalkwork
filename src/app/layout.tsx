import type { Metadata, Viewport } from "next";
import { Cabin_Sketch, Patrick_Hand } from "next/font/google";
import Link from "next/link";
import { ThemeToggle } from "@/components/ThemeToggle";
import "./globals.css";

const hand = Patrick_Hand({
  variable: "--font-hand",
  weight: "400",
  subsets: ["latin"],
});

const sketch = Cabin_Sketch({
  variable: "--font-sketch",
  weight: ["400", "700"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Chalkwork",
  description: "Create calculations and share them with a link.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0b0f0d" },
    { media: "(prefers-color-scheme: light)", color: "#dfe2e6" },
  ],
};

// Runs before first paint: saved choice, otherwise follow the system setting.
const themeScript = `(function(){try{var t=localStorage.getItem("theme");if(t!=="dark"&&t!=="light")t=matchMedia("(prefers-color-scheme: light)").matches?"light":"dark";document.documentElement.setAttribute("data-theme",t)}catch(e){}})()`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      data-theme="dark"
      suppressHydrationWarning
      className={`${hand.variable} ${sketch.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full flex flex-col">
        <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-2 py-3 sm:px-4 sm:py-6">
          <div className="board flex flex-1 flex-col">
            <header className="relative flex items-center justify-between gap-3 px-4 pt-4 sm:px-8 sm:pt-6">
              <Link href="/" className="sketch text-2xl font-bold sm:text-3xl">
                Chalkwork
              </Link>
              <nav className="flex items-center gap-3">
                <Link href="/new" className="link text-lg">
                  New
                </Link>
                <ThemeToggle />
              </nav>
            </header>
            <main className="relative w-full flex-1 px-4 py-6 sm:px-8 sm:py-8">{children}</main>
          </div>
        </div>
      </body>
    </html>
  );
}
