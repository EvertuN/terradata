import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { ChevronLeft, Sun, Moon, Compass } from 'lucide-react';

export default function Custom404() {
  const router = useRouter();
  const [theme, setTheme] = useState<'dark' | 'light'>('light');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = (localStorage.getItem('terradata_theme') ||
        localStorage.getItem('urbanpulse_theme')) as 'dark' | 'light' | null;
      if (saved) {
        setTheme(saved);
        document.documentElement.setAttribute('data-theme', saved);
      } else {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        const initial = prefersDark ? 'dark' : 'light';
        setTheme(initial);
        document.documentElement.setAttribute('data-theme', initial);
      }
    }
  }, []);

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    if (typeof window !== 'undefined') {
      localStorage.setItem('terradata_theme', next);
      document.documentElement.setAttribute('data-theme', next);
    }
  };

  const isDark = theme === 'dark';

  return (
    <View style={[styles.root, isDark ? styles.rootDark : styles.rootLight]}>
      <Head>
        <title>404 - Página Não Encontrada | TerraData</title>
        <meta
          name="description"
          content="A página que você está procurando não foi encontrada no TerraData."
        />
        <meta name="robots" content="noindex, nofollow" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
      </Head>

      {/* Top Bar with Minimal Native Apple Controls */}
      <View style={styles.topBar}>
        <View style={styles.topBarInner}>
          <TouchableOpacity
            style={[styles.backBtn, isDark ? styles.backBtnDark : styles.backBtnLight]}
            onPress={() => router.push('/')}
            activeOpacity={0.7}
            accessibilityLabel="Voltar para a página inicial"
          >
            <ChevronLeft size={16} color={isDark ? '#64b5f6' : '#0071e3'} />
            <Text style={[styles.backBtnText, isDark ? styles.backTextDark : styles.backTextLight]}>
              Início
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.themeBtn, isDark ? styles.themeBtnDark : styles.themeBtnLight]}
            onPress={toggleTheme}
            activeOpacity={0.7}
            accessibilityLabel="Alternar tema claro e escuro"
          >
            {isDark ? <Sun size={15} color="#f5f5f7" /> : <Moon size={15} color="#1d1d1f" />}
          </TouchableOpacity>
        </View>
      </View>

      {/* Centered Content */}
      <View style={styles.centerContainer}>
        <View style={[styles.card, isDark ? styles.cardDark : styles.cardLight]}>
          <View style={[styles.iconWrap, isDark ? styles.iconWrapDark : styles.iconWrapLight]}>
            <Compass size={40} color={isDark ? '#64b5f6' : '#0071e3'} strokeWidth={1.75} />
          </View>

          <Text style={[styles.codeText, isDark ? styles.codeTextDark : styles.codeTextLight]}>
            404
          </Text>

          <Text style={[styles.title, isDark ? styles.titleDark : styles.titleLight]}>
            Página Não Encontrada
          </Text>

          <Text style={[styles.desc, isDark ? styles.descDark : styles.descLight]}>
            O recurso solicitado não existe, foi removido ou não está acessível.
          </Text>

          <TouchableOpacity
            style={[styles.actionBtn, isDark ? styles.actionBtnDark : styles.actionBtnLight]}
            onPress={() => router.push('/')}
            activeOpacity={0.8}
            accessibilityLabel="Ir para o mapa e página inicial"
          >
            <Text style={styles.actionBtnText}>Ir para a Página Inicial</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    minHeight: '100vh' as any,
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
  },
  rootLight: {
    backgroundColor: '#f5f5f7',
  },
  rootDark: {
    backgroundColor: '#000000',
  },
  topBar: {
    width: '100%',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.06)',
    backgroundColor: 'rgba(255,255,255,0.7)',
    backdropFilter: 'blur(20px)',
    zIndex: 10,
  } as any,
  topBarInner: {
    maxWidth: 960,
    marginHorizontal: 'auto' as any,
    paddingHorizontal: 20,
    paddingVertical: 14,
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  backBtnLight: {
    backgroundColor: 'rgba(0,113,227,0.08)',
  },
  backBtnDark: {
    backgroundColor: 'rgba(100,181,246,0.12)',
  },
  backBtnText: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 4,
  },
  backTextLight: {
    color: '#0071e3',
  },
  backTextDark: {
    color: '#64b5f6',
  },
  themeBtn: {
    padding: 8,
    borderRadius: 20,
  },
  themeBtnLight: {
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  themeBtnDark: {
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 460,
    borderRadius: 24,
    padding: 36,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
  },
  cardLight: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  cardDark: {
    backgroundColor: '#1c1c1e',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  iconWrapLight: {
    backgroundColor: 'rgba(0,113,227,0.08)',
  },
  iconWrapDark: {
    backgroundColor: 'rgba(100,181,246,0.12)',
  },
  codeText: {
    fontSize: 48,
    fontWeight: '800',
    letterSpacing: -1,
    marginBottom: 4,
  },
  codeTextLight: {
    color: '#1d1d1f',
  },
  codeTextDark: {
    color: '#f5f5f7',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.3,
    marginBottom: 10,
    textAlign: 'center',
  },
  titleLight: {
    color: '#1d1d1f',
  },
  titleDark: {
    color: '#f5f5f7',
  },
  desc: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 28,
  },
  descLight: {
    color: '#86868b',
  },
  descDark: {
    color: '#a1a1a6',
  },
  actionBtn: {
    backgroundColor: '#0071e3',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnLight: {
    backgroundColor: '#0071e3',
  },
  actionBtnDark: {
    backgroundColor: '#0071e3',
  },
  actionBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
});
