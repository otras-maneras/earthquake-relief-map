import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import type { BlogBlock } from '@/lib/blog';

// Renderiza el contenido estructurado de un artículo con un look editorial
// ("long-read"): subtítulos en serif, capitular en el primer párrafo,
// destacados (pull-quotes) en serif y bloques de cifras.
export default function BlogContent({ blocks }: { blocks: BlogBlock[] }) {
  const firstParagraphIndex = blocks.findIndex((b) => b.type === 'p');

  return (
    <div className="space-y-5">
      {blocks.map((b, i) => {
        switch (b.type) {
          case 'h2':
            return (
              <h2 key={i} className="text-[23px] md:text-[28px] font-semibold text-ap-primary font-serif mt-9 leading-[1.15] scroll-mt-20">
                {b.text}
              </h2>
            );
          case 'h3':
            return (
              <h3 key={i} className="text-[17px] md:text-[19px] font-bold text-ap-primary font-outfit mt-6">
                {b.text}
              </h3>
            );
          case 'p':
            return (
              <p
                key={i}
                className={`text-[16.5px] text-ap-secondary leading-[1.75] ${
                  i === firstParagraphIndex
                    ? 'first-letter:float-left first-letter:font-serif first-letter:font-semibold first-letter:text-ap-primary first-letter:text-[3.4rem] first-letter:leading-[0.78] first-letter:pr-2.5 first-letter:pt-1'
                    : ''
                }`}
              >
                {b.text}
              </p>
            );
          case 'ul':
            return (
              <ul key={i} className="list-disc pl-5 space-y-1.5 text-[16px] text-ap-secondary leading-relaxed marker:text-ap-muted">
                {b.items.map((it, j) => <li key={j}>{it}</li>)}
              </ul>
            );
          case 'ol':
            return (
              <ol key={i} className="list-decimal pl-5 space-y-1.5 text-[16px] text-ap-secondary leading-relaxed marker:text-ap-muted marker:font-bold">
                {b.items.map((it, j) => <li key={j}>{it}</li>)}
              </ol>
            );
          case 'stats':
            return (
              <div key={i} className="grid grid-cols-2 md:grid-cols-4 border border-ap-border rounded-xl divide-x divide-y md:divide-y-0 divide-ap-border overflow-hidden my-7">
                {b.items.map((s, j) => (
                  <div key={j} className="p-4">
                    <div className="text-[24px] md:text-[28px] font-semibold text-ap-primary font-serif leading-none">{s.value}</div>
                    <div className="text-[11.5px] text-ap-muted font-semibold mt-1.5 leading-snug">{s.label}</div>
                  </div>
                ))}
              </div>
            );
          case 'callout':
            return (
              <div key={i} className="bg-ap-primary/5 border border-ap-primary/15 rounded-xl p-4 text-[14.5px] text-ap-primary font-semibold leading-relaxed">
                {b.text}
              </div>
            );
          case 'pullquote':
            return (
              <figure key={i} className="my-9 border-l-2 border-ap-primary/40 pl-5">
                <blockquote className="text-[21px] md:text-[25px] font-serif italic text-ap-primary leading-[1.32]">
                  {b.text}
                </blockquote>
                {b.cite && <figcaption className="text-[12.5px] text-ap-muted font-semibold mt-2 not-italic">— {b.cite}</figcaption>}
              </figure>
            );
          case 'quote':
            return (
              <blockquote key={i} className="border-l-4 border-ap-border pl-4 italic text-[16px] text-ap-secondary">
                {b.text}
                {b.cite && <cite className="block not-italic text-[12px] text-ap-muted mt-1">— {b.cite}</cite>}
              </blockquote>
            );
          case 'cta':
            return (
              <Link
                key={i}
                href={b.href}
                className="inline-flex items-center gap-1.5 bg-ap-primary hover:bg-ap-secondary text-white font-bold text-[14px] px-5 py-2.5 rounded-xl transition-all active:scale-95 shadow-sm my-2"
              >
                {b.label} <ArrowRight size={15} />
              </Link>
            );
          default:
            return null;
        }
      })}
    </div>
  );
}
