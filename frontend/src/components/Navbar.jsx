function Navbar({ theme, toggleTheme, status }) {
  return (
    <header className="sticky top-0 z-30 border-b border-white/50 bg-white/80 backdrop-blur-xl dark:border-slate-800/80 dark:bg-slate-950/80">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-cyan-700 dark:text-cyan-300">
            Cryptography and Network Security
          </p>
          <h1 className="text-lg font-semibold text-slate-950 dark:text-white sm:text-xl">
            HabitFlow Secure Messaging Demo
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-medium text-emerald-700 dark:border-emerald-900/80 dark:bg-emerald-950/60 dark:text-emerald-300 sm:block">
            {status}
          </div>
          <button
            type="button"
            onClick={toggleTheme}
            className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:-translate-y-0.5 hover:border-cyan-500 hover:text-cyan-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          >
            {theme === "dark" ? "Light mode" : "Dark mode"}
          </button>
        </div>
      </div>
    </header>
  );
}

export default Navbar;
