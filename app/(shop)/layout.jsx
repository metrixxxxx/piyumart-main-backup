import Navbar from "@/components/ui/navbar";

export default function ShopLayout({ children }) {
  return (
    <>
      <Navbar />
      <main>{children}</main>
    </>
  );
}