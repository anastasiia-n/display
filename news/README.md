# Retro pixel news broadcast

Animated 16-bit TV news studio on an HTML5 Canvas (`1920x1080`) with four pixel-art anchors, CRT scanlines, a 16:9 backstage monitor image, and a scrolling `BREAKING NEWS` ticker.

Live on GitHub Pages: <https://anastasiia-n.github.io/display/news/>

Configure it using the studio controls on the page (click **COPY LINK** to copy the resulting URL), or pass parameters directly in the URL `#hash` so changes apply without reloading.

## URL hash parameters (`#...`)

| Parameter | Default | Description |
| :--- | :--- | :--- |
| `ticker` | empty | Scrolling `BREAKING NEWS` marquee text (pauses on hover). |
| `img` | City/tech photo | Image URL cover-fitted onto the 16:9 backstage screen. Shows `NO MEDIA SIGNAL` color bars if it fails to load. |
| `presenter` | `male` | Anchor character: `male`, `female`, `cyber`, or `robot`. |
| `scanlines` | `true` | Set `scanlines=false` or `scanlines=0` to disable the CRT scanline overlay. |
| `tv` (or `tvmode`) | `false` | Set `tv=true` or `tv=1` to hide all studio controls and fill `100vw x 100vh`. |

## Controls and shortcuts

When focus is outside the text inputs:

- `T` or `F` (or **TV MODE**): toggle full-screen TV mode.
- `Escape`: exit TV mode.
- **PRESENTER**: cycle through `MALE`, `FEMALE`, `CYBER`, and `ROBOT`.
- **SCANLINES**: toggle the CRT scanline overlay (the backstage monitor image stays unmasked).
- **COPY LINK**: copy the current `#...` broadcast URL.

## Examples

Studio editor:
`https://anastasiia-n.github.io/display/news/`

Full-screen TV broadcast with the robot anchor:
`https://anastasiia-n.github.io/display/news/#presenter=robot&ticker=BREAKING%3A+Friday+deploy+completed+with+zero+rollbacks&tv=true`

Cyberpunk anchor with a custom monitor image:
`https://anastasiia-n.github.io/display/news/#presenter=cyber&img=https%3A%2F%2Fimages.unsplash.com%2Fphoto-1526374965328-7f61d4dc18c5%3Fw%3D1600&ticker=SYSTEM+UPGRADE+IN+PROGRESS+%E2%80%A2+PLEASE+STAND+BY&tv=true`

## Running locally

```bash
python3 -m http.server 8000 --directory news
```
