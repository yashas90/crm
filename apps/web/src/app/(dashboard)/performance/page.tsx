import dynamic from "next/dynamic";

const AgentPerformanceContent = dynamic(
  () =>
    import("@/components/performance/agent-performance-content").then((m) => ({
      default: m.AgentPerformanceContent,
    })),
  { ssr: false },
);

export default function PerformancePage() {
  return <AgentPerformanceContent />;
}
