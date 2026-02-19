import { motion } from "motion/react";

export default function Spinner() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="relative w-10 h-10">
        {/* Outer ring — blue, clockwise */}
        <motion.div
          className="absolute inset-0 rounded-full"
          style={{
            border: "2px solid rgba(59, 130, 246, 0.1)",
            borderTopColor: "var(--accent-blue)",
            boxShadow: "0 0 12px rgba(59, 130, 246, 0.3)",
          }}
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
        />
        {/* Inner ring — orange, counter-clockwise */}
        <motion.div
          className="absolute inset-1.5 rounded-full"
          style={{
            border: "2px solid rgba(249, 115, 22, 0.1)",
            borderBottomColor: "var(--accent-orange)",
            boxShadow: "0 0 8px rgba(249, 115, 22, 0.2)",
          }}
          animate={{ rotate: -360 }}
          transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
        />
      </div>
    </div>
  );
}
