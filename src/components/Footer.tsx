import Link from "next/link";

export default function Footer() {
  return (
    <footer>
      <div className="max-w-[800px] mx-auto px-10 max-sm:px-5">
        <div className="border-t border-[#111]" />
      </div>
      <div className="max-w-[800px] mx-auto px-10 max-sm:px-5 py-10">
        <div className="flex justify-between text-[13px] max-sm:flex-col max-sm:gap-6">
          <div className="flex flex-col gap-1">
            <span className="font-bold tracking-[0.05em]">iiiaha.lab</span>
            <span className="text-[#999]">contact@iiiaha.com</span>
          </div>
          <div className="flex flex-col gap-1 text-right max-sm:text-left">
            <Link href="https://www.instagram.com/iiiaha.lab/" target="_blank" rel="noopener noreferrer">
              Instagram
            </Link>
            <Link href="/terms">Terms</Link>
            <Link href="/privacy">Privacy</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
