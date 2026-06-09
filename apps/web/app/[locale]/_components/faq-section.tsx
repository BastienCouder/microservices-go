"use client";

import { useTranslations } from "next-intl";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  sectionCompactBodyClass,
  sectionHeadingClass,
  sectionHeadingMutedClass,
  sectionIntroTextClass,
} from "./section-styles";

type FaqItem = {
  question: string;
  answer: string;
};

export function FaqSection() {
  const t = useTranslations("faq");
  const items = t.raw("items") as FaqItem[];

  return (
    <section id="faq" className="relative py-16 sm:py-20 lg:py-28">
      <div className="max-w-[1400px] mx-auto px-6 lg:px-12">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-16">
          <div className="max-w-2xl">
            <h2 className={`${sectionHeadingClass} mb-6`}>
              <span className="block">{t("title")}</span>
              <span className={`mt-2 block ${sectionHeadingMutedClass}`}>{t("subtitle")}</span>
            </h2>
            <p className={sectionIntroTextClass}>{t("description")}</p>
          </div>
            <Accordion type="single" collapsible className="w-full">
              {items.map((item, index) => (
                <AccordionItem
                  key={item.question}
                  value={`faq-${index}`}
                  className="border-foreground/10 px-1"
                >
                  <AccordionTrigger className="py-5 text-base font-medium text-foreground hover:no-underline sm:text-lg">
                    {item.question}
                  </AccordionTrigger>
                  <AccordionContent className={`${sectionCompactBodyClass} max-w-3xl pr-8`}>
                    {item.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
        
        </div>
      </div>
    </section>
  );
}
