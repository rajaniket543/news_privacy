function Loader() {
  return (
    <div className="flex min-h-[260px] flex-col items-center justify-center rounded-[2rem] border border-white/70 bg-white/80 p-6 text-center shadow-soft glass dark:border-white/10 dark:bg-slate-900/70">
      <div className="relative mb-4 h-16 w-16">
        <div className="absolute inset-0 rounded-full border-4 border-accent/20 animate-pulseRing" />
        <div className="absolute inset-2 rounded-full border-4 border-transparent border-t-accent animate-spin" />
      </div>
      <h3 className="text-lg font-semibold text-ink dark:text-white">
        Running DistilBERT inference
      </h3>
      <p className="mt-2 max-w-sm text-sm text-slate-500 dark:text-slate-400">
        The backend model is loaded once at startup, so each request only cleans,
        tokenizes, and scores your text.
      </p>
    </div>
  );
}

export default Loader;
