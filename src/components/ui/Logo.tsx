import type { FC } from "react";

interface LogoProps {
  className?: string;
  showText?: boolean;
}

export const Logo: FC<LogoProps> = ({ className = "h-8", showText = true }) => (
  <div className={`flex items-center gap-2.5 ${className}`}>
    <svg
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="aspect-square h-full w-auto text-[#1A1A1A]"
      aria-hidden="true"
    >
      <rect width="40" height="40" rx="10" fill="#F8F5F0" />
      <path
        d="M20 11C21.1046 11 22 11.8954 22 13C22 13.8 21.5 14.5 20.8 14.8L27 18.5V20H13V18.5L19.2 14.8C18.5 14.5 18 13.8 18 13C18 11.8954 18.8954 11 20 11Z"
        stroke="#C5A880"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect x="11" y="20" width="18" height="11" rx="2" stroke="#1A1A1A" strokeWidth="2" />
      <path d="M16 20V18" stroke="#C5A880" strokeWidth="2" strokeLinecap="round" />
      <path d="M24 20V18" stroke="#C5A880" strokeWidth="2" strokeLinecap="round" />
    </svg>
    {showText && (
      <span className="whitespace-nowrap font-heading text-xl font-bold tracking-tight text-[#1A1A1A]">
        Rent<span className="text-[#C5A880]">Folio</span>
      </span>
    )}
  </div>
);