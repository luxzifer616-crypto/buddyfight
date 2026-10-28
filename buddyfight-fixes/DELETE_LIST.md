# Files to delete from the repo

None of these are loaded by the game (`index.html`, `*.js`, `*.css`) or used by the tests.
I checked for every filename, including image paths built in code.

## 1. System junk — safe to delete
- `.DS_Store`
- `Sprite/.DS_Store`
- `CardSprite/Thumbs.db`
- `CardSprite/desktop.ini`

## 2. Unused images in `Sprite/` (about 6 MB)
- `Sprite/123.gif`
- `Sprite/Background1 - копия.png` (a copy of Background1)
- `Sprite/Background2.png` … `Sprite/Background6.png`
- `Sprite/BackgroundD.png`, `BackgroundD1.png`, `BackgroundD2.png`, `BackgroundD3.png`
- `Sprite/BackgroundMenu1.png`
- `Sprite/BackgroundTextInMenu.png`
- `Sprite/EffAn.png`
- `Sprite/FaceDownCard.jpg`
- `Sprite/GameChatSprite.png`
- `Sprite/SleevesMini/` (whole folder)

Still used, so **keep**: `Background1.png`, `BackgroundMenu.png`, `Field1.png`, `OvergodZeroFlag.png`, `Mats/`, `Sleeves/`.

## 3. Photoshop sources (about 30 MB): back these up first
- `Sprite/Photoshope Shapblon/` (whole folder)

The main file is named "Исходники НЕ ПОТЕРЯТЬ" ("Sources – DO NOT LOSE").
Copy the folder to a cloud drive before deleting it from the repo.

## 4. Card database copies (about 38 MB) and card text dumps (about 4.5 MB)
- `buddyfight_cards.json`
- `buddyfight_cards.csv`
- `buddyfight_cards.sqlite`
- `Text/` (whole folder)

The game only loads `cards_data.js`. These files look like the source data `cards_data.js` was built from.
If you might regenerate `cards_data.js` someday, keep one copy (for example the `.json`) outside the repo.

## Two other things to know
- Deleting from GitHub makes the repo smaller to download, but the files stay in git history.
- `CardSprite/` (6,500 card images) is required. Don't delete it.
