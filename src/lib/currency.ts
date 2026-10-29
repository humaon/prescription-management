const COUNTRY_CURRENCY: Record<string, { currency: string; symbol: string }> = {
  BD: { currency: "BDT", symbol: "৳" },
  US: { currency: "USD", symbol: "$" },
  GB: { currency: "GBP", symbol: "£" },
  IN: { currency: "INR", symbol: "₹" },
  PK: { currency: "PKR", symbol: "Rs" },
  AE: { currency: "AED", symbol: "AED" },
  SA: { currency: "SAR", symbol: "SAR" },
  MY: { currency: "MYR", symbol: "RM" },
  SG: { currency: "SGD", symbol: "S$" },
  CA: { currency: "CAD", symbol: "C$" },
  AU: { currency: "AUD", symbol: "A$" },
  EU: { currency: "EUR", symbol: "€" },
  DE: { currency: "EUR", symbol: "€" },
  FR: { currency: "EUR", symbol: "€" },
  IT: { currency: "EUR", symbol: "€" },
  ES: { currency: "EUR", symbol: "€" },
};

export function languageForCountry(country?: string | null): "en" | "bn" {
  return (country || "").toUpperCase() === "BD" ? "bn" : "en";
}

export function currencyForCountry(country?: string | null) {
  const code = (country || "").toUpperCase();
  return COUNTRY_CURRENCY[code] || { currency: "USD", symbol: "$" };
}
