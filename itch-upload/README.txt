MANSAF RUSH - what to give itch.io
==================================

Upload this ONE file:

    UPLOAD-THIS-mansaf-rush.zip      (19 MB, index.html is at the top of the ZIP, as itch.io requires)

Nothing else in this folder needs to be uploaded.


Steps on https://itch.io/game/new
---------------------------------
1. Kind of project:  HTML   ("You have a ZIP or HTML file that will be played in the browser")
2. Uploads > Upload files > pick UPLOAD-THIS-mansaf-rush.zip
3. Tick  "This file will be played in the browser"  next to the file once it has uploaded.
4. Embed options (shown after step 3):
     Viewport dimensions ..... 1280 x 720   (the game fits any size, 960 x 600 also works)
     Fullscreen button ....... ON
     Mobile friendly ......... ON            (phones get the joystick layout automatically)
     Automatically start ..... OFF           (players click to launch, which also lets the sound start)
     Scrollbars .............. OFF
5. In the description you can say: "Desktop: arrow keys to move, hold SPACE to scoop, tap left and right
   to roll, up arrow to eat. Phone: joystick and buttons."
6. Save as Draft first, open the page, click to play once, then set it to Public.

Do not tick anything about downloads or a minimum price: this is a browser game, the ZIP is only what
makes it playable.


butler (optional, instead of the website upload)
------------------------------------------------
    butler push UPLOAD-THIS-mansaf-rush.zip YOUR-ITCH-NAME/YOUR-GAME-NAME:html5

The channel name "html5" makes itch.io treat the upload as a browser game. Later pushes only send what changed.


Good to know
------------
* The only thing loaded from the internet is the fonts (Google Fonts). If a player is offline the game
  still runs with a fallback font.
* The game was tested from this exact ZIP, served from a sub-folder on a different address inside an
  iframe (the way itch.io runs games), with keyboard play, and also with browser storage blocked
  (some browsers block it for embedded games). Both worked with no errors.
* Sound starts after the player's first click or key press (browser rule), so a click-to-launch page is best.
* This ZIP is a snapshot of the game as it is now. After any change to the game it has to be rebuilt:
  run "npm run build", then zip the CONTENTS of the "dist" folder (index.html must be at the top of the
  ZIP, not inside a folder).
