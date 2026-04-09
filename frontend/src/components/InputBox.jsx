function InputBox({
  text,
  setText,
  datasetType,
  setDatasetType,
  examples,
  onExampleSelect,
  onSubmit,
  isLoading,
  error,
}) {
  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;

  return (
    <section className="rounded-[2rem] border border-white/70 bg-white/80 p-6 shadow-soft glass dark:border-white/10 dark:bg-slate-900/70">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
            Inference playground
          </p>
          <h2 className="text-2xl font-semibold text-ink dark:text-white">
            Paste news text for instant classification
          </h2>
        </div>

        <div className="hidden rounded-full bg-slate-100 px-4 py-2 text-sm text-slate-600 dark:bg-slate-800 dark:text-slate-300 sm:block">
          Limit: 500 words
        </div>
      </div>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <label className="text-sm font-medium text-slate-600 dark:text-slate-300">
          Dataset simulation
        </label>
        <select
          value={datasetType}
          onChange={(event) => setDatasetType(event.target.value)}
          className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-accent dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
        >
          <option value="ag_news">AG News</option>
          <option value="imdb">IMDB Reviews</option>
          <option value="yelp">Yelp Reviews</option>
          <option value="general">General Articles</option>
        </select>
      </div>

      <textarea
        value={text}
        onChange={(event) => setText(event.target.value)}
        rows={10}
        placeholder="Enter a news article, review, or long-form text. The backend cleans the text, tokenizes it, and runs DistilBERT inference without saving your submission."
        className="w-full rounded-[1.5rem] border border-slate-200 bg-slate-50 px-5 py-4 text-base leading-7 text-slate-800 outline-none transition focus:border-accent focus:bg-white dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:bg-slate-900"
      />

      <div className="mt-3 flex items-center justify-between text-sm">
        <span className="text-slate-500 dark:text-slate-400">
          {wordCount} / 500 words
        </span>
        {error ? (
          <span className="font-medium text-rose-500">{error}</span>
        ) : (
          <span className="text-slate-500 dark:text-slate-400">
            Inputs stay in-memory only
          </span>
        )}
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        {examples.map((example) => (
          <button
            key={example.title}
            type="button"
            onClick={() => onExampleSelect(example.text)}
            className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 transition hover:-translate-y-0.5 hover:border-accent hover:text-accent dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
          >
            {example.title}
          </button>
        ))}
      </div>

      <div className="mt-6">
        <button
          type="button"
          onClick={onSubmit}
          disabled={isLoading}
          className="inline-flex items-center justify-center rounded-full bg-ink px-6 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-accent disabled:cursor-not-allowed disabled:opacity-70 dark:bg-accent dark:hover:bg-accentWarm"
        >
          {isLoading ? "Analyzing..." : "Predict category"}
        </button>
      </div>
    </section>
  );
}

export default InputBox;
