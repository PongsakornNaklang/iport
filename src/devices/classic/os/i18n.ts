/**
 * Settings ▸ Language for the Click Wheel iPods. The system's own words
 * (menus, settings, messages) are translated; your music, contacts and notes
 * keep their names. English is the key; a string missing from the table, or
 * a language without one, stays in English.
 */
import { useSettings } from '../../../core/settings/store';

/** the languages with a translation, as each calls itself (the order of TABLE's columns) */
const TRANSLATED = ['ไทย', '日本語', 'Deutsch', 'Español', 'Français'] as const;

/** Settings ▸ Language */
export const LANGUAGES = ['English', ...TRANSLATED];

/** dates and numbers in the chosen language */
const LOCALES: Record<string, string> = { English: 'en-US', ไทย: 'th-TH', 日本語: 'ja-JP', Deutsch: 'de-DE', Español: 'es-ES', Français: 'fr-FR' };

type Row = [th: string, ja: string, de: string, es: string, fr: string];

const TABLE: Record<string, Row> = {
  // ---------------------------------------------------------------- menus
  Music: ['เพลง', 'ミュージック', 'Musik', 'Música', 'Musique'],
  'Genius Mixes': ['มิกซ์ Genius', 'Genius Mix', 'Genius-Mixe', 'Mezclas Genius', 'Mix Genius'],
  Playlists: ['เพลย์ลิสต์', 'プレイリスト', 'Playlists', 'Listas', 'Listes de lecture'],
  Artists: ['ศิลปิน', 'アーティスト', 'Interpreten', 'Artistas', 'Artistes'],
  Albums: ['อัลบั้ม', 'アルバム', 'Alben', 'Álbumes', 'Albums'],
  Compilations: ['รวมเพลง', 'コンピレーション', 'Kompilationen', 'Recopilatorios', 'Compilations'],
  Songs: ['เพลง', '曲', 'Titel', 'Canciones', 'Morceaux'],
  Genres: ['ประเภท', 'ジャンル', 'Genres', 'Géneros', 'Genres'],
  Composers: ['ผู้แต่งเพลง', '作曲者', 'Komponisten', 'Compositores', 'Compositeurs'],
  Audiobooks: ['หนังสือเสียง', 'オーディオブック', 'Hörbücher', 'Audiolibros', 'Livres audio'],
  Search: ['ค้นหา', '検索', 'Suchen', 'Buscar', 'Recherche'],
  'Now Playing': ['กำลังเล่น', '再生中', 'Sie hören', 'En reproducción', 'À l’écoute'],
  Videos: ['วิดีโอ', 'ビデオ', 'Videos', 'Vídeos', 'Vidéos'],
  Photos: ['รูปภาพ', '写真', 'Fotos', 'Fotos', 'Photos'],
  Podcasts: ['พ็อดคาสท์', 'Podcast', 'Podcasts', 'Podcasts', 'Podcasts'],
  Extras: ['พิเศษ', 'エクストラ', 'Extras', 'Extras', 'Extras'],
  Settings: ['การตั้งค่า', '設定', 'Einstellungen', 'Ajustes', 'Réglages'],
  'Shuffle Songs': ['สุ่มเพลง', '曲をシャッフル', 'Titel zufällig', 'Canciones aleatorias', 'Morceaux aléatoires'],
  Backlight: ['ไฟพื้นหลัง', 'バックライト', 'Beleuchtung', 'Retroiluminación', 'Rétroéclairage'],
  Radio: ['วิทยุ', 'ラジオ', 'Radio', 'Radio', 'Radio'],
  Games: ['เกม', 'ゲーム', 'Spiele', 'Juegos', 'Jeux'],
  Clock: ['นาฬิกา', '時計', 'Uhr', 'Reloj', 'Horloge'],
  Contacts: ['รายชื่อ', '連絡先', 'Kontakte', 'Contactos', 'Contacts'],
  Calendar: ['ปฏิทิน', 'カレンダー', 'Kalender', 'Calendario', 'Calendrier'],
  Notes: ['โน้ต', 'メモ', 'Notizen', 'Notas', 'Notes'],
  'Play a song to start Genius': ['เล่นเพลงก่อนเพื่อเริ่ม Genius', 'Genius を開始するには曲を再生してください', 'Spiele einen Titel ab, um Genius zu starten', 'Reproduce una canción para iniciar Genius', 'Lisez un morceau pour lancer Genius'],
  'No iTunes U': ['ไม่มี iTunes U', 'iTunes U はありません', 'Kein iTunes U', 'No hay iTunes U', 'Aucun iTunes U'],
  'Music Quiz': ['ทายเพลง', 'ミュージッククイズ', 'Musikquiz', 'Concurso musical', 'Quiz musical'],
  'Loading…': ['กำลังโหลด…', '読み込み中…', 'Laden …', 'Cargando…', 'Chargement…'],
  'Game not found': ['ไม่พบเกม', 'ゲームが見つかりません', 'Spiel nicht gefunden', 'Juego no encontrado', 'Jeu introuvable'],

  // ---------------------------------------------------------------- music
  'Genius is not available for this song': ['ใช้ Genius กับเพลงนี้ไม่ได้', 'この曲では Genius を利用できません', 'Genius ist für diesen Titel nicht verfügbar', 'Genius no está disponible para esta canción', 'Genius n’est pas disponible pour ce morceau'],
  'Add to On-The-Go': ['เพิ่มไปยัง On-The-Go', 'On-The-Go に追加', 'Zu On-The-Go hinzufügen', 'Añadir a On-The-Go', 'Ajouter à On-The-Go'],
  'Added to On-The-Go': ['เพิ่มไปยัง On-The-Go แล้ว', 'On-The-Go に追加しました', 'Zu On-The-Go hinzugefügt', 'Añadido a On-The-Go', 'Ajouté à On-The-Go'],
  'Start Genius': ['เริ่ม Genius', 'Genius を開始', 'Genius starten', 'Iniciar Genius', 'Lancer Genius'],
  'Browse Album': ['ดูอัลบั้ม', 'アルバムを表示', 'Album anzeigen', 'Ver álbum', 'Parcourir l’album'],
  'Browse Artist': ['ดูศิลปิน', 'アーティストを表示', 'Interpret anzeigen', 'Ver artista', 'Parcourir l’artiste'],
  'Unknown Album': ['อัลบั้มที่ไม่รู้จัก', '不明なアルバム', 'Unbekanntes Album', 'Álbum desconocido', 'Album inconnu'],
  'Unknown Artist': ['ศิลปินที่ไม่รู้จัก', '不明なアーティスト', 'Unbekannter Interpret', 'Artista desconocido', 'Artiste inconnu'],
  Untitled: ['ไม่มีชื่อ', '名称未設定', 'Ohne Titel', 'Sin título', 'Sans titre'],
  Cancel: ['ยกเลิก', 'キャンセル', 'Abbrechen', 'Cancelar', 'Annuler'],
  'Play Next': ['เล่นถัดไป', '次に再生', 'Als Nächstes', 'Reproducir a continuación', 'Lire ensuite'],
  'No Songs': ['ไม่มีเพลง', '曲はありません', 'Keine Titel', 'No hay canciones', 'Aucun morceau'],
  'No Playlists': ['ไม่มีเพลย์ลิสต์', 'プレイリストはありません', 'Keine Playlists', 'No hay listas', 'Aucune liste de lecture'],
  'No Artists': ['ไม่มีศิลปิน', 'アーティストはありません', 'Keine Interpreten', 'No hay artistas', 'Aucun artiste'],
  'No Compilations': ['ไม่มีรวมเพลง', 'コンピレーションはありません', 'Keine Kompilationen', 'No hay recopilatorios', 'Aucune compilation'],
  'No Genres': ['ไม่มีประเภท', 'ジャンルはありません', 'Keine Genres', 'No hay géneros', 'Aucun genre'],
  'No Composers': ['ไม่มีผู้แต่งเพลง', '作曲者はありません', 'Keine Komponisten', 'No hay compositores', 'Aucun compositeur'],
  'No Audiobooks': ['ไม่มีหนังสือเสียง', 'オーディオブックはありません', 'Keine Hörbücher', 'No hay audiolibros', 'Aucun livre audio'],
  'No Podcasts': ['ไม่มีพ็อดคาสท์', 'Podcast はありません', 'Keine Podcasts', 'No hay podcasts', 'Aucun podcast'],
  'No Episodes': ['ไม่มีตอน', 'エピソードはありません', 'Keine Folgen', 'No hay episodios', 'Aucun épisode'],
  'No Photos': ['ไม่มีรูปภาพ', '写真はありません', 'Keine Fotos', 'No hay fotos', 'Aucune photo'],
  'No Video Podcasts': ['ไม่มีพ็อดคาสท์วิดีโอ', 'ビデオ Podcast はありません', 'Keine Video-Podcasts', 'No hay podcasts de vídeo', 'Aucun podcast vidéo'],
  'No Video Playlists': ['ไม่มีเพลย์ลิสต์วิดีโอ', 'ビデオプレイリストはありません', 'Keine Video-Playlists', 'No hay listas de vídeo', 'Aucune liste vidéo'],
  'No Radio Stations': ['ไม่มีสถานีวิทยุ', 'ラジオ局はありません', 'Keine Radiosender', 'No hay emisoras', 'Aucune station de radio'],
  'No Contacts': ['ไม่มีรายชื่อ', '連絡先はありません', 'Keine Kontakte', 'No hay contactos', 'Aucun contact'],
  'No Notes': ['ไม่มีโน้ต', 'メモはありません', 'Keine Notizen', 'No hay notas', 'Aucune note'],
  'No Games': ['ไม่มีเกม', 'ゲームはありません', 'Keine Spiele', 'No hay juegos', 'Aucun jeu'],
  'Playlist not found': ['ไม่พบเพลย์ลิสต์', 'プレイリストが見つかりません', 'Playlist nicht gefunden', 'Lista no encontrada', 'Liste introuvable'],
  'Alarm deleted': ['ลบการปลุกแล้ว', 'アラームは削除されました', 'Wecker gelöscht', 'Alarma eliminada', 'Alarme supprimée'],
  'No Albums': ['ไม่มีอัลบั้ม', 'アルバムはありません', 'Keine Alben', 'No hay álbumes', 'Aucun album'],
  'Save Playlist': ['บันทึกเพลย์ลิสต์', 'プレイリストを保存', 'Playlist sichern', 'Guardar lista', 'Enregistrer la liste'],
  'Save On-The-Go?': ['บันทึก On-The-Go ไหม', 'On-The-Go を保存しますか?', 'On-The-Go sichern?', '¿Guardar On-The-Go?', 'Enregistrer On-The-Go ?'],
  'Playlist Saved': ['บันทึกเพลย์ลิสต์แล้ว', 'プレイリストを保存しました', 'Playlist gesichert', 'Lista guardada', 'Liste enregistrée'],
  'Clear Playlist': ['ล้างเพลย์ลิสต์', 'プレイリストを消去', 'Playlist löschen', 'Borrar lista', 'Effacer la liste'],
  'Clear On-The-Go?': ['ล้าง On-The-Go ไหม', 'On-The-Go を消去しますか?', 'On-The-Go löschen?', '¿Borrar On-The-Go?', 'Effacer On-The-Go ?'],
  'All Albums': ['อัลบั้มทั้งหมด', 'すべてのアルバム', 'Alle Alben', 'Todos los álbumes', 'Tous les albums'],
  'All Songs': ['เพลงทั้งหมด', 'すべての曲', 'Alle Titel', 'Todas las canciones', 'Tous les morceaux'],
  Refresh: ['รีเฟรช', '更新', 'Aktualisieren', 'Actualizar', 'Actualiser'],
  'No Genius Mixes': ['ไม่มีมิกซ์ Genius', 'Genius Mix はありません', 'Keine Genius-Mixe', 'No hay mezclas Genius', 'Aucun mix Genius'],
  'Genius Mixes are created from your library when you have enough songs in a genre.': [
    'มิกซ์ Genius สร้างจากคลังเพลงของคุณเมื่อมีเพลงในประเภทเดียวกันมากพอ',
    'ジャンルの曲が十分にあると、ライブラリから Genius Mix が作成されます。',
    'Genius-Mixe entstehen aus deiner Mediathek, sobald ein Genre genug Titel hat.',
    'Las mezclas Genius se crean a partir de tu biblioteca cuando un género tiene suficientes canciones.',
    'Les mix Genius sont créés à partir de votre bibliothèque lorsqu’un genre compte assez de morceaux.',
  ],
  'Nothing Playing': ['ไม่มีเพลงที่กำลังเล่น', '再生中の項目はありません', 'Keine Wiedergabe', 'Nada en reproducción', 'Aucune lecture'],
  'This video can’t be played': ['เล่นวิดีโอนี้ไม่ได้', 'このビデオは再生できません', 'Dieses Video kann nicht abgespielt werden', 'No se puede reproducir este vídeo', 'Impossible de lire cette vidéo'],
  '{n} of {m}': ['{n} จาก {m}', '{n}/{m}', '{n} von {m}', '{n} de {m}', '{n} sur {m}'],
  '{t} left': ['เหลือ {t}', '残り {t}', 'Noch {t}', 'Quedan {t}', 'Reste {t}'],

  // ---------------------------------------------------------------- settings
  Shuffle: ['สุ่ม', 'シャッフル', 'Zufällig', 'Aleatorio', 'Aléatoire'],
  Repeat: ['เล่นซ้ำ', 'リピート', 'Wiederholen', 'Repetir', 'Répéter'],
  Off: ['ปิด', 'オフ', 'Aus', 'No', 'Non'],
  On: ['เปิด', 'オン', 'Ein', 'Sí', 'Oui'],
  One: ['หนึ่งเพลง', '1曲', 'Eins', 'Una', 'Un'],
  All: ['ทั้งหมด', 'すべて', 'Alle', 'Todas', 'Tous'],
  '{n} Seconds': ['{n} วินาที', '{n} 秒', '{n} Sekunden', '{n} segundos', '{n} secondes'],
  '{n} Minutes': ['{n} นาที', '{n} 分', '{n} Minuten', '{n} minutos', '{n} minutes'],
  'Always On': ['เปิดตลอด', '常にオン', 'Immer an', 'Siempre activado', 'Toujours activé'],
  Speaker: ['ลำโพง', 'スピーカー', 'Lautsprecher', 'Altavoz', 'Haut-parleur'],
  Headphones: ['หูฟัง', 'ヘッドフォン', 'Kopfhörer', 'Auriculares', 'Écouteurs'],
  Both: ['ทั้งสองแบบ', '両方', 'Beide', 'Ambos', 'Les deux'],
  Slower: ['ช้าลง', '遅く', 'Langsamer', 'Más lento', 'Plus lent'],
  Normal: ['ปกติ', '標準', 'Normal', 'Normal', 'Normal'],
  Faster: ['เร็วขึ้น', '速く', 'Schneller', 'Más rápido', 'Plus rapide'],
  About: ['เกี่ยวกับ', '情報', 'Info', 'Información', 'Informations'],
  Shake: ['เขย่า', 'シェイク', 'Schütteln', 'Agitar', 'Secouer'],
  'Main Menu': ['เมนูหลัก', 'メインメニュー', 'Hauptmenü', 'Menú principal', 'Menu principal'],
  'Music Menu': ['เมนูเพลง', 'ミュージックメニュー', 'Musikmenü', 'Menú Música', 'Menu Musique'],
  'Volume Limit': ['จำกัดระดับเสียง', '音量制限', 'Lautstärkebegrenzung', 'Límite de volumen', 'Volume maximal'],
  Contrast: ['ความคมชัด', 'コントラスト', 'Kontrast', 'Contraste', 'Contraste'],
  Brightness: ['ความสว่าง', '明るさ', 'Helligkeit', 'Brillo', 'Luminosité'],
  'Audio Crossfade': ['เฟดเสียงข้ามเพลง', 'オーディオクロスフェード', 'Audio-Überblendung', 'Fundido de audio', 'Fondu enchaîné'],
  'Sound Check': ['ตรวจสอบเสียง', '音量の自動調整', 'Lautstärke anpassen', 'Ajuste de volumen', 'Égaliseur de volume'],
  EQ: ['อีควอไลเซอร์', 'イコライザ', 'EQ', 'Ecualizador', 'Égaliseur'],
  Clicker: ['เสียงคลิก', 'クリック音', 'Klicken', 'Clic', 'Cliqueur'],
  'Date & Time': ['วันที่และเวลา', '日付と時刻', 'Datum & Uhrzeit', 'Fecha y hora', 'Date et heure'],
  'Sort By': ['เรียงตาม', 'ソート順', 'Sortieren nach', 'Ordenar por', 'Trier par'],
  First: ['ชื่อ', '名', 'Vorname', 'Nombre', 'Prénom'],
  Last: ['นามสกุล', '姓', 'Nachname', 'Apellido', 'Nom'],
  Language: ['ภาษา', '言語', 'Sprache', 'Idioma', 'Langue'],
  Legal: ['ข้อกฎหมาย', '法的情報', 'Rechtliches', 'Información legal', 'Mentions légales'],
  'Reset Settings': ['รีเซ็ตการตั้งค่า', '設定をリセット', 'Einstellungen zurücksetzen', 'Restablecer ajustes', 'Réinitialiser les réglages'],
  Reset: ['รีเซ็ต', 'リセット', 'Zurücksetzen', 'Restablecer', 'Réinitialiser'],
  'Reset Main Menu': ['รีเซ็ตเมนูหลัก', 'メインメニューをリセット', 'Hauptmenü zurücksetzen', 'Restablecer menú principal', 'Réinitialiser le menu principal'],
  'Reset Music Menu': ['รีเซ็ตเมนูเพลง', 'ミュージックメニューをリセット', 'Musikmenü zurücksetzen', 'Restablecer menú Música', 'Réinitialiser le menu Musique'],
  'Set the maximum volume': ['ตั้งระดับเสียงสูงสุด', '最大音量を設定', 'Maximale Lautstärke festlegen', 'Ajusta el volumen máximo', 'Réglez le volume maximal'],
  'Press center to confirm': ['กดปุ่มกลางเพื่อยืนยัน', 'センターボタンを押して確定', 'Zum Bestätigen Mitte drücken', 'Pulsa el centro para confirmar', 'Appuyez au centre pour confirmer'],
  'Set Date & Time': ['ตั้งวันที่และเวลา', '日付と時刻を設定', 'Datum & Uhrzeit einstellen', 'Ajustar fecha y hora', 'Régler la date et l’heure'],
  'iPod sets its clock from your computer.': ['iPod ตั้งนาฬิกาตามคอมพิวเตอร์ของคุณ', 'iPod の時計はコンピュータに合わせて設定されます。', 'Der iPod stellt seine Uhr nach deinem Computer.', 'El iPod ajusta su reloj con tu ordenador.', 'L’iPod règle son horloge sur votre ordinateur.'],
  'Time Zone': ['เขตเวลา', '時間帯', 'Zeitzone', 'Zona horaria', 'Fuseau horaire'],
  'Set automatically': ['ตั้งค่าโดยอัตโนมัติ', '自動設定', 'Automatisch eingestellt', 'Ajuste automático', 'Réglage automatique'],
  '24 Hour Clock': ['นาฬิกา 24 ชั่วโมง', '24時間表示', '24-Stunden-Uhr', 'Reloj de 24 horas', 'Horloge 24 h'],
  'Time in Title': ['เวลาในแถบชื่อ', 'タイトルに時刻', 'Uhrzeit in Titelleiste', 'Hora en el título', 'Heure dans le titre'],
  Capacity: ['ความจุ', '容量', 'Kapazität', 'Capacidad', 'Capacité'],
  Available: ['ว่าง', '使用可能', 'Verfügbar', 'Disponible', 'Disponible'],
  Version: ['เวอร์ชั่น', 'バージョン', 'Version', 'Versión', 'Version'],
  Model: ['รุ่น', 'モデル', 'Modell', 'Modelo', 'Modèle'],
  Format: ['รูปแบบ', 'フォーマット', 'Format', 'Formato', 'Format'],

  // ---------------------------------------------------------------- videos
  Movies: ['ภาพยนตร์', 'ムービー', 'Filme', 'Películas', 'Films'],
  Rentals: ['ภาพยนตร์เช่า', 'レンタル', 'Leihfilme', 'Alquileres', 'Locations'],
  'TV Shows': ['รายการทีวี', 'テレビ番組', 'TV-Sendungen', 'Series de TV', 'Séries TV'],
  'Video Podcasts': ['พ็อดคาสท์วิดีโอ', 'ビデオ Podcast', 'Video-Podcasts', 'Podcasts de vídeo', 'Podcasts vidéo'],
  'Music Videos': ['มิวสิควิดีโอ', 'ミュージックビデオ', 'Musikvideos', 'Videoclips', 'Clips vidéo'],
  'Video Playlists': ['เพลย์ลิสต์วิดีโอ', 'ビデオプレイリスト', 'Video-Playlists', 'Listas de vídeo', 'Listes vidéo'],
  'Video Settings': ['การตั้งค่าวิดีโอ', 'ビデオ設定', 'Videoeinstellungen', 'Ajustes de vídeo', 'Réglages vidéo'],
  'No Rentals': ['ไม่มีภาพยนตร์เช่า', 'レンタルはありません', 'Keine Leihfilme', 'No hay alquileres', 'Aucune location'],
  'No Movies': ['ไม่มีภาพยนตร์', 'ムービーはありません', 'Keine Filme', 'No hay películas', 'Aucun film'],
  'No TV Shows': ['ไม่มีรายการทีวี', 'テレビ番組はありません', 'Keine TV-Sendungen', 'No hay series', 'Aucune série TV'],
  'No Videos': ['ไม่มีวิดีโอ', 'ビデオはありません', 'Keine Videos', 'No hay vídeos', 'Aucune vidéo'],
  'TV Show': ['รายการทีวี', 'テレビ番組', 'TV-Sendung', 'Serie de TV', 'Série TV'],
  Podcast: ['พ็อดคาสท์', 'Podcast', 'Podcast', 'Podcast', 'Podcast'],
  'TV Out': ['ส่งออกทีวี', 'TV 出力', 'TV-Ausgang', 'Salida TV', 'Sortie TV'],
  Ask: ['ถามก่อน', '確認', 'Fragen', 'Preguntar', 'Demander'],
  'TV Signal': ['สัญญาณทีวี', 'TV 信号', 'TV-Signal', 'Señal TV', 'Signal TV'],
  Widescreen: ['จอกว้าง', 'ワイドスクリーン', 'Breitbild', 'Panorámica', 'Grand écran'],
  'Fit to Screen': ['พอดีจอ', '画面に合わせる', 'An Bildschirm anpassen', 'Ajustar a pantalla', 'Adapter à l’écran'],
  Captions: ['คำบรรยาย', 'キャプション', 'Untertitel', 'Subtítulos', 'Sous-titres'],

  // ---------------------------------------------------------------- photos
  Random: ['สุ่ม', 'ランダム', 'Zufällig', 'Aleatorio', 'Aléatoire'],
  Dissolve: ['จางหาย', 'ディゾルブ', 'Auflösen', 'Disolver', 'Fondu'],
  'Push Across': ['ดันข้าม', 'プッシュ', 'Schieben', 'Empujar', 'Pousser'],
  'Wipe Across': ['กวาดข้าม', 'ワイプ', 'Wischen', 'Barrido', 'Balayer'],
  'Zoom Out': ['ซูมออก', 'ズームアウト', 'Auszoomen', 'Alejar', 'Zoom arrière'],
  'Cube Across': ['ลูกบาศก์', 'キューブ', 'Würfel', 'Cubo', 'Cube'],
  Manual: ['ด้วยตนเอง', '手動', 'Manuell', 'Manual', 'Manuel'],
  'Slideshow Settings': ['การตั้งค่าสไลด์โชว์', 'スライドショー設定', 'Diashow-Einstellungen', 'Ajustes del pase', 'Réglages du diaporama'],
  'Photo Library': ['คลังรูปภาพ', 'フォトライブラリ', 'Fotomediathek', 'Fototeca', 'Photothèque'],
  Favorites: ['รายการโปรด', 'お気に入り', 'Favoriten', 'Favoritos', 'Favoris'],
  'Time Per Slide': ['เวลาต่อภาพ', 'スライドあたりの時間', 'Zeit pro Bild', 'Tiempo por foto', 'Durée par photo'],
  'Shuffle Photos': ['สุ่มรูปภาพ', '写真をシャッフル', 'Fotos zufällig', 'Fotos aleatorias', 'Photos aléatoires'],
  Transitions: ['การเปลี่ยนภาพ', 'トランジション', 'Übergänge', 'Transiciones', 'Transitions'],
  Photo: ['รูปภาพ', '写真', 'Foto', 'Foto', 'Photo'],
  Slideshow: ['สไลด์โชว์', 'スライドショー', 'Diashow', 'Pase de fotos', 'Diaporama'],

  // ---------------------------------------------------------------- extras
  Alarms: ['การปลุก', 'アラーム', 'Wecker', 'Alarmas', 'Alarmes'],
  Calendars: ['ปฏิทิน', 'カレンダー', 'Kalender', 'Calendarios', 'Calendriers'],
  Clocks: ['นาฬิกา', '時計', 'Uhren', 'Relojes', 'Horloges'],
  'Screen Lock': ['ล็อคหน้าจอ', '画面ロック', 'Bildschirmsperre', 'Bloqueo de pantalla', 'Verrouillage de l’écran'],
  Stopwatch: ['นาฬิกาจับเวลา', 'ストップウォッチ', 'Stoppuhr', 'Cronómetro', 'Chronomètre'],
  'Voice Memos': ['บันทึกเสียง', 'ボイスメモ', 'Sprachmemos', 'Notas de voz', 'Mémos vocaux'],
  Note: ['โน้ต', 'メモ', 'Notiz', 'Nota', 'Note'],
  'No Name': ['ไม่มีชื่อ', '名前なし', 'Kein Name', 'Sin nombre', 'Sans nom'],
  'Set Combination': ['ตั้งรหัส', '組み合わせを設定', 'Kombination festlegen', 'Definir combinación', 'Définir la combinaison'],
  'Change Combination': ['เปลี่ยนรหัส', '組み合わせを変更', 'Kombination ändern', 'Cambiar combinación', 'Modifier la combinaison'],
  'Combination Set': ['ตั้งรหัสแล้ว', '組み合わせを設定しました', 'Kombination festgelegt', 'Combinación definida', 'Combinaison définie'],
  Lock: ['ล็อค', 'ロック', 'Sperren', 'Bloquear', 'Verrouiller'],
  'Turn Off': ['ปิด', 'オフにする', 'Ausschalten', 'Desactivar', 'Désactiver'],
  'Remove the combination?': ['ลบรหัสไหม', '組み合わせを削除しますか?', 'Kombination entfernen?', '¿Eliminar la combinación?', 'Supprimer la combinaison ?'],
  'Enter combination': ['ใส่รหัส', '組み合わせを入力', 'Kombination eingeben', 'Introduce la combinación', 'Saisissez la combinaison'],
  'Enter new combination': ['ใส่รหัสใหม่', '新しい組み合わせを入力', 'Neue Kombination eingeben', 'Introduce la nueva combinación', 'Saisissez la nouvelle combinaison'],
  'Wrong combination': ['รหัสไม่ถูกต้อง', '組み合わせが違います', 'Falsche Kombination', 'Combinación incorrecta', 'Combinaison incorrecte'],
  'Press center to unlock': ['กดปุ่มกลางเพื่อปลดล็อค', 'センターボタンを押してロックを解除', 'Zum Entsperren Mitte drücken', 'Pulsa el centro para desbloquear', 'Appuyez au centre pour déverrouiller'],
  'Search Results': ['ผลการค้นหา', '検索結果', 'Suchergebnisse', 'Resultados', 'Résultats'],
  'Turn the wheel to choose letters, press the center button to enter.': [
    'หมุนวงล้อเพื่อเลือกตัวอักษร กดปุ่มกลางเพื่อป้อน',
    'ホイールを回して文字を選び、センターボタンで入力します。',
    'Drehe das Click Wheel, um Buchstaben zu wählen, und drücke die Mitte zum Eingeben.',
    'Gira la rueda para elegir letras y pulsa el botón central para introducirlas.',
    'Tournez la molette pour choisir les lettres, appuyez au centre pour les saisir.',
  ],
  'No results': ['ไม่พบผลลัพธ์', '結果なし', 'Keine Ergebnisse', 'Sin resultados', 'Aucun résultat'],

  // voice memos
  'Voice Memo': ['บันทึกเสียง', 'ボイスメモ', 'Sprachmemo', 'Nota de voz', 'Mémo vocal'],
  'Start Recording': ['เริ่มบันทึก', '録音開始', 'Aufnahme starten', 'Iniciar grabación', 'Démarrer l’enregistrement'],
  Record: ['บันทึก', '録音', 'Aufnehmen', 'Grabar', 'Enregistrer'],
  Play: ['เล่น', '再生', 'Wiedergeben', 'Reproducir', 'Lire'],
  Delete: ['ลบ', '削除', 'Löschen', 'Eliminar', 'Supprimer'],
  'Recording is not supported in this browser.': ['เบราว์เซอร์นี้บันทึกเสียงไม่ได้', 'このブラウザでは録音できません。', 'Dieser Browser unterstützt keine Aufnahmen.', 'Este navegador no permite grabar.', 'Ce navigateur ne permet pas d’enregistrer.'],
  'Microphone access was denied.': ['ไม่ได้รับอนุญาตให้ใช้ไมโครโฟน', 'マイクへのアクセスが拒否されました。', 'Der Zugriff auf das Mikrofon wurde verweigert.', 'Se ha denegado el acceso al micrófono.', 'L’accès au micro a été refusé.'],
  'No microphone is available.': ['ไม่มีไมโครโฟน', 'マイクがありません。', 'Kein Mikrofon verfügbar.', 'No hay ningún micrófono.', 'Aucun micro disponible.'],
  'Voice Memo Saved': ['บันทึกเสียงแล้ว', 'ボイスメモを保存しました', 'Sprachmemo gesichert', 'Nota de voz guardada', 'Mémo vocal enregistré'],
  Resume: ['เล่นต่อ', '再開', 'Fortsetzen', 'Reanudar', 'Reprendre'],
  Pause: ['หยุดชั่วคราว', '一時停止', 'Pause', 'Pausa', 'Pause'],
  'Stop and Save': ['หยุดและบันทึก', '停止して保存', 'Stoppen und sichern', 'Detener y guardar', 'Arrêter et enregistrer'],
  'Discard this recording?': ['ทิ้งเสียงที่บันทึกนี้ไหม', 'この録音を破棄しますか?', 'Diese Aufnahme verwerfen?', '¿Descartar esta grabación?', 'Supprimer cet enregistrement ?'],
  Discard: ['ทิ้ง', '破棄', 'Verwerfen', 'Descartar', 'Supprimer'],

  // clocks and alarms
  Once: ['ครั้งเดียว', '1回のみ', 'Einmal', 'Una vez', 'Une fois'],
  'Every Day': ['ทุกวัน', '毎日', 'Täglich', 'Todos los días', 'Tous les jours'],
  Weekdays: ['วันธรรมดา', '平日', 'Wochentags', 'Días laborables', 'En semaine'],
  Weekends: ['วันหยุดสุดสัปดาห์', '週末', 'Am Wochenende', 'Fines de semana', 'Le week-end'],
  'Every {d}': ['ทุก{d}', '毎週{d}', 'Jeden {d}', 'Cada {d}', 'Chaque {d}'],
  Custom: ['กำหนดเอง', 'カスタム', 'Eigene', 'Personalizado', 'Personnalisé'],
  Alarm: ['การปลุก', 'アラーム', 'Wecker', 'Alarma', 'Alarme'],
  'Wake Up': ['ตื่นนอน', '起床', 'Aufwachen', 'Despertar', 'Réveil'],
  Work: ['ทำงาน', '仕事', 'Arbeit', 'Trabajo', 'Travail'],
  Class: ['เข้าเรียน', '授業', 'Unterricht', 'Clase', 'Cours'],
  Medication: ['ทานยา', '服薬', 'Medikamente', 'Medicación', 'Médicaments'],
  Exercise: ['ออกกำลังกาย', '運動', 'Sport', 'Ejercicio', 'Sport'],
  Appointment: ['นัดหมาย', '予約', 'Termin', 'Cita', 'Rendez-vous'],
  Meeting: ['ประชุม', '会議', 'Besprechung', 'Reunión', 'Réunion'],
  Lunch: ['มื้อกลางวัน', 'ランチ', 'Mittagessen', 'Comida', 'Déjeuner'],
  Nap: ['งีบหลับ', '昼寝', 'Nickerchen', 'Siesta', 'Sieste'],
  Event: ['กิจกรรม', 'イベント', 'Ereignis', 'Evento', 'Événement'],
  'Create Alarm': ['สร้างการปลุก', 'アラームを作成', 'Wecker erstellen', 'Crear alarma', 'Créer une alarme'],
  'Sleep Timer': ['ตั้งเวลาปิด', 'スリープタイマー', 'Schlaftimer', 'Temporizador', 'Minuterie'],
  Playlist: ['เพลย์ลิสต์', 'プレイリスト', 'Playlist', 'Lista', 'Liste de lecture'],
  None: ['ไม่มี', 'なし', 'Keine', 'Ninguno', 'Aucun'],
  Beep: ['เสียงบี๊บ', 'ビープ', 'Signalton', 'Pitido', 'Bip'],
  Time: ['เวลา', '時刻', 'Uhrzeit', 'Hora', 'Heure'],
  Alerts: ['เสียงเตือน', '通知', 'Hinweise', 'Avisos', 'Alertes'],
  Label: ['ป้ายชื่อ', 'ラベル', 'Etikett', 'Etiqueta', 'Libellé'],
  'Delete this alarm?': ['ลบการปลุกนี้ไหม', 'このアラームを削除しますか?', 'Diesen Wecker löschen?', '¿Eliminar esta alarma?', 'Supprimer cette alarme ?'],
  'Turn the wheel to change, press center to continue.': [
    'หมุนวงล้อเพื่อเปลี่ยน กดปุ่มกลางเพื่อไปต่อ',
    'ホイールを回して変更し、センターボタンで次へ進みます。',
    'Drehe das Click Wheel zum Ändern und drücke die Mitte, um fortzufahren.',
    'Gira la rueda para cambiar y pulsa el centro para continuar.',
    'Tournez la molette pour modifier, appuyez au centre pour continuer.',
  ],
  'Add Clock': ['เพิ่มนาฬิกา', '時計を追加', 'Uhr hinzufügen', 'Añadir reloj', 'Ajouter une horloge'],
  Add: ['เพิ่ม', '追加', 'Hinzufügen', 'Añadir', 'Ajouter'],
  Today: ['วันนี้', '今日', 'Heute', 'Hoy', 'Aujourd’hui'],
  Tomorrow: ['พรุ่งนี้', '明日', 'Morgen', 'Mañana', 'Demain'],
  Yesterday: ['เมื่อวาน', '昨日', 'Gestern', 'Ayer', 'Hier'],
  Start: ['เริ่ม', '開始', 'Start', 'Iniciar', 'Démarrer'],
  Stop: ['หยุด', '停止', 'Stopp', 'Detener', 'Arrêter'],
  Lap: ['รอบ', 'ラップ', 'Runde', 'Vuelta', 'Tour'],
  'Lap {n}': ['รอบ {n}', 'ラップ {n}', 'Runde {n}', 'Vuelta {n}', 'Tour {n}'],
  Dismiss: ['ปิด', '停止', 'Beenden', 'Cerrar', 'Ignorer'],
  Snooze: ['เลื่อนปลุก', 'スヌーズ', 'Schlummern', 'Posponer', 'Rappel'],
  'All Calendars': ['ปฏิทินทั้งหมด', 'すべてのカレンダー', 'Alle Kalender', 'Todos los calendarios', 'Tous les calendriers'],
  "To Do's": ['สิ่งที่ต้องทำ', 'ToDo', 'Aufgaben', 'Tareas', 'À faire'],
  "No To Do's": ['ไม่มีสิ่งที่ต้องทำ', 'ToDo はありません', 'Keine Aufgaben', 'No hay tareas', 'Aucune tâche'],
  'No Events': ['ไม่มีกิจกรรม', 'イベントはありません', 'Keine Ereignisse', 'No hay eventos', 'Aucun événement'],
  'Event deleted': ['ลบกิจกรรมแล้ว', 'イベントは削除されました', 'Ereignis gelöscht', 'Evento eliminado', 'Événement supprimé'],
  'all-day': ['ทั้งวัน', '終日', 'ganztägig', 'todo el día', 'journée'],
  'All day': ['ทั้งวัน', '終日', 'Ganztägig', 'Todo el día', 'Toute la journée'],
};

let lang = useSettings.getState().language;
useSettings.subscribe((s) => {
  lang = s.language;
});

/**
 * The system's words in the chosen language. `{name}` in the text is filled
 * from `vars` (after translating, so the order can change).
 */
export function t(s: string, vars?: Record<string, string | number>): string {
  const col = TRANSLATED.indexOf(lang as (typeof TRANSLATED)[number]);
  let out = s;
  if (col >= 0) {
    const hit = TABLE[s]?.[col];
    // "5 Seconds" reads as "{n} Seconds"
    const num = hit === undefined ? /^(\d+) (.+)$/.exec(s) : null;
    const pat = num && TABLE[`{n} ${num[2]}`]?.[col];
    out = hit ?? (pat ? pat.split('{n}').join(num![1]) : s);
  }
  if (vars) for (const k in vars) out = out.split(`{${k}}`).join(String(vars[k]));
  return out;
}

/** The chosen language (re-renders on change). */
export function useLang(): string {
  return useSettings((s) => s.language);
}

/** BCP 47 locale for dates in the chosen language */
export function locale(): string {
  return LOCALES[lang] ?? 'en-US';
}
