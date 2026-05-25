import type { AppProps } from 'next/app';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import { ThemeProvider } from '../components/ThemeProvider';
import '../styles/global.css';

export default function App({ Component, pageProps }: AppProps) {
  return (
    <ThemeProvider>
      <div className={`${GeistSans.variable} ${GeistMono.variable} font-sans`}>
        <Component {...pageProps} />
      </div>
    </ThemeProvider>
  );
}
