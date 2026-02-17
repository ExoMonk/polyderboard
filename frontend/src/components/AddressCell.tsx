import { Link } from "react-router-dom";
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
        <Link to={`/trader/${address}`} className="text-blue-400 hover:text-blue-300 font-mono text-sm transition-colors">
          {short}
        </Link>
      ) : (
        <span className="font-mono text-sm">{short}</span>
      )}
      <a
        href={polygonscanAddress(address)}
        target="_blank"
        rel="noopener noreferrer"
        className="text-gray-600 hover:text-gray-400 transition-colors"
        title="View on Polygonscan"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
        </svg>
      </a>
    </div>
  );
}
