"use client";

import { useMemo, useRef, useState } from "react";
import styles from "./EmojiPicker.module.css";

const GROUPS: { id: string; label: string; items: string[] }[] = [
  {
    id: "smileys",
    label: "Smileys & People",
    items: ["😀","😃","😄","😁","😆","😅","🤣","😂","🙂","😉","😊","😇","🥰","😍","🤩","😘","😗","😚","😙","🥲","😋","😛","😜","🤪","😝","🤑","🤗","🤭","🫢","🫣","🤫","🤔","🫡","🤐","🤨","😐","😑","😶","🫥","😏","😒","🙄","😬","🤥","😌","😔","😪","🤤","😴","😷","🤒","🤕","🤢","🤮","🥵","🥶","🥴","😵","🤯","🤠","🥳","🥸","😎","🤓","🧐","😕","🫤","😟","🙁","😮","😯","😲","😳","🥺","🥹","😦","😧","😨","😰","😥","😢","😭","😱","😖","😣","😞","😓","😩","😫","🥱","😤","😡","😠","🤬","😈","👿","💀","☠️","💩","🤡","👹","👺","👻","👽","👾","🤖"],
  },
  {
    id: "gestures",
    label: "People & gestures",
    items: ["👋","🤚","🖐️","✋","🖖","🫱","🫲","🫳","🫴","👌","🤌","🤏","✌️","🤞","🫰","🤟","🤘","🤙","👈","👉","👆","🖕","👇","☝️","🫵","👍","👎","✊","👊","🤛","🤜","👏","🙌","🫶","👐","🤲","🤝","🙏","✍️","💅","🤳","💪","🦾","🦵","🦶","👂","👃","🧠","👀","👁️","👅","👄","🫦","💋","❤️","🧡","💛","💚","💙","💜","🖤","🤍","🤎","💔","❤️‍🔥","💕","💞","💓","💗","💖","💘","💝"],
  },
  {
    id: "animals",
    label: "Animals & Nature",
    items: ["🐶","🐱","🐭","🐹","🐰","🦊","🐻","🐼","🐨","🐯","🦁","🐮","🐷","🐸","🐵","🙈","🙉","🙊","🐔","🐧","🐦","🐤","🦆","🦅","🦉","🦇","🐺","🐗","🐴","🦄","🐝","🪱","🐛","🦋","🐌","🐞","🐜","🪲","🐢","🐍","🦎","🐙","🦑","🦐","🐠","🐟","🐡","🐬","🐳","🐋","🦈","🐊","🐅","🐆","🦓","🦍","🦧","🐘","🦛","🦏","🐪","🦒","🦘","🐃","🐄","🐖","🐏","🐑","🐐","🐕","🐈","🐓","🦃","🦚","🦜","🦢","🕊️","🐇","🦝","🦨","🦡","🐁","🐀"],
  },
  {
    id: "food",
    label: "Food & Drink",
    items: ["🍏","🍎","🍐","🍊","🍋","🍌","🍉","🍇","🍓","🫐","🍈","🍒","🍑","🥭","🍍","🥥","🥝","🍅","🍆","🥑","🥦","🥬","🥒","🌶️","🫑","🌽","🥕","🧄","🧅","🥔","🍠","🥐","🥯","🍞","🥖","🥨","🧀","🥚","🍳","🧈","🥞","🧇","🥓","🥩","🍗","🍖","🦴","🌭","🍔","🍟","🍕","🫓","🥪","🥙","🧆","🌮","🌯","🫔","🥗","🥘","🥫","🍝","🍜","🍲","🍛","🍣","🍱","🥟","🦪","🍤","🍙","🍚","🍘","🍥","🥠","🥮","🍢","🍡","🍧","🍨","🍦","🥧","🧁","🍰","🎂","🍮","🍭","🍬","🍫","🍿","🍩","🍪","🌰","🥜","🍯","🥛","🍼","☕","🍵","🧃","🥤","🧋","🍶","🍺","🍻","🥂","🍷","🥃","🍸","🍹","🧉","🍾"],
  },
  {
    id: "activity",
    label: "Activities",
    items: ["⚽","🏀","🏈","⚾","🥎","🎾","🏐","🏉","🥏","🎱","🪀","🏓","🏸","🏒","🏑","🥍","🏏","🪃","🥅","⛳","🪁","🏹","🎣","🤿","🥊","🥋","🎽","🛹","🛼","🛷","⛸️","🥌","🎿","⛷️","🏂","🪂","🏋️","🤼","🤸","⛹️","🤺","🤾","🏌️","🏇","🧘","🏄","🏊","🤽","🚣","🧗","🚴","🚵","🎪","🎭","🎨","🎬","🎤","🎧","🎼","🎹","🥁","🪘","🎷","🎺","🪗","🎸","🪕","🎻","🎲","♟️","🎯","🎳","🎮","🎰","🧩"],
  },
  {
    id: "travel",
    label: "Travel & Places",
    items: ["🚗","🚕","🚙","🚌","🚎","🏎️","🚓","🚑","🚒","🚐","🛻","🚚","🚛","🚜","🏍️","🛵","🚲","🛴","🛺","🚨","🚔","🚍","🚘","🚖","🛞","🚡","🚠","🚟","🚃","🚋","🚞","🚝","🚄","🚅","🚈","🚂","🚆","🚇","🚊","🚉","✈️","🛫","🛬","🛩️","💺","🛰️","🚀","🛸","🚁","🛶","⛵","🚤","🛥️","🛳️","⛴️","🚢","⚓","🪝","⛽","🚧","🚦","🚥","🗺️","🗿","🗽","🗼","🏰","🏯","🏟️","🎡","🎢","🎠","⛲","⛱️","🏖️","🏝️","🏜️","🌋","⛰️","🏔️","🗻","🏕️","⛺","🏠","🏡","🏢","🏣","🏤","🏥","🏦","🏨","🏩","🏪","🏫","🏬","🏭","🏯","💒","🗼","🗽"],
  },
  {
    id: "objects",
    label: "Objects",
    items: ["⌚","📱","💻","⌨️","🖥️","🖨️","🖱️","💽","💾","💿","📀","📷","📸","📹","🎥","📞","☎️","📟","📠","📺","📻","🎙️","🎚️","🎛️","🧭","⏱️","⏲️","⏰","🕰️","⌛","⏳","📡","🔋","🪫","🔌","💡","🔦","🕯️","🪔","🧯","🛢️","💸","💵","💴","💶","💷","🪙","💰","💳","💎","⚖️","🪜","🧰","🪛","🔧","🔨","⚒️","🛠️","⛏️","🪚","🔩","⚙️","🪤","🧱","⛓️","🧲","🔫","💣","🧨","🪓","🔪","🗡️","⚔️","🛡️","🚬","⚰️","⚱️","🏺","🔮","📿","🧿","💈","⚗️","🔭","🔬","🕳️","🩹","🩺","💊","💉","🩸","🧬","🦠","🧫","🧪","🌡️","🧹","🪠","🧺","🧻","🚽","🚰","🚿","🛁","🛀","🧼","🪥","🪒","🧽","🪣","🧴","🛎️","🔑","🗝️","🚪","🪑","🛋️","🛏️","🛌","🧸","🪆","🖼️","🪞","🪟","🛍️","🛒","🎁","🎈","🎏","🎀","🪄","🎊","🎉","🎎","🏮","🎐","🧧","✉️","📩","📨","📧","💌","📥","📤","📦","🏷️","🪧","📪","📫","📬","📭","📮","📯"],
  },
  {
    id: "symbols",
    label: "Symbols",
    items: ["🔥","✨","⭐","🌟","💫","🎉","🎊","❤️","🧡","💛","💚","💙","💜","🖤","🤍","🤎","❣️","💕","💞","💓","💗","💖","💘","💝","💟","☮️","✝️","☪️","🕉️","☸️","✡️","🔯","🕎","☯️","☦️","🛐","⛎","♈","♉","♊","♋","♌","♍","♎","♏","♐","♑","♒","♓","🆔","⚛️","🉑","☢️","☣️","📴","📳","🈶","🈚","🈸","🈺","🈷️","✴️","🆚","💮","🉐","㊙️","㊗️","🈴","🈵","🈹","🈲","🅰️","🅱️","🆎","🆑","🅾️","🆘","❌","⭕","🛑","⛔","📛","🚫","💯","💢","♨️","🚷","🚯","🚳","🚱","🔞","📵","🚭","❗","❕","❓","❔","‼️","⁉️","🔅","🔆","〽️","⚠️","🚸","🔱","⚜️","🔰","♻️","✅","🈯","💹","❇️","✳️","❎","🌐","💠","Ⓜ️","🌀","💤","🏧","🚾","♿","🅿️","🛗","🈳","🈂️","🛂","🛃","🛄","🛅","🚹","🚺","🚼","⚧️","🚻","🚮","🎦","📶","🈁","🔣","ℹ️","🔤","🔡","🔠","🆖","🆗","🆙","🆒","🆕","🆓","0️⃣","1️⃣","2️⃣","3️⃣","4️⃣","5️⃣","6️⃣","7️⃣","8️⃣","9️⃣","🔟","🔢","#️⃣","*️⃣","⏏️","▶️","⏸️","⏯️","⏹️","⏺️","⏭️","⏮️","⏩","⏪","⏫","⏬","◀️","🔼","🔽","➡️","⬅️","⬆️","⬇️","↗️","↘️","↙️","↖️","↕️","↔️","↪️","↩️","⤴️","⤵️","🔀","🔁","🔂","🔄","🔃","🎵","🎶","➕","➖","➗","✖️","🟰","♾️","💲","💱","™️","©️","®️","〰️","➰","➿","🔚","🔙","🔛","🔝","🔜","✔️","☑️","🔘","🔴","🟠","🟡","🟢","🔵","🟣","⚫","⚪","🟤","🔺","🔻","🔸","🔹","🔶","🔷","🔳","🔲","▪️","▫️","◾","◽","◼️","◻️","🟥","🟧","🟨","🟩","🟦","🟪","⬛","⬜","🟫","🔈","🔇","🔉","🔊","🔔","🔕","📣","📢","💬","💭","🗯️","♠️","♣️","♥️","♦️","🃏","🎴","🀄"],
  },
  {
    id: "flags",
    label: "Flags",
    items: ["🏳️","🏴","🏁","🚩","🏳️‍🌈","🏳️‍⚧️","🇬🇭","🇳🇬","🇺🇸","🇬🇧","🇨🇦","🇫🇷","🇩🇪","🇮🇹","🇪🇸","🇵🇹","🇧🇷","🇲🇽","🇯🇵","🇰🇷","🇨🇳","🇮🇳","🇿🇦","🇰🇪","🇪🇬","🇲🇦","🇦🇪","🇸🇦","🇹🇷","🇦🇺","🇳🇿","🇯🇲","🇹🇹","🇧🇧"],
  },
];

const KEYWORDS: Record<string, string> = {
  "😀": "grin smile happy", "😂": "joy laugh cry", "🤣": "rofl laugh", "😍": "heart eyes love", "😘": "kiss",
  "😭": "cry sad", "😎": "cool sunglasses", "🥺": "pleading puppy", "😡": "angry", "👍": "yes like thumb",
  "👎": "no dislike", "🙏": "pray thanks", "👏": "clap", "🔥": "fire hot", "❤️": "heart love red",
  "💔": "broken heart", "🎉": "party", "✨": "sparkle", "💯": "hundred perfect",
};

function Icon({ id }: { id: string }) {
  const common = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (id === "recent") return <svg {...common}><circle cx="12" cy="12" r="8" /><path d="M12 8v5l3 2" /></svg>;
  if (id === "smileys") return <svg {...common}><circle cx="12" cy="12" r="8" /><path d="M8 14s1.5 2 4 2 4-2 4-2" /><path d="M9 10h.01M15 10h.01" /></svg>;
  if (id === "gestures") return <svg {...common}><path d="M8 13V7a2 2 0 1 1 4 0v6" /><path d="M12 12V6a2 2 0 1 1 4 0v7" /><path d="M8 13a4 4 0 0 0 8 2" /></svg>;
  if (id === "animals") return <svg {...common}><circle cx="7" cy="10" r="2" /><circle cx="17" cy="10" r="2" /><path d="M6 16c1.5 2 10.5 2 12 0" /><path d="M4 8c1-3 4-3 5 0M20 8c-1-3-4-3-5 0" /></svg>;
  if (id === "food") return <svg {...common}><path d="M6 3v8M10 3v8M8 3v18M16 3c2 3 2 6 0 8v10" /></svg>;
  if (id === "activity") return <svg {...common}><circle cx="12" cy="12" r="8" /><path d="M12 8v8M8 12h8" /></svg>;
  if (id === "travel") return <svg {...common}><path d="M3 16l9-6 9 6" /><path d="M7 16v3h10v-3" /><circle cx="12" cy="9" r="1" /></svg>;
  if (id === "objects") return <svg {...common}><path d="M9 18h6M10 21h4M8 14a6 6 0 1 1 8 0c-1 1-2 2-2 4H10c0-2-1-3-2-4z" /></svg>;
  if (id === "symbols") return <svg {...common}><path d="M5 19L19 5" /><circle cx="8" cy="8" r="2" /><circle cx="16" cy="16" r="2" /></svg>;
  return <svg {...common}><path d="M5 15V5h8l6 6v10H5z" /><path d="M13 5v6h6" /></svg>;
}

export default function EmojiPicker({ onPick, onClose }: { onPick: (emoji: string) => void; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState("smileys");
  const [recent, setRecent] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("lt_recent_emoji") || "[]");
    } catch {
      return [];
    }
  });
  const scroller = useRef<HTMLDivElement>(null);

  const groups = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const withRecent = recent.length ? [{ id: "recent", label: "Recent", items: recent }, ...GROUPS] : GROUPS;
    if (!needle) return withRecent;
    const found = withRecent.flatMap((group) => group.items).filter((emoji, index, list) => {
      if (list.indexOf(emoji) !== index) return false;
      return emoji.includes(needle) || (KEYWORDS[emoji] || "").includes(needle) || groupName(emoji, withRecent).includes(needle);
    });
    return [{ id: "search", label: "Search results", items: found }];
  }, [query, recent]);

  const pick = (emoji: string) => {
    onPick(emoji);
    const next = [emoji, ...recent.filter((item) => item !== emoji)].slice(0, 24);
    setRecent(next);
    localStorage.setItem("lt_recent_emoji", JSON.stringify(next));
  };

  const jump = (id: string) => {
    setActive(id);
    setQuery("");
    document.getElementById(`emoji-${id}`)?.scrollIntoView({ block: "start" });
  };

  return (
    <div className={styles.panel}>
      <div className={styles.topBar}>
        <span>Emoji</span>
        <button type="button" className={styles.close} onClick={onClose} aria-label="Close emoji">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      <div className={styles.tabs}>
        {recent.length > 0 && (
          <button className={`${styles.tab} ${active === "recent" ? styles.tabOn : ""}`} onClick={() => jump("recent")} aria-label="Recent">
            <Icon id="recent" />
          </button>
        )}
        {GROUPS.map((group) => (
          <button key={group.id} className={`${styles.tab} ${active === group.id ? styles.tabOn : ""}`} onClick={() => jump(group.id)} aria-label={group.label}>
            <Icon id={group.id} />
          </button>
        ))}
      </div>
      <div className={styles.searchWrap}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3-3" /></svg>
        <input className={styles.search} placeholder="Search emoji" value={query} onChange={(event) => setQuery(event.target.value)} />
      </div>
      <div className={styles.scroller} ref={scroller}>
        {groups.map((group) => (
          <section key={group.id} id={`emoji-${group.id}`}>
            <p className={styles.label}>{group.label}</p>
            {group.items.length === 0
              ? <p className={styles.empty}>No emoji found</p>
              : (
                <div className={styles.grid}>
                  {group.items.filter((emoji, index, list) => list.indexOf(emoji) === index).map((emoji) => (
                    <button key={`${group.id}-${emoji}`} className={styles.emoji} onClick={() => pick(emoji)}>{emoji}</button>
                  ))}
                </div>
              )}
          </section>
        ))}
      </div>
    </div>
  );
}

function groupName(emoji: string, groups: { label: string; items: string[] }[]) {
  return groups.find((group) => group.items.includes(emoji))?.label.toLowerCase() || "";
}
