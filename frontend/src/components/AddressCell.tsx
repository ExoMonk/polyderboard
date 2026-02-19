import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { shortenAddress, polygonscanAddress } from "../lib/format";

interface Props {
  address: string;
  link?: boolean;
}

export default function AddressCell({ address, link = true }: Props) {
  const short = shortenAddress(address);

  return (
    <div className="flex items-center gap-2">
      {link ? (
        <motion.div whileHover={{ textShadow: "0 0 8px rgba(59,130,246,0.4)" }}>
          <Link
            to={`/trader/${address}`}
            className="text-[var(--accent-blue)] hover:brightness-125 font-mono text-sm transition-all duration-200"
          >
            {short}
          </Link>
        </motion.div>
      ) : (
        <span className="font-mono text-sm text-[var(--accent-blue)]">{short}</span>
      )}
      <motion.a
        href={polygonscanAddress(address)}
        target="_blank"
        rel="noopener noreferrer"
        className="text-[var(--text-secondary)] opacity-40 hover:opacity-100 hover:text-[var(--accent-blue)] transition-all duration-200"
        title="View on Polygonscan"
        whileHover={{ scale: 1.2, rotate: 5 }}
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
        </svg>
      </motion.a>
    </div>
  );
}
