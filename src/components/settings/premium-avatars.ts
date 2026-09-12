export const premiumAvatars = [
  { id: "luca", name: "Luca", description: "Un sorriso, mille possibilità" },
  { id: "sofia", name: "Sofia", description: "La creatività è di casa" },
  { id: "andrea", name: "Andrea", description: "Sempre una nuova prospettiva" },
  { id: "giulia", name: "Giulia", description: "Semplicemente, te stessa" },
  { id: "marco", name: "Marco", description: "Un tocco di energia" },
  { id: "amina", name: "Amina", description: "Una personalità luminosa" },
].map((avatar) => ({ ...avatar, url: `/avatars/premium/${avatar.id}.png` }));
