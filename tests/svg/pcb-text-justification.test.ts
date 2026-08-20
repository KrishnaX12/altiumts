import { expect, test } from "bun:test"
import { parseAltiumPcbDoc, serializeAltiumPcbToSvg } from "../../lib"

const textPlacementExamples = [
  { justification: 1, text: "TL", xMils: 200, yMils: 700 },
  { justification: 4, text: "TC", xMils: 450, yMils: 700 },
  { justification: 7, text: "TR", xMils: 700, yMils: 700 },
  { justification: 2, text: "CL", xMils: 200, yMils: 450 },
  { justification: 5, text: "C", xMils: 450, yMils: 450 },
  { justification: 8, text: "CR", xMils: 700, yMils: 450 },
  { justification: 3, text: "BL", xMils: 200, yMils: 200 },
  { justification: 6, text: "BC", xMils: 450, yMils: 200 },
  { justification: 9, text: "BR", xMils: 700, yMils: 200 },
]

test("snapshots all nine Altium PCB text justification positions", async () => {
  const records = [
    "|RECORD=Board|VX0=0mil|VY0=0mil|VX1=900mil|VY1=0mil|VX2=900mil|VY2=900mil|VX3=0mil|VY3=900mil|VX4=0mil|VY4=0mil",
    ...textPlacementExamples.flatMap(
      ({ justification, text, xMils, yMils }) => [
        `|RECORD=Track|LAYER=TOPOVERLAY|X1=${xMils - 15}mil|Y1=${yMils}mil|X2=${xMils + 15}mil|Y2=${yMils}mil|WIDTH=4mil`,
        `|RECORD=Track|LAYER=TOPOVERLAY|X1=${xMils}mil|Y1=${yMils - 15}mil|X2=${xMils}mil|Y2=${yMils + 15}mil|WIDTH=4mil`,
        `|RECORD=Text|LAYER=TOPOVERLAY|X=${xMils}mil|Y=${yMils}mil|HEIGHT=50mil|JUSTIFICATION=${justification}|TEXT=${text}`,
      ],
    ),
  ]
  const svg = serializeAltiumPcbToSvg(parseAltiumPcbDoc(records.join("\n")), {
    title: "Altium PCB text justification",
  })

  await expect(svg).toMatchSvgSnapshot(import.meta.path)
})
