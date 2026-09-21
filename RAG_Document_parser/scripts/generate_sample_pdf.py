"""
generate_sample_pdf.py — Create the canonical sample document for the RAG demo.

This script generates `data/sample_documents/rag_sample.pdf`, a 5-page PDF
containing ~20 specific, verifiable facts across five topic domains:
  Page 1 — Space Exploration
  Page 2 — World Geography
  Page 3 — Historical Inventions
  Page 4 — Climate & Environment
  Page 5 — Biology & Medicine

Facts are chosen to be:
  - Specific (dates, numbers, names) so keyword-check evaluation is reliable.
  - Varied in phrasing so the eval tests different retrieval paths.
  - Self-contained in single paragraphs to keep chunks clean.

Run from the project root:
    python scripts/generate_sample_pdf.py
"""

import os
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter

OUTPUT_PATH = os.path.join(
    os.path.dirname(os.path.dirname(__file__)),
    "data", "sample_documents", "rag_sample.pdf"
)

PAGES = [
    {
        "title": "Space Exploration",
        "paragraphs": [
            (
                "The Apollo 11 mission, launched on July 16, 1969, was the first "
                "crewed mission to land on the Moon. Astronauts Neil Armstrong and "
                "Buzz Aldrin walked on the lunar surface on July 20, 1969, while "
                "Michael Collins orbited above in the Command Module."
            ),
            (
                "The International Space Station (ISS) is a modular space station "
                "in low Earth orbit. Construction began in 1998 and it has been "
                "continuously inhabited since November 2, 2000. The ISS orbits Earth "
                "at an average altitude of approximately 408 kilometres."
            ),
            (
                "The Mars Curiosity rover, part of NASA's Mars Science Laboratory "
                "mission, landed on Mars on August 6, 2012. It was designed to "
                "explore the Gale Crater as part of NASA's Mars Exploration Program. "
                "Curiosity is powered by a radioisotope thermoelectric generator."
            ),
            (
                "The Voyager 1 spacecraft, launched on September 5, 1977, became "
                "the first human-made object to reach interstellar space. As of 2024 "
                "it is approximately 23 billion kilometres from the Sun, making it "
                "the most distant human-made object ever."
            ),
        ],
    },
    {
        "title": "World Geography",
        "paragraphs": [
            (
                "The Amazon River is the largest river by water discharge on Earth. "
                "It flows through South America and discharges approximately 209,000 "
                "cubic metres of water per second into the Atlantic Ocean. "
                "The Amazon basin covers over 7 million square kilometres."
            ),
            (
                "Mount Everest is the highest mountain above sea level on Earth, "
                "with its peak standing at 8,848 metres. It is located in the "
                "Himalayas on the border between Nepal and China. The mountain was "
                "first summited by Edmund Hillary and Tenzing Norgay on May 29, 1953."
            ),
            (
                "The Sahara Desert is the world's largest hot desert, covering "
                "approximately 9.2 million square kilometres across 11 countries in "
                "northern Africa. Despite its reputation, only about 25 percent of "
                "the Sahara is covered by sand dunes; the rest is rocky terrain."
            ),
            (
                "Lake Baikal in Siberia, Russia, is the world's deepest lake, "
                "reaching a maximum depth of 1,642 metres. It holds approximately "
                "23,615 cubic kilometres of water — about 20 percent of the world's "
                "unfrozen surface fresh water."
            ),
        ],
    },
    {
        "title": "Historical Inventions",
        "paragraphs": [
            (
                "The World Wide Web was invented by British scientist Tim Berners-Lee "
                "in 1989 while working at CERN in Geneva, Switzerland. He published "
                "a proposal in March 1989 and wrote the first web browser, called "
                "WorldWideWeb, in 1990. The web became publicly available in 1991."
            ),
            (
                "The printing press with movable type was developed by Johannes "
                "Gutenberg around 1440 in Mainz, Germany. His Gutenberg Bible, "
                "completed around 1455, is considered the first major book printed "
                "using this technology in the Western world."
            ),
            (
                "Alexander Graham Bell is credited with patenting the first practical "
                "telephone in 1876. He received US Patent 174,465 on March 7, 1876, "
                "for an apparatus for transmitting vocal or other sounds telegraphically."
            ),
            (
                "The discovery of penicillin is credited to Alexander Fleming, who "
                "noticed in 1928 that a mold called Penicillium notatum had contaminated "
                "one of his petri dishes and was killing the surrounding bacteria. "
                "This observation led to the development of the first antibiotic."
            ),
        ],
    },
    {
        "title": "Climate and Environment",
        "paragraphs": [
            (
                "The Paris Agreement is an international treaty on climate change "
                "adopted in December 2015 at COP21. It entered into force on "
                "November 4, 2016. Its central aim is to limit global warming to "
                "well below 2 degrees Celsius above pre-industrial levels, with "
                "efforts to limit warming to 1.5 degrees Celsius."
            ),
            (
                "The Great Barrier Reef, located in the Coral Sea off the coast of "
                "Queensland, Australia, is the world's largest coral reef system. "
                "It stretches over 2,300 kilometres and comprises over 2,900 "
                "individual reefs and 900 islands."
            ),
            (
                "The ozone layer is a region of Earth's stratosphere that absorbs "
                "most of the Sun's ultraviolet radiation. The Montreal Protocol, "
                "signed in 1987, is an international treaty designed to protect the "
                "ozone layer by phasing out the production of ozone-depleting substances."
            ),
        ],
    },
    {
        "title": "Biology and Medicine",
        "paragraphs": [
            (
                "DNA, or deoxyribonucleic acid, is a molecule that carries the "
                "genetic instructions for the development, functioning, growth, and "
                "reproduction of all known organisms. The double-helix structure of "
                "DNA was described by James Watson and Francis Crick in 1953, with "
                "key contributions from Rosalind Franklin's X-ray diffraction images."
            ),
            (
                "The human body contains approximately 37.2 trillion cells. Of these, "
                "red blood cells are the most numerous, making up about 70 percent of "
                "all cells. An adult human heart beats about 100,000 times per day, "
                "pumping roughly 7,500 litres of blood."
            ),
            (
                "Photosynthesis is the process by which plants, algae, and some "
                "bacteria convert light energy into chemical energy stored as glucose. "
                "The overall equation is: 6CO2 + 6H2O + light energy → C6H12O6 + 6O2. "
                "Chlorophyll, the green pigment in leaves, is essential for capturing light."
            ),
            (
                "The CRISPR-Cas9 gene editing technology was developed by Jennifer "
                "Doudna and Emmanuelle Charpentier, who were awarded the Nobel Prize "
                "in Chemistry in 2020 for this discovery. CRISPR allows scientists to "
                "edit DNA sequences with high precision, enabling potential treatments "
                "for genetic diseases."
            ),
        ],
    },
]


def generate_pdf(output_path: str) -> None:
    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    c = canvas.Canvas(output_path, pagesize=letter)
    width, height = letter

    for page_data in PAGES:
        # Title
        c.setFont("Helvetica-Bold", 14)
        c.drawString(40, height - 50, page_data["title"])

        y = height - 80
        for paragraph in page_data["paragraphs"]:
            # Write paragraph wrapped to fit the page.
            c.setFont("Helvetica", 10)
            words = paragraph.split()
            line = ""
            for word in words:
                test_line = f"{line} {word}".strip()
                # Approximate: 90 chars per line at font size 10 with 40pt margin
                if len(test_line) > 90:
                    c.drawString(40, y, line)
                    y -= 14
                    line = word
                else:
                    line = test_line
            if line:
                c.drawString(40, y, line)
                y -= 14
            y -= 10  # paragraph spacing

            if y < 80:
                # Shouldn't happen with our content, but be safe.
                break

        c.showPage()

    c.save()
    print(f"✓ Sample PDF generated: {output_path}")
    print(f"  Pages: {len(PAGES)}")
    total_paragraphs = sum(len(p["paragraphs"]) for p in PAGES)
    print(f"  Paragraphs: {total_paragraphs}")


if __name__ == "__main__":
    generate_pdf(OUTPUT_PATH)
