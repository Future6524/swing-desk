import Link from "next/link";

export default function NotFound() {
  return (
    <div className="empty">
      <p>That setup doesn’t exist.</p>
      <p style={{ marginTop: 12 }}>
        <Link href="/" className="gold">
          Back to the watchlist
        </Link>
      </p>
    </div>
  );
}
