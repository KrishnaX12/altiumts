import { expect, test } from "bun:test"
import {
  parseAltiumPcbDoc,
  serializeAltiumPcbLayerToSvg,
  serializeAltiumPcbToSvg,
} from "../lib"

const options = {
  showBoardOutline: false,
  viewBox: { x: 0, y: 0, width: 200, height: 200 },
}

test("renders expanded mask openings on the correct pad side without copper outlines or holes", () => {
  const document = parseAltiumPcbDoc(
    [
      "|RECORD=Board",
      "|RECORD=Rule|RULEKIND=SolderMaskExpansion|ENABLED=TRUE|SCOPE1EXPRESSION=All|EXPANSION=3mil",
      "|RECORD=Pad|NAME=top|LAYER=TOP|X=50mil|Y=50mil|XSIZE=20mil|YSIZE=40mil|SHAPE=RECTANGLE|ROTATION=45|SOLDERMASKEXPANSIONMODE=Rule|SOLDERMASKEXPANSION_MANUAL=99mil",
      "|RECORD=Pad|NAME=bottom|LAYER=BOTTOM|X=100mil|Y=50mil|XSIZE=20mil|YSIZE=40mil|SHAPE=RECTANGLE|SOLDERMASKEXPANSIONMODE=Manual|SOLDERMASKEXPANSION_MANUAL=1mil",
      "|RECORD=Pad|NAME=through|LAYER=MULTILAYER|X=150mil|Y=50mil|XSIZE=30mil|YSIZE=30mil|SHAPE=ROUND|HOLESIZE=10mil",
    ].join("\n"),
  )
  const source = document.getString()
  const top = serializeAltiumPcbLayerToSvg(document, "Top Solder", options)
  const bottom = serializeAltiumPcbLayerToSvg(document, "BOTTOMSOLDER", options)
  expect(top).toContain('data-pad-name="top"')
  expect(top).not.toContain('data-pad-name="bottom"')
  expect(top).toContain('width="26" height="46"')
  expect(top).toContain("rotate(-45 50 150)")
  expect(top).toContain('r="18" fill="#4ade80"')
  expect(top).not.toContain("data-hole-shape=")
  expect(top).not.toContain('stroke="#111827"')
  expect(bottom).toContain('data-pad-name="bottom"')
  expect(bottom).not.toContain('data-pad-name="top"')
  expect(bottom).toContain('width="22" height="42"')
  expect(bottom).toContain('data-pad-name="through"')
  expect(document.getString()).toBe(source)
})

test("omits tented and collapsed openings while retaining explicit solder fills", () => {
  const document = parseAltiumPcbDoc(
    [
      "|RECORD=Board",
      "|RECORD=Pad|NAME=tented|LAYER=MULTILAYER|X=30mil|Y=50mil|XSIZE=20mil|YSIZE=20mil|TENTEDTOP=TRUE",
      "|RECORD=Pad|NAME=closed|LAYER=TOP|X=60mil|Y=50mil|XSIZE=20mil|YSIZE=20mil|SOLDERMASKEXPANSIONMODE=Manual|SOLDERMASKEXPANSION_MANUAL=-10mil",
      "|RECORD=Pad|NAME=contracted|LAYER=TOP|X=90mil|Y=50mil|XSIZE=20mil|YSIZE=40mil|SHAPE=RECTANGLE|SOLDERMASKEXPANSIONMODE=Manual|SOLDERMASKEXPANSION_MANUAL=-2mil",
      "|RECORD=Fill|LAYER=TOPSOLDER|X1=10mil|Y1=10mil|X2=20mil|Y2=20mil|ROTATION=45",
      "|RECORD=Via|X=120mil|Y=50mil|DIAMETER=20mil|STARTLAYER=TOP|ENDLAYER=BOTTOM|TENTEDTOP=TRUE",
      "|RECORD=Via|X=150mil|Y=50mil|DIAMETER=20mil|STARTLAYER=MID1|ENDLAYER=MID2",
      "|RECORD=Via|X=180mil|Y=50mil|DIAMETER=20mil|STARTLAYER=TOP|ENDLAYER=MID1",
    ].join("\n"),
  )
  const top = serializeAltiumPcbLayerToSvg(document, "TOPSOLDER", options)
  expect(top).not.toContain('data-pad-name="tented"')
  expect(top).not.toContain('data-pad-name="closed"')
  expect(top).toContain('width="16" height="36"')
  expect(top).toContain('data-record="Fill" data-layer="TOPSOLDER"')
  expect(top.match(/data-record="Via"/g)).toHaveLength(1)
  expect(top).toContain('cx="180" cy="150" r="10"')
  const bottom = serializeAltiumPcbLayerToSvg(document, "BOTTOMSOLDER", options)
  expect(bottom).toContain('data-pad-name="tented"')
  expect(bottom.match(/data-record="Via"/g)).toHaveLength(1)
  expect(bottom).toContain('cx="120" cy="150" r="10"')
})

test("uses bottom pad-stack geometry and expanded bounds for cropping", () => {
  const document = parseAltiumPcbDoc(
    [
      "|RECORD=Board",
      "|RECORD=Pad|NAME=stack|LAYER=MULTILAYER|X=50mil|Y=50mil|PADMODE=1|XSIZE=20mil|YSIZE=20mil|SHAPE=ROUND|BOTTOMXSIZE=40mil|BOTTOMYSIZE=60mil|BOTTOMSHAPE=RECTANGLE|SOLDERMASKEXPANSIONMODE=Manual|SOLDERMASKEXPANSION_MANUAL=2mil",
      "|RECORD=Pad|NAME=edge|LAYER=TOP|X=-15mil|Y=50mil|XSIZE=20mil|YSIZE=20mil|SHAPE=ROUND|SOLDERMASKEXPANSIONMODE=Manual|SOLDERMASKEXPANSION_MANUAL=10mil",
    ].join("\n"),
  )
  const bottom = serializeAltiumPcbLayerToSvg(document, "BOTTOMSOLDER", options)
  expect(bottom).toContain('width="44" height="64"')
  expect(bottom).toContain('data-pad-stack-layer="31"')
  const top = serializeAltiumPcbLayerToSvg(document, "TOPSOLDER", options)
  expect(top).toContain('data-pad-name="edge"')
  expect(top).toContain('cx="-15" cy="150" r="20"')
})

test("honors rule priority and manual expansion without applying unrelated scopes", () => {
  const document = parseAltiumPcbDoc(
    [
      "|RECORD=Board",
      "|RECORD=Rule|RULEKIND=SolderMaskExpansion|ENABLED=FALSE|PRIORITY=0|SCOPE1EXPRESSION=All|EXPANSION=90mil",
      "|RECORD=Rule|RULEKIND=SolderMaskExpansion|PRIORITY=1|SCOPE1EXPRESSION=InNet('unrelated')|EXPANSION=80mil",
      "|RECORD=Rule|RULEKIND=SolderMaskExpansion|PRIORITY=2|SCOPE1EXPRESSION=IsPad|EXPANSION=2mil",
      "|RECORD=Rule|RULEKIND=SolderMaskExpansion|PRIORITY=3|SCOPE1EXPRESSION=All|EXPANSION=3mil",
      "|RECORD=Pad|NAME=rule|LAYER=TOP|X=50mil|Y=50mil|XSIZE=20mil|YSIZE=20mil|SHAPE=ROUND|SOLDERMASKEXPANSIONMODE=Rule",
      "|RECORD=Via|X=100mil|Y=50mil|DIAMETER=20mil",
      "|RECORD=Pad|NAME=manual|LAYER=TOP|X=150mil|Y=50mil|XSIZE=20mil|YSIZE=20mil|SHAPE=ROUND|SOLDERMASKEXPANSIONMODE=Manual|SOLDERMASKEXPANSION_MANUAL=0mil",
    ].join("\n"),
  )
  const svg = serializeAltiumPcbLayerToSvg(document, "TOPSOLDER", options)
  expect(svg).toContain('cx="50" cy="150" r="12"')
  expect(svg).toContain('cx="100" cy="150" r="13"')
  expect(svg).toContain('cx="150" cy="150" r="10"')
})

test("preserves copper rendering and reference filters when adding mask layers", () => {
  const document = parseAltiumPcbDoc(
    [
      "|RECORD=Board",
      "|RECORD=Component|ID=0|SOURCEDESIGNATOR=U1",
      "|RECORD=Net|ID=0|NAME=GND",
      "|RECORD=Net|ID=1|NAME=VCC",
      "|RECORD=Pad|NAME=selected|COMPONENT=0|NET=0|LAYER=TOP|X=50mil|Y=50mil|XSIZE=20mil|YSIZE=20mil|SHAPE=ROUND",
      "|RECORD=Pad|NAME=other|NET=1|LAYER=TOP|X=100mil|Y=50mil|XSIZE=20mil|YSIZE=20mil|SHAPE=ROUND",
    ].join("\n"),
  )
  const copper = serializeAltiumPcbLayerToSvg(document, "TOP", options)
  expect(copper).not.toContain("data-solder-mask-opening=")
  expect(copper).toContain('r="10" fill="#ef4444" stroke="#111827"')
  const svg = serializeAltiumPcbToSvg(document, {
    ...options,
    layers: ["TOP", "TOPSOLDER", "Top Solder", "BOTTOMSOLDER"],
    componentIndices: [0],
    netIndices: [0],
  })
  expect(svg.match(/data-pad-name="selected"/g)).toHaveLength(2)
  expect(svg.match(/data-solder-mask-opening=/g)).toHaveLength(1)
  expect(svg).not.toContain('data-pad-name="other"')
})

test("preserves rounded pad corners on each side without duplicating explicit mask vias", () => {
  const document = parseAltiumPcbDoc(
    [
      "|RECORD=Board",
      "|RECORD=Pad|NAME=rounded|LAYER=MULTILAYER|X=50mil|Y=50mil|PADMODE=1|XSIZE=20mil|YSIZE=40mil|SHAPE=ROUNDRECT|BOTTOMXSIZE=40mil|BOTTOMYSIZE=60mil|LAYER31ALTSHAPE=ROUNDRECT|LAYER31CORNERRADIUS=25|SOLDERMASKEXPANSIONMODE=Manual|SOLDERMASKEXPANSION_MANUAL=2mil",
      "|RECORD=Via|LAYER=TOPSOLDER|X=100mil|Y=50mil|DIAMETER=20mil",
    ].join("\n"),
  )
  const top = serializeAltiumPcbLayerToSvg(document, "TOPSOLDER", options)
  expect(top).toContain('width="24" height="44" rx="5.6" ry="5.6"')
  expect(top.match(/data-record="Via"/g)).toHaveLength(1)
  const bottom = serializeAltiumPcbLayerToSvg(document, "BOTTOMSOLDER", options)
  expect(bottom).toContain('width="44" height="64" rx="7" ry="7"')
  expect(bottom).not.toContain('data-record="Via"')
})
