# Impostor Online (GitHub Pages + Firebase)

Gra towarzyska dla 3-10 osób. Wszyscy poza Impostorem znają hasło, podają skojarzenia i głosują na podejrzanego.

## 1. Zasady

- Każdy gracz po kolei wpisuje skojarzenie związane z hasłem.
- Po rundzie aktywni gracze głosują na podejrzaną osobę.
- Jeśli wyeliminowany nie jest Impostorem, rozpoczyna się kolejna runda bez tej osoby.
- Impostor może w dowolnym momencie zgłosić odpowiedź. Wszyscy głosują, czy jest poprawna.
- Host może włączyć Jester (wygrywa po wygłosowaniu) i Executioner (wygrywa po wygłosowaniu celu).

### Role

| Rola | Cel |
|-------|----------|-----------|
| Impostor | Wtopić się i odgadnąć hasło |
| Gracz | Wykryć Impostora |
| Jester | Zostać wygłosowanym |
| Executioner | Doprowadzić do wygłosowania celu |

## 2. Konfiguracja Firebase

1. Utwórz projekt w Firebase Console.
2. Włącz Authentication i metodę Anonymous.
3. Włącz Cloud Firestore (tryb produkcyjny lub testowy).
4. Skopiuj konfigurację web app z Firebase i wklej do pliku app.js w obiekcie FIREBASE_CONFIG.

## 3. Minimalne reguły Firestore (na start)

Wklej jako reguły Firestore:

```txt
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /rooms/{roomId} {
      allow read, write: if request.auth != null;
      match /players/{playerId} {
        allow read, write: if request.auth != null;
      }
    }
  }
}
```

Te same reguły są zapisane w pliku `firestore.rules`. W Firebase Console otwórz
Firestore Database -> Rules, wklej ich zawartość i kliknij Publish. Reguły
muszą zezwalać zalogowanym anonimowo użytkownikom na dokumenty `rooms/{roomId}`.

To są reguły prototypowe. Do produkcji warto dodać dodatkową walidację pól i ról hosta.

## 4. Uruchomienie lokalne

Ponieważ to statyczna strona z modułami ES, użyj prostego serwera HTTP:

1. Otwórz terminal w folderze projektu.
2. Uruchom:

```powershell
npx serve .
```

3. Otwórz adres z terminala (zwykle http://localhost:3000).

## 5. Publikacja na GitHub Pages

1. Utwórz repozytorium i wypchnij pliki.
2. W ustawieniach repo:
   - Settings -> Pages
   - Source: Deploy from a branch
   - Branch: main (root)
3. Po publikacji aplikacja będzie działać jako statyczna strona, a backendem zostaje Firebase.

## 6. Struktura plików

- index.html - UI aplikacji
- styles.css - styl i responsywność
- app.js - logika gry + Firebase
- README.md - instrukcja uruchomienia

## 7. Uwaga o hostingu

GitHub Pages hostuje tylko frontend. Stan gry, synchronizacja i dane są w Firestore.
