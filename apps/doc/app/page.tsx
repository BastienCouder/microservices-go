import Link from "next/link";

export default function HomePage() {
  return (
    <main className="landing">
      <h1>Documentation API</h1>
      <p>Portail de documentation des microservices.</p>
      <Link href="/docs/">Ouvrir la documentation</Link>
    </main>
  );
}
