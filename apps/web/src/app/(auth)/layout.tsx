import Image from "next/image";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-neu-cream p-6 transition-colors duration-300 dark:bg-[#0A0F1C]">
      <div className="pointer-events-none absolute inset-0 hidden dark:block">
        <img
          src="https://images.unsplash.com/photo-1515703944563-dbcfbf121b3d?auto=format&w=1440&q=80&fit=crop"
          className="h-full w-full object-cover opacity-10 blur-sm"
          alt=""
        />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#0A0F1C]/80 to-[#0A0F1C]" />
      </div>
      <div className="relative z-10 mb-8 flex flex-col items-center text-center">
        <Image
          src="/brand/logo.png"
          alt="PropNinja"
          width={280}
          height={80}
          className="mb-4 h-auto w-64 max-w-full object-contain"
          priority
        />
        <p className="font-medium text-neutral-600 dark:text-slate-400">
          Real estate CRM for closers
        </p>
      </div>
      <div className="relative z-10 w-full max-w-md">{children}</div>
    </div>
  );
}
