import { expect, test } from "bun:test"
import { parseAltiumAscii, serializeAltiumSheetToSvg } from "../../lib"

test("renders a schematic sheet symbol with entries", async () => {
  const source = [
    "|HEADER=Protel for Windows - Schematic Capture Ascii File Version 5.0",
    "|RECORD=31|CUSTOMX=300|CUSTOMY=200|USECUSTOMSHEET=T|FONTNAME1=Arial|SIZE1=8",
    "|RECORD=15|LOCATION.X=60|LOCATION.Y=150|XSIZE=180|YSIZE=100|COLOR=128|AREACOLOR=8454016|ISSOLID=T|UNIQUEID=POWER",
    "|RECORD=32|OWNERINDEX=1|LOCATION.X=60|LOCATION.Y=160|COLOR=8388608|FONTID=1|TEXT=Power Supply",
    "|RECORD=33|OWNERINDEX=1|LOCATION.X=60|LOCATION.Y=150|COLOR=8388608|FONTID=1|TEXT=power.SchDoc",
    "|RECORD=16|OWNERINDEX=1|DISTANCEFROMTOP=3|COLOR=128|AREACOLOR=8454143|TEXTCOLOR=128|TEXTFONTID=1|NAME=VIN|IOTYPE=1",
    "|RECORD=16|OWNERINDEX=1|SIDE=1|DISTANCEFROMTOP=5|COLOR=128|AREACOLOR=8454143|TEXTCOLOR=128|TEXTFONTID=1|NAME=VOUT|IOTYPE=2",
  ].join("\r\n")

  const svg = serializeAltiumSheetToSvg(parseAltiumAscii(source), {
    backgroundColor: "#fff",
    showBorder: false,
  })

  await expect(svg).toMatchSvgSnapshot(import.meta.path)
})
