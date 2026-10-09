import type { Metadata, Viewport } from "next";
import { Cabin_Sketch, Patrick_Hand } from "next/font/google";
import Link from "next/link";
import { MainNav } from "@/components/MainNav";
import { SiteFrame } from "@/components/SiteFrame";
import { UserMenu } from "@/components/UserMenu";
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
  description: "Write formulas, build boards and share them with a link.",
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
        <SiteFrame
          header={
            <>
              <div className="flex items-start justify-between gap-3">
                <Link href="/" className="sketch text-2xl font-bold sm:text-3xl">
                  Chalkwork
                </Link>
                <UserMenu />
              </div>
              <MainNav />
            </>
          }
        >
          {children}
        </SiteFrame>
      </body>
    </html>
  );
}
