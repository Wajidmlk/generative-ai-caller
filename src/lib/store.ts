import { prisma } from "./db";
import { cookies } from "next/headers";
import { normalizePhoneLookup } from "./phone";

export const STORE_COOKIE = "gai_store_id";

export const DEFAULT_POLICIES = [
  { intent: "general", label: "General questions", shareInfo: true, notifyContact: false, notes: "" },
  { intent: "hours", label: "Store hours / address", shareInfo: true, notifyContact: false, notes: "" },
  { intent: "products", label: "Product info", shareInfo: true, notifyContact: false, notes: "" },
  { intent: "price", label: "Prices", shareInfo: true, notifyContact: false, notes: "" },
  { intent: "order", label: "Place order", shareInfo: true, notifyContact: true, notes: "Email contact when caller wants to order" },
  { intent: "human", label: "Talk to human", shareInfo: false, notifyContact: true, notes: "Email contact for callback" },
];

const storeInclude = { products: true, policies: true } as const;

export async function listStores() {
  return prisma.store.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      twilioNumber: true,
      contactEmail: true,
      contactName: true,
      defaultLanguage: true,
      address: true,
      hours: true,
      _count: { select: { products: true, calls: true } },
    },
  });
}

export async function createStore(name = "New Store") {
  return prisma.store.create({
    data: {
      name,
      description: "",
      address: "",
      hours: "",
      contactEmail: "",
      contactName: "",
      twilioNumber: "",
      defaultLanguage: "en",
      agentVoice: "alloy",
      greetingEn: `Hello, thanks for calling ${name}. How can I help you today?`,
      greetingUr: `السلام علیکم، ${name} پر کال کرنے کا شکریہ۔ میں آپ کی کیا مدد کر سکتا ہوں؟`,
      policies: { create: DEFAULT_POLICIES },
    },
    include: storeInclude,
  });
}

export async function getOrCreateDefaultStore() {
  const existing = await prisma.store.findFirst({
    include: storeInclude,
    orderBy: { createdAt: "asc" },
  });
  if (existing) return existing;
  return createStore("Demo Store");
}

export async function getStoreById(id: string) {
  return prisma.store.findUnique({ where: { id }, include: storeInclude });
}

export async function resolveAdminStore(storeId?: string | null) {
  if (storeId) {
    const store = await getStoreById(storeId);
    if (store) return store;
  }
  const jar = await cookies();
  const fromCookie = jar.get(STORE_COOKIE)?.value;
  if (fromCookie) {
    const store = await getStoreById(fromCookie);
    if (store) return store;
  }
  return getOrCreateDefaultStore();
}

export async function findStoreByTwilioNumber(toNumber: string) {
  const candidates = Array.from(
    new Set(
      [toNumber.trim(), normalizePhoneLookup(toNumber)].filter(Boolean),
    ),
  );
  for (const normalized of candidates) {
    const byNumber = await prisma.store.findFirst({
      where: { twilioNumber: normalized },
      include: storeInclude,
    });
    if (byNumber) return byNumber;
  }
  return prisma.store.findFirst({
    include: storeInclude,
    orderBy: { createdAt: "asc" },
  });
}
