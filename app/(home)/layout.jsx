import Navbar from "@/components/ui/navbar";

export default function HomeLayout({ children }) {
  return (
    <>
      <Navbar />
      {children}
    </>
  );
}
