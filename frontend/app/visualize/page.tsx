export const metadata = { title: "Battle Rap | Visualize" };

const REPORT_URL =
  "https://app.powerbi.com/view?r=eyJrIjoiNzk2M2UwNDMtMzBjMi00YzdkLWJkYzUtZDk1Nzc1NjQxYzM4IiwidCI6IjZiZjU3ZTE3LWZhOGItNDJlMy1iMDNlLTVjYjA3ZGUyNjVkMyJ9&pageName=ReportSection";

export default function VisualizePage() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="mb-6 text-3xl font-bold">Visualize</h1>
      <div className="aspect-[16/10] w-full overflow-hidden rounded-2xl border border-white/10">
        <iframe
          title="Battle Rap dashboard"
          src={REPORT_URL}
          className="h-full w-full"
          frameBorder={0}
          allowFullScreen
        />
      </div>
    </section>
  );
}
