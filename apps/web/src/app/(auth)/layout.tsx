import Image from "next/image";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-neu-cream p-6">
      <div className="mb-8 flex flex-col items-center text-center">
        <Image
          src="/brand/logo.png"
          alt="PropNinja"
          width={280}
          height={80}
          className="mb-4 h-auto w-64 max-w-full object-contain"
          priority
        />
        <p className="font-medium text-neutral-600">Real estate CRM for closers</p>
      </div>
      {children}
    </div>
  );
}
