import './globals.css';
export const metadata={title:'MAMOUN POS — Plateforme de restauration',description:'Gestion de restaurants, cafés, commandes, tables et caisse.',manifest:'/manifest.webmanifest',appleWebApp:{capable:true,title:'MAMOUN POS',statusBarStyle:'default'},icons:{icon:'/icon',apple:'/icon'}};
export default function RootLayout({children}){return <html lang="fr"><body>{children}</body></html>}
