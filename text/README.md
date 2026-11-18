# Text display

Full-screen centered text sign configured through URL query parameters.

Live on GitHub Pages: <https://anastasiia-n.github.io/display/text/>

## Query parameters

| Parameter | Default | Description |
| :--- | :--- | :--- |
| `text` (or `msg`) | `No message provided` | Main centered message. Use `%0A` for line breaks. |
| `title` | hidden | Optional uppercase heading above the message (`3.5vw`). |
| `bg` | `ffffff` | Background color as hex without `#` (`0f172a`), `%230f172a`, or `rgb(...)`. |
| `color` | `111827` | Text color as hex without `#` (`f8fafc`), `%23...`, or `rgb(...)`. |
| `size` | `6vw` | CSS `font-size` for the main text (`10vw`, `8rem`, `120px`). |
| `font` | `Google Sans Flex` | Font family name. Preloads `Google Sans Flex`, `Outfit`, and `Roboto`; any installed system font also works. |

Omit `#` on hex colors or encode it as `%23`, because an unencoded `#` starts a URL hash fragment and cuts off the query string.

## Examples

Simple notice:
`https://anastasiia-n.github.io/display/text/?text=Back%20in%205%20minutes`

Dark status banner:
`https://anastasiia-n.github.io/display/text/?title=Build%20Status&text=PROD%20IS%20GREEN&bg=064e3b&color=ecfdf5&size=8vw`

Multiline warning sign:
`https://anastasiia-n.github.io/display/text/?title=Warning&text=Coffee%20machine%20out%20of%20order%0AProceed%20with%20caution&bg=7f1d1d&color=fef2f2&size=5vw`

Custom font and oversized text:
`https://anastasiia-n.github.io/display/text/?text=DEMO%20DAY&font=Outfit&bg=0f172a&color=facc15&size=12vw`

## Running locally

Open `text/index.html` in a browser or serve it:

```bash
python3 -m http.server 8000 --directory text
```
