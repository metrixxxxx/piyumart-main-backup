export default function BaoLoginCard({ children }) {
  return (
    <main className="bao-surface flex min-h-dvh items-center justify-center px-4 py-10">
      <section className="w-full max-w-md overflow-hidden rounded-2xl border border-[#dbe1f0] bg-white shadow-lg">
        <header className="border-b-4 border-[#FABB00] bg-[#131f50] px-7 py-6 text-white sm:px-9">
          <p className="text-lg font-extrabold tracking-tight">PIYU<span className="text-[#FABB00]">MART</span></p>
          <h1 className="mt-4 text-2xl font-bold">BAO Staff Login</h1>
          <p className="mt-1 text-sm text-white/80">Sign in with your authorized BAO account.</p>
        </header>
        <div className="p-7 sm:p-9">{children}</div>
      </section>
    </main>
  );
}
