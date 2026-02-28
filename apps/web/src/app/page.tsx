import Link from "next/link";

export default function Home() {
  return (
    <main className="page">
      <h1>Web App initialisee</h1>
      <p>Application frontend Next.js.</p>
      <p>
        <Link href="/auth">Ouvrir la page de test auth</Link>
      </p>
    </main>
  );
}
