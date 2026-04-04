import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
      <h1 className="text-[24px] font-bold tracking-[0.05em] mb-4">
        iiiaha.lab
      </h1>
      <p className="text-[15px] text-[#666] mb-10 leading-relaxed">
        SketchUp Extensions & Courses
      </p>
      <div className="flex gap-6">
        <Link
          href="/extensions"
          className="text-[13px] tracking-[0.1em] border border-[#111] px-8 py-3 no-underline hover:bg-[#111] hover:text-white transition-colors duration-200"
        >
          Extensions
        </Link>
        <Link
          href="/courses"
          className="text-[13px] tracking-[0.1em] border border-[#111] px-8 py-3 no-underline hover:bg-[#111] hover:text-white transition-colors duration-200"
        >
          Courses
        </Link>
      </div>
    </div>
  );
}
