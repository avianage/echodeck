import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type LegalSection = {
  id: string;
  title: string;
  paragraphs: string[];
  items?: string[];
};

type LegalPageProps = {
  title: string;
  description: string;
  lastUpdated: string;
  sections: LegalSection[];
};

export function LegalPage({ title, description, lastUpdated, sections }: LegalPageProps) {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto grid max-w-7xl gap-8 px-6 py-10 md:grid-cols-[16rem_1fr] md:px-12 md:py-12 lg:gap-12">
        <aside className="min-w-0 md:sticky md:top-28 md:self-start">
          <Card className="w-full min-w-0">
            <CardHeader>
              <CardTitle className="text-base uppercase tracking-widest">Contents</CardTitle>
            </CardHeader>
            <CardContent>
              <nav aria-label={`${title} sections`} className="flex flex-col gap-3">
                {sections.map((section) => (
                  <Link
                    key={section.id}
                    href={`#${section.id}`}
                    className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
                  >
                    {section.title}
                  </Link>
                ))}
              </nav>
            </CardContent>
          </Card>
        </aside>

        <article className="min-w-0 space-y-8">
          <header className="space-y-4">
            <p className="text-xs font-black uppercase tracking-widest text-primary">
              Last updated: {lastUpdated}
            </p>
            <div className="space-y-4">
              <h1 className="break-words text-4xl font-black uppercase italic tracking-tighter md:text-6xl">
                {title}
              </h1>
              <p className="max-w-3xl break-words text-base font-medium leading-7 text-muted-foreground md:text-lg">
                {description}
              </p>
            </div>
          </header>

          <div className="space-y-6">
            {sections.map((section) => (
              <section key={section.id} id={section.id} className="min-w-0 scroll-mt-28">
                <Card className="w-full min-w-0">
                  <CardHeader>
                    <CardTitle>{section.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {section.paragraphs.map((paragraph) => (
                      <p
                        key={paragraph}
                        className="break-words text-sm font-medium leading-7 text-muted-foreground md:text-base"
                      >
                        {paragraph}
                      </p>
                    ))}
                    {section.items && (
                      <ul className="space-y-3 pl-5 text-sm font-medium leading-7 text-muted-foreground md:text-base">
                        {section.items.map((item) => (
                          <li key={item} className="list-disc break-words">
                            {item}
                          </li>
                        ))}
                      </ul>
                    )}
                  </CardContent>
                </Card>
              </section>
            ))}
          </div>
        </article>
      </div>
    </main>
  );
}
