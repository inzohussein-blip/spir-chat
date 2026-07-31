import type { Locale } from "./config";

// English is the source of truth for the dictionary shape; `ar` must mirror it.
const en = {
  nav: {
    star: "Star on GitHub",
    login: "Log in",
    getStarted: "Get started free",
  },
  hero: {
    badge: "MIT Licensed",
    viewGithub: "View on GitHub",
    titleLead: "Live chat and chatbots for your",
    titleHighlight: "website and social",
    subtitle:
      "One inbox for every conversation — website live chat plus DMs and comments across Instagram, Facebook, WhatsApp, Telegram, X, Bluesky, and Reddit. Automate with a visual flow builder and AI, or take over live. Open source, self-hostable, and built on Supabase.",
    ctaPrimary: "Get started free",
    ctaSource: "View source code",
    note: "MIT licensed. Self-host or use our cloud. No credit card required.",
  },
  footer: {
    tagline: "The open-source live chat and chatbot platform.",
  },
  auth: {
    loginTitle: "Welcome back",
    loginSubtitle: "Log in to your SpirChat account",
    registerTitle: "Get started with SpirChat",
    registerSubtitle: "Create your free account",
    name: "Name",
    email: "Email",
    password: "Password",
    loginCta: "Log in",
    registerCta: "Create account",
    loggingIn: "Logging in…",
    creatingAccount: "Creating account…",
    noAccount: "Don't have an account?",
    haveAccount: "Already have an account?",
    signUpLink: "Sign up",
    signInLink: "Log in",
    orContinue: "Or continue with",
    namePlaceholder: "Your name",
    minChars: "Min. 6 characters",
  },
  sidebar: {
    flows: "Flows",
    inbox: "Inbox",
    contacts: "Contacts",
    broadcasts: "Broadcasts",
    sequences: "Sequences",
    analytics: "Analytics",
    growth: "Growth",
    website: "Website",
    channels: "Channels",
    settings: "Settings",
    lightMode: "Light mode",
    darkMode: "Dark mode",
    signOut: "Sign out",
  },
  widget: {
    title: "SpirChat",
    subtitle: "We typically reply shortly",
    empty: "Send us a message and we'll get back to you.",
    unavailable: "Chat is unavailable right now.",
    placeholder: "Type a message…",
  },
};

export type Dictionary = typeof en;

const ar: Dictionary = {
  nav: {
    star: "قيّمنا على GitHub",
    login: "تسجيل الدخول",
    getStarted: "ابدأ مجاناً",
  },
  hero: {
    badge: "رخصة MIT",
    viewGithub: "اعرضه على GitHub",
    titleLead: "لايف شات وبوتات لموقعك",
    titleHighlight: "ومنصّات التواصل",
    subtitle:
      "صندوق وارد واحد لكل المحادثات — لايف شات على موقعك إضافةً إلى الرسائل والتعليقات عبر إنستغرام وفيسبوك وواتساب وتيليغرام و X وبلوسكاي وريديت. أتمِت عبر منشئ تدفقات مرئي وذكاء اصطناعي، أو تولَّ المحادثة مباشرةً. مفتوح المصدر، قابل للاستضافة الذاتية، ومبنيّ على Supabase.",
    ctaPrimary: "ابدأ مجاناً",
    ctaSource: "اطّلع على الكود",
    note: "برخصة MIT. استضِفه ذاتياً أو استخدم سحابتنا. بدون بطاقة ائتمان.",
  },
  footer: {
    tagline: "منصّة اللايف شات والبوتات مفتوحة المصدر.",
  },
  auth: {
    loginTitle: "أهلاً بعودتك",
    loginSubtitle: "سجّل الدخول إلى حسابك في SpirChat",
    registerTitle: "ابدأ مع SpirChat",
    registerSubtitle: "أنشئ حسابك المجاني",
    name: "الاسم",
    email: "البريد الإلكتروني",
    password: "كلمة المرور",
    loginCta: "تسجيل الدخول",
    registerCta: "إنشاء حساب",
    loggingIn: "جارٍ تسجيل الدخول…",
    creatingAccount: "جارٍ إنشاء الحساب…",
    noAccount: "ليس لديك حساب؟",
    haveAccount: "لديك حساب بالفعل؟",
    signUpLink: "أنشئ حساباً",
    signInLink: "سجّل الدخول",
    orContinue: "أو تابع عبر",
    namePlaceholder: "اسمك",
    minChars: "6 أحرف على الأقل",
  },
  sidebar: {
    flows: "التدفقات",
    inbox: "الوارد",
    contacts: "جهات الاتصال",
    broadcasts: "البثّ",
    sequences: "التسلسلات",
    analytics: "التحليلات",
    growth: "النموّ",
    website: "الموقع",
    channels: "القنوات",
    settings: "الإعدادات",
    lightMode: "الوضع الفاتح",
    darkMode: "الوضع الداكن",
    signOut: "تسجيل الخروج",
  },
  widget: {
    title: "SpirChat",
    subtitle: "نردّ عادةً خلال وقت قصير",
    empty: "أرسل لنا رسالة وسنعاود التواصل معك.",
    unavailable: "المحادثة غير متاحة حالياً.",
    placeholder: "اكتب رسالة…",
  },
};

export const dictionaries: Record<Locale, Dictionary> = { en, ar };
