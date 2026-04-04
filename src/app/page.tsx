import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
      <h1 className="text-[22px] font-bold tracking-[0.05em] mb-3">
        iiiaha.lab
      </h1>
      <p className="text-[14px] text-[#666] mb-8">
        SketchUp Extensions & Courses
      </p>
      <div className="flex gap-4">
        <Link
          href="/extensions"
          className="text-[13px] tracking-[0.05em] border border-[#111] px-6 py-2.5 no-underline hover:bg-[#111] hover:text-white transition-colors duration-200"
        >
          Extensions
        </Link>
        <Link
          href="/courses"
          className="text-[13px] tracking-[0.05em] border border-[#111] px-6 py-2.5 no-underline hover:bg-[#111] hover:text-white transition-colors duration-200"
        >
          Courses
        </Link>
      </div>
    </div>
  );
}
