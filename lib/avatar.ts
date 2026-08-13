// Deterministic, colorful avatar fallbacks (Tidio/ManyChat vibe). The same name
// always maps to the same gradient, so a contact keeps a stable color everywhere.

export const AVATAR_GRADIENTS = [
  "from-violet-500 to-purple-600",
  "from-blue-500 to-cyan-500",
  "from-emerald-500 to-teal-600",
  "from-amber-500 to-orange-600",
  "from-pink-500 to-rose-600",
  "from-indigo-500 to-blue-600",
  "from-fuchsia-500 to-pink-600",
  "from-cyan-500 to-sky-600",
];

/** Pick a stable gradient (Tailwind from/to classes) for a display name. */
export function avatarGradient(name: string): string {
  const key = name || "?";
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return AVATAR_GRADIENTS[h % AVATAR_GRADIENTS.length];
}
