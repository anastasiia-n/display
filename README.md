# display

Web pages built for spare monitors and hallway TVs. There is no backend, no build step, and no login screen; you configure everything in the URL bar.

## Pages

| Page | Live URL | Docs | What it's for |
| :--- | :--- | :--- | :--- |
| [`text/`](text/) | [`/display/text/`](https://anastasiia-n.github.io/display/text/) | [README](text/README.md) | Giant centered text readable from across the room ("COFFEE MACHINE IS BROKEN"). |
| [`news/`](news/) | [`/display/news/`](https://anastasiia-n.github.io/display/news/) | [README](news/README.md) | A 16-bit news studio with a pixel-art anchor and a `BREAKING NEWS` ticker, for announcements that deserve too much drama. |
| [`timetable/`](timetable/) | [`/display/timetable/`](https://anastasiia-n.github.io/display/timetable/) | [README](timetable/README.md) | Live Munich S-Bahn and U-Bahn departures that tell you when to walk out the door, or when to `RUN NOW`. |

## Examples

Bring snacks:
<https://anastasiia-n.github.io/display/text/?title=PSA&text=Bring%20snacks&bg=0f172a&color=facc15&size=10vw>

Put a robot on live television:
<https://anastasiia-n.github.io/display/news/#presenter=robot&ticker=BREAKING%3A+All+tests+passed+on+the+first+try+%28suspicious%29&tv=true>

Catch an eastbound S-Bahn or U2 before it leaves:
<https://anastasiia-n.github.io/display/timetable/?filter=east,Hbf:U2@Sendlinger%20Tor>

## Setup

1. Edit plain `.html`, `.css`, and `.js` files.
2. Push to `main`.
3. Point a TV browser at `https://anastasiia-n.github.io/display/...` and hide the remote.

## License

[MIT](LICENSE)
