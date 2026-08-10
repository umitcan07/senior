"""EXMARaLDA basic-transcription (`.exb`) parser.

Schema verified against the upstream DTD (`src/build/misc/dtd/1.4/
basic-transcription.dtd` in Exmaralda-Org/exmaralda):

    basic-transcription
      head
        meta-information  (project-name, transcription-name,
                           referenced-file[url], ud-meta-information, ...)
        speakertable
          speaker[id]     (abbreviation, sex[value=m|f|u], languages-used,
                           l1, l2, ud-speaker-information, comment)
      basic-body
        common-timeline   (tli[id, time, type])
        tier[id, speaker, category, display-name, type=(t|d|a|l|u)]
          event[start, end]  -> references tli ids

Two things matter for the site:

* **Speaker metadata lives here**, not only in `.coma` — `sex`, `l1`, `l2` plus
  arbitrary `ud-information` key/value pairs (the Dulko learner-corpus template
  uses `age`, `learner_level_CEFR_conversion`, `L2_study_years`, …). We surface
  whatever keys are actually present rather than assuming a fixed set.
* **`tier@type="a"` is an annotation tier.** If the corpus carries hand-made
  error annotation, that is where it is, and `tier@category` is the name EXAKT
  filters on. `parse_exb` keeps every tier so the caller can decide.

Timeline items may omit `@time` (unanchored). Callers that need absolute times
should use `Transcription.event_times`, which interpolates across unanchored
items between two anchored ones.
"""

from __future__ import annotations

import xml.etree.ElementTree as ET
from dataclasses import dataclass, field
from pathlib import Path


@dataclass
class Speaker:
    id: str
    abbreviation: str = ""
    sex: str = "u"  # m | f | u
    l1: list[str] = field(default_factory=list)
    l2: list[str] = field(default_factory=list)
    languages_used: list[str] = field(default_factory=list)
    ud: dict[str, str] = field(default_factory=dict)
    comment: str = ""


@dataclass(frozen=True)
class Event:
    start: str  # tli id
    end: str  # tli id
    text: str


@dataclass
class ExbTier:
    id: str
    category: str
    type: str  # t | d | a | l | u
    speaker: str | None = None
    display_name: str | None = None
    events: list[Event] = field(default_factory=list)

    @property
    def is_annotation(self) -> bool:
        return self.type == "a"

    @property
    def is_transcription(self) -> bool:
        return self.type == "t"


@dataclass
class Transcription:
    path: Path
    project_name: str = ""
    transcription_name: str = ""
    referenced_files: list[str] = field(default_factory=list)
    ud: dict[str, str] = field(default_factory=dict)
    speakers: dict[str, Speaker] = field(default_factory=dict)
    timeline: dict[str, float | None] = field(default_factory=dict)
    tier_list: list[ExbTier] = field(default_factory=list)

    def tiers(self, *, type: str | None = None, category: str | None = None) -> list[ExbTier]:
        out = self.tier_list
        if type is not None:
            out = [t for t in out if t.type == type]
        if category is not None:
            out = [t for t in out if t.category.lower() == category.lower()]
        return out

    def anchored_timeline(self) -> dict[str, float]:
        """Timeline with unanchored items linearly interpolated.

        EXMARaLDA only requires `@time` on some `<tli>`; the rest inherit their
        position from the surrounding anchors. Leading/trailing unanchored runs
        are clamped to the nearest known anchor.
        """
        ids = list(self.timeline)
        times = [self.timeline[i] for i in ids]
        known = [(idx, t) for idx, t in enumerate(times) if t is not None]
        if not known:
            return {}

        out: dict[str, float] = {}
        for idx, tid in enumerate(ids):
            t = times[idx]
            if t is not None:
                out[tid] = t
                continue
            before = [k for k in known if k[0] < idx]
            after = [k for k in known if k[0] > idx]
            if before and after:
                (i0, t0), (i1, t1) = before[-1], after[0]
                span = i1 - i0
                out[tid] = t0 + (t1 - t0) * ((idx - i0) / span) if span else t0
            elif before:
                out[tid] = before[-1][1]
            else:
                out[tid] = after[0][1]
        return out

    def event_times(self, event: Event) -> tuple[float, float] | None:
        anchored = self.anchored_timeline()
        t0 = anchored.get(event.start)
        t1 = anchored.get(event.end)
        if t0 is None or t1 is None:
            return None
        return (t0, t1)


def _text(node: ET.Element | None) -> str:
    if node is None or node.text is None:
        return ""
    return node.text.strip()


def _ud(node: ET.Element | None) -> dict[str, str]:
    """Collect `<ud-information attribute-name="k">v</ud-information>` pairs."""
    if node is None:
        return {}
    out: dict[str, str] = {}
    for item in node.findall("ud-information"):
        key = item.get("attribute-name")
        if not key:
            continue
        value = (item.text or "").strip()
        if value:
            out[key] = value
    return out


def _languages(node: ET.Element | None) -> list[str]:
    if node is None:
        return []
    return [
        lang.get("lang", "").strip()
        for lang in node.findall("language")
        if lang.get("lang")
    ]


def parse_exb(path: Path) -> Transcription:
    root = ET.parse(path).getroot()
    tr = Transcription(path=path)

    head = root.find("head")
    if head is not None:
        meta = head.find("meta-information")
        if meta is not None:
            tr.project_name = _text(meta.find("project-name"))
            tr.transcription_name = _text(meta.find("transcription-name"))
            tr.referenced_files = [
                rf.get("url", "")
                for rf in meta.findall("referenced-file")
                if rf.get("url")
            ]
            tr.ud = _ud(meta.find("ud-meta-information"))

        table = head.find("speakertable")
        if table is not None:
            for sp in table.findall("speaker"):
                sid = sp.get("id") or ""
                sex_node = sp.find("sex")
                tr.speakers[sid] = Speaker(
                    id=sid,
                    abbreviation=_text(sp.find("abbreviation")),
                    sex=(sex_node.get("value") if sex_node is not None else "u") or "u",
                    l1=_languages(sp.find("l1")),
                    l2=_languages(sp.find("l2")),
                    languages_used=_languages(sp.find("languages-used")),
                    ud=_ud(sp.find("ud-speaker-information")),
                    comment=_text(sp.find("comment")),
                )

    body = root.find("basic-body")
    if body is not None:
        tl = body.find("common-timeline")
        if tl is not None:
            for tli in tl.findall("tli"):
                tid = tli.get("id")
                if not tid:
                    continue
                raw = tli.get("time")
                tr.timeline[tid] = float(raw) if raw not in (None, "") else None

        for tier in body.findall("tier"):
            events = []
            for ev in tier.findall("event"):
                # Event text may be interleaved with <ud-information> children;
                # itertext() would swallow those, so take direct text only.
                events.append(
                    Event(
                        start=ev.get("start") or "",
                        end=ev.get("end") or "",
                        text=(ev.text or "").strip(),
                    )
                )
            tr.tier_list.append(
                ExbTier(
                    id=tier.get("id") or "",
                    category=tier.get("category") or "",
                    type=tier.get("type") or "t",
                    speaker=tier.get("speaker"),
                    display_name=tier.get("display-name"),
                    events=events,
                )
            )

    return tr


def describe(path: Path) -> str:
    """One-screen summary of an .exb — used by the verification script."""
    tr = parse_exb(path)
    lines = [
        f"{path.name}",
        f"  project           : {tr.project_name or '-'}",
        f"  transcription     : {tr.transcription_name or '-'}",
        f"  referenced files  : {', '.join(tr.referenced_files) or '-'}",
        f"  corpus ud keys    : {', '.join(sorted(tr.ud)) or '(none)'}",
        f"  speakers          : {len(tr.speakers)}",
    ]
    for sp in tr.speakers.values():
        meta = ", ".join(f"{k}={v}" for k, v in sorted(sp.ud.items())) or "(no ud keys)"
        lines.append(
            f"    {sp.id} abbr={sp.abbreviation or '-'} sex={sp.sex} "
            f"l1={'/'.join(sp.l1) or '-'} :: {meta}"
        )
    lines.append(f"  timeline items    : {len(tr.timeline)}")
    lines.append(f"  tiers             : {len(tr.tier_list)}")
    for t in tr.tier_list:
        lines.append(
            f"    [{t.type}] category={t.category!r} "
            f"display={t.display_name!r} events={len(t.events)}"
        )
    return "\n".join(lines)
