import Link from 'next/link';

export function Footer() {
  return (
    <footer className="border-t border-border bg-background">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-8 md:flex-row md:items-center md:justify-between md:px-12">
        <div className="space-y-1">
          <Link
            href="/"
            className="text-xl font-black uppercase italic tracking-tighter text-foreground transition-colors hover:text-primary"
          >
            Echo<span className="text-primary">Deck</span>
          </Link>
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
            © 2026 EchoDeck
          </p>
        </div>

        <nav
          aria-label="Legal"
          className="flex flex-wrap items-center gap-x-6 gap-y-3 text-xs font-black uppercase tracking-widest text-muted-foreground"
        >
          <Link href="/privacy" className="transition-colors hover:text-primary">
            Privacy
          </Link>
          <Link href="/terms" className="transition-colors hover:text-primary">
            Terms
          </Link>
          <a
            href="https://avianage.in"
            target="_blank"
            rel="noopener noreferrer"
            className="transition-colors hover:text-primary"
          >
            Aakash Joshi
          </a>
        </nav>
      </div>
    </footer>
  );
}
