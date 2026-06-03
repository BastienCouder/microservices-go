import {
  sectionCompactBodyClass,
  sectionCompactTitleClass,
  sectionHeadingClass,
  sectionHeadingMutedClass,
  sectionIntroTextClass,
} from "./section-styles";

const segments = [
  {
    fig: "FIG 0.1",
    title: "Le CRM confondu avec un outil d'emailing",
    description:
      "VISIA detecte une confusion concurrentielle, recommande une page comparative et une FAQ pipeline commercial, puis genere le draft a pousser dans le CMS.",
    visual: "growth",
  },
  {
    fig: "FIG 0.2",
    title: "Le bon outil, mais dans la mauvaise categorie",
    description:
      "VISIA revele un mauvais cadrage de categorie dans les reponses IA et recommande les clarifications de messaging a deployer sur la home et les comparatifs.",
    visual: "cmo",
  },
  {
    fig: "FIG 0.3",
    title: "Visible sur les mauvais prompts, invisible sur ceux qui convertissent",
    description:
      "VISIA compare le mention rate par niveau d'intention, isole le concurrent qui capte la demande et propose les pages use case, /vs et guides a creer en priorite.",
    visual: "saas",
  },
];

function SegmentVisual({ type }: { type: string }) {
  return (
    <div className="relative h-64 w-full overflow-hidden rounded-[1.5rem] border border-primary/10 bg-[radial-gradient(circle_at_top,rgba(15,23,42,0.02),transparent_60%),linear-gradient(180deg,rgba(255,255,255,0.95),rgba(248,250,252,0.98))]">
      {type === "growth" && (
        <div className="absolute left-1/2 top-1/2 h-28 w-28 -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-xl border border-primary/30 bg-primary/[0.03]">
          <div className="absolute -left-8 top-8 h-24 w-24 rounded-xl border border-primary/20" />
          <div className="absolute left-8 -top-8 h-24 w-24 rounded-xl border border-primary/20" />
          <div className="absolute left-10 top-10 h-12 w-12 rounded-full border border-primary/35 bg-primary/[0.05]" />
        </div>
      )}

      {type === "cmo" && (
        <div className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-end gap-3">
          {[56, 84, 120, 160, 108].map((height, index) => (
            <div
              key={index}
              className="w-9 rounded-t-lg border border-primary/20 bg-primary/[0.06]"
              style={{ height }}
            />
          ))}
        </div>
      )}

      {type === "saas" && (
        <div className="absolute left-1/2 top-1/2 grid -translate-x-1/2 -translate-y-1/2 grid-cols-3 gap-3">
          {Array.from({ length: 9 }).map((_, index) => (
            <div
              key={index}
              className="h-12 w-12 rounded-lg border border-primary/20 bg-primary/[0.05]"
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function SegmentsSection() {
  return (
    <section className="py-16 text-foreground sm:py-20 lg:py-24">
      <div className="mx-auto max-w-[1400px] px-6 lg:px-12">
        <div className="mb-14 max-w-3xl lg:mb-16">
          <p className="mb-4 text-xs font-mono uppercase tracking-[0.24em] text-primary">
            Cas d'usage B2B reels
          </p>
          <h2 className={sectionHeadingClass}>
            Les IA B2B
            <br />
            <span className={sectionHeadingMutedClass}>
              filtrent deja par role et taille d'entreprise.
            </span>
          </h2>
          <p className={`${sectionIntroTextClass} mt-6 max-w-2xl`}>
            VISIA montre ou votre marque est citee, mal comprise ou ignoree,
            puis transforme ces constats en contenus actionnables.
          </p>
        </div>

        <div className="grid gap-5 md:grid-cols-3">
          {segments.map((segment, index) => (
            <article
              key={segment.title}
              className="group relative rounded-[1.75rem] p-5 transition-colors duration-300 hover:border-primary/25 sm:p-6 lg:p-8"
            >
              <p className="mb-4 font-mono text-[11px] uppercase tracking-[0.22em] text-primary/65">
                {segment.fig}
              </p>

              <SegmentVisual type={segment.visual} />

              <div className="mt-8">
                <h3 className={`${sectionCompactTitleClass} text-primary`}>
                  {segment.title}
                </h3>
                <p className={`${sectionCompactBodyClass} mt-4 max-w-sm`}>
                  {segment.description}
                </p>
              </div>

              <div
                className={[
                  "pointer-events-none absolute inset-x-8 bottom-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent transition-opacity duration-300",
                  index === 1 ? "opacity-100" : "opacity-70 group-hover:opacity-100",
                ].join(" ")}
              />
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
