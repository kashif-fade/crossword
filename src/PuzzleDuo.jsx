import { useState, useEffect, useMemo, useCallback } from "react";

// ---------------------------------------------------------------
// THEME
// ---------------------------------------------------------------
const T = {
  page: "#EDF1F2",
  panel: "#FFFFFF",
  ink: "#22313A",
  inkSoft: "#5C6B74",
  line: "#C7D0D4",
  accent: "#106B5D",
  accentSoft: "#DCEBE5",
  accentSel: "#A9D8CB",
  wrongBg: "#F6DCD5",
  wrongInk: "#B03A22",
  block: "#22313A",
};

// ---------------------------------------------------------------
// CROSSWORD DATA — 5x5 mini, verified grid
//   . . C A T
//   . L A V A
//   W I D E N
//   O V E R .
//   N E T . .
// ---------------------------------------------------------------
const CW_SIZE = 5;
const CW_SOLUTION = [
  [null, null, "C", "A", "T"],
  [null, "L", "A", "V", "A"],
  ["W", "I", "D", "E", "N"],
  ["O", "V", "E", "R", null],
  ["N", "E", "T", null, null],
];
const CW_NUMBERS = { "0,2": 1, "0,3": 2, "0,4": 3, "1,1": 4, "2,0": 5, "3,0": 6, "4,0": 7 };
const CW_CLUES = {
  across: [
    { num: 1, row: 0, col: 2, len: 3, clue: "Whiskered house pet" },
    { num: 4, row: 1, col: 1, len: 4, clue: "Molten rock from a volcano" },
    { num: 5, row: 2, col: 0, len: 5, clue: "Make broader, as a road" },
    { num: 6, row: 3, col: 0, len: 4, clue: "Set of six balls, in cricket" },
    { num: 7, row: 4, col: 0, len: 3, clue: "Court divider in badminton" },
  ],
  down: [
    { num: 1, row: 0, col: 2, len: 5, clue: "Military academy trainee" },
    { num: 2, row: 0, col: 3, len: 4, clue: "State as fact" },
    { num: 3, row: 0, col: 4, len: 3, clue: "Souvenir from a beach day" },
    { num: 4, row: 1, col: 1, len: 4, clue: "Airing as it happens" },
    { num: 5, row: 2, col: 0, len: 3, clue: "Finished first" },
  ],
};

const isBlock = (r, c) => CW_SOLUTION[r][c] === null;

function wordCells(r, c, dir) {
  if (isBlock(r, c)) return [];
  const dr = dir === "down" ? 1 : 0;
  const dc = dir === "across" ? 1 : 0;
  let sr = r, sc = c;
  while (sr - dr >= 0 && sc - dc >= 0 && !isBlock(sr - dr, sc - dc)) { sr -= dr; sc -= dc; }
  const cells = [];
  let cr = sr, cc = sc;
  while (cr < CW_SIZE && cc < CW_SIZE && !isBlock(cr, cc)) { cells.push([cr, cc]); cr += dr; cc += dc; }
  return cells;
}

// ---------------------------------------------------------------
// SUDOKU GENERATOR
// ---------------------------------------------------------------
function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function sdValid(g, idx, v) {
  const r = Math.floor(idx / 9), c = idx % 9;
  for (let i = 0; i < 9; i++) {
    if (g[r * 9 + i] === v || g[i * 9 + c] === v) return false;
  }
  const br = r - (r % 3), bc = c - (c % 3);
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 3; j++)
      if (g[(br + i) * 9 + bc + j] === v) return false;
  return true;
}
function sdFindEmpty(g) {
  for (let i = 0; i < 81; i++) if (g[i] === 0) return i;
  return -1;
}
function sdPeers(idx) {
  const r = Math.floor(idx / 9), c = idx % 9;
  const br = r - (r % 3), bc = c - (c % 3);
  const peers = new Set();
  for (let i = 0; i < 9; i++) {
    peers.add(r * 9 + i);
    peers.add(i * 9 + c);
  }
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 3; j++)
      peers.add((br + i) * 9 + (bc + j));
  peers.delete(idx);
  return [...peers];
}
function sdFill(g) {
  const idx = sdFindEmpty(g);
  if (idx < 0) return true;
  for (const v of shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9])) {
    if (sdValid(g, idx, v)) {
      g[idx] = v;
      if (sdFill(g)) return true;
      g[idx] = 0;
    }
  }
  return false;
}
function sdCountSolutions(g, limit) {
  const idx = sdFindEmpty(g);
  if (idx < 0) return 1;
  let count = 0;
  for (let v = 1; v <= 9; v++) {
    if (sdValid(g, idx, v)) {
      g[idx] = v;
      count += sdCountSolutions(g, limit - count);
      g[idx] = 0;
      if (count >= limit) return count;
    }
  }
  return count;
}
const SD_TARGETS = { easy: 40, medium: 32, hard: 26 };
function sdGenerate(difficulty) {
  const g = new Array(81).fill(0);
  sdFill(g);
  const solution = [...g];
  let givens = 81;
  const target = SD_TARGETS[difficulty];
  for (const p of shuffle([...Array(81).keys()])) {
    if (givens <= target) break;
    const backup = g[p];
    g[p] = 0;
    if (sdCountSolutions([...g], 2) !== 1) g[p] = backup;
    else givens--;
  }
  return { puzzle: [...g], solution };
}

// ---------------------------------------------------------------
// SHARED SMALL COMPONENTS
// ---------------------------------------------------------------
function Btn({ children, onClick, primary, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: "8px 16px",
        borderRadius: 8,
        border: primary ? "none" : `1px solid ${T.line}`,
        background: primary ? T.accent : T.panel,
        color: primary ? "#fff" : T.ink,
        fontSize: 14,
        fontWeight: 600,
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.5 : 1,
        fontFamily: "inherit",
      }}
    >
      {children}
    </button>
  );
}

function Banner({ children }) {
  return (
    <div
      style={{
        background: T.accentSoft,
        color: T.accent,
        border: `1px solid ${T.accentSel}`,
        borderRadius: 10,
        padding: "10px 16px",
        fontWeight: 700,
        textAlign: "center",
        marginBottom: 16,
      }}
    >
      {children}
    </div>
  );
}

// ---------------------------------------------------------------
// CROSSWORD TAB
// ---------------------------------------------------------------
function Crossword() {
  const empty = () => CW_SOLUTION.map((row) => row.map((c) => (c === null ? null : "")));
  const [grid, setGrid] = useState(empty);
  const [sel, setSel] = useState({ r: 2, c: 0 });
  const [dir, setDir] = useState("across");
  const [wrong, setWrong] = useState(new Set());

  const activeCells = useMemo(() => wordCells(sel.r, sel.c, dir), [sel, dir]);
  const activeKey = new Set(activeCells.map(([r, c]) => `${r},${c}`));

  const solved = useMemo(
    () =>
      grid.every((row, r) =>
        row.every((v, c) => CW_SOLUTION[r][c] === null || v === CW_SOLUTION[r][c])
      ),
    [grid]
  );

  const activeClue = useMemo(() => {
    if (!activeCells.length) return null;
    const [sr, sc] = activeCells[0];
    return CW_CLUES[dir].find((cl) => cl.row === sr && cl.col === sc) || null;
  }, [activeCells, dir]);

  const setCell = (r, c, val) => {
    setGrid((g) => {
      const n = g.map((row) => [...row]);
      n[r][c] = val;
      return n;
    });
    setWrong((w) => {
      if (!w.has(`${r},${c}`)) return w;
      const n = new Set(w);
      n.delete(`${r},${c}`);
      return n;
    });
  };

  const move = useCallback(
    (dr, dc) => {
      setSel((s) => {
        let { r, c } = s;
        for (let i = 0; i < CW_SIZE; i++) {
          r = Math.min(CW_SIZE - 1, Math.max(0, r + dr));
          c = Math.min(CW_SIZE - 1, Math.max(0, c + dc));
          if (!isBlock(r, c)) return { r, c };
          if ((dr > 0 && r === CW_SIZE - 1) || (dr < 0 && r === 0)) break;
          if ((dc > 0 && c === CW_SIZE - 1) || (dc < 0 && c === 0)) break;
        }
        return s;
      });
    },
    []
  );

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "ArrowUp") { setDir("down"); move(-1, 0); e.preventDefault(); }
      else if (e.key === "ArrowDown") { setDir("down"); move(1, 0); e.preventDefault(); }
      else if (e.key === "ArrowLeft") { setDir("across"); move(0, -1); e.preventDefault(); }
      else if (e.key === "ArrowRight") { setDir("across"); move(0, 1); e.preventDefault(); }
      else if (/^[a-zA-Z]$/.test(e.key)) {
        const { r, c } = sel;
        if (!isBlock(r, c)) {
          setCell(r, c, e.key.toUpperCase());
          const idx = activeCells.findIndex(([ar, ac]) => ar === r && ac === c);
          if (idx >= 0 && idx < activeCells.length - 1) {
            const [nr, nc] = activeCells[idx + 1];
            setSel({ r: nr, c: nc });
          }
        }
        e.preventDefault();
      } else if (e.key === "Backspace") {
        const { r, c } = sel;
        if (grid[r][c]) setCell(r, c, "");
        else {
          const idx = activeCells.findIndex(([ar, ac]) => ar === r && ac === c);
          if (idx > 0) {
            const [pr, pc] = activeCells[idx - 1];
            setSel({ r: pr, c: pc });
            setCell(pr, pc, "");
          }
        }
        e.preventDefault();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sel, activeCells, grid, move]);

  const clickCell = (r, c) => {
    if (isBlock(r, c)) return;
    if (sel.r === r && sel.c === c) setDir((d) => (d === "across" ? "down" : "across"));
    else setSel({ r, c });
  };

  const clickClue = (cl, d) => {
    setDir(d);
    const cells = wordCells(cl.row, cl.col, d);
    const firstEmpty = cells.find(([r, c]) => !grid[r][c]);
    const [r, c] = firstEmpty || cells[0];
    setSel({ r, c });
  };

  const check = () => {
    const w = new Set();
    grid.forEach((row, r) =>
      row.forEach((v, c) => {
        if (CW_SOLUTION[r][c] !== null && v && v !== CW_SOLUTION[r][c]) w.add(`${r},${c}`);
      })
    );
    setWrong(w);
  };

  const reveal = () => {
    setGrid(CW_SOLUTION.map((row) => row.map((c) => (c === null ? null : c))));
    setWrong(new Set());
  };

  const clear = () => {
    setGrid(empty());
    setWrong(new Set());
  };

  const cellSize = "min(60px, 16vw)";

  return (
    <div>
      {solved && <Banner>Solved — nicely done.</Banner>}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 24, alignItems: "flex-start" }}>
        {/* Grid */}
        <div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${CW_SIZE}, ${cellSize})`,
              border: `2px solid ${T.ink}`,
              width: "fit-content",
              background: T.ink,
              gap: 1,
            }}
          >
            {CW_SOLUTION.map((row, r) =>
              row.map((_, c) => {
                const key = `${r},${c}`;
                const block = isBlock(r, c);
                const isSel = sel.r === r && sel.c === c;
                const inWord = activeKey.has(key);
                const isWrong = wrong.has(key);
                return (
                  <div
                    key={key}
                    onClick={() => clickCell(r, c)}
                    style={{
                      width: cellSize,
                      height: cellSize,
                      background: block
                        ? T.block
                        : isSel
                        ? T.accentSel
                        : isWrong
                        ? T.wrongBg
                        : inWord
                        ? T.accentSoft
                        : T.panel,
                      position: "relative",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: block ? "default" : "pointer",
                      fontSize: "clamp(18px, 6vw, 26px)",
                      fontWeight: 700,
                      color: isWrong ? T.wrongInk : T.ink,
                      userSelect: "none",
                    }}
                  >
                    {CW_NUMBERS[key] && (
                      <span
                        style={{
                          position: "absolute",
                          top: 2,
                          left: 4,
                          fontSize: 10,
                          fontWeight: 600,
                          color: T.inkSoft,
                        }}
                      >
                        {CW_NUMBERS[key]}
                      </span>
                    )}
                    {!block && grid[r][c]}
                  </div>
                );
              })
            )}
          </div>

          {activeClue && (
            <div
              style={{
                marginTop: 12,
                padding: "8px 12px",
                background: T.accentSoft,
                borderRadius: 8,
                fontSize: 14,
                maxWidth: 320,
              }}
            >
              <strong>
                {activeClue.num}
                {dir === "across" ? "A" : "D"}.
              </strong>{" "}
              {activeClue.clue}
            </div>
          )}

          <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
            <Btn onClick={check}>Check</Btn>
            <Btn onClick={reveal}>Reveal</Btn>
            <Btn onClick={clear}>Clear</Btn>
          </div>
        </div>

        {/* Clues */}
        <div style={{ display: "flex", gap: 32, flexWrap: "wrap" }}>
          {["across", "down"].map((d) => (
            <div key={d} style={{ minWidth: 200 }}>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  color: T.inkSoft,
                  marginBottom: 8,
                }}
              >
                {d}
              </div>
              {CW_CLUES[d].map((cl) => {
                const isActive =
                  activeClue &&
                  dir === d &&
                  activeClue.num === cl.num;
                return (
                  <div
                    key={cl.num}
                    onClick={() => clickClue(cl, d)}
                    style={{
                      padding: "6px 8px",
                      borderRadius: 6,
                      cursor: "pointer",
                      fontSize: 14,
                      background: isActive ? T.accentSoft : "transparent",
                      borderLeft: isActive
                        ? `3px solid ${T.accent}`
                        : "3px solid transparent",
                      marginBottom: 2,
                    }}
                  >
                    <strong>{cl.num}.</strong> {cl.clue}{" "}
                    <span style={{ color: T.inkSoft, fontSize: 12 }}>({cl.len})</span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <p style={{ fontSize: 13, color: T.inkSoft, marginTop: 20 }}>
        Type to fill, arrow keys to move, tap a cell twice to switch direction.
        One hand-built mini for now — the full version would draw from a
        generated puzzle bank.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------
// SUDOKU TAB
// ---------------------------------------------------------------
function Sudoku() {
  const [difficulty, setDifficulty] = useState("medium");
  const [game, setGame] = useState(() => sdGenerate("medium"));
  const [grid, setGrid] = useState(() => [...game.puzzle]);
  // pencil[i] is a Set of candidate numbers (1-9) marked in that cell
  const [pencil, setPencil] = useState(() => Array.from({ length: 81 }, () => new Set()));
  const [mode, setMode] = useState("pen"); // "pen" | "pencil"
  const [sel, setSel] = useState(null);
  const [wrong, setWrong] = useState(new Set());
  const [generating, setGenerating] = useState(false);

  const newGame = (diff) => {
    setGenerating(true);
    setDifficulty(diff);
    // let the button state paint before the (brief) generation work
    setTimeout(() => {
      const g = sdGenerate(diff);
      setGame(g);
      setGrid([...g.puzzle]);
      setPencil(Array.from({ length: 81 }, () => new Set()));
      setSel(null);
      setWrong(new Set());
      setGenerating(false);
    }, 30);
  };

  const solved = useMemo(
    () => grid.every((v, i) => v === game.solution[i]),
    [grid, game]
  );

  const setValue = useCallback(
    (v) => {
      if (sel === null || game.puzzle[sel] !== 0) return;
      setGrid((g) => {
        const n = [...g];
        n[sel] = v;
        return n;
      });
      setPencil((p) => {
        const n = [...p];
        // entering (or clearing) a final digit wipes that cell's own notes
        n[sel] = new Set();
        // and removes that digit from notes in the same row/col/box,
        // since it's no longer a valid candidate there
        if (v !== 0) {
          for (const peer of sdPeers(sel)) {
            if (n[peer].has(v)) {
              const s = new Set(n[peer]);
              s.delete(v);
              n[peer] = s;
            }
          }
        }
        return n;
      });
      setWrong((w) => {
        if (!w.has(sel)) return w;
        const n = new Set(w);
        n.delete(sel);
        return n;
      });
    },
    [sel, game]
  );

  const togglePencil = useCallback(
    (v) => {
      if (sel === null || game.puzzle[sel] !== 0 || grid[sel] !== 0) return;
      setPencil((p) => {
        const n = [...p];
        const s = new Set(n[sel]);
        if (s.has(v)) s.delete(v);
        else s.add(v);
        n[sel] = s;
        return n;
      });
    },
    [sel, game, grid]
  );

  const enterDigit = useCallback(
    (v) => {
      if (mode === "pencil") togglePencil(v);
      else setValue(v);
    },
    [mode, togglePencil, setValue]
  );

  useEffect(() => {
    const onKey = (e) => {
      if (sel === null) return;
      if (/^[1-9]$/.test(e.key)) {
        const n = parseInt(e.key, 10);
        if (e.shiftKey) togglePencil(n);
        else setValue(n);
        e.preventDefault();
      } else if (e.key === "Backspace" || e.key === "Delete" || e.key === "0") {
        setValue(0);
        e.preventDefault();
      } else if (e.key === "ArrowUp") { setSel((s) => (s >= 9 ? s - 9 : s)); e.preventDefault(); }
      else if (e.key === "ArrowDown") { setSel((s) => (s < 72 ? s + 9 : s)); e.preventDefault(); }
      else if (e.key === "ArrowLeft") { setSel((s) => (s % 9 > 0 ? s - 1 : s)); e.preventDefault(); }
      else if (e.key === "ArrowRight") { setSel((s) => (s % 9 < 8 ? s + 1 : s)); e.preventDefault(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sel, setValue, togglePencil]);

  const check = () => {
    const w = new Set();
    grid.forEach((v, i) => {
      if (v !== 0 && game.puzzle[i] === 0 && v !== game.solution[i]) w.add(i);
    });
    setWrong(w);
  };

  const selRow = sel !== null ? Math.floor(sel / 9) : -1;
  const selCol = sel !== null ? sel % 9 : -1;
  const selVal = sel !== null ? grid[sel] : 0;

  return (
    <div>
      {solved && <Banner>Solved — grid complete and correct.</Banner>}

      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
        <span style={{ fontSize: 13, color: T.inkSoft, fontWeight: 600 }}>New puzzle:</span>
        {["easy", "medium", "hard"].map((d) => (
          <Btn key={d} onClick={() => newGame(d)} primary={difficulty === d} disabled={generating}>
            {d[0].toUpperCase() + d.slice(1)}
          </Btn>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <span style={{ fontSize: 13, color: T.inkSoft, fontWeight: 600 }}>Input:</span>
        <Btn onClick={() => setMode("pen")} primary={mode === "pen"}>
          ✎ Final
        </Btn>
        <Btn onClick={() => setMode("pencil")} primary={mode === "pencil"}>
          ⚬ Notes
        </Btn>
        <span style={{ fontSize: 12, color: T.inkSoft }}>
          (or hold Shift while typing a number for a quick note)
        </span>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 24, alignItems: "flex-start" }}>
        <div style={{ width: "min(440px, 94vw)" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(9, 1fr)",
              border: `2px solid ${T.ink}`,
              background: T.panel,
              width: "100%",
              opacity: generating ? 0.4 : 1,
            }}
          >
            {grid.map((v, i) => {
              const r = Math.floor(i / 9), c = i % 9;
              const given = game.puzzle[i] !== 0;
              const isSel = sel === i;
              const inLine =
                sel !== null &&
                (r === selRow || c === selCol ||
                  (Math.floor(r / 3) === Math.floor(selRow / 3) &&
                    Math.floor(c / 3) === Math.floor(selCol / 3)));
              const sameVal = selVal !== 0 && v === selVal && !isSel;
              const isWrong = wrong.has(i);
              const notes = pencil[i];
              return (
                <div
                  key={i}
                  onClick={() => setSel(i)}
                  style={{
                    aspectRatio: "1",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "clamp(16px, 4vw, 22px)",
                    fontWeight: given ? 700 : 600,
                    color: isWrong ? T.wrongInk : given ? T.ink : T.accent,
                    background: isSel
                      ? T.accentSel
                      : isWrong
                      ? T.wrongBg
                      : sameVal
                      ? T.accentSoft
                      : inLine
                      ? "#F2F6F5"
                      : T.panel,
                    borderRight:
                      c === 8 ? "none" : c % 3 === 2 ? `2px solid ${T.ink}` : `1px solid ${T.line}`,
                    borderBottom:
                      r === 8 ? "none" : r % 3 === 2 ? `2px solid ${T.ink}` : `1px solid ${T.line}`,
                    cursor: "pointer",
                    userSelect: "none",
                  }}
                >
                  {v !== 0 ? (
                    v
                  ) : notes && notes.size > 0 ? (
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(3, 1fr)",
                        gridTemplateRows: "repeat(3, 1fr)",
                        width: "100%",
                        height: "100%",
                        padding: "2px",
                      }}
                    >
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                        <div
                          key={n}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "clamp(7px, 2vw, 10px)",
                            fontWeight: 600,
                            color: T.inkSoft,
                          }}
                        >
                          {notes.has(n) ? n : ""}
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>

          {/* number pad */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(10, 1fr)",
              gap: 6,
              marginTop: 12,
            }}
          >
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
              <button
                key={n}
                onClick={() => enterDigit(n)}
                style={{
                  aspectRatio: "1",
                  borderRadius: 8,
                  border: `1px solid ${T.line}`,
                  background: T.panel,
                  fontSize: 18,
                  fontWeight: 700,
                  color: T.ink,
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                {n}
              </button>
            ))}
            <button
              onClick={() => setValue(0)}
              style={{
                aspectRatio: "1",
                borderRadius: 8,
                border: `1px solid ${T.line}`,
                background: T.panel,
                fontSize: 14,
                color: T.inkSoft,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              ⌫
            </button>
          </div>

          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <Btn onClick={check}>Check</Btn>
            <Btn
              onClick={() => {
                setGrid([...game.solution]);
                setWrong(new Set());
              }}
            >
              Reveal
            </Btn>
          </div>
        </div>
      </div>

      <p style={{ fontSize: 13, color: T.inkSoft, marginTop: 20 }}>
        Every puzzle is generated fresh with a single-solution guarantee.
        Difficulty sets the number of starting clues ({SD_TARGETS.easy} /{" "}
        {SD_TARGETS.medium} / {SD_TARGETS.hard} givens).
      </p>
    </div>
  );
}

// ---------------------------------------------------------------
// APP SHELL
// ---------------------------------------------------------------
export default function PuzzleDuo() {
  const [tab, setTab] = useState("crossword");

  return (
    <div
      style={{
        minHeight: "100vh",
        background: T.page,
        color: T.ink,
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        padding: "24px 16px 48px",
      }}
    >
      <div style={{ maxWidth: 860, margin: "0 auto" }}>
        <header style={{ marginBottom: 20 }}>
          <h1
            style={{
              fontFamily: "Georgia, 'Times New Roman', serif",
              fontSize: "clamp(26px, 5vw, 34px)",
              margin: 0,
              letterSpacing: "-0.01em",
            }}
          >
            The Daily Duo
          </h1>
          <p style={{ margin: "4px 0 0", color: T.inkSoft, fontSize: 14 }}>
            One crossword, one sudoku. Demo build — local play only.
          </p>
        </header>

        {/* Tabs styled as crossword cells */}
        <div style={{ display: "flex", gap: 1, marginBottom: 24, background: T.ink, width: "fit-content", border: `2px solid ${T.ink}` }}>
          {[
            { id: "crossword", label: "Crossword", num: 1 },
            { id: "sudoku", label: "Sudoku", num: 2 },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                position: "relative",
                padding: "14px 26px 10px",
                border: "none",
                background: tab === t.id ? T.accentSel : T.panel,
                color: T.ink,
                fontSize: 15,
                fontWeight: 700,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              <span
                style={{
                  position: "absolute",
                  top: 3,
                  left: 6,
                  fontSize: 10,
                  fontWeight: 600,
                  color: T.inkSoft,
                }}
              >
                {t.num}
              </span>
              {t.label}
            </button>
          ))}
        </div>

        {tab === "crossword" ? <Crossword /> : <Sudoku />}
      </div>
    </div>
  );
}
