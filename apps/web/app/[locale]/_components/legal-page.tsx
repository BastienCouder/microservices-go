import { FooterSection } from "@/app/[locale]/_components/footer-section";
import { Navigation } from "@/app/[locale]/_components/navigation";

type LegalSection = {
  title: string;
  body: string[];
};

type LegalPageProps = {
  title: string;
  intro: string;
  sections: LegalSection[];
};

export function LegalPage({ title, intro, sections }: LegalPageProps) {
  return (
    <main className="relative min-h-screen overflow-x-hidden noise-overlay bg-background">
      <Navigation />

      <section className="mx-auto max-w-[960px] px-6 pb-20 pt-36 sm:px-8 lg:px-10 lg:pt-40">
        <div className="max-w-3xl">
          <h1 className="font-display text-4xl text-foreground sm:text-5xl">
            {title}
          </h1>
          <p className="mt-5 text-base leading-7 text-muted-foreground sm:text-lg">
            {intro}
          </p>
        </div>

        <div className="mt-12 space-y-6">
          {sections.map((section) => (
            <section
              key={section.title}
              className="rounded-3xl border border-foreground/10 bg-background/70 p-6 backdrop-blur-sm sm:p-8"
            >
              <h2 className="text-xl font-semibold text-foreground">
                {section.title}
              </h2>

              <ul className="mt-4 space-y-3 text-sm leading-7 text-muted-foreground sm:text-base">
                {section.body.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </section>

      <FooterSection />
    </main>
  );
}
