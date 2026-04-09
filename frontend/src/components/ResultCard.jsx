function ResultCard({ result }) {
  if (!result) {
    return (
      <section className="rounded-[2rem] border border-dashed border-slate-300/80 bg-white/50 p-6 shadow-soft glass dark:border-slate-700 dark:bg-slate-900/40">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
          Awaiting input
        </p>
        <h3 className="mt-2 text-2xl font-semibold text-ink dark:text-white">
          Prediction results will appear here
        </h3>
        <p className="mt-3 text-slate-600 dark:text-slate-300">
          Submit a sample to view the predicted category, confidence score, and
          class probability distribution.
        </p>
      </section>
    );
  }

  return (
    <section className="animate-floatIn rounded-[2rem] border border-white/70 bg-white/85 p-6 shadow-soft glass dark:border-white/10 dark:bg-slate-900/70">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-accent dark:text-cyan-300">
            Predicted class
          </p>
          <h3 className="mt-2 text-3xl font-semibold text-ink dark:text-white">
            {result.label}
          </h3>
        </div>
        <div className="rounded-2xl bg-slate-100 px-5 py-4 dark:bg-slate-800">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
            Confidence
          </p>
          <p className="mt-1 text-2xl font-semibold text-slate-800 dark:text-slate-100">
            {(result.confidence * 100).toFixed(1)}%
          </p>
        </div>
      </div>

      <div className="mt-6 space-y-4">
        {result.class_probabilities.map((item) => (
          <div key={item.label}>
            <div className="mb-1 flex items-center justify-between text-sm">
              <span className="font-medium text-slate-700 dark:text-slate-200">
                {item.label}
              </span>
              <span className="text-slate-500 dark:text-slate-400">
                {(item.probability * 100).toFixed(1)}%
              </span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              <div
                className="h-full rounded-full bg-gradient-to-r from-accent to-accentWarm transition-all duration-700"
                style={{ width: `${Math.max(item.probability * 100, 3)}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 rounded-[1.5rem] bg-slate-50 p-4 dark:bg-slate-950/60">
        <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
          Privacy note
        </p>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          This demo keeps inference transient and does not persist submitted
          text. The API only returns prediction metadata for the current request.
        </p>
      </div>
    </section>
  );
}

export default ResultCard;
