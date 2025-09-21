'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import ThemeSwitcher from './themeSwitcher';

const WalletMultiButtonDynamic = dynamic(
  async () => (await import('@solana/wallet-adapter-react-ui')).WalletMultiButton,
  { ssr: false }
);

const Header = () => {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full">
      {/* Glow line */}
      <div className="h-px w-full bg-gradient-to-r from-transparent via-sky-400/50 to-transparent" />

      {/* Glass bar */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mt-3 rounded-2xl border border-white/20 bg-white/60 backdrop-blur-md shadow-lg shadow-slate-900/5 dark:border-white/10 dark:bg-white/10">
          <div className="flex items-center justify-between px-4 py-3 sm:px-6">
            {/* Brand */}
            <div className="flex items-center gap-3">
              {/* Logo / mark */}
              <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-tr from-indigo-600 to-sky-500 text-white shadow-md shadow-indigo-600/30">
                {/* Simple spark icon */}
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v6m0 6v6M3 12h6m6 0h6" />
                </svg>
              </div>

              <div className="leading-tight">
                <div className="bg-gradient-to-tr from-indigo-400 via-sky-400 to-cyan-400 bg-clip-text text-lg font-extrabold tracking-tight text-transparent sm:text-xl">
                  Roku Subscribers
                </div>
                <div className="mt-0.5 flex items-center gap-2">
                  <span className="rounded-full border border-slate-200/70 bg-white/70 px-2 py-0.5 text-[10px] font-medium text-slate-700 dark:border-white/10 dark:bg-white/10 dark:text-slate-300">
                    cNFT Mint • Devnet
                  </span>
                </div>
              </div>
            </div>

            {/* Desktop actions */}
            <div className="hidden items-center gap-3 sm:flex">
              {/* Optional nav placeholders — add links if you want */}
              {/* <a className="text-sm text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white" href="#">Docs</a> */}
              {/* <a className="text-sm text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white" href="#">Explorer</a> */}

              <div className="flex items-center gap-2">
                <div className="rounded-xl border border-white/20 bg-white/60 px-1.5 py-1 backdrop-blur dark:border-white/10 dark:bg-white/10">
                  <ThemeSwitcher />
                </div>
                <div className="rounded-xl border border-white/20 bg-white/60 px-1.5 py-1 backdrop-blur dark:border-white/10 dark:bg-white/10">
                  <WalletMultiButtonDynamic />
                </div>
              </div>
            </div>

            {/* Mobile toggle */}
            <button
              aria-label="Toggle menu"
              onClick={() => setOpen((s) => !s)}
              className="inline-flex items-center justify-center rounded-xl border border-white/20 bg-white/60 p-2 text-slate-700 backdrop-blur transition hover:bg-white/80 dark:border-white/10 dark:bg-white/10 dark:text-slate-200 sm:hidden"
            >
              {open ? (
                // Close icon
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                // Hamburger
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>

          {/* Mobile menu */}
          <div
            className={`grid overflow-hidden transition-[grid-template-rows] duration-300 sm:hidden ${
              open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
            }`}
          >
            <div className="min-h-0">
              <div className="border-t border-white/20 px-4 py-3 sm:px-6 dark:border-white/10">
                <div className="flex items-center justify-between gap-3">
                  <div className="rounded-xl border border-white/20 bg-white/60 px-1.5 py-1 backdrop-blur dark:border-white/10 dark:bg-white/10">
                    <ThemeSwitcher />
                  </div>
                  <div className="rounded-xl border border-white/20 bg-white/60 px-1.5 py-1 backdrop-blur dark:border-white/10 dark:bg-white/10">
                    <WalletMultiButtonDynamic />
                  </div>
                </div>

                {/* Optional quick links */}
                {/* <div className="mt-3 grid gap-2 text-sm">
                  <a className="rounded-lg px-2 py-1 text-slate-700 hover:bg-white/60 dark:text-slate-200 dark:hover:bg-white/10" href="#">Docs</a>
                  <a className="rounded-lg px-2 py-1 text-slate-700 hover:bg-white/60 dark:text-slate-200 dark:hover:bg-white/10" href="#">Explorer</a>
                </div> */}
              </div>
            </div>
          </div>
        </div>

        {/* Subtle shadow under bar */}
        <div className="h-3" />
      </div>
    </header>
  );
};

export default Header;
