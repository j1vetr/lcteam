import { Link } from 'wouter';

export default function NotFound() {
  return (
    <div className="flex min-h-[70dvh] w-full flex-col items-center justify-center px-6 text-center">
      <p className="eyebrow">404</p>
      <h1 className="heading mt-2 text-[30px]">Bu sayfa bulunamadı.</h1>
      <p className="mt-2 text-[15px] font-light text-muted-foreground">Bağlantı eskimiş ya da adres yanlış yazılmış olabilir.</p>
      <Link href="/" className="pill pill-primary mt-6">Panolara dön</Link>
    </div>
  );
}
