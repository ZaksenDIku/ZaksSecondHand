export interface ChecklistItem {
  id: string;
  label: string;
  detail?: string;
}

export const IPHONE_CHECKLIST: ChecklistItem[] = [
  { id: "findmy", label: "Find My slået fra", detail: "Indstillinger > [navn] > Find My. Skal være fra, ellers er enheden aktiveringslåst." },
  { id: "activation", label: "Activation Lock fjernet", detail: "Genopret via DFU/hardware, og kontrollér at aktivering kræver sælgers Apple-ID." },
  { id: "imei", label: "IMEI kontrolleret", detail: "*#06# - tjek status hos teleselskab/politi for tyveri og restgæld." },
  { id: "serial", label: "Serienummer kontrolleret", detail: "settings > Generelt > Om. Match mod æske og Apple-support." },
  { id: "battery", label: "Batterihelse tjekket", detail: "Indstillinger > Batteri > Batterihelse. Sammenlign med annoncen." },
  { id: "faceid", label: "Face ID testet", detail: "Test optagelse af ny Face ID-profil." },
  { id: "cameras", label: "Alle kameraer testet", detail: "Front, ultra vidte, tele (hvis Pro) og videooptagelse." },
  { id: "charging", label: "Opladning testet", detail: "Test både kabel og trådløs opladning i 2 minutter." },
  { id: "truetone", label: "True Tone kontrolleret", detail: "Skift mellem True Tone til/fra i kontrolcenter." },
  { id: "display", label: "Skærm kontrolleret", detail: "Heldagsbaggrund, døde pixels, berøring i alle hjørner, 120Hz ProMotion." },
  { id: "av", label: "Højttalere/mikrofon", detail: "Afspil lyd, optag en besked, test ørestykke." },
  { id: "network", label: "Netværk/SIM", detail: "Test opkald, data, Wi-Fi, Bluetooth og eSIM-mulighed." },
  { id: "receipt", label: "Kvittering hvis muligt", detail: "Kvittering beskytter mod tyveri-markering og dokumenterer garantien." },
];

export const MACBOOK_CHECKLIST: ChecklistItem[] = [
  { id: "findmy", label: "Find My / Activation Lock slået fra", detail: "Systemindstillinger > Apple-ID > Find My." },
  { id: "mdm", label: "Ingen MDM / Remote Management", detail: "Ved aktivering skal 'Remote Management' ikke vises. Tjek også profiloversigt." },
  { id: "serial", label: "Serienummer kontrolleret", detail: "Om denne Mac - match mod kasse/Apple-support." },
  { id: "cycles", label: "Battericykltal", detail: "Systemrapport > Strøm - under ca. 400 cykler er normalt for moderne MacBooks." },
  { id: "battery", label: "Batterihelse", detail: "Maksimum kapacitet over ca. 85%." },
  { id: "keyboard", label: "Tastatur", detail: "Test alle taster inkl. funktionstaster og Touch ID." },
  { id: "trackpad", label: "Trackpad", detail: "Klik, klik-and-hold, multi-touch gestusser." },
  { id: "display", label: "Skærm", detail: "Pixelfejl, ridser, backlight bleed, True Tone." },
  { id: "ports", label: " porte", detail: "Alle USB-C/Thunderbolt, MagSafe, HDMI, SD hvis udstyret." },
  { id: "wireless", label: "Wi-Fi / Bluetooth", detail: "Forbind til netværk og enhed." },
  { id: "camera", label: "Kamera", detail: "FaceTime-kamera testet." },
  { id: "speakers", label: "Højttalere", detail: "Test begge kanaler." },
  { id: "charger", label: "Lader", detail: "Original eller godkendt oplader medfølger." },
  { id: "receipt", label: "Kvittering hvis mulig", detail: "Vigtigt for garanti og dokumentation." },
];

export function checklistFor(productType: string | null | undefined): ChecklistItem[] {
  if (productType === "macbook") return MACBOOK_CHECKLIST;
  if (productType === "iphone") return IPHONE_CHECKLIST;
  return [...IPHONE_CHECKLIST, ...MACBOOK_CHECKLIST];
}
