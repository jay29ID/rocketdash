# Rocket League stats recorder: setup

One-time setup, about five minutes. Only one of you needs to run it, because it records both teammates.

## 1. Switch on the game's Stats API
1. Close Rocket League.
2. Keep all these files together in one folder (Desktop is fine).
3. Double-click `Enable Stats API.bat` and click Yes when Windows asks for permission.

A big game update can reset this. If the widget says "Stats API is off", run it again.

## 2. Start the widget
Double-click `RL Stats Widget.bat`. A small window appears in the bottom-right corner:
- The dot at the top shows the status: amber means waiting for the game, green means connected, and blue means you're in a match.
- During a match it shows the live score and clock, plus goals, assists, shots, saves, demos and boost for you both.
- After a match it shows the result, and below that today's record, your win or loss streak and your MMR.
- To move it, drag it by the top bar or the score. **Pin** keeps it on top of other windows. **_** hides it to the system tray, where it keeps recording. **x** quits.

Windows may say "Windows protected your PC" the first time you open a .bat file. Click More info, then Run anyway.

Run either the widget or `Start RL Recorder.bat` (the plain console version), not both, or every match gets saved twice.

## Updates
If `Documents\RLStats\upload.json` exists (it comes with the install zip), the widget checks the dashboard site each time it starts. It downloads any newer files and restarts itself. If the site can't be reached, it just starts as normal.

## Updates
Once uploads are set up (`Set Up Uploads.bat`), the widget checks the dashboard site for a newer version every time it starts, installs it and restarts itself. You don't need to download anything again.

## MMR
You don't have to do anything. Every time you queue, the game writes your MMR to its own log file, and the recorder reads it from there. When you queue as a party, the game logs the party leader's number, and those rows are marked with a party size of 2. `Type MMR` in the widget, or `Log MMR.bat`, is only needed to fill gaps.

## Where the data goes
`Documents\RLStats\`
- `matches.jsonl`: one line per match. This is what the dashboard uses.
- `players.csv`: one row per player per match, and it opens in Excel.
- `mmr.csv`: every MMR value, with the time and playlist.
- `events\<match id>.jsonl`: the full event log for each match.

Matches you leave early are saved as "Incomplete". Freeplay, training and replays are ignored.
Boost, speed and movement are only sent for your own team, so opponents have blanks for those.
