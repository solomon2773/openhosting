import "server-only";
import { cookies } from "next/headers";

// Lightweight i18n: flat dot-path dictionaries, cookie-selected locale,
// English fallback. Add a locale by extending DICTIONARIES; pages migrate
// to t() incrementally.

const en = {
  "nav.cart": "Cart",
  "nav.signIn": "Sign in",
  "nav.dashboard": "Dashboard",
  "nav.blog": "News",
  "home.heroTitle": "Hosting that scales with you",
  "home.heroSubtitle":
    "offers reliable game servers, VPS and web hosting with instant setup and fair pricing.",
  "home.browsePlans": "Browse plans",
  "home.createAccount": "Create account",
  "home.viewAll": "View all",
  "home.from": "From",
  "home.perMonth": "/mo",
  "home.empty": "No products yet. Sign in as an admin to add your catalog.",
  "footer.allRights": "All rights reserved.",
  "footer.poweredBy": "Powered by",
  "auth.welcomeBack": "Welcome back",
  "auth.signInSubtitle": "Sign in to manage your services.",
  "auth.email": "Email",
  "auth.password": "Password",
  "auth.forgotPassword": "Forgot password?",
  "auth.signIn": "Sign in",
  "auth.newHere": "New here?",
  "auth.createAccount": "Create an account",
  "auth.registerTitle": "Create your account",
  "auth.registerSubtitle": "Order services and manage billing in one place.",
  "auth.firstName": "First name",
  "auth.lastName": "Last name",
  "auth.passwordHint": "At least 8 characters.",
  "auth.haveAccount": "Already have an account?",
} as const;

export type MessageKey = keyof typeof en;

const nl: Record<MessageKey, string> = {
  ...en,
  "nav.cart": "Winkelwagen",
  "nav.signIn": "Inloggen",
  "nav.dashboard": "Dashboard",
  "nav.blog": "Nieuws",
  "home.heroTitle": "Hosting die met je meegroeit",
  "home.heroSubtitle":
    "biedt betrouwbare gameservers, VPS en webhosting met directe installatie en eerlijke prijzen.",
  "home.browsePlans": "Bekijk pakketten",
  "home.createAccount": "Account aanmaken",
  "home.viewAll": "Bekijk alles",
  "home.from": "Vanaf",
  "home.perMonth": "/mnd",
  "home.empty": "Nog geen producten. Log in als beheerder om je catalogus toe te voegen.",
  "footer.allRights": "Alle rechten voorbehouden.",
  "footer.poweredBy": "Mogelijk gemaakt door",
  "auth.welcomeBack": "Welkom terug",
  "auth.signInSubtitle": "Log in om je diensten te beheren.",
  "auth.email": "E-mailadres",
  "auth.password": "Wachtwoord",
  "auth.forgotPassword": "Wachtwoord vergeten?",
  "auth.signIn": "Inloggen",
  "auth.newHere": "Nieuw hier?",
  "auth.createAccount": "Maak een account aan",
  "auth.registerTitle": "Maak je account aan",
  "auth.registerSubtitle": "Bestel diensten en beheer facturen op één plek.",
  "auth.firstName": "Voornaam",
  "auth.lastName": "Achternaam",
  "auth.passwordHint": "Minimaal 8 tekens.",
  "auth.haveAccount": "Heb je al een account?",
};

const DICTIONARIES: Record<string, Record<MessageKey, string>> = { en, nl };

export const LOCALES = [
  { code: "en", label: "English" },
  { code: "nl", label: "Nederlands" },
];

const LOCALE_COOKIE = "oh_locale";

export async function getLocale(): Promise<string> {
  const store = await cookies();
  const cookie = store.get(LOCALE_COOKIE)?.value;
  return cookie && DICTIONARIES[cookie] ? cookie : "en";
}

export async function setLocaleCookie(code: string): Promise<void> {
  if (!DICTIONARIES[code]) return;
  const store = await cookies();
  store.set(LOCALE_COOKIE, code, {
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}

// Returns a translate function bound to the active locale.
export async function getT(): Promise<(key: MessageKey) => string> {
  const locale = await getLocale();
  const dict = DICTIONARIES[locale] ?? en;
  return (key) => dict[key] ?? en[key] ?? key;
}
