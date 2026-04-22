export default function PublicSiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="min-h-screen overflow-x-hidden">{children}</div>;
}
