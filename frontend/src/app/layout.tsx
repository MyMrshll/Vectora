import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { AppSidebar } from "@/components/app-sidebar";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Vectora - Admin Dashboard",
  description: "Sistem Informasi Manajemen Vectora RAG",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`dark ${inter.variable} ${jetbrainsMono.variable} antialiased`}
      suppressHydrationWarning
    >
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" />
      </head>
      <body className="min-h-screen flex font-body-md text-body-md overflow-x-hidden bg-background text-foreground">
        <AppSidebar />
        <main className="flex-1 lg:ml-[280px] min-h-screen flex flex-col pb-24 md:pb-8">
          {/* TopAppBar */}
          <header className="w-full top-0 sticky flex justify-between items-center px-margin-mobile md:px-margin-desktop h-16 border-b border-outline-variant bg-surface/80 backdrop-blur-xl z-50">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-secondary text-[28px]">account_tree</span>
              <h1 className="font-headline-md text-headline-md font-bold text-secondary uppercase tracking-widest">VECTORA</h1>
            </div>
            <div className="flex items-center gap-4">
              <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-surface-container rounded-full border border-outline-variant">
                <span className="w-2 h-2 rounded-full bg-secondary animate-pulse"></span>
                <span className="text-label-sm font-data-mono text-secondary">SYSTEM ACTIVE</span>
              </div>
              <img alt="User profile avatar" className="w-10 h-10 rounded-full border-2 border-secondary/30 object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuB2TmS9VUlEdT58gzxvKRojc_WBlpmw_Z1eqk-s1B_IY3zxW1vHeEUWMOA7mmUfy_xgREHf3jc9O34ehVWURm9xd7jfaq4YdQi-r4bc_ovrbG3FO7zXrR4kYsG9DfK8hAWzon0Tx_ZmmkARRFE-NIeaksaYFBYVgy5CbQ-cWrZRL-Fxb707jm5TbHXGuQvqSR1uFyX7pC3Gyl-PkdF9zWqnqm283yuGxX45Y1NIOMdx9q_9ZSXiaxwswzCYf7bbBAs9Gd813Vp5pwE"/>
            </div>
          </header>
          
          <div className="p-margin-mobile md:p-margin-desktop space-y-gutter max-w-screen-2xl mx-auto w-full">
            {children}
          </div>
        </main>

        {/* BottomNavBar (Mobile Only) */}
        <nav className="md:hidden fixed bottom-0 left-0 w-full z-50 flex justify-around items-center px-4 py-2 pb-safe bg-surface-container/90 backdrop-blur-xl border-t border-outline-variant">
          <a className="flex flex-col items-center justify-center text-secondary bg-secondary/10 rounded-xl p-2" href="/">
            <span className="material-symbols-outlined">dashboard</span>
            <span className="font-label-sm text-label-sm uppercase mt-1">Status</span>
          </a>
          <a className="flex flex-col items-center justify-center text-on-surface-variant p-2" href="/documents">
            <span className="material-symbols-outlined">database</span>
            <span className="font-label-sm text-label-sm uppercase mt-1">Index</span>
          </a>
          <a className="flex flex-col items-center justify-center text-on-surface-variant p-2" href="/playground">
            <span className="material-symbols-outlined">query_stats</span>
            <span className="font-label-sm text-label-sm uppercase mt-1">Queries</span>
          </a>
          <a className="flex flex-col items-center justify-center text-on-surface-variant p-2" href="/models">
            <span className="material-symbols-outlined">settings</span>
            <span className="font-label-sm text-label-sm uppercase mt-1">Settings</span>
          </a>
        </nav>

        {/* Floating Action Button (FAB) */}
        <button className="fixed right-6 bottom-24 md:bottom-10 w-14 h-14 bg-secondary rounded-full shadow-2xl flex items-center justify-center text-on-secondary hover:scale-105 active:scale-95 transition-all primary-glow z-40">
          <span className="material-symbols-outlined text-[28px]">chat_bubble</span>
        </button>
      </body>
    </html>
  );
}
