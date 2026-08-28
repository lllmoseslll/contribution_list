import './globals.css';

export const metadata = {
  title: 'Kwanjula Contribution & Pledge Portal | Edwin & Jamirah',
  description: 'Official Introduction Ceremony Budget, Pledges & Live Contribution Tracker for Mr. Edwin Laston & Jamirah Nakayemba (27th November 2026)',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@500;700;800&family=Outfit:wght@300;400;500;600;700;800&family=Playfair+Display:ital,wght@0,600;0,700;1,400&display=swap" rel="stylesheet" />
      </head>
      <body className="min-h-screen flex flex-col antialiased">
        {children}
      </body>
    </html>
  );
}
