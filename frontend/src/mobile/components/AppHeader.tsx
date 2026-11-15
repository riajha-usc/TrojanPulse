import "../mobile.css";

export default function AppHeader() {
  return (
    <header className="mobile-header">
      <button className="mobile-header-button" type="button" aria-label="Safety information">
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          aria-hidden="true"
        >
          <path d="M12 3 5 6v5c0 4.5 3 7.5 7 10 4-2.5 7-5.5 7-10V6l-7-3Z" />
        </svg>
      </button>

      <span className="mobile-wordmark">
        Trojan<span>Pulse</span>
      </span>

      <button className="mobile-header-button" type="button" aria-label="Notifications">
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
          <path d="M10 21h4" />
        </svg>
      </button>
    </header>
  );
}
