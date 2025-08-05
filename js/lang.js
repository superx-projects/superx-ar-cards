async function loadLang(langCode = "en") {
  const langFile = `lang/${langCode}.json`;
  try {
    const res = await fetch(langFile);
    if (!res.ok) throw new Error("Language not found");
    return await res.json();
  } catch {
    const fallback = await fetch("lang/en.json");
    return await fallback.json();
  }
}
