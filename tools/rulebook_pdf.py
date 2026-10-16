"""Build print/Suitkeep-Rulebook.pdf from RULEBOOK.md using headless Google Chrome.

Usage (from the project root):  python3 tools/rulebook_pdf.py
Handles the markdown the rulebook uses: headings, paragraphs, numbered lists with nested bullets, tables, **bold**, *italic*.
"""
import html, os, re, subprocess, sys, tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "RULEBOOK.md")
OUT = os.path.join(ROOT, "print", "Suitkeep-Rulebook.pdf")
CHROME = os.environ.get("CHROME", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome")

CSS = """
@page { size: A4; margin: 13mm 15mm 13mm; }
body { font: 10.2pt/1.4 Georgia, 'Times New Roman', serif; color: #1b1b1b; }
h1 { font: 700 22pt/1.15 system-ui, sans-serif; color: #0d3b2a; margin: 0 0 6pt; }
h2 { font: 700 13pt/1.2 system-ui, sans-serif; color: #0d3b2a; border-bottom: 1.5pt solid #c8861b; padding-bottom: 2pt; margin: 11pt 0 5pt; break-after: avoid; }
p { margin: 0 0 6pt; }
ol, ul { margin: 0 0 6pt; padding-left: 18pt; }
li { margin: 0 0 3pt; break-inside: avoid; }
li > ul { margin-top: 3pt; }
table { border-collapse: collapse; margin: 4pt 0 8pt; font: 9.5pt system-ui, sans-serif; }
th, td { border: 0.75pt solid #999; padding: 2pt 6pt; text-align: center; }
th { background: #0d3b2a; color: #fff; }
td:first-child, th:first-child { font-weight: 700; }
strong { color: #0d3b2a; }
"""


def inline(text):
    t = html.escape(text, quote=False)
    t = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", t)
    t = re.sub(r"(?<![*\w])\*(?!\s)(.+?)(?<!\s)\*(?![*\w])", r"<em>\1</em>", t)
    return t


def convert(md):
    out, i = [], 0
    lines = md.splitlines()
    while i < len(lines):
        line = lines[i]
        if not line.strip():
            i += 1
        elif line.startswith("# "):
            out.append(f"<h1>{inline(line[2:])}</h1>"); i += 1
        elif line.startswith("## "):
            out.append(f"<h2>{inline(line[3:])}</h2>"); i += 1
        elif line.startswith("|"):
            rows = []
            while i < len(lines) and lines[i].startswith("|"):
                cells = [c.strip() for c in lines[i].strip().strip("|").split("|")]
                if not all(re.fullmatch(r":?-+:?", c) for c in cells):
                    rows.append(cells)
                i += 1
            head, body = rows[0], rows[1:]
            out.append("<table><tr>" + "".join(f"<th>{inline(c)}</th>" for c in head) + "</tr>"
                       + "".join("<tr>" + "".join(f"<td>{inline(c)}</td>" for c in r) + "</tr>" for r in body) + "</table>")
        elif re.match(r"\d+\. |- ", line):
            tag = "ol" if line[0].isdigit() else "ul"
            items = []
            while i < len(lines) and (re.match(r"\d+\. |- ", lines[i]) or lines[i].startswith("   - ")):
                if lines[i].startswith("   - "):
                    items[-1][1].append(lines[i][5:])
                else:
                    items.append((re.sub(r"^(\d+\. |- )", "", lines[i]), []))
                i += 1
            parts = []
            for text, subs in items:
                sub = "<ul>" + "".join(f"<li>{inline(s)}</li>" for s in subs) + "</ul>" if subs else ""
                parts.append(f"<li>{inline(text)}{sub}</li>")
            out.append(f"<{tag}>{''.join(parts)}</{tag}>")
        else:
            para = []
            while i < len(lines) and lines[i].strip() and not re.match(r"#|\||\d+\. |- ", lines[i]):
                para.append(lines[i].strip()); i += 1
            out.append(f"<p>{inline(' '.join(para))}</p>")
    return "\n".join(out)


def main():
    body = convert(open(SRC, encoding="utf-8").read())
    page = f'<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Suitkeep Rulebook</title><style>{CSS}</style></head><body>{body}</body></html>'
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        src = os.path.join(tmp, "rulebook.html")
        open(src, "w", encoding="utf-8").write(page)
        subprocess.run([CHROME, "--headless=new", "--disable-gpu", f"--user-data-dir={tmp}/profile", "--no-pdf-header-footer",
                        f"--print-to-pdf={OUT}", "file://" + src], check=True, capture_output=True)
    print("wrote", OUT)


if __name__ == "__main__":
    sys.exit(main())
