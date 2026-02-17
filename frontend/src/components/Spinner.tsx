export default function Spinner() {
  return (
    <div className="flex items-center justify-center py-20">
      <div
        className="w-8 h-8 rounded-full animate-spin"
        style={{
          border: "2px solid rgba(6, 182, 212, 0.15)",
          borderTopColor: "var(--accent-cyan)",
          boxShadow: "0 0 12px rgba(34, 211, 238, 0.3)",
        }}
      />
    </div>
  );
}
