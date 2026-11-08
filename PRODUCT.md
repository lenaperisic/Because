# Product

## Register

brand

## Users

Dve publike, iste ekrane:

- **Produkt tim koji već koristi PostHog** (PM, UX istraživač, osnivač). Ima podatke o tome šta korisnici rade, a nema zašto. Otvara alat da vidi u koje grupe po ponašanju se korisnici dele, šta su rekli u AI intervjuu i koji razlog se ponavlja, pa da odluči šta da promeni u proizvodu.
- **Žiri na hakaton demou (danas).** Gleda sa projektora oko 3 minuta, uživo: član žirija u Folio-u potpiše nalaz, za par sekundi se pojavi u grupi, AI ga intervjuiše o onome što je stvarno uradio, rezultat se vidi u PostHog-u, a ekran grupe pokazuje sintezu razloga sa citatima. Svaki ekran mora da se razume za oko 10 sekundi, bez objašnjavanja.

Krajnji korisnici koje intervjuišemo (lekar, developer, bankar u Folio-u) vide samo ekran intervjua: razgovor sa AI-jem koji traje 2 do 3 minuta i počinje traženjem pristanka.

## Product Purpose

„PostHog vam kaže šta korisnici rade. Mi ih pitamo zašto, i to svakog o onome što je on uradio.“

Alat se kači na PostHog, razvrstava korisnike u grupe po ponašanju (kod, ne model), vodi AI intervju zasnovan isključivo na činjenicama koje je izračunao kod, i rezultat vraća u PostHog kao osobine osobe (`ai_main_reason`), pa produkt tim pravi kohorte po razlogu bez koda. Uspeh: produkt tim posle jednog pogleda na grupu zna glavni razlog, ima citat koji ga dokazuje i konkretan predlog promene; žiri pamti „pitali su me o onome što sam upravo uradio“.

## Brand Personality

**Ljudsko, radoznalo, toplo.** U centru su glasovi ljudi: citati su glavni materijal, ne ukras. Ton je ton dobrog istraživača: radoznao, pažljiv, nikad sugestivan, persira. Uvid se kaže jednom jasnom rečenicom, pa ga prate dokazi.

Reference:
- **The Pudding / NYT data priče:** naslov je sam uvid, citati nose glas ljudi, tipografija nosi stranu, podaci služe priči.
- **Linear:** mirno i precizno; jasna hijerarhija, malo boja, svaki element deluje promišljeno.

## Anti-references

- **Generički SaaS dashboard:** sive kartice u mreži, plavi dugmići, velike metrike sa malim labelama, sve iste težine.
- **AI ljubičasto i „sparkle“:** ljubičasti gradijenti, zvezdice i „magic“ ikonice za sve što radi AI.
- **Klon PostHog-a:** gust analitički UI pun grafikona i filtera. Mi smo „zašto“, ne još jedan „šta“.
- **Krem/bež „editorial“:** topla papir-pozadina sa serifom koja danas izgleda kao svaki AI sajt.

## Design Principles

1. **Glas korisnika u prvom planu.** Odgovor na „zašto“ se pokazuje rečima korisnika; citat je dokaz i glavni sadržaj, broj osoba ga prati.
2. **Uvid kao naslov.** Svaki ekran počinje rečenicom koja kaže šta je otkriveno (zaključak sinteze, glavni razlog), a detalji i tabele dolaze ispod.
3. **Dokaz pre tvrdnje.** Činjenice računa kod, broj osoba računa kod, citati su doslovni, a AI navodi koje je činjenice koristio. Interfejs to pokazuje, ne samo tvrdi.
4. **Iskreno o simulaciji.** Simulirani rezultati su uvek jasno označeni, a pravi intervju uživo se izdvaja; žiri nikad ne sme da pomisli da je sve lažno.
5. **Mirna pozadina, jedan glas.** Kao Linear: malo boja i ukrasa, pa ono što je važno (uvid, citat, osoba uživo) jasno iskače.

## Accessibility & Inclusion

- WCAG 2.2 AA: kontrast teksta bar 4.5:1 (veliki tekst 3:1), bez svetlosivog teksta na svetloj pozadini.
- Čitljivo sa projektora u osvetljenoj sali: telo teksta bar 16px, ključni brojevi i uvidi krupni, stanje (uživo, simulirano, upisano u PostHog) nikad samo bojom.
- `prefers-reduced-motion` se poštuje: animacije imaju trenutnu ili crossfade alternativu.
- Interfejs je na srpskom (latinica, ekavica); intervju persira.
