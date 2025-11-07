import './global.css';
export const metadata = {
  title: 'Générateur de Factures IA',
  description: 'Générateur automatique de factures par OCR et IA',
}

export default function RootLayout({ children }) {
  return (
    <html lang="fr">
      <body className="antialiased">{children}</body>
    </html>
  )
}