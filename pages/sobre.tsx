import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Linking,
} from 'react-native';
import { ChevronLeft, Sun, Moon, Globe, Github, Linkedin } from 'lucide-react';

export default function SobrePage() {
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
        <title>Sobre | TerraData</title>
        <meta
          name="description"
          content="Conheça a proposta, missão e arquitetura do TerraData: agregador inteligente de clima, cultura e roteiros para todas as cidades."
        />
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
              Voltar
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.themeBtn, isDark ? styles.themeBtnDark : styles.themeBtnLight]}
            onPress={toggleTheme}
            activeOpacity={0.7}
            accessibilityLabel="Alternar tema claro/escuro"
          >
            {isDark ? <Sun size={15} color="#ffd60a" /> : <Moon size={15} color="#1d1d1f" />}
          </TouchableOpacity>
        </View>
      </View>

      {/* Scrollable Content */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Page Hero Header */}
        <View style={styles.heroBlock}>
          <Text style={[styles.heroTitle, isDark ? styles.textPrimaryDark : styles.textPrimaryLight]}>
            Sobre
          </Text>
          <Text style={[styles.heroSubtitle, isDark ? styles.textSecondaryDark : styles.textSecondaryLight]}>
            Agregador geográfico, meteorológico e cultural para qualquer cidade.
          </Text>
        </View>

        {/* Apple Cards Stack */}
        <View style={styles.cardsStack}>
          {/* O que é o TerraData */}
          <View style={[styles.card, isDark ? styles.cardDark : styles.cardLight]}>
            <Text style={[styles.cardTitle, isDark ? styles.textPrimaryDark : styles.textPrimaryLight]}>
              O que é o TerraData?
            </Text>
            <Text style={[styles.cardBody, isDark ? styles.textSecondaryDark : styles.textSecondaryLight]}>
              O TerraData é uma plataforma aberta de inteligência territorial que unifica dados meteorológicos de alta precisão, patrimônio cultural e sugestões dinâmicas de roteiros turísticos. Desenvolvido para entregar uma experiência limpa e livre de anúncios, o projeto indexa mais de 5.570 municípios brasileiros e as principais capitais mundiais em uma interface inspirada na simplicidade e refinamento dos sistemas Apple.
            </Text>
          </View>

          {/* Nossa Missão & Propósito */}
          <View style={[styles.card, isDark ? styles.cardDark : styles.cardLight]}>
            <Text style={[styles.cardTitle, isDark ? styles.textPrimaryDark : styles.textPrimaryLight]}>
              Nossa Missão & Propósito
            </Text>
            <Text style={[styles.cardBody, isDark ? styles.textSecondaryDark : styles.textSecondaryLight]}>
              Democratizar o acesso a informações públicas de forma rápida, privada e sem sobrecarga cognitiva. Acreditamos que pesquisar as condições climáticas de hoje ou planejar a visita aos pontos históricos de uma cidade deve ser uma experiência instantânea, confiável e transparente, sem coleta invasiva de dados ou rastreadores ocultos.
            </Text>
          </View>

          {/* Como Funciona a Plataforma */}
          <View style={[styles.card, isDark ? styles.cardDark : styles.cardLight]}>
            <Text style={[styles.cardTitle, isDark ? styles.textPrimaryDark : styles.textPrimaryLight]}>
              Como Funciona a Plataforma
            </Text>
            <Text style={[styles.cardBody, isDark ? styles.textSecondaryDark : styles.textSecondaryLight]}>
              A arquitetura do TerraData opera em três eixos integrados: modelos numéricos abertos do Open-Meteo para aferição de temperaturas, vento, índice UV e qualidade do ar em tempo real; consultas semânticas geolocalizadas via Wikidata e Wikipédia para identificação de atrações históricas e fotos de domínio público; e inteligência artificial generativa com proteção de taxa para sintetizar roteiros diários adaptados ao clima e horário do local.
            </Text>
          </View>

          {/* Desenvolvimento & Autoria */}
          <View style={[styles.card, isDark ? styles.cardDark : styles.cardLight]}>
            <Text style={[styles.cardTitle, isDark ? styles.textPrimaryDark : styles.textPrimaryLight]}>
              Desenvolvimento & Autoria
            </Text>
            <Text style={[styles.cardBody, isDark ? styles.textSecondaryDark : styles.textSecondaryLight]}>
              O projeto foi idealizado e desenvolvido de forma independente por <Text style={styles.boldText}>Everton Almeida</Text>, em Rondônia, Brasil. Construído com tecnologias modernas da web — incluindo Next.js, React Native Web e TypeScript — o TerraData reflete uma visão prática de que ferramentas digitais podem ser poderosas, funcionais e esteticamente agradáveis.
            </Text>
            <View style={styles.authorLinksRow}>
              <TouchableOpacity
                style={[styles.authorChip, isDark ? styles.chipDark : styles.chipLight]}
                onPress={() => Linking.openURL('https://everton.net.br')}
                activeOpacity={0.7}
              >
                <Globe size={13} color={isDark ? '#64b5f6' : '#0071e3'} />
                <Text style={[styles.authorChipText, isDark ? styles.linkActiveDark : styles.linkActiveLight]}>
                  everton.net.br
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.authorChip, isDark ? styles.chipDark : styles.chipLight]}
                onPress={() => Linking.openURL('https://linkedin.com/in/almeidaeverton')}
                activeOpacity={0.7}
              >
                <Linkedin size={13} color={isDark ? '#64b5f6' : '#0071e3'} />
                <Text style={[styles.authorChipText, isDark ? styles.linkActiveDark : styles.linkActiveLight]}>
                  linkedin.com/in/almeidaeverton
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.authorChip, isDark ? styles.chipDark : styles.chipLight]}
                onPress={() => Linking.openURL('https://github.com/evertun')}
                activeOpacity={0.7}
              >
                <Github size={13} color={isDark ? '#64b5f6' : '#0071e3'} />
                <Text style={[styles.authorChipText, isDark ? styles.linkActiveDark : styles.linkActiveLight]}>
                  github.com/evertun
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Aviso Legal & Termos */}
          <View style={[styles.card, isDark ? styles.cardDark : styles.cardLight]}>
            <Text style={[styles.cardTitle, isDark ? styles.textPrimaryDark : styles.textPrimaryLight]}>
              Aviso Legal & Termos
            </Text>
            <Text style={[styles.cardBody, isDark ? styles.textSecondaryDark : styles.textSecondaryLight]}>
              As previsões meteorológicas e resumos culturais apresentados são provenientes de fontes públicas e dados abertos mantidos por instituições terceiras, destinando-se a fins de consulta, planejamento e utilidade pública. Para situações de alerta emergencial ou desastres naturais, recomendamos sempre acompanhar as orientações da Defesa Civil e dos centros meteorológicos oficiais do seu estado.
            </Text>
          </View>
        </View>

        {/* Minimal Apple Footer */}
        <View style={styles.footer}>
          <View style={styles.footerNav}>
            <TouchableOpacity onPress={() => router.push('/sobre')} activeOpacity={0.6}>
              <Text style={[styles.footerLinkActive, isDark ? styles.linkActiveDark : styles.linkActiveLight]}>
                Sobre
              </Text>
            </TouchableOpacity>
            <Text style={styles.footerDot}>•</Text>
            <TouchableOpacity onPress={() => router.push('/fontes')} activeOpacity={0.6}>
              <Text style={[styles.footerLink, isDark ? styles.textSecondaryDark : styles.textSecondaryLight]}>
                Fontes de dados
              </Text>
            </TouchableOpacity>
            <Text style={styles.footerDot}>•</Text>
            <TouchableOpacity onPress={() => router.push('/contato')} activeOpacity={0.6}>
              <Text style={[styles.footerLink, isDark ? styles.textSecondaryDark : styles.textSecondaryLight]}>
                Contato
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={[styles.footerCopy, isDark ? styles.textSecondaryDark : styles.textSecondaryLight]}>
            Clima por Open-Meteo · © {new Date().getFullYear()} TerraData
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    minHeight: '100vh',
    width: '100%',
  },
  rootLight: {
    backgroundColor: '#f6f8fc',
  },
  rootDark: {
    backgroundColor: '#0d1219',
  },
  topBar: {
    width: '100%',
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  topBarInner: {
    width: '100%',
    maxWidth: 680,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 999,
  },
  backBtnLight: {
    backgroundColor: '#e5effd',
  },
  backBtnDark: {
    backgroundColor: 'rgba(10, 132, 255, 0.15)',
  },
  backBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  backTextLight: {
    color: '#0071e3',
  },
  backTextDark: {
    color: '#64b5f6',
  },
  themeBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  themeBtnLight: {
    backgroundColor: '#ffffff',
    borderColor: '#d5dded',
  },
  themeBtnDark: {
    backgroundColor: '#161e29',
    borderColor: '#2a3646',
  },
  scrollView: {
    flex: 1,
    width: '100%',
  },
  scrollContent: {
    width: '100%',
    maxWidth: 680,
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 48,
    gap: 22,
  },
  heroBlock: {
    gap: 6,
    marginBottom: 4,
  },
  heroTitle: {
    fontSize: 34,
    fontWeight: '750',
    letterSpacing: -0.8,
  },
  heroSubtitle: {
    fontSize: 16,
    lineHeight: 24,
  },
  cardsStack: {
    width: '100%',
    gap: 16,
  },
  card: {
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    boxShadow: '0 4px 18px rgba(16, 24, 40, 0.04)',
    gap: 10,
  },
  cardLight: {
    backgroundColor: '#ffffff',
    borderColor: '#d5dded',
  },
  cardDark: {
    backgroundColor: '#161e29',
    borderColor: '#2a3646',
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '650',
    letterSpacing: -0.2,
  },
  cardBody: {
    fontSize: 15,
    lineHeight: 24,
  },
  boldText: {
    fontWeight: '600',
  },
  authorLinksRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 4,
  },
  authorChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  chipLight: {
    backgroundColor: '#f0f4fa',
  },
  chipDark: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  authorChipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  footer: {
    marginTop: 20,
    alignItems: 'center',
    gap: 8,
    paddingVertical: 16,
  },
  footerNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  footerLink: {
    fontSize: 13,
    fontWeight: '500',
  },
  footerLinkActive: {
    fontSize: 13,
    fontWeight: '600',
  },
  linkActiveLight: {
    color: '#0071e3',
  },
  linkActiveDark: {
    color: '#64b5f6',
  },
  footerDot: {
    fontSize: 12,
    color: '#86868b',
  },
  footerCopy: {
    fontSize: 12,
  },
  textPrimaryLight: {
    color: '#0f1722',
  },
  textPrimaryDark: {
    color: '#eef2f8',
  },
  textSecondaryLight: {
    color: '#556070',
  },
  textSecondaryDark: {
    color: '#9eabbd',
  },
});
