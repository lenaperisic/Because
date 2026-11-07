# Folio · PDF alat (demo)

Mock PDF alata u Javi (Swing, bez spoljnih biblioteka) sa tri profila koji isti alat koriste potpuno različito. Razlika nije samo u dokumentima, nego u **funkcijama koje kliknu**, pa je odličan izvor podataka za grupisanje korisnika po ponašanju.

| Profil | Dokumenti | Šta koristi | Šta nikad |
| --- | --- | --- | --- |
| Developer · Marko Petrović | Specifikacije, RFC, fakture, release notes | Pretraga, izvoz u tekst, komentari | Formular, OCR, zacrnjivanje |
| Lekar · Dr Ana Jovanović | Nalazi, uputi, skenovi starih nalaza, otpusne liste | Potpis, formulari, OCR, zacrnjivanje | Poređenje, izvoz, AI sažetak |
| Bankar · Jelena Marković | Ugovori o kreditu, KYC, bilansi, skenovi ličnih karata | Zacrnjivanje, potpis, poređenje verzija | Koristi sve alate |

Desni panel **„Kako koristi PDF alat"** pokazuje broj korišćenja svakog alata za poslednjih 30 dana i alate koje profil **nikad nije koristio**. Odatle dolaze pitanja za intervju, na primer: *„Svaki dan potpisujete i popunjavate formulare, ali AI sažetak nalaza nikad niste otvorili. Zašto?"*

## Pokretanje

Potrebna je Java 17 ili novija.

```
java -jar folio.jar
java -jar folio.jar --profile lekar
java -jar folio.jar --profile bankar
```

Profil se menja i dugmićima gore desno.

## Šta radi svaki alat

| Alat | Efekat u demou |
| --- | --- |
| Potpis | Dodaje potpis na dokument koji ima polje za potpis |
| Formular | Popunjava prazan formular (uput, KYC) |
| OCR | Pretvara sken u dokument sa tekstom |
| Zacrni | Zacrnjuje lične podatke (ime, JMBG, broj dokumenta) |
| Uporedi | Prikazuje izmene u odnosu na prethodnu verziju ugovora ili specifikacije |
| AI sažetak | Prikazuje sažetak dokumenta |
| Komentar | Dodaje komentar na stranu |
| Pretraga, Spoji, Kompresuj, Izvezi tekst | Kratko obaveštenje |

Narandžasta tačka na alatu znači da ga trenutni dokument čeka (nepotpisan, prazan formular, sken bez teksta, nezacrnjeni podaci). Svaki klik povećava brojač u desnom panelu.

## Podaci (JSON)

Pri prvom pokretanju aplikacija napravi folder `folio-data/` sa fajlovima `developer.json`, `lekar.json` i `bankar.json`. Tu su:

- `usage`: koliko puta je koja funkcija korišćena (brojevi u desnom panelu),
- `documents`: dokumenti sa stanjem (`signed`, `filled`, `redacted`, `ocr`...), AI sažetkom, izmenama za poređenje i sadržajem prve strane (`blocks`: naslov, tabela, formular, potpis...).

Sve izmene se odmah čuvaju. Obrišite `folio-data/` da vratite početno stanje pre demoa.

## PostHog (opciono)

Događaji: `app_opened`, `profile_switched`, `document_opened`, `feature_used` (sa osobinama `feature` i `doc_kind`). Svaki profil je posebna osoba (`folio_developer`, `folio_lekar`, `folio_bankar`) sa osobinom `role`.

Bez podešavanja događaji se samo ispisuju u konzolu. Da idu u PostHog:

```
export POSTHOG_KEY=phc_vas_project_token
export POSTHOG_HOST=https://eu.i.posthog.com   # ili https://us.i.posthog.com
java -jar folio.jar
```

Na Windowsu: `set POSTHOG_KEY=...` pre pokretanja.

Za novu osobu uživo (demo): `java -jar folio.jar --profile lekar --user "Ana Zirij"`. Događaji tada idu na osobu `folio_ana_zirij` (ime bez kvačica, mala slova, `_` umesto razmaka), sa ulogom izabranog profila.

## Izgradnja iz izvornog koda

`./build.sh` (macOS, Linux) ili `build.bat` (Windows) pravi novi `folio.jar`.
