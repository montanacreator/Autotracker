Auto-Manager

Dateien
- index.html  Aufbau der Seite
- style.css   Design und Farben
- app.js      gesamte Logik (Tanken, Kosten, Wartungen, Termine, Kalender, Einstellungen)
- icon.png    App-Icon (grau, weisses A)

Starten
index.html im Browser oeffnen. Alle Dateien muessen im selben Ordner liegen.
Fuer Handy oder mehrere Geraete auf einen Webserver legen (z. B. GitHub Pages, Netlify).

Hinweise
- Die Daten werden im localStorage des Browsers gespeichert (pro Gerat und Browser).
- Das automatische Auslesen von Kassenzetteln funktioniert nur, wenn die Seite
  in Claude (claude.ai) geoeffnet wird. Ausserhalb ist das Upload-Feld ausgeblendet.
- Schriften werden von Google Fonts geladen (mit Ersatzschriften, falls offline).
